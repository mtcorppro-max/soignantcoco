import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estEmailAdmin } from "@/lib/admin";
import { peutOctroyer } from "@/lib/niveaux";

type RolePro = "coordinatrice" | "chirurgien" | "delegue" | "manager" | "infirmiere_liberale" | "livreur" | "pharmacie";
const ROLES: RolePro[] = ["coordinatrice", "chirurgien", "delegue", "manager", "infirmiere_liberale", "livreur", "pharmacie"];
// Comptes service : ne peuvent pas créer d'autres comptes.
const estRoleService = (r: string | null | undefined) => r === "livreur" || r === "pharmacie";

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
    .select("niveau, role, prestataire_id, agence_id, region_id")
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
  } else if (pro && (pro.niveau === 0 || (pro.niveau <= 2 && pro.role !== "chirurgien" && !estRoleService(pro.role)))) {
    prestataireId = pro.prestataire_id;
  } else {
    return NextResponse.json(
      { message: "Vous n'avez pas les droits pour créer un compte soignant." },
      { status: 403 }
    );
  }

  // Contrôle d'octroi : pas plus puissant que soi, et le niveau 1 (manager)
  // est réservé au niveau 0.
  // Un manager est toujours niveau 1 ; une infirmière libérale toujours niveau 3.
  // Niveaux fixes par rôle ; seuls coordinatrice et délégué laissent le choix.
  const niveauDemande = role === "manager" ? 1
    : role === "livreur" ? 2
    : (role === "infirmiere_liberale" || role === "pharmacie" || role === "chirurgien") ? 3
    : ([0, 1, 2, 3].includes(Number(body.niveau)) ? Number(body.niveau) : 3);
  if (!peutOctroyer(niveauCreateur, niveauDemande)) {
    return NextResponse.json(
      { message: "Vous ne pouvez pas octroyer ce niveau (le niveau 1 manager est réservé au niveau 0)." },
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
          rpps: texteOuNull(body.rpps),
          cabinets: texteOuNull(body.cabinets),
          telephone: texteOuNull(body.telephone),
          secretariat_nom: texteOuNull(body.secretariat_nom),
          secretariat_email: texteOuNull(body.secretariat_email),
          secretariat_tel: texteOuNull(body.secretariat_tel),
          protocoles: Array.isArray(body.protocoles) && body.protocoles.length > 0 ? body.protocoles : null,
          ordonnances_types: Array.isArray(body.ordonnances_types) ? body.ordonnances_types : [],
          // Réception des alertes patients : opt-in explicite (défaut : non).
          recevoir_alertes: body.recevoir_alertes === true,
        }
      : {
          prenom: texteOuNull(body.prenom),
          telephone: texteOuNull(body.telephone),
          zone_exercice: role === "infirmiere_liberale" ? texteOuNull(body.zone_exercice) : null,
        };

  // Rattachement : infirmière libérale & pharmacie -> aucune agence ;
  // niveau 1 -> région ; délégué niveau 2/3 -> plusieurs agences ;
  // autres niveau 2/3 -> une agence ; niveau 0 -> aucun.
  let agenceId: string | null = null;
  let regionId: string | null = null;
  let agencesList: string[] | null = null;

  // Une agence est-elle dans le périmètre du créateur ?
  const agenceDansPerimetre = async (agId: string): Promise<boolean> => {
    const { data: ag } = await admin
      .from("agence")
      .select("id, region_id, region:region_id(prestataire_id)")
      .eq("id", agId)
      .maybeSingle();
    const agPrestataire = (ag?.region as { prestataire_id?: string } | null)?.prestataire_id;
    let ok = !!ag && agPrestataire === prestataireId;
    if (ok && !admin_ && niveauCreateur !== 0) {
      if (pro?.niveau === 2) ok = ag!.id === pro.agence_id;
      else if (pro?.niveau === 1) ok = ag!.region_id === (pro.region_id ?? null);
    }
    return ok;
  };

  if (role === "infirmiere_liberale" || role === "pharmacie") {
    // Pas de rattachement à une agence.
  } else if (niveauDemande === 1) {
    regionId = texteOuNull(body.region_id);
    if (!regionId) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ message: "Région de rattachement requise." }, { status: 400 });
    }
    const { data: reg } = await admin.from("region").select("id, prestataire_id").eq("id", regionId).maybeSingle();
    if (!reg || reg.prestataire_id !== prestataireId) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ message: "Région hors de votre périmètre." }, { status: 403 });
    }
  } else if (niveauDemande === 2 || niveauDemande === 3) {
    if (role === "delegue") {
      // Le délégué peut être rattaché à plusieurs agences.
      const arr = Array.isArray(body.agences) ? (body.agences.filter((x: unknown) => typeof x === "string") as string[]) : [];
      const uniques = [...new Set(arr)];
      if (uniques.length === 0) {
        await admin.auth.admin.deleteUser(created.user.id);
        return NextResponse.json({ message: "Au moins une agence de rattachement est requise." }, { status: 400 });
      }
      for (const agId of uniques) {
        if (!(await agenceDansPerimetre(agId))) {
          await admin.auth.admin.deleteUser(created.user.id);
          return NextResponse.json({ message: "Agence hors de votre périmètre." }, { status: 403 });
        }
      }
      agencesList = uniques;
      agenceId = uniques[0];
    } else {
      agenceId = texteOuNull(body.agence_id);
      if (!agenceId) {
        await admin.auth.admin.deleteUser(created.user.id);
        return NextResponse.json({ message: "Agence de rattachement requise." }, { status: 400 });
      }
      if (!(await agenceDansPerimetre(agenceId))) {
        await admin.auth.admin.deleteUser(created.user.id);
        return NextResponse.json({ message: "Agence hors de votre périmètre." }, { status: 403 });
      }
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
    agences: agencesList,
    region_id: regionId,
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
