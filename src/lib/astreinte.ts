// Utilitaires de gestion des astreintes (semaine / week-end).

// Date locale -> "YYYY-MM-DD"
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Lundi de la semaine contenant `d` (00:00 local).
export function lundiDe(d: Date): Date {
  const x = new Date(d);
  const jour = (x.getDay() + 6) % 7; // lundi = 0 … dimanche = 6
  x.setDate(x.getDate() - jour);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Les `n` lundis à partir de la semaine courante (incluse).
export function semainesAVenir(n: number, depuis = new Date()): Date[] {
  const base = lundiDe(depuis);
  return Array.from({ length: n }, (_, i) => {
    const m = new Date(base);
    m.setDate(m.getDate() + i * 7);
    return m;
  });
}

// Ajoute n jours à une date ISO "YYYY-MM-DD".
function addIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

// Premier jour NON couvert par une astreinte sur les `jours` prochains jours
// (aujourd'hui inclus, week-ends compris). Renvoie sa date ISO, ou null si
// tous les jours sont couverts.
// `evenements` = plages d'astreinte { date_debut, date_fin } (evenement_planning
// de type "astreinte").
export function premierJourNonCouvert(
  evenements: { date_debut: string | null; date_fin: string | null }[],
  jours = 15
): string | null {
  const couverts = new Set<string>();
  for (const e of evenements) {
    if (!e.date_debut || !e.date_fin) continue;
    let d = e.date_debut;
    for (let garde = 0; d <= e.date_fin && garde < 400; garde++) {
      couverts.add(d);
      d = addIso(d, 1);
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < jours; i++) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + i);
    const iso = isoDate(dt);
    if (!couverts.has(iso)) return iso;
  }
  return null;
}

// Les astreintes sont-elles incomplètes (au moins un jour non couvert) ?
export function astreintesIncompletes(
  evenements: { date_debut: string | null; date_fin: string | null }[],
  jours = 15
): boolean {
  return premierJourNonCouvert(evenements, jours) !== null;
}
