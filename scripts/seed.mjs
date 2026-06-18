#!/usr/bin/env node
// =====================================================================
// Seed de démonstration — crée un prestataire, une coordinatrice,
// un délégué, un chirurgien, et un patient avec mesures + une alerte.
//
// Usage :
//   1. Appliquer d'abord la migration (supabase/migrations/0001_init.sql)
//   2. Renseigner .env.local (URL + ANON + SERVICE_ROLE)
//   3. node --env-file=.env.local scripts/seed.mjs
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOMAIN = "patient.soignantcoco.local";
const codePatient = "DEMO1234";

async function creerPro(email, password, nom, role, prestataireId) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  await db.from("professionnel").insert({
    user_id: data.user.id,
    prestataire_id: prestataireId,
    nom,
    email,
    role,
  });
  return data.user.id;
}

async function main() {
  console.log("→ Création du prestataire…");
  const { data: presta } = await db
    .from("prestataire")
    .insert({ nom: "Prestataire Démo" })
    .select("id")
    .single();

  console.log("→ Professionnels…");
  await creerPro("coordinatrice@demo.fr", "demo1234", "Claire Coord.", "coordinatrice", presta.id);
  await creerPro("chirurgien@demo.fr", "demo1234", "Dr Bernard", "chirurgien", presta.id);
  await creerPro("delegue@demo.fr", "demo1234", "Paul Délégué", "delegue", presta.id);

  console.log("→ Patient démo…");
  const { data: patientUser } = await db.auth.admin.createUser({
    email: `${codePatient.toLowerCase()}@${DOMAIN}`,
    password: codePatient,
    email_confirm: true,
    user_metadata: { type: "patient" },
  });
  const { data: patient } = await db
    .from("patient")
    .insert({
      user_id: patientUser.user.id,
      prestataire_id: presta.id,
      code_unique: codePatient,
      nom: "Monsieur Démo",
      code_postal: "49000",
      tel_alerte_1: "+33600000001",
      tel_alerte_2: "+33600000002",
    })
    .select("id")
    .single();

  console.log("→ Seuils…");
  await db.from("seuil").insert([
    { patient_id: patient.id, type_mesure: "temperature", valeur_min: 35, valeur_max: 38.5 },
    { patient_id: patient.id, type_mesure: "spo2", valeur_min: 92, valeur_max: null },
    { patient_id: patient.id, type_mesure: "ta_systolique", valeur_min: 90, valeur_max: 160 },
    { patient_id: patient.id, type_mesure: "ta_diastolique", valeur_min: 50, valeur_max: 100 },
  ]);

  console.log("→ Mesures (dont une hors seuil → alerte auto via trigger)…");
  const now = Date.now();
  const j = (n) => new Date(now - n * 86400000).toISOString();
  await db.from("mesure").insert([
    { patient_id: patient.id, type: "temperature", valeur: 37.0, horodatage: j(4) },
    { patient_id: patient.id, type: "temperature", valeur: 37.4, horodatage: j(3) },
    { patient_id: patient.id, type: "temperature", valeur: 38.0, horodatage: j(2) },
    { patient_id: patient.id, type: "temperature", valeur: 39.2, horodatage: j(0) }, // > 38.5 => ALERTE
    { patient_id: patient.id, type: "spo2", valeur: 97, horodatage: j(3) },
    { patient_id: patient.id, type: "spo2", valeur: 95, horodatage: j(1) },
    { patient_id: patient.id, type: "ta_systolique", valeur: 128, horodatage: j(1) },
    { patient_id: patient.id, type: "ta_diastolique", valeur: 82, horodatage: j(1) },
  ]);

  console.log("\n✅ Seed terminé.\n");
  console.log("Comptes pro (mot de passe : demo1234)");
  console.log("  • coordinatrice@demo.fr");
  console.log("  • chirurgien@demo.fr");
  console.log("  • delegue@demo.fr");
  console.log(`\nPatient — code de connexion : ${codePatient}\n`);
}

main().catch((e) => {
  console.error("❌ Erreur seed :", e.message ?? e);
  process.exit(1);
});
