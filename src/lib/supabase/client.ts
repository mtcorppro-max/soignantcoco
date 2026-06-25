"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton : une SEULE instance du client navigateur pour tout l'onglet.
// Indispensable — si on recrée un client à chaque appel, chaque instance lance
// son propre minuteur de rafraîchissement de token. Après une longue inactivité,
// elles tentent toutes de rafraîchir le même refresh token en même temps ; la
// rotation des tokens Supabase invalide alors tous les perdants
// (« Invalid Refresh Token: Already Used ») → déconnexion intempestive lors
// d'une navigation. Un singleton supprime cette course.
let client: SupabaseClient | null = null;

// Client Supabase côté navigateur (utilise la clé anon, protégée par la RLS).
export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return client;
}
