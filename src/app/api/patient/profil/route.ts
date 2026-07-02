import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Le patient connecté met à jour ses propres coordonnées (champs whitelistés).
const CHAMPS = ["telephone", "email", "adresse", "code_postal", "ville", "proche_nom", "proche_tel", "sexe"] as const;

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const { data: patient } = await supabase.from("patient").select("id").eq("user_id", user.id).maybeSingle();
  if (!patient) return NextResponse.json({ message: "Profil patient introuvable." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const maj: Record<string, string | null> = {};
  for (const k of CHAMPS) {
    if (body[k] !== undefined) maj[k] = typeof body[k] === "string" && body[k].trim() ? body[k].trim() : null;
  }
  // Sexe : valeurs autorisées uniquement (contrainte en base, avatar-guide).
  if (maj.sexe !== undefined && maj.sexe !== null && !["feminin", "masculin"].includes(maj.sexe)) maj.sexe = null;
  if (Object.keys(maj).length === 0) return NextResponse.json({ message: "Rien à modifier." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("patient").update(maj).eq("id", patient.id);
  if (error) return NextResponse.json({ message: "Échec de la mise à jour." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
