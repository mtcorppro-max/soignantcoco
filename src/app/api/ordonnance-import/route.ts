import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Intégration d'une ordonnance déjà remplie (PDF ou photo) déposée depuis
// l'ordinateur / le téléphone. Le fichier va dans un bucket privé ; l'accès
// (patient) est vérifié par la RLS via le client normal, le stockage passe par
// le client admin (bucket privé), comme le coffre-fort.

type Admin = ReturnType<typeof createAdminClient>;
const BUCKET = "ordonnances";
const TYPES_OK = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const TAILLE_MAX = 20 * 1024 * 1024; // 20 Mo
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf",
};

async function assurerBucket(admin: Admin) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) await admin.storage.createBucket(BUCKET, { public: false });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  const patientId = form?.get("patient_id")?.toString() ?? "";
  const signee = (form?.get("signee")?.toString() ?? "") === "oui";
  const destinataireId = form?.get("destinataire_id")?.toString() || null;
  if (!(fichier instanceof File)) return NextResponse.json({ message: "Fichier manquant." }, { status: 400 });
  if (!TYPES_OK.includes(fichier.type)) return NextResponse.json({ message: "Format non supporté (PDF ou image)." }, { status: 400 });
  if (fichier.size > TAILLE_MAX) return NextResponse.json({ message: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });
  if (!patientId) return NextResponse.json({ message: "Patient manquant." }, { status: 400 });
  // Non signée → il faut un médecin destinataire pour l'envoi à la signature.
  if (!signee && !destinataireId) return NextResponse.json({ message: "Choisissez le médecin signataire." }, { status: 400 });

  // Accès au patient contrôlé par la RLS (client normal).
  const { data: pat } = await supabase.from("patient").select("id").eq("id", patientId).maybeSingle();
  if (!pat) return NextResponse.json({ message: "Patient hors de votre périmètre." }, { status: 403 });
  const { data: pro } = await supabase.from("professionnel").select("id,prestataire_id").eq("user_id", user.id).maybeSingle();
  if (!pro?.prestataire_id) return NextResponse.json({ message: "Compte introuvable." }, { status: 403 });

  const admin = createAdminClient();
  await assurerBucket(admin);
  const ext = EXT[fichier.type] ?? "bin";
  const chemin = `${patientId}/${crypto.randomUUID()}.${ext}`;
  const { error: errUp } = await admin.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type, upsert: false });
  if (errUp) return NextResponse.json({ message: "Échec de l'envoi du fichier." }, { status: 500 });

  // Déjà signée → stockage direct (statut « signée »). Sinon → envoi au médecin
  // pour signature (statut « à signer » + destinataire).
  const { error: errRow } = await supabase.from("ordonnance").insert({
    patient_id: patientId,
    prestataire_id: pro.prestataire_id,
    type: "importee",
    titre: fichier.name || "Ordonnance importée",
    contenu: { chemin, mime: fichier.type },
    cree_par: pro.id,
    statut: signee ? "signee" : "a_signer",
    destinataire_id: signee ? null : destinataireId,
  });
  if (errRow) {
    await admin.storage.from(BUCKET).remove([chemin]);
    return NextResponse.json({ message: "Échec de l'enregistrement : " + errRow.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Signature du médecin : on reçoit le fichier signé (PDF), on remplace le fichier
// stocké et on finalise l'ordonnance (statut « signée »).
export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const fichier = form?.get("fichier");
  const id = form?.get("id")?.toString() ?? "";
  const signataire = form?.get("signataire")?.toString() ?? "";
  if (!(fichier instanceof File) || !id) return NextResponse.json({ message: "Paramètres manquants." }, { status: 400 });
  if (fichier.size > TAILLE_MAX) return NextResponse.json({ message: "Fichier trop volumineux." }, { status: 400 });

  // Accès + chemin actuel via la RLS (le médecin destinataire peut lire/mettre à jour).
  const { data: o } = await supabase.from("ordonnance").select("patient_id,contenu").eq("id", id).maybeSingle();
  if (!o) return NextResponse.json({ message: "Ordonnance introuvable." }, { status: 403 });
  const ancien = (o.contenu as { chemin?: string } | null)?.chemin;

  const admin = createAdminClient();
  await assurerBucket(admin);
  const chemin = `${o.patient_id}/${crypto.randomUUID()}-signe.pdf`;
  const { error: errUp } = await admin.storage.from(BUCKET).upload(chemin, fichier, { contentType: "application/pdf", upsert: false });
  if (errUp) return NextResponse.json({ message: "Échec de l'enregistrement du fichier signé." }, { status: 500 });

  const { error: errRow } = await supabase.from("ordonnance").update({
    statut: "signee",
    signataire_nom: signataire || null,
    signee_le: new Date().toISOString(),
    contenu: { chemin, mime: "application/pdf", signe: true },
  }).eq("id", id);
  if (errRow) { await admin.storage.from(BUCKET).remove([chemin]); return NextResponse.json({ message: "Échec : " + errRow.message }, { status: 500 }); }

  if (ancien && ancien !== chemin) await admin.storage.from(BUCKET).remove([ancien]); // on retire l'original non signé
  return NextResponse.json({ ok: true });
}

// URL signée pour consulter le fichier importé (accès contrôlé par la RLS).
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ message: "Identifiant manquant." }, { status: 400 });

  const { data: o } = await supabase.from("ordonnance").select("contenu").eq("id", id).maybeSingle();
  const chemin = (o?.contenu as { chemin?: string } | null)?.chemin;
  if (!chemin) return NextResponse.json({ message: "Fichier introuvable." }, { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(chemin, 3600);
  if (!data?.signedUrl) return NextResponse.json({ message: "Lien indisponible." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}

// Suppression d'une ordonnance importée (fichier + enregistrement).
export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = (body.id ?? "").toString();
  if (!id) return NextResponse.json({ message: "Identifiant manquant." }, { status: 400 });

  const { data: o } = await supabase.from("ordonnance").select("id,contenu").eq("id", id).maybeSingle();
  if (!o) return NextResponse.json({ message: "Suppression non autorisée." }, { status: 403 });
  const { error } = await supabase.from("ordonnance").delete().eq("id", id);
  if (error) return NextResponse.json({ message: "Échec : " + error.message }, { status: 500 });

  const chemin = (o.contenu as { chemin?: string } | null)?.chemin;
  if (chemin) { const admin = createAdminClient(); await admin.storage.from(BUCKET).remove([chemin]); }
  return NextResponse.json({ ok: true });
}
