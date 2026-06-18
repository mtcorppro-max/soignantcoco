import { createAdminClient } from "@/lib/supabase/admin";

// Bucket Storage privé des photos de cicatrice (cf. scripts/setup-storage.mjs).
export const BUCKET_CICATRICES = "cicatrices";

const DUREE_URL_SIGNEE = 60 * 60; // 1 h

// Génère des URLs signées (temporaires) pour des chemins du bucket privé.
// Utilise le service_role côté serveur : la visibilité « métier » est déjà
// filtrée en amont par la RLS de la table `photo` (qui a le droit de lister).
export async function urlsSignees(
  chemins: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (chemins.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(BUCKET_CICATRICES)
    .createSignedUrls(chemins, DUREE_URL_SIGNEE);
  (data ?? []).forEach((item) => {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  });
  return map;
}
