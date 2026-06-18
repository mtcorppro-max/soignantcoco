#!/usr/bin/env node
// =====================================================================
// Crée le bucket Storage privé "cicatrices" (photos médicales).
// Idempotent : ne fait rien si le bucket existe déjà.
//
// Usage : node --env-file=.env.local scripts/setup-storage.mjs
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).");
  process.exit(1);
}

const BUCKET = "cicatrices";
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: buckets, error: errList } = await db.storage.listBuckets();
if (errList) {
  console.error("❌ Impossible de lister les buckets :", errList.message);
  process.exit(1);
}

if (buckets.some((b) => b.name === BUCKET)) {
  console.log(`✓ Bucket "${BUCKET}" déjà présent.`);
  process.exit(0);
}

const { error } = await db.storage.createBucket(BUCKET, {
  public: false, // privé : accès uniquement via URL signée (cf. lib/photos.ts)
  fileSizeLimit: "10MB",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
});
if (error) {
  console.error("❌ Création du bucket échouée :", error.message);
  process.exit(1);
}
console.log(`✅ Bucket privé "${BUCKET}" créé.`);
