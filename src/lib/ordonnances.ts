// Registre des modèles d'ordonnance. Pour en ajouter une, il suffit d'ajouter
// une entrée ici : le formulaire de saisie et le rendu PDF sont génériques.

export type ChampOrdo =
  | { key: string; label: string; type: "text" | "textarea" | "date" | "number" }
  | { key: string; label: string; type: "radio" | "checkboxes"; options: string[] };

export type ModeleOrdo = { id: string; label: string; description?: string; champs: ChampOrdo[] };

export const MODELES_ORDONNANCE: ModeleOrdo[] = [
  {
    id: "perfusion_domicile",
    label: "Prescription de perfusion à domicile",
    description: "Formulaire de prescription de perfusion à domicile (ville ou hôpital).",
    champs: [
      { key: "produit", label: "Dénomination du produit (dosage, posologie, solvant…)", type: "textarea" },
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Veineuse centrale (VC)", "Chambre implantable", "Cathéter central", "PICC-line", "Péri-nerveuse", "Veineuse périphérique", "Sous-cutanée"] },
      { key: "mode", label: "Mode d'administration", type: "radio", options: ["Gravité", "Diffuseur", "Système actif électrique", "Transfuseur"] },
      { key: "duree_perfusion", label: "Durée d'administration d'une perfusion", type: "text" },
      { key: "nb_perfusions", label: "Nombre total de perfusions", type: "number" },
      { key: "frequence", label: "Fréquence (par jour / semaine / mois)", type: "text" },
      { key: "date_debut", label: "Date de début de la cure", type: "date" },
      { key: "date_fin", label: "Date de fin de la cure", type: "date" },
    ],
  },
];

export const modeleOrdo = (id: string) => MODELES_ORDONNANCE.find((m) => m.id === id);

// Représentation lisible d'une valeur de champ pour l'affichage / le PDF.
export function valeurLisible(champ: ChampOrdo, valeur: unknown): string {
  if (champ.type === "checkboxes") return Array.isArray(valeur) ? valeur.join(", ") : "";
  if (valeur == null) return "";
  return String(valeur);
}
