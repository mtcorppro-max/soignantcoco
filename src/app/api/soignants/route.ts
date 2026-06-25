import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estEmailAdmin } from "@/lib/admin";

type RolePro = "coordinatrice" | "chirurgien" | "delegue";
const ROLES: RolePro[] = ["coordinatrice", "chirurgien", "delegue"];

// Génère un mot de passe lisible (sans caractères ambigus).
function genererMotDePasse(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

function intOuNull(v: unknown): number | null {
  const n = Number(v);
  return v != null && v !== "" && isFinite(n) ? Math.trunc(n) : null;
}
function texteOuNull(v: unknown): string | null {
  const s = (v ?? "").toString().trim();
  return s || null;
}

// Création d'un compte soignant (coordinatrice / chirurgien / délégué) par la
// coordinatrice. Provisionne le compte Auth + la ligne professionnel.
// Pour un chirurgien/médecin : enregistre aussi les consignes (coordonnées,
// secrétariat, protocole, durée et nombre de suivis).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const nom = texteOuNull(body.nom);
  const email = texteOuNull(body.email)?.toLowerCase() ?? null;
  const role = (body.role ?? "") as RolePro;

  // Autorisation : un admin (allowlist) peut créer dans n'importe quel
  // prestataire ; une coordinatrice uniquement dans le sien.
  const { data: pro } = await supabase
    .from("professionnel")
    .select("role, prestataire_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const admin_ = estEmailAdmin(user.email);
  let prestataireId: string | null = null;
  if (admin_) {
    prestataireId = texteOuNull(body.prestataire_id);
    if (!prestataireId) {
      return NextResponse.json({ message: "Prestataire requis." }, { status: 400 });
    }
  } else if (pro?.role === "coordinatrice") {
    prestataireId = pro.prestataire_id;
  } else {
    return NextResponse.json(
      { message: "Seuls un administrateur ou la coordinatrice peuvent créer un compte soignant." },
      { status: 403 }
    );
  }

  if (!nom) return NextResponse.json({ message: "Nom requis." }, { status: 400 });
  if (!email) return NextResponse.json({ message: "Email requis." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ message: "Rôle invalide." }, { status: 400 });

  const motDePasse = texteOuNull(body.motDePasse) ?? genererMotDePasse();
  if (motDePasse.length < 8) {
    return NextResponse.json({ message: "Le mot de passe doit faire au moins 8 caractères." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Compte Auth
  const { data: created, error: errUser } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { type: "pro" },
  });
  if (errUser || !created.user) {
    const dejaPris = (errUser?.message ?? "").toLowerCase().includes("already");
    return NextResponse.json(
      { message: dejaPris ? "Un compte existe déjà avec cet email." : "Échec de création du compte." },
      { status: dejaPris ? 409 : 500 }
    );
  }

  // 2. Ligne professionnel
  const extras =
    role === "chirurgien"
      ? {
          titre: texteOuNull(body.titre),
          prenom: texteOuNull(body.prenom),
          specialite: texteOuNull(body.specialite),
          cabinets: texteOuNull(body.cabinets),
          telephone: texteOuNull(body.telephone),
          secretariat_nom: texteOuNull(body.secretariat_nom),
          secretariat_email: texteOuNull(body.secretariat_email),
          secretariat_tel: texteOuNull(body.secretariat_tel),
          protocole: texteOuNull(body.protocole),
          duree_prise_en_charge: intOuNull(body.duree_prise_en_charge),
          jours_suivi: Array.isArray(body.jours_suivi) && body.jours_suivi.length > 0 ? body.jours_suivi : null,
          molecules: Array.isArray(body.molecules) && body.molecules.length > 0 ? body.molecules : null,
          pansement: body.pansement === true,
          pansement_detail: body.pansement === true ? texteOuNull(body.pansement_detail) : null,
          cryotherapie: body.cryotherapie === true,
          cryotherapie_duree: body.cryotherapie === true ? texteOuNull(body.cryotherapie_duree) : null,
          cryotherapie_machine: body.cryotherapie === true ? texteOuNull(body.cryotherapie_machine) : null,
          envoi_ordo: Array.isArray(body.envoi_ordo) && body.envoi_ordo.length > 0 ? body.envoi_ordo : null,
          pharmacie_per_os: body.pharmacie_per_os === true,
          medicaments_per_os:
            body.pharmacie_per_os === true && Array.isArray(body.medicaments_per_os) && body.medicaments_per_os.length > 0
              ? body.medicaments_per_os
              : null,
          materiel_paramedical: body.materiel === true ? texteOuNull(body.materiel_paramedical) : null,
        }
      : {
          prenom: texteOuNull(body.prenom),
          telephone: texteOuNull(body.telephone),
        };

  const { error: errPro } = await admin.from("professionnel").insert({
    user_id: created.user.id,
    prestataire_id: prestataireId,
    nom,
    email,
    role,
    ...extras,
  });

  if (errPro) {
    // rollback du compte Auth orphelin
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { message: "Échec de création de la fiche soignant." },
      { status: 500 }
    );
  }

  return NextResponse.json({ email, motDePasse });
}
