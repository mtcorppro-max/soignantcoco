#!/usr/bin/env node
// =====================================================================
// Crée un compte soignant (professionnel) de test.
//
// Usage :
//   node --env-file=.env.local scripts/creer-pro.mjs \
//        --email=soignant@test.fr --pass=motdepasse \
//        --nom="Claire Test" --role=coordinatrice
//
//   role = coordinatrice | chirurgien | delegue   (défaut: coordinatrice)
//
// S'il n'existe aucun prestataire, en crée un automatiquement ("Prestataire Test").
// Sinon rattache le pro au premier prestataire trouvé.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=")];
  })
);

const email = args.email;
const pass = args.pass;
const nom = args.nom || email;
const role = args.role || "coordinatrice";

if (!email || !pass) {
  console.error("❌ --email et --pass sont obligatoires.");
  process.exit(1);
}
if (!["coordinatrice", "chirurgien", "delegue"].includes(role)) {
  console.error(`❌ role invalide: ${role} (coordinatrice|chirurgien|delegue)`);
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Prestataire (réutilise le premier, sinon en crée un)
  let { data: presta } = await db.from("prestataire").select("id, nom").limit(1).maybeSingle();
  if (!presta) {
    const { data, error } = await db
      .from("prestataire")
      .insert({ nom: "Prestataire Test" })
      .select("id, nom")
      .single();
    if (error) throw error;
    presta = data;
    console.log(`→ Prestataire créé : ${presta.nom}`);
  } else {
    console.log(`→ Prestataire existant : ${presta.nom}`);
  }

  // 2. Compte Auth
  const { data: created, error: errUser } = await db.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  if (errUser) throw errUser;

  // 3. Ligne professionnel
  const { error: errPro } = await db.from("professionnel").insert({
    user_id: created.user.id,
    prestataire_id: presta.id,
    nom,
    email,
    role,
  });
  if (errPro) {
    await db.auth.admin.deleteUser(created.user.id);
    throw errPro;
  }

  console.log("\n✅ Compte soignant créé :");
  console.log(`   email    : ${email}`);
  console.log(`   mot de passe : ${pass}`);
  console.log(`   rôle     : ${role}`);
  console.log("\n   → connexion sur /login/pro\n");
}

main().catch((e) => {
  console.error("❌ Erreur :", e.message ?? e);
  process.exit(1);
});
