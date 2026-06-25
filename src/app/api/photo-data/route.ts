import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_CICATRICES } from "@/lib/photos";

// Renvoie des photos de cicatrice en data-URL base64 (pour insertion dans un
// PDF côté client, sans souci de CORS sur le bucket privé).
// L'autorisation s'appuie sur la RLS de la table `photo` : on ne télécharge
// que les chemins effectivement visibles par l'utilisateur connecté.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  const { chemins } = (await req.json().catch(() => ({}))) as { chemins?: string[] };
  if (!chemins?.length) return NextResponse.json({ data: {} });

  // Filtre les chemins autorisés via la RLS (lecture de la table photo).
  const { data: rows } = await supabase
    .from("photo")
    .select("chemin_stockage")
    .in("chemin_stockage", chemins);
  const autorises = new Set((rows ?? []).map((r) => r.chemin_stockage));

  const admin = createAdminClient();
  const data: Record<string, string> = {};
  for (const chemin of chemins) {
    if (!autorises.has(chemin)) continue;
    const { data: blob } = await admin.storage.from(BUCKET_CICATRICES).download(chemin);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    const mime = blob.type || "image/jpeg";
    data[chemin] = `data:${mime};base64,${buf.toString("base64")}`;
  }

  return NextResponse.json({ data });
}
