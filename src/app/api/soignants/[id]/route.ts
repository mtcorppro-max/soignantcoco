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

// Modification d'un compte soignant : niveau et/ou agence de rattachement.
// Règles : seuls les niveaux 0 et 1 (ou admin) peuvent modifier des comptes
// de niveau 2 ou 3. On ne peut pas octroyer un niveau inférieur au sien.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const { data: moi } = await supabase
    .from("professionnel")
    .select("id, niveau, prestataire_id, agence_id, region_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const admin_ = estEmailAdmin(user.email);
  const niveauMoi = admin_ ? 0 : (moi?.niveau ?? 3);

  if (!admin_ && niveauMoi > 1) {
    return NextResponse.json({ message: "Seuls les niveaux 0 et 1 peuvent modifier un compte." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: cible } = await admin
    .from("professionnel")
    .select("id, niveau, prestataire_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!cible) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });

  // On ne peut modifier que des comptes de niveau 2 ou 3
  if (cible.niveau < 2) {
    return NextResponse.json({ message: "Ce compte ne peut pas être modifié à ce niveau." }, { status: 403 });
  }
  if (!admin_ && cible.prestataire_id !== moi?.prestataire_id) {
    return NextResponse.json({ message: "Compte hors de votre prestataire." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const maj: { niveau?: number; agence_id?: string | null; region_id?: string | null } = {};

  // Nouveau niveau (optionnel)
  if (body.niveau !== undefined && body.niveau !== null) {
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
  if (body.agence_id !== undefined) {
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
  if (body.region_id !== undefined) {
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
