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

  // Autorisation : un admin (allowlist = super-admin niveau 0) peut créer dans
  // n'importe quel prestataire ; sinon un compte gestionnaire (niveau 0/1/2,
  // hors chirurgien) dans son propre prestataire.
  const { data: pro } = await supabase
    .from("professionnel")
    .select("niveau, role, prestataire_id, agence_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const admin_ = estEmailAdmin(user.email);
  // Niveau effectif du créateur (admin allowlist = 0).
  const niveauCreateur = admin_ ? 0 : (pro?.niveau ?? 3);
  let prestataireId: string | null = null;
  if (admin_) {
    prestataireId = texteOuNull(body.prestataire_id);
    if (!prestataireId) {
      return NextResponse.json({ message: "Prestataire requis." }, { status: 400 });
    }
  } else if (pro && pro.niveau <= 2 && pro.role !== "chirurgien") {
    prestataireId = pro.prestataire_id;
  } else {
    return NextResponse.json(
      { message: "Vous n'avez pas les droits pour créer un compte soignant." },
      { status: 403 }
    );
  }

  // Contrôle d'octroi : on ne peut pas créer un compte plus puissant que soi.
  const niveauDemande = [0, 1, 2, 3].includes(Number(body.niveau)) ? Number(body.niveau) : 3;
  if (niveauDemande < niveauCreateur) {
    return NextResponse.json(
      { message: "Vous ne pouvez pas octroyer un niveau supérieur au vôtre." },
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
          protocoles: Array.isArray(body.protocoles) && body.protocoles.length > 0 ? body.protocoles : null,
        }
      : {
          prenom: texteOuNull(body.prenom),
          telephone: texteOuNull(body.telephone),
        };

  // Agence de rattachement (requise sauf niveau 0) + contrôle de périmètre.
  let agenceId: string | null = null;
  if (niveauDemande !== 0) {
    agenceId = texteOuNull(body.agence_id);
    if (!agenceId) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ message: "Agence de rattachement requise." }, { status: 400 });
    }
    const { data: ag } = await admin
      .from("agence")
      .select("id, region_id, region:region_id(prestataire_id)")
      .eq("id", agenceId)
      .maybeSingle();
    const agPrestataire = (ag?.region as { prestataire_id?: string } | null)?.prestataire_id;
    let okPerimetre = !!ag && agPrestataire === prestataireId;
    if (okPerimetre && !admin_ && niveauCreateur !== 0) {
      if (pro?.niveau === 2) {
        okPerimetre = ag!.id === pro.agence_id;
      } else if (pro?.niveau === 1) {
        const { data: monAg } = await admin
          .from("agence").select("region_id").eq("id", pro.agence_id ?? "").maybeSingle();
        okPerimetre = ag!.region_id === monAg?.region_id;
      }
    }
    if (!okPerimetre) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ message: "Agence hors de votre périmètre." }, { status: 403 });
    }
  }

  const { error: errPro } = await admin.from("professionnel").insert({
    user_id: created.user.id,
    prestataire_id: prestataireId,
    nom,
    email,
    role,
    niveau: niveauDemande,
    agence_id: agenceId,
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
