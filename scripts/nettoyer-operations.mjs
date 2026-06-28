#!/usr/bin/env node
// =====================================================================
// Nettoie les opérations incohérentes des patients.
//
// Une opération est "incohérente" quand le patient a une `operation`
// renseignée qui NE correspond à AUCUN protocole de son médecin
// (`chirurgien`), alors que ce médecin a bien des protocoles.
// → on vide l'opération (mise à NULL). Le reste du dossier est intact.
//
// Usage :
//   node --env-file=.env.local scripts/nettoyer-operations.mjs            (aperçu)
//   node --env-file=.env.local scripts/nettoyer-operations.mjs --apply    (applique)
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const nomComplet = (p) => [p.titre, p.prenom, p.nom].filter(Boolean).join(" ").trim();
const norm = (s) => (s ?? "").toString().trim().toLowerCase();

async function main() {
  const [{ data: patients, error: e1 }, { data: pros, error: e2 }, { data: externes, error: e3 }] = await Promise.all([
    db.from("patient").select("id,nom,operation,chirurgien"),
    db.from("professionnel").select("nom,prenom,titre,protocoles").eq("role", "chirurgien"),
    db.from("soignant_externe").select("nom,prenom,titre,protocoles"),
  ]);
  if (e1 || e2 || e3) throw e1 || e2 || e3;

  // Nom du médecin → ensemble des interventions de ses protocoles.
  const interventionsParMedecin = new Map();
  for (const m of [...(pros ?? []), ...(externes ?? [])]) {
    const protos = Array.isArray(m.protocoles) ? m.protocoles : [];
    const set = new Set(protos.map((p) => norm(p?.intervention)).filter(Boolean));
    interventionsParMedecin.set(nomComplet(m), set);
  }

  const aNettoyer = [];
  for (const p of patients ?? []) {
    const op = (p.operation ?? "").trim();
    if (!op) continue;
    const med = (p.chirurgien ?? "").trim();
    if (!med) continue;
    const interventions = interventionsParMedecin.get(med);
    // On ne touche que si le médecin est connu ET a au moins un protocole,
    // et que l'opération n'en fait pas partie.
    if (!interventions || interventions.size === 0) continue;
    if (!interventions.has(norm(op))) aNettoyer.push({ id: p.id, nom: p.nom, op, med });
  }

  if (aNettoyer.length === 0) {
    console.log("✅ Aucune opération incohérente trouvée.");
    return;
  }

  console.log(`${aNettoyer.length} opération(s) incohérente(s) :`);
  aNettoyer.forEach((x) => console.log(`  • ${x.nom} : « ${x.op} » (médecin : ${x.med})`));

  if (!APPLY) {
    console.log("\n(aperçu) — relance avec --apply pour vider ces opérations.");
    return;
  }

  for (const x of aNettoyer) {
    const { error } = await db.from("patient").update({ operation: null }).eq("id", x.id);
    if (error) console.error(`  ❌ ${x.nom} : ${error.message}`);
  }
  console.log(`\n✅ ${aNettoyer.length} opération(s) vidée(s).`);
}

main().catch((e) => { console.error("❌ Erreur :", e.message ?? e); process.exit(1); });
