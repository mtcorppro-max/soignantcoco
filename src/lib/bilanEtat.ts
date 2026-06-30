// Bilan « état général » — questionnaire court rempli par le patient.
export type QBilan = {
  id: string;
  label: string;
  type: "echelle" | "choix" | "ouinon" | "multi" | "texte";
  options?: string[];
};

export const QUESTIONS_BILAN: QBilan[] = [
  { id: "etat_general", label: "Comment vous sentez-vous globalement ?", type: "choix", options: ["Très bien", "Bien", "Moyen", "Pas bien"] },
  { id: "douleur", label: "Niveau de douleur (0 = aucune, 10 = maximale)", type: "echelle" },
  { id: "fievre", label: "Fièvre ou frissons ?", type: "ouinon" },
  { id: "sommeil", label: "Votre sommeil cette nuit", type: "choix", options: ["Bon", "Moyen", "Mauvais"] },
  { id: "appetit", label: "Votre appétit", type: "choix", options: ["Bon", "Moyen", "Faible"] },
  { id: "signes_locaux", label: "Au niveau du dispositif / de la cicatrice", type: "multi", options: ["Rougeur", "Gonflement", "Douleur", "Écoulement", "Chaleur", "Rien à signaler"] },
  { id: "nausees", label: "Nausées ou vomissements ?", type: "ouinon" },
  { id: "moral", label: "Votre moral", type: "choix", options: ["Bon", "Moyen", "Bas"] },
  { id: "commentaire", label: "Quelque chose à signaler ? (facultatif)", type: "texte" },
];

export type ReponsesBilan = Record<string, string | number | string[] | undefined>;

export function formatReponse(q: QBilan, v: string | number | string[] | undefined): string {
  if (v == null || v === "") return "—";
  if (q.type === "echelle") return `${v}/10`;
  if (q.type === "multi") return Array.isArray(v) ? v.join(", ") : String(v);
  return String(v);
}

// Une réponse préoccupante (à mettre en évidence côté soignant) ?
export function reponsePreoccupante(id: string, v: string | number | string[] | undefined): boolean {
  switch (id) {
    case "etat_general": return v === "Moyen" || v === "Pas bien";
    case "douleur": return typeof v === "number" && v >= 6;
    case "fievre": return v === "Oui";
    case "nausees": return v === "Oui";
    case "moral": return v === "Bas";
    case "appetit": return v === "Faible";
    case "sommeil": return v === "Mauvais";
    case "signes_locaux": return Array.isArray(v) && v.some((x) => x !== "Rien à signaler");
    default: return false;
  }
}
