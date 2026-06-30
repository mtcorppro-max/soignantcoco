import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_COFFRE } from "@/lib/coffre";

type Admin = ReturnType<typeof createAdminClient>;

const TYPES_OK = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const TAILLE_MAX = 20 * 1024 * 1024; // 20 Mo
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf",
};

async function assurerBucket(admin: Admin) {
  const { data } = await admin.storage.getBucket(BUCKET_COFFRE);
  if (!data) await admin.storage.createBucket(BUCKET_COFFRE, { public: false });
}

async function proCourant(admin: Admin, userId: string) {
  const { data } = await admin.from("professionnel").select("id").eq("user_id", userId).maybeSingle();
  return data?.id as string | undefined;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  const cible = form?.get("professionnel_id")?.toString() ?? "";
  if (!(fichier instanceof File)) return NextResponse.json({ message: "Fichier manquant." }, { status: 400 });
  if (!TYPES_OK.includes(fichier.type)) return NextResponse.json({ message: "Format non supporté (image ou PDF)." }, { status: 400 });
  if (fichier.size > TAILLE_MAX) return NextResponse.json({ message: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });

  const admin = createAdminClient();
  const proId = await proCourant(admin, user.id);
  if (!proId) return NextResponse.json({ message: "Compte introuvable." }, { status: 403 });

  // Propriétaire du document : soi-même, ou un salarié (dépôt RH/dirigeant).
  let ownerId = proId;
  if (cible && cible !== proId) {
    const { data: moi } = await admin.from("professionnel").select("role,niveau,prestataire_id").eq("id", proId).maybeSingle();
    const peutDeposer = !!moi && (moi.niveau === 0 || moi.role === "rh" || moi.role === "dirigeant");
    if (!peutDeposer) return NextResponse.json({ message: "Dépôt non autorisé." }, { status: 403 });
    const { data: emp } = await admin.from("professionnel").select("id,prestataire_id").eq("id", cible).maybeSingle();
    if (!emp || emp.prestataire_id !== moi.prestataire_id) return NextResponse.json({ message: "Salarié hors de votre périmètre." }, { status: 403 });
    ownerId = cible;
  }
  await assurerBucket(admin);

  const ext = EXT[fichier.type] ?? "bin";
  const chemin = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error: errUp } = await admin.storage.from(BUCKET_COFFRE).upload(chemin, fichier, { contentType: fichier.type, upsert: false });
  if (errUp) return NextResponse.json({ message: "Échec de l'envoi du fichier." }, { status: 500 });

  const { error: errRow } = await admin.from("coffre_document").insert({
    professionnel_id: ownerId, depose_par: proId, chemin_stockage: chemin,
    libelle: fichier.name, mime: fichier.type, taille: fichier.size,
  });
  if (errRow) {
    await admin.storage.from(BUCKET_COFFRE).remove([chemin]);
    return NextResponse.json({ message: "Échec de l'enregistrement." }, { status: 500 });
  }

  // Dépôt par un tiers (RH/dirigeant) → on prévient le salarié par message interne.
  if (ownerId !== proId) {
    await admin.from("message_pro").insert({
      expediteur_id: proId,
      destinataire_id: ownerId,
      contenu: `📁 Un nouveau document a été déposé dans votre coffre-fort : « ${fichier.name} ».`,
    });
  }
  return NextResponse.json({ ok: true });
}

// Réinitialisation du code d'un salarié par un RH / dirigeant (code oublié).
export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const cible = (body.professionnel_id ?? "").toString();
  if (!cible) return NextResponse.json({ message: "Salarié manquant." }, { status: 400 });

  const admin = createAdminClient();
  const proId = await proCourant(admin, user.id);
  const { data: moi } = await admin.from("professionnel").select("role,niveau,prestataire_id").eq("id", proId ?? "").maybeSingle();
  const peutReset = !!moi && (moi.niveau === 0 || moi.role === "rh" || moi.role === "dirigeant");
  if (!proId || !peutReset) return NextResponse.json({ message: "Action non autorisée." }, { status: 403 });
  const { data: emp } = await admin.from("professionnel").select("id,prestataire_id").eq("id", cible).maybeSingle();
  if (!emp || emp.prestataire_id !== moi!.prestataire_id) return NextResponse.json({ message: "Salarié hors de votre périmètre." }, { status: 403 });

  await admin.from("professionnel").update({ coffre_code_hash: null }).eq("id", cible);
  // On informe le salarié qu'il devra définir un nouveau code.
  await admin.from("message_pro").insert({
    expediteur_id: proId,
    destinataire_id: cible,
    contenu: "🔐 Le code de votre coffre-fort a été réinitialisé. Vous devrez en définir un nouveau à la prochaine ouverture.",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = (body.id ?? "").toString();
  if (!id) return NextResponse.json({ message: "Identifiant manquant." }, { status: 400 });

  const admin = createAdminClient();
  const proId = await proCourant(admin, user.id);
  const { data: doc } = await admin.from("coffre_document").select("id,chemin_stockage,professionnel_id").eq("id", id).maybeSingle();
  if (!proId || !doc || doc.professionnel_id !== proId) return NextResponse.json({ message: "Suppression non autorisée." }, { status: 403 });

  await admin.storage.from(BUCKET_COFFRE).remove([doc.chemin_stockage]);
  await admin.from("coffre_document").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

// URLs signées (bucket privé) — restreintes aux documents du pro courant.
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const chemins = (params.get("chemins") ?? "").split(",").filter(Boolean);
  const code = params.get("code") ?? "";
  if (!chemins.length) return NextResponse.json({ urls: {} });

  // Accès aux fichiers protégé par le code du coffre.
  const { data: ok } = await supabase.rpc("coffre_verifier_code", { p_code: code });
  if (!ok) return NextResponse.json({ message: "Code du coffre incorrect." }, { status: 403 });

  const admin = createAdminClient();
  const proId = await proCourant(admin, user.id);
  if (!proId) return NextResponse.json({ urls: {} });
  // On ne signe que les chemins appartenant au pro (préfixe `${proId}/`).
  const aMoi = chemins.filter((c) => c.startsWith(`${proId}/`));
  if (!aMoi.length) return NextResponse.json({ urls: {} });
  const { data } = await admin.storage.from(BUCKET_COFFRE).createSignedUrls(aMoi, 3600);
  const urls: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
  return NextResponse.json({ urls });
}
