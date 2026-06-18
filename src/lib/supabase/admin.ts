import { createClient } from "@supabase/supabase-js";

// Client "service_role" — SERVEUR UNIQUEMENT (bypass RLS).
// Ne jamais l'importer dans un composant client.
// Sert à provisionner les comptes patients (création par la coordinatrice).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante — requise pour le provisionnement des patients."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
