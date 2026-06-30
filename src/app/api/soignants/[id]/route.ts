import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estEmailAdmin } from "@/lib/admin";
import { peutOctroyer } from "@/lib/niveaux";

// Suppression d'un compte soignant.
// Réservé à un administrateur (allowlist) ou à un compte de niveau 1 du même
// prestataire. Supprime l'utilisateur Auth → cascade sur la ligne professionnel
// et les liaisons. On nullifie d'abord les alertes acquittées par ce soignant
// (FK sans cascade).
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data: moi } = await supabase
    .from("professionnel")
    .select("id, niveau, prestataire_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const admin_ = estEmailAdmin(user.email);
  const niveauMoi = admin_ ? 0 : (moi?.niveau ?? 3);
  if (!admin_ && niveauMoi > 1) {
    return NextResponse.json(
      { message: "Seuls les niveaux 0 et 1 peuvent supprimer un compte." },
      { status: 403 }
    );
  }

  if (moi && moi.id === params.id) {
    return NextResponse.json({ message: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cible } = await admin
    .from("professionnel")
    .select("id, user_id, prestataire_id, niveau")
    .eq("id", params.id)
    .maybeSingle();

  if (!cible) {
    return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  }
  if (!admin_ && cible.prestataire_id !== moi?.prestataire_id) {
    return NextResponse.json({ message: "Compte hors de votre prestataire." }, { status: 403 });
  }
  // On ne peut pas supprimer un compte plus puissant que soi.
  if (cible.niveau < niveauMoi) {
    return NextResponse.json({ message: "Vous ne pouvez pas supprimer un compte de niveau supérieur." }, { status: 403 });
  }

  // Détacher des alertes acquittées (FK sans cascade)
  await admin.from("alerte").update({ acquittee_par: null }).eq("acquittee_par", cible.id);

  // Supprimer l'utilisateur Auth → cascade sur professionnel + liaisons
  const { error } = await admin.auth.admin.deleteUser(cible.user_id);
  if (error) {
    return NextResponse.json({ message: "Échec de la suppression du compte." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Modification d'un compte soignant.
//  • Coordonnées / infos pro (tél, email, RPPS, spécialité, cabinet, secrétariat,
//    zone) : modifiables par soi-même, ou par un niveau 0/1/2 du même prestataire.
//  • Niveau / agence / région d'accès : réservés aux niveaux 0/1 (cibles niveau ≥ 2).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const { data: moi } = await supabase
    .from("professionnel")
    .select("id, niveau, prestataire_id, agence_id, region_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  const admin_ = estEmailAdmin(user.email);
  const niveauMoi = admin_ ? 0 : (moi?.niveau ?? 3);
  const estSelf = !!moi && moi.id === params.id;

  const admin = createAdminClient();
  const { data: cible } = await admin
    .from("professionnel")
    .select("id, niveau, prestataire_id, role")
    .eq("id", params.id)
    .maybeSingle();
  if (!cible) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  if (!admin_ && !estSelf && cible.prestataire_id !== moi?.prestataire_id) {
    return NextResponse.json({ message: "Compte hors de votre prestataire." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const maj: Record<string, unknown> = {};

  // Coordonnées / infos pro : soi-même, admin, ou un gestionnaire (niveau ≤ 2),
  // mais JAMAIS sur un compte plus puissant que soi (niveau strictement inférieur).
  const peutContact = admin_ || estSelf || (niveauMoi <= 2 && cible.niveau >= niveauMoi);
  if (peutContact) {
    for (const k of ["telephone", "email", "rpps", "specialite", "cabinets", "secretariat_nom", "secretariat_email", "secretariat_tel", "zone_exercice", "titre", "prenom"]) {
      if (body[k] !== undefined) maj[k] = t(body[k]);
    }
    if (body.nom !== undefined && t(body.nom)) maj.nom = t(body.nom);
    if (Array.isArray(body.protocoles)) maj.protocoles = body.protocoles;
    // Délégué médical rattaché au médecin (auto-rattachement de ses patients).
    if (body.delegue_id !== undefined && cible.role === "chirurgien") maj.delegue_id = body.delegue_id || null;
    if (Array.isArray(body.ordonnances_types)) maj.ordonnances_types = body.ordonnances_types;
    // Réception des alertes patients (opt-in médecin).
    if (typeof body.recevoir_alertes === "boolean") maj.recevoir_alertes = body.recevoir_alertes;
    // Agences du délégué (rattachement multiple) : modifiable par soi-même ou
    // un gestionnaire. On ne garde que les agences du prestataire de la cible.
    if (Array.isArray(body.agences) && cible.role === "delegue") {
      const arr = [...new Set(body.agences.filter((x: unknown) => typeof x === "string") as string[])];
      let valides: string[] = [];
      if (arr.length) {
        const { data: ags } = await admin
          .from("agence")
          .select("id, region:region_id(prestataire_id)")
          .in("id", arr);
        valides = (ags ?? [])
          .filter((a) => (a.region as { prestataire_id?: string } | null)?.prestataire_id === cible.prestataire_id)
          .map((a) => a.id as string);
      }
      maj.agences = valides.length ? valides : null;
      maj.agence_id = valides[0] ?? null;
    }
  }

  // Dénomination de poste : soi-même, admin, ou RH / dirigeant / manager du
  // même prestataire (le périmètre prestataire est déjà vérifié plus haut).
  const peutPoste = admin_ || estSelf || (moi?.role === "rh" || moi?.role === "dirigeant" || moi?.role === "manager");
  if (peutPoste && body.poste !== undefined) maj.poste = t(body.poste);

  // Niveau / agence / région : réservés aux niveaux 0/1, cibles de niveau ≥ 2, hors soi-même.
  const peutAcces = (admin_ || niveauMoi <= 1) && !estSelf && cible.niveau >= 2;
  if (!peutAcces && (body.niveau !== undefined || body.agence_id !== undefined || body.region_id !== undefined)) {
    if (Object.keys(maj).length === 0) {
      return NextResponse.json({ message: "Modification du niveau/agence réservée aux niveaux 0 et 1." }, { status: 403 });
    }
  }

  // Nouveau niveau (optionnel)
  if (peutAcces && body.niveau !== undefined && body.niveau !== null) {
    const n = Number(body.niveau);
    if (![0, 1, 2, 3].includes(n)) {
      return NextResponse.json({ message: "Niveau invalide." }, { status: 400 });
    }
    if (!peutOctroyer(niveauMoi, n)) {
      return NextResponse.json({ message: "Octroi interdit (le niveau 1 manager est réservé au niveau 0)." }, { status: 403 });
    }
    maj.niveau = n;
  }

  // Nouvelle agence (optionnel) — validée selon le périmètre
  if (peutAcces && body.agence_id !== undefined) {
    const agId: string | null = body.agence_id || null;
    if (agId) {
      const { data: ag } = await admin
        .from("agence")
        .select("id, region_id, region:region_id(prestataire_id)")
        .eq("id", agId)
        .maybeSingle();
      const agPresta = (ag?.region as { prestataire_id?: string } | null)?.prestataire_id;
      let ok = !!ag && (admin_ || agPresta === moi?.prestataire_id);
      if (ok && !admin_ && niveauMoi === 1) {
        ok = ag!.region_id === (moi?.region_id ?? null);
      }
      if (!ok) return NextResponse.json({ message: "Agence hors de votre périmètre." }, { status: 403 });
    }
    maj.agence_id = agId;
  }

  // Nouvelle région (pour un manager niveau 1) — validée selon le prestataire
  if (peutAcces && body.region_id !== undefined) {
    const regId: string | null = body.region_id || null;
    if (regId) {
      const { data: reg } = await admin.from("region").select("id, prestataire_id").eq("id", regId).maybeSingle();
      const ok = !!reg && (admin_ || reg.prestataire_id === moi?.prestataire_id);
      if (!ok) return NextResponse.json({ message: "Région hors de votre périmètre." }, { status: 403 });
    }
    maj.region_id = regId;
  }

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ message: "Rien à modifier." }, { status: 400 });
  }

  const { error } = await admin.from("professionnel").update(maj).eq("id", cible.id);
  if (error) return NextResponse.json({ message: "Échec de la mise à jour." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
