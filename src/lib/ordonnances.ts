// Registre des modèles d'ordonnance. Pour en ajouter une, il suffit d'ajouter
// une entrée ici : le formulaire de saisie et le rendu PDF sont génériques.

export type ChampOrdo =
  | { key: string; label: string; type: "text" | "textarea" | "date" | "number" }
  | { key: string; label: string; type: "radio" | "checkboxes"; options: string[] }
  | { key: string; label: string; type: "valeur_unite"; uniteKey: string; options: string[] }
  | { key: string; label: string; type: "section" };

export type ModeleOrdo = { id: string; label: string; description?: string; champs: ChampOrdo[] };

export const MODELES_ORDONNANCE: ModeleOrdo[] = [
  {
    id: "perfusion_domicile",
    label: "Perfadom",
    champs: [
      { key: "type_demande", label: "Type de demande", type: "radio", options: ["Initiation d'une perfusion à domicile", "Renouvellement ou modification"] },

      { key: "_sec1", label: "Produit à perfuser n°1", type: "section" },
      { key: "produit", label: "Dénomination du produit (dosage, posologie, solvant…)", type: "textarea" },
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Veineuse centrale (VC)", "Chambre implantable", "Cathéter central", "PICC-line", "Péri-nerveuse", "Veineuse périphérique", "Sous-cutanée"] },
      { key: "mode", label: "Mode d'administration", type: "radio", options: ["Gravité", "Diffuseur", "Système actif électrique", "Transfuseur"] },
      { key: "duree_valeur", uniteKey: "duree_unite", label: "Durée d'une perfusion", type: "valeur_unite", options: ["minutes", "heures"] },
      { key: "nb_perfusions", label: "Nombre total de perfusions", type: "number" },
      { key: "frequence_nb", uniteKey: "frequence_periode", label: "Fréquence (nombre de perfusions par…)", type: "valeur_unite", options: ["jour", "semaine", "mois"] },
      { key: "date_debut", label: "Date de début de la cure", type: "date" },
      { key: "date_fin", label: "Date de fin de la cure", type: "date" },

      { key: "_sec2", label: "Produit à perfuser n°2", type: "section" },
      { key: "produit2", label: "Dénomination du produit (dosage, posologie, solvant…)", type: "textarea" },
      { key: "voie2", label: "Voie d'abord", type: "radio", options: ["Veineuse centrale (VC)", "Chambre implantable", "Cathéter central", "PICC-line", "Péri-nerveuse", "Veineuse périphérique", "Sous-cutanée"] },
      { key: "mode2", label: "Mode d'administration", type: "radio", options: ["Gravité", "Diffuseur", "Système actif électrique", "Transfuseur"] },
      { key: "duree_valeur2", uniteKey: "duree_unite2", label: "Durée d'une perfusion", type: "valeur_unite", options: ["minutes", "heures"] },
      { key: "nb_perfusions2", label: "Nombre total de perfusions", type: "number" },
      { key: "frequence_nb2", uniteKey: "frequence_periode2", label: "Fréquence (nombre de perfusions par…)", type: "valeur_unite", options: ["jour", "semaine", "mois"] },
      { key: "date_debut2", label: "Date de début de la cure", type: "date" },
      { key: "date_fin2", label: "Date de fin de la cure", type: "date" },
    ],
  },
  {
    id: "ordo_bs",
    label: "Bilan sanguin",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["VVP", "PAC", "VVC", "PICCLINE"] },
      { key: "analyses", label: "À doser dans le sang", type: "checkboxes", options: ["NFS", "Plaquettes", "Ionogramme sanguin", "Calcémie", "Urée", "Créatinémie", "Albuminémie", "Pré-albumine", "VS", "CRP", "Transaminases SGOT SGPT", "Gamma GT", "Phosphatases alcalines", "Bilirubine total"] },
      { key: "autres", label: "Autres dosages", type: "text" },
      { key: "a_faire_le", label: "À faire le", type: "date" },
    ],
  },
  {
    id: "pharma_perf",
    label: "Pharmacie",
    champs: [
      { key: "poches_50", label: "Poches NaCl 0,9% 50 mL (/jour)", type: "number" },
      { key: "poches_100", label: "Poches NaCl 0,9% 100 mL (/jour)", type: "number" },
      { key: "molecules", label: "Molécules à commander (une par ligne)", type: "textarea" },
      { key: "qsp_jours", label: "QSP (jours)", type: "number" },
    ],
  },
  {
    id: "ordo_pharma_npad",
    label: "Pharmacie — NPAD",
    champs: [
      { key: "poches_50", label: "Poches NaCl 0,9% 50 mL", type: "number" },
      { key: "poches_100", label: "Poches NaCl 0,9% 100 mL", type: "number" },
      { key: "nutrition", label: "Poches de nutrition et vitamines (une par ligne)", type: "textarea" },
      { key: "qsp_jours", label: "QSP (jours)", type: "number" },
      { key: "renouvelable", label: "Renouvelable (fois)", type: "number" },
    ],
  },
  {
    id: "ordo_pharma_piccline",
    label: "Pharmacie — PICC-line",
    champs: [
      { key: "nacl_50", label: "NaCl 0,9% 50 mL (/jour)", type: "number" },
      { key: "nacl_100", label: "NaCl 0,9% 100 mL (/jour)", type: "number" },
      { key: "autres", label: "Autres (une par ligne)", type: "textarea" },
      { key: "qsp_jours", label: "QSP (jours)", type: "number" },
    ],
  },
  {
    id: "ordo_pst",
    label: "Pansement post-opératoire (IDEL)",
    champs: [{ key: "protocole", label: "Protocole de pansement (une ligne par consigne)", type: "textarea" }],
  },
  {
    id: "ordo_glycemie",
    label: "Surveillance glycémique (IDEL)",
    champs: [
      { key: "autres", label: "Autres (une par ligne)", type: "textarea" },
      { key: "ordonnance_jours", label: "Ordonnance pour (jours)", type: "number" },
    ],
  },
  {
    id: "ordo_taurolock",
    label: "Verrou Taurolock (IDEL)",
    champs: [
      { key: "autres", label: "Autres (une par ligne)", type: "textarea" },
      { key: "qsp_jours", label: "QSP (jours)", type: "number" },
      { key: "a_renouveler", label: "À renouveler (fois)", type: "text" },
    ],
  },
  {
    id: "ordo_idel_po",
    label: "IDEL — PO & constantes",
    champs: [
      { key: "autres", label: "Autres (une par ligne)", type: "textarea" },
      { key: "ordonnance_jours", label: "Ordonnance pour (jours)", type: "number" },
      { key: "a_renouveler", label: "À renouveler (fois)", type: "number" },
    ],
  },
  {
    id: "ordo_idel_npad",
    label: "IDEL — NPAD",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Cathéter central", "Picc-line", "Chambre implantable"] },
      { key: "perfusion", label: "Perfusion de", type: "text" },
      { key: "ordonnance_jours", label: "Ordonnances pour (jours)", type: "number" },
    ],
  },
  {
    id: "perfadom_npad",
    label: "Perfadom — NPAD",
    champs: [
      { key: "options", label: "Forfaits", type: "checkboxes", options: ["Première installation", "12 premières semaines", "Après les 12 premières semaines"] },
      { key: "jours7_avant", label: "Administrée … jours/7 (12 premières sem.)", type: "number" },
      { key: "jours7_apres", label: "Administrée … jours/7 (après 12 sem.)", type: "number" },
      { key: "autres", label: "Autres (une par ligne)", type: "textarea" },
      { key: "ordonnance_jours", label: "Ordonnances pour (jours)", type: "number" },
    ],
  },
  {
    id: "idel_kyste",
    label: "IDEL — Pansement de kyste",
    champs: [
      { key: "autres", label: "Autres (une par ligne)", type: "textarea" },
      { key: "duree_jours", label: "Durée (jours)", type: "number" },
    ],
  },
  {
    id: "nead",
    label: "NEAD (nutrition entérale)",
    champs: [
      { key: "ordonnance_jours", label: "Ordonnance pour (jours)", type: "number" },
      { key: "a_renouveler", label: "À renouveler (fois)", type: "text" },
    ],
  },
  {
    id: "nead_idel",
    label: "NEAD — IDEL",
    champs: [
      { key: "ordonnance_jours", label: "Ordonnance pour (jours)", type: "number" },
      { key: "a_renouveler", label: "À renouveler (fois)", type: "text" },
    ],
  },
  {
    id: "idel_perf",
    label: "IDEL (soins de perfusion)",
    champs: [
      { key: "date_debut_soins", label: "Date de début des soins", type: "date" },
      { key: "voie", label: "Par voie d'abord", type: "radio", options: ["Périphérique", "PICC-line", "Cathéter central", "Chambre Implantable", "Sous cutanée"] },
      { key: "mode", label: "Traitement à administrer par", type: "radio", options: ["Pompe en continu ou discontinu", "Diffuseur", "Gravité", "Pousse seringue électrique"] },
      { key: "perfusion_1", label: "1/ Perfusion de", type: "textarea" },
      { key: "perfusion_2", label: "2/ Perfusion de", type: "textarea" },
      { key: "duree_jours", label: "D'une durée de (jours)", type: "number" },
    ],
  },
];

// Ordonnance type (modèle pré-rempli) rattachée à un protocole.
export type OrdonnanceType = { id: string; nom: string; type: string; contenu: Record<string, unknown> };

export const modeleOrdo = (id: string) => MODELES_ORDONNANCE.find((m) => m.id === id);

// Représentation lisible d'un champ (à partir du contenu complet de l'ordonnance).
export function valeurLisible(champ: ChampOrdo, contenu: Record<string, unknown>): string {
  if (champ.type === "section") return "";
  const v = contenu[champ.key];
  if (champ.type === "checkboxes") return Array.isArray(v) ? v.join(", ") : "";
  if (champ.type === "valeur_unite") {
    const u = contenu[champ.uniteKey];
    return v != null && v !== "" ? `${v} ${u ?? ""}`.trim() : "";
  }
  if (v == null) return "";
  return String(v);
}
