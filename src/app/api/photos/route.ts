import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_CICATRICES } from "@/lib/photos";

const TYPES_OK = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

// Envoi d'une photo de cicatrice par le patient connecté.
// Upload dans le bucket privé + insertion de la ligne `photo` (service_role).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  // Le patient ne peut envoyer que pour son propre dossier.
  const { data: patient } = await supabase
    .from("patient")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!patient) {
    return NextResponse.json(
      { message: "Seul un patient peut envoyer une photo." },
      { status: 403 }
    );
  }

  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  const legende = (form?.get("legende")?.toString() ?? "").trim() || null;

  if (!(fichier instanceof File)) {
    return NextResponse.json({ message: "Fichier manquant." }, { status: 400 });
  }
  if (!TYPES_OK.includes(fichier.type)) {
    return NextResponse.json(
      { message: "Format non supporté (JPEG, PNG, WebP ou HEIC)." },
      { status: 400 }
    );
  }
  if (fichier.size > TAILLE_MAX) {
    return NextResponse.json(
      { message: "Image trop volumineuse (max 10 Mo)." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const ext = EXT[fichier.type] ?? "jpg";
  const chemin = `${patient.id}/${crypto.randomUUID()}.${ext}`;

  const { error: errUp } = await admin.storage
    .from(BUCKET_CICATRICES)
    .upload(chemin, fichier, { contentType: fichier.type, upsert: false });
  if (errUp) {
    return NextResponse.json(
      { message: "Échec de l'envoi du fichier." },
      { status: 500 }
    );
  }

  const { error: errRow } = await admin.from("photo").insert({
    patient_id: patient.id,
    auteur_user_id: user.id,
    chemin_stockage: chemin,
    legende,
  });
  if (errRow) {
    // nettoyage du fichier orphelin
    await admin.storage.from(BUCKET_CICATRICES).remove([chemin]);
    return NextResponse.json(
      { message: "Échec de l'enregistrement de la photo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
