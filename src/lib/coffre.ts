// Coffre-fort personnel du soignant : documents privés (fiches de paie, contrat,
// attestations…), stockés dans un bucket privé, visibles uniquement par le propriétaire.
export const BUCKET_COFFRE = "coffre-fort";

export type CoffreDocument = {
  id: string;
  libelle: string;
  chemin_stockage: string;
  mime: string | null;
  taille: number | null;
  created_at: string;
  depose_par: string | null;
  professionnel_id: string;
};

export function formatTaille(o: number | null): string {
  if (!o) return "";
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / (1024 * 1024)).toFixed(1)} Mo`;
}
