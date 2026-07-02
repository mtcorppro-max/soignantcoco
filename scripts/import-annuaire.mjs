#!/usr/bin/env node
// =====================================================================
// Import de l'annuaire santé officiel (PS_LibreAcces / RPPS, Open Data)
// dans la table annuaire_sante.
//
// - Lit le fichier pipe-delimited en streaming (≈ 771 Mo, ne charge pas
//   tout en mémoire).
// - Filtre : médecins (10), infirmiers (60), pharmaciens (21) + code
//   postal du lieu d'exercice commençant par les départements demandés.
// - Regroupe les lignes par RPPS (multi-sites → tableau `sites`).
// - Upsert par lots de 500 max (clé rpps : relançable sans doublon),
//   pause entre chaque lot, log de progression, continue si un lot échoue.
//
// Usage :
//   node --env-file=.env.local scripts/import-annuaire.mjs                 # dépt 34 (test)
//   node --env-file=.env.local scripts/import-annuaire.mjs --depts 34,30,11,66
//   node --env-file=.env.local scripts/import-annuaire.mjs --fichier /chemin/DOSOIGNANT.txt
//   node --env-file=.env.local scripts/import-annuaire.mjs --dry            # parse seul, aucun envoi
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).");
  process.exit(1);
}

// --- Arguments ---
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const FICHIER = arg("fichier", "public/DOSOIGNANT.txt");
const DEPTS = arg("depts", "34").split(",").map((d) => d.trim()).filter(Boolean);
const TAILLE_LOT = 500;
const PAUSE_MS = 400;

// Professions retenues → type applicatif.
const TYPES = { 10: "medecin", 60: "infirmiere", 21: "pharmacie" };

// Libellés mode d'exercice → forme lisible.
const MODE = (m) => (m.startsWith("Lib") ? "Libéral" : m || null);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// --- 1) Lecture en streaming + regroupement par RPPS ---
console.log(`Lecture de ${FICHIER} (départements : ${DEPTS.join(", ")})…`);
const fiches = new Map(); // rpps -> fiche
let lignesLues = 0;
let lignesRetenues = 0;

const rl = createInterface({ input: createReadStream(FICHIER, "utf8"), crlfDelay: Infinity });
let entete = true;
for await (const ligne of rl) {
  if (entete) { entete = false; continue; }
  lignesLues++;
  if (lignesLues % 500000 === 0) console.log(`  … ${lignesLues.toLocaleString("fr-FR")} lignes lues`);

  const c = ligne.split("|");
  const type = TYPES[c[9]];
  if (!type) continue;
  const cp = c[35] ?? "";
  if (!DEPTS.some((d) => cp.startsWith(d))) continue;
  const rpps = (c[1] ?? "").trim();
  const nom = (c[7] ?? "").trim();
  if (!rpps || !nom) continue;
  lignesRetenues++;

  // Adresse du site : numéro + indice + type de voie + voie.
  const adresse = [c[28], c[29], c[31], c[32]].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  const site = {
    rs: (c[24] || c[25] || "").trim() || null,  // raison sociale / enseigne
    adresse: adresse || null,
    cp,
    commune: (c[37] ?? "").trim() || null,
    tel: (c[40] ?? "").trim() || null,
  };

  let f = fiches.get(rpps);
  if (!f) {
    f = {
      rpps,
      type,
      civilite: (c[4] ?? "").trim() || null,
      nom,
      prenom: (c[8] ?? "").trim() || null,
      profession: (c[10] ?? "").trim() || null,
      specialite: (c[16] ?? "").trim() || null,
      mode_exercice: MODE((c[18] ?? "").trim()),
      sites: [],
    };
    fiches.set(rpps, f);
  }
  // Complète les champs vides avec les lignes suivantes (multi-activités).
  if (!f.specialite && (c[16] ?? "").trim()) f.specialite = c[16].trim();
  if (f.mode_exercice !== "Libéral" && (c[18] ?? "").startsWith("Lib")) f.mode_exercice = "Libéral";
  // Sites dédupliqués (même raison sociale + adresse + CP).
  const cle = `${site.rs}|${site.adresse}|${site.cp}`;
  if (!f.sites.some((s) => `${s.rs}|${s.adresse}|${s.cp}` === cle)) f.sites.push(site);
}

const liste = [...fiches.values()];
console.log(`${lignesLues.toLocaleString("fr-FR")} lignes lues — ${lignesRetenues.toLocaleString("fr-FR")} retenues — ${liste.length.toLocaleString("fr-FR")} professionnels uniques (RPPS).`);
const parType = liste.reduce((a, f) => ((a[f.type] = (a[f.type] ?? 0) + 1), a), {});
console.log(`  médecins : ${parType.medecin ?? 0} · infirmiers : ${parType.infirmiere ?? 0} · pharmaciens : ${parType.pharmacie ?? 0}`);

if (process.argv.includes("--dry")) {
  console.log("\nExemples de fiches :");
  for (const f of liste.slice(0, 3)) console.log(JSON.stringify(f, null, 2));
  console.log("\n(--dry : aucun envoi vers Supabase.)");
  process.exit(0);
}

// --- 2) Upsert par lots de 500 ---
const nbLots = Math.ceil(liste.length / TAILLE_LOT);
const echecs = [];
for (let i = 0; i < nbLots; i++) {
  const lot = liste.slice(i * TAILLE_LOT, (i + 1) * TAILLE_LOT);
  const { error } = await db.from("annuaire_sante").upsert(lot, { onConflict: "rpps" });
  if (error) {
    echecs.push(i + 1);
    console.error(`  ✗ lot ${i + 1}/${nbLots} en échec : ${error.message}`);
  } else {
    console.log(`  ✓ lot ${i + 1}/${nbLots} importé (${lot.length} fiches)`);
  }
  if (i < nbLots - 1) await pause(PAUSE_MS);
}

if (echecs.length) {
  console.error(`\n⚠️ Terminé avec ${echecs.length} lot(s) en échec : ${echecs.join(", ")}. Relancez le script (upsert : pas de doublon).`);
  process.exit(1);
}
console.log(`\n✅ Import terminé : ${liste.length.toLocaleString("fr-FR")} fiches (départements ${DEPTS.join(", ")}).`);
