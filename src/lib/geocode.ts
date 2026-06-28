// Géocodage d'adresse via la Base Adresse Nationale (api-adresse.data.gouv.fr).
// API publique française, gratuite et sans clé. Renvoie les coordonnées GPS.

export type LatLng = { lat: number; lon: number };

// Géocode une adresse libre (ex. « 12 rue de la Paix 34000 Montpellier »).
export async function geocodeAdresse(q: string): Promise<LatLng | null> {
  const t = q.trim();
  if (t.length < 3) return null;
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(t)}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const c = data?.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) return null;
    const [lon, lat] = c as [number, number];
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    return { lat, lon };
  } catch {
    return null;
  }
}
