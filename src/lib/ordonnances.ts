// Registre des modèles d'ordonnance. Pour en ajouter une, il suffit d'ajouter
// une entrée ici : le formulaire de saisie et le rendu PDF sont génériques.

export type ChampOrdo =
  | { key: string; label: string; type: "text" | "textarea" | "date" | "number" }
  | { key: string; label: string; type: "radio" | "checkboxes"; options: string[] }
  | { key: string; label: string; type: "valeur_unite"; uniteKey: string; options: string[] }
  | { key: string; label: string; type: "section" };

export type ModeleOrdo = { id: string; label: string; description?: string; categorie?: string; champs: ChampOrdo[] };

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
      { key: "ordonnance_jours", label: "Ordonnance pour (durée, ex. 180 jours ou 6 mois)", type: "text" },
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
      { key: "ordonnance_jours", label: "Ordonnance pour (durée, ex. 180 jours ou 6 mois)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (fois)", type: "number" },
    ],
  },
  {
    id: "ordo_idel_npad",
    label: "IDEL — NPAD",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Cathéter central", "Picc-line", "Chambre implantable"] },
      { key: "perfusion", label: "Perfusion de", type: "text" },
      { key: "heure_branchement", label: "Heure de branchement", type: "text" },
      { key: "heure_debranchement", label: "Heure de débranchement", type: "text" },
      { key: "nocturne", label: "Administration nocturne", type: "checkboxes", options: ["Administration nocturne"] },
      { key: "ordonnance_jours", label: "Ordonnances pour (durée, ex. 180 jours ou 6 mois)", type: "text" },
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
      { key: "ordonnance_jours", label: "Ordonnances pour (durée, ex. 180 jours ou 6 mois)", type: "text" },
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
    label: "NEAD (nutrition entérale) — prestataire",
    champs: [
      { key: "produits", label: "Produit de nutrition", type: "checkboxes", options: ["STANDARD", "HYPERÉNERGÉTIQUE", "HYPERÉNERGÉTIQUE HP", "AUTRE"] },
      { key: "fibres", label: "Avec fibres", type: "checkboxes", options: ["Fibres STANDARD", "Fibres HYPERÉNERGÉTIQUE", "Fibres HP", "Fibres AUTRE"] },
      { key: "nom_std", label: "STANDARD — nom du produit", type: "text" },
      { key: "qte_std", label: "STANDARD — quantité par jour", type: "text" },
      { key: "nom_he", label: "HYPERÉNERGÉTIQUE — nom du produit", type: "text" },
      { key: "qte_he", label: "HYPERÉNERGÉTIQUE — quantité par jour", type: "text" },
      { key: "nom_hp", label: "HYPERÉNERGÉTIQUE HP — nom du produit", type: "text" },
      { key: "qte_hp", label: "HYPERÉNERGÉTIQUE HP — quantité par jour", type: "text" },
      { key: "nom_autre", label: "AUTRE — nom du produit", type: "text" },
      { key: "qte_autre", label: "AUTRE — quantité par jour", type: "text" },
      { key: "mode", label: "Mode d'administration", type: "checkboxes", options: ["Forfait Première Installation", "Forfait 1 Sans Pompe", "Forfait 2 Avec pompe", "Location d'une Pompe Ambulatoire", "Pied à sérum à roulettes"] },
      { key: "materiel", label: "Autre matériel", type: "checkboxes", options: ["Sets de soins", "Sonde Naso-Gastrique", "Set de remplacement (sonde gastrostomie)", "Bouton de gastrostomie", "Prolongateur bouton de gastrostomie"] },
      { key: "frequence", label: "Fréquence (jours sur 7)", type: "text" },
      { key: "debit", label: "Débit (ml/h)", type: "text" },
      { key: "qsp", label: "QSP (durée, ex. 21 jours)", type: "text" },
    ],
  },
  {
    id: "nead_idel",
    label: "NEAD — IDEL",
    champs: [
      { key: "admin", label: "Administration de l'alimentation entérale", type: "checkboxes", options: ["Pompe", "Gravité", "SNG", "Sonde Naso-jéjunale", "Bouton ou sonde de gastrostomie", "Continu", "Discontinu"] },
      { key: "per_os", label: "Alimentation Per Os autorisée", type: "radio", options: ["OUI", "NON"] },
      { key: "produits", label: "Produit de nutrition", type: "checkboxes", options: ["STANDARD", "HYPERÉNERGÉTIQUE", "HYPERÉNERGÉTIQUE HP", "AUTRE"] },
      { key: "fibres", label: "Avec fibres", type: "checkboxes", options: ["Fibres STANDARD", "Fibres HYPERÉNERGÉTIQUE", "Fibres HP", "Fibres AUTRE"] },
      { key: "nom_std", label: "STANDARD — nom du produit", type: "text" },
      { key: "qte_std", label: "STANDARD — quantité par jour", type: "text" },
      { key: "nom_he", label: "HYPERÉNERGÉTIQUE — nom du produit", type: "text" },
      { key: "qte_he", label: "HYPERÉNERGÉTIQUE — quantité par jour", type: "text" },
      { key: "nom_hp", label: "HYPERÉNERGÉTIQUE HP — nom du produit", type: "text" },
      { key: "qte_hp", label: "HYPERÉNERGÉTIQUE HP — quantité par jour", type: "text" },
      { key: "nom_autre", label: "AUTRE — nom du produit", type: "text" },
      { key: "qte_autre", label: "AUTRE — quantité par jour", type: "text" },
      { key: "frequence", label: "Fréquence (jours sur 7)", type: "text" },
      { key: "renouveler", label: "À renouveler", type: "text" },
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

  // ── Catégorie ALD (Affection Longue Durée) — CERFA bizone 14465*01 ──────────
  // Contenu majoritairement pré-imprimé : on ne saisit que l'en-tête (auto) et
  // quelques champs variables (durée, renouvellement, poches, cases à cocher).
  {
    id: "ald_pst", categorie: "ALD", label: "Pansement post-opératoire ALD",
    description: "Bizone ALD — protocole de pansement pré-imprimé.",
    champs: [
      { key: "qsp_jours", label: "QSP (nombre de jours)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre de fois)", type: "text" },
    ],
  },
  {
    id: "ald_glycemie", categorie: "ALD", label: "Surveillance glycémique ALD",
    description: "Bizone ALD — surveillance glycémique + insuline.",
    champs: [
      { key: "ordonnance_jours", label: "Ordonnance pour (durée, ex. 6 mois)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre)", type: "text" },
    ],
  },
  {
    id: "ald_hemocs", categorie: "ALD", label: "Hémocultures ALD",
    description: "Bizone ALD — 1 train d'hémocultures (PAC/PICC-line + périphérique).",
    champs: [
      { key: "ordonnance_jours", label: "Ordonnance pour (durée)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre)", type: "text" },
    ],
  },
  {
    id: "ald_taurolock", categorie: "ALD", label: "Verrou Taurolock ALD",
    description: "Bizone ALD — protocole Taurolock pré-imprimé.",
    champs: [
      { key: "qsp_jours", label: "QSP (jours)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre)", type: "text" },
    ],
  },
  {
    id: "ald_pharma", categorie: "ALD", label: "Pharmacie ALD",
    description: "Bizone ALD — Bétadine, Biseptine, sérum physio, tubifast, mepitel.",
    champs: [
      { key: "poches_100", label: "Sérum physiologique 100 mL (poches/jour)", type: "text" },
      { key: "poches_50", label: "Sérum physiologique 50 mL (poches/jour)", type: "text" },
      { key: "qsp_jours", label: "QSP (jours)", type: "text" },
    ],
  },
  {
    id: "ald_pharma_pac", categorie: "ALD", label: "Pharmacie PAC ALD",
    description: "Bizone ALD — matériel pansement chambre implantable (PAC).",
    champs: [
      { key: "poches_100", label: "Sérum physiologique 100 mL (poches/jour)", type: "text" },
      { key: "poches_50", label: "Sérum physiologique 50 mL (poches/jour)", type: "text" },
      { key: "qsp_jours", label: "QSP (jours)", type: "text" },
    ],
  },
  {
    id: "ald_bs", categorie: "ALD", label: "Bilan sanguin ALD",
    description: "Bizone ALD — bilan sanguin à domicile (à faxer ASDIA).",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["VVP", "PAC", "VVC", "PICCLINE"] },
      { key: "analyses", label: "À doser", type: "checkboxes", options: ["NFS", "Plaquettes", "Ionogramme sanguin", "Calcémie", "Urée", "Créatinémie", "Albuminémie", "Pré-albumine", "VS", "CRP + PCT", "Transaminases SGOT SGPT", "Gamma GT", "Phosphatases alcalines", "Bilirubine total"] },
      { key: "autres", label: "Autres", type: "text" },
      { key: "ordonnance_jours", label: "Ordonnance pour (durée)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre)", type: "text" },
    ],
  },
  {
    id: "ald_perfadom_npad", categorie: "ALD", label: "Perfadom NPAD ALD",
    description: "Bizone ALD — nutrition parentérale à domicile (forfaits).",
    champs: [
      { key: "options", label: "Forfaits", type: "checkboxes", options: ["Première installation", "12 premières semaines", "Après les 12 premières semaines"] },
      { key: "jours7_avant", label: "Prestation hebdo (12 premières sem.) — administrée … jours/7", type: "text" },
      { key: "jours7_apres", label: "Prestation hebdo (après 12 sem.) — administrée … jours/7", type: "text" },
      { key: "ordonnance_jours", label: "Ordonnance pour (durée, ex. 4 semaines / 6 mois)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre de fois)", type: "text" },
    ],
  },
  {
    id: "ald_idel_npad", categorie: "ALD", label: "IDEL NPAD ALD",
    description: "Bizone ALD — branchement/débranchement nutrition parentérale.",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Cathéter central", "Picc-line", "Chambre implantable"] },
      { key: "perfusion", label: "Programmation, pose et surveillance de la perfusion de", type: "textarea" },
      { key: "ordonnance_jours", label: "Ordonnance pour (durée, ex. 4 semaines / 6 mois)", type: "text" },
    ],
  },
  {
    id: "ald_idel_pca", categorie: "ALD", label: "IDEL PCA ALD",
    description: "Bizone ALD — mise en place et surveillance d'une PCA (délivrance antalgique).",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Cathéter central", "Picc line", "Chambre Implantable", "Voie veineuse périphérique ou sous cutanée"] },
      { key: "produit", label: "Programmation de la PCA — produit", type: "radio", options: ["Chlorhydrate de morphine", "Oxynorm", "Fentanyl"] },
      { key: "ampoule_mg", label: "Type d'ampoules (mg)", type: "text" },
      { key: "reservoir_ml", label: "Pour un réservoir de (ml)", type: "text" },
      { key: "concentration", label: "Soit une concentration de (mg/ml)", type: "text" },
      { key: "debit_mg_heure", label: "Débit continu (mg/heure)", type: "text" },
      { key: "debit_mg_24h", label: "Soit (mg par 24 heures)", type: "text" },
      { key: "bolus_mg", label: "Bolus de (mg)", type: "text" },
      { key: "interdiction_min", label: "Période d'interdiction (minutes)", type: "text" },
      { key: "dose_totale_24h", label: "Dose totale sur 24 h bolus compris (mg)", type: "text" },
      { key: "ordonnance_jours", label: "Ordonnance pour (durée)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre)", type: "text" },
    ],
  },
  {
    id: "ald_idel_piccline", categorie: "ALD", label: "IDEL Entretien PICC-line ALD",
    description: "Bizone ALD — entretien PICC-line.",
    champs: [
      { key: "ordonnance_jours", label: "Ordonnance pour (durée)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre de fois)", type: "text" },
    ],
  },
  {
    id: "ald_idel", categorie: "ALD", label: "IDEL ALD",
    description: "Bizone ALD — soins infirmiers à domicile.",
    champs: [
      { key: "voie", label: "Voie d'abord", type: "radio", options: ["Voie veineuse périphérique ou sous-cutanée", "Cathéter central", "PICC-line", "Chambre implantable"] },
      { key: "perfusion_produit", label: "Perfusion IV de (produit)", type: "text" },
      { key: "perfusion_volume", label: "Volume total de remplissage du diffuseur", type: "text" },
      { key: "perfusion_duree", label: "Durée de perfusion", type: "text" },
      { key: "ordonnance_jours", label: "Ordonnance pour (durée)", type: "text" },
      { key: "a_renouveler", label: "À renouveler (nombre)", type: "text" },
    ],
  },
];

// Ordonnance type (modèle pré-rempli) rattachée à un protocole.
export type OrdonnanceType = { id: string; nom: string; type: string; contenu: Record<string, unknown> };

export const modeleOrdo = (id: string) => MODELES_ORDONNANCE.find((m) => m.id === id);

// Modèles d'ordonnance destinés à la pharmacie (visibles par le compte
// pharmacie une fois l'ordonnance signée).
export const TYPES_ORDO_PHARMACIE = ["pharma_perf", "ordo_pharma_npad", "ordo_pharma_piccline"] as const;
export const estOrdoPharmacie = (type: string) =>
  (TYPES_ORDO_PHARMACIE as readonly string[]).includes(type);

// Repère « ordonnances pharmacie vues le » (epoch ms) par compte, en localStorage.
export const clePharmaVu = (proId: string) => `sc_pharma_vu_${proId}`;

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
