import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estEmailAdmin } from "@/lib/admin";

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
  if (!admin_ && moi?.niveau !== 1) {
    return NextResponse.json(
      { message: "Seuls un administrateur ou un compte de niveau 1 peuvent supprimer un compte." },
      { status: 403 }
    );
  }

  if (moi && moi.id === params.id) {
    return NextResponse.json({ message: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cible } = await admin
    .from("professionnel")
    .select("id, user_id, prestataire_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!cible) {
    return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  }
  if (!admin_ && cible.prestataire_id !== moi?.prestataire_id) {
    return NextResponse.json({ message: "Compte hors de votre prestataire." }, { status: 403 });
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
