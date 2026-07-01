import { ouvrirTemplate, nomPrescripteur, frDate, type DocOrdoData, type Pt } from "@/lib/pdfOverlay";

// Moteur générique d'ordonnances à modèle (overlay sur CERFA), piloté par config.
type Champ =
  | { k: "txt"; key: string; pos: Pt; size?: number; centre?: boolean; masque?: Rect; auto?: { key: string; option: string; valeur: string } }
  | { k: "date"; key: string; pos: Pt; size?: number }
  | { k: "lignes"; key: string; pos: Pt; lineH?: number }
  | { k: "radio" | "checks"; key: string; map: Record<string, Pt> }
  // Coche une case automatiquement si le champ `key` est rempli (ex. « Autres »).
  | { k: "cocheSi"; key: string; pos: Pt }
  // Phrase recomposée : {clé} remplacé par la valeur (sinon « ____ ») ;
  // suffixe ajouté seulement si la case suffixeSiCoche est cochée.
  | { k: "phrase"; modele: string; pos: Pt; size?: number; suffixe?: string; suffixeSiCoche?: { key: string; option: string } };

type Rect = [number, number, number, number];

type Conf = {
  template: string;
  presc?: Pt; rpps?: Pt; patient?: Pt; date?: Pt; signature?: Pt;
  patientGauche?: boolean; // nom patient aligné à gauche (sinon centré sur patient.x)
  rppsBarres?: Rect; // zone des |__| de l'identifiant à masquer
  blancs?: Rect[];
  textes?: { s: string; pos: Pt; size?: number }[]; // textes statiques (re)dessinés
  champs: Champ[];
};

// En-tête CERFA standard : nom + RPPS dans la case prescripteur (barres masquées), nom patient.
const STD = {
  presc: { x: 70, y: 128 } as Pt,
  rpps: { x: 86, y: 151 } as Pt,
  patient: { x: 296, y: 205 } as Pt, // centre de la case patient
  rppsBarres: [84, 144, 152, 12] as Rect,
};

// En-tête commun aux CERFA bizone ALD 14465*01 (identique sur les 12 modèles) :
// prescripteur (haut gauche), RPPS, patient (case centrale). Positions en points
// depuis le haut-gauche.
const BIZONE = {
  presc: { x: 46, y: 118 } as Pt,
  rpps: { x: 46, y: 141 } as Pt,
  patient: { x: 300, y: 205 } as Pt, // centre de la case patient (entre les 2 libellés)
};

export const CONFIGS: Record<string, Conf> = {
  // Remplace « Pharmacie (perfusion) » — ordonnance bizone ALD (cases vides, sans barres).
  pharma_perf: {
    template: "/ORDO%20PHARMA%20(2).pdf", presc: { x: 45, y: 78 }, rpps: { x: 45, y: 98 }, patient: { x: 440, y: 92 }, date: { x: 52, y: 256 }, signature: { x: 400, y: 615 },
    champs: [
      { k: "txt", key: "poches_50", pos: { x: 208, y: 386 } },
      { k: "txt", key: "poches_100", pos: { x: 217, y: 405 } },
      { k: "lignes", key: "molecules", pos: { x: 54, y: 428 }, lineH: 16 },
      { k: "txt", key: "qsp_jours", pos: { x: 65, y: 555 } },
    ],
  },
  ordo_pst: {
    template: "/ORDO%20PST.pdf", ...STD, date: { x: 478, y: 248 }, signature: { x: 390, y: 518 },
    champs: [{ k: "lignes", key: "protocole", pos: { x: 20, y: 330 }, lineH: 13 }],
  },
  ordo_pharma_npad: {
    template: "/ORDO%20PHARMA%20NPAD.pdf", presc: { x: 45, y: 78 }, rpps: { x: 45, y: 98 }, patient: { x: 440, y: 92 }, signature: { x: 400, y: 585 },
    blancs: [[62, 498, 34, 10], [163, 517, 24, 10]],
    textes: [{ s: "jours", pos: { x: 98, y: 505 } }, { s: "fois", pos: { x: 192, y: 524 } }],
    champs: [
      { k: "txt", key: "poches_50", pos: { x: 208, y: 337 } },
      { k: "txt", key: "poches_100", pos: { x: 214, y: 355 } },
      { k: "lignes", key: "nutrition", pos: { x: 54, y: 415 }, lineH: 16 },
      { k: "txt", key: "qsp_jours", pos: { x: 66, y: 505 } },
      { k: "txt", key: "renouvelable", pos: { x: 162, y: 524 } },
    ],
  },
  ordo_pharma_piccline: {
    template: "/ORDO%20PHARMA%20PICCLINE.pdf", ...STD, date: { x: 110, y: 283 }, signature: { x: 390, y: 572 },
    champs: [
      { k: "txt", key: "nacl_50", pos: { x: 176, y: 353 } },
      { k: "txt", key: "nacl_100", pos: { x: 180, y: 364 } },
      { k: "lignes", key: "autres", pos: { x: 20, y: 416 }, lineH: 15 },
      { k: "txt", key: "qsp_jours", pos: { x: 50, y: 467 } },
    ],
  },
  ordo_glycemie: {
    template: "/ORDO%20GLYCEMIE.pdf", ...STD, date: { x: 444, y: 269 }, signature: { x: 390, y: 560 },
    blancs: [[141, 453, 30, 11]], // masque « jours » imprimé (durée libre)
    champs: [
      { k: "lignes", key: "autres", pos: { x: 41, y: 374 }, lineH: 16 },
      { k: "txt", key: "ordonnance_jours", pos: { x: 130, y: 461 } },
    ],
  },
  ordo_taurolock: {
    template: "/ORDO%20TAUROLOCK.pdf", ...STD, date: { x: 506, y: 269 }, signature: { x: 390, y: 681 },
    champs: [
      { k: "lignes", key: "autres", pos: { x: 20, y: 434 }, lineH: 16 },
      { k: "txt", key: "qsp_jours", pos: { x: 50, y: 564 } },
      { k: "txt", key: "a_renouveler", pos: { x: 106, y: 576 } },
    ],
  },
  perfadom_npad: {
    template: "/PERFADOM%20NPAD.pdf", ...STD, date: { x: 440, y: 258 }, signature: { x: 390, y: 714 },
    blancs: [[120, 647, 28, 11]], // masque « jours » imprimé (durée libre)
    champs: [
      { k: "checks", key: "options", map: { "Première installation": { x: 31, y: 313 }, "12 premières semaines": { x: 31, y: 343 }, "Après les 12 premières semaines": { x: 29, y: 490 } } },
      { k: "txt", key: "jours7_avant", pos: { x: 40, y: 388 } },
      { k: "txt", key: "jours7_apres", pos: { x: 40, y: 549 } },
      { k: "lignes", key: "autres", pos: { x: 20, y: 618 }, lineH: 15 },
      { k: "txt", key: "ordonnance_jours", pos: { x: 106, y: 655 } },
    ],
  },
  ordo_idel_po: {
    template: "/ORDO%20IDEL%20PO%20ET%20CONSTANTES.pdf", ...STD, date: { x: 512, y: 258 }, signature: { x: 390, y: 493 },
    blancs: [[548, 250, 42, 12], [128, 422, 30, 11]], // « Fait le » décalé + « jours » masqué (durée libre)
    textes: [{ s: "Fait le", pos: { x: 478, y: 258 } }],
    champs: [
      { k: "lignes", key: "autres", pos: { x: 20, y: 390 }, lineH: 15 },
      { k: "txt", key: "ordonnance_jours", pos: { x: 113, y: 430 } },
      { k: "txt", key: "a_renouveler", pos: { x: 90, y: 445 } },
    ],
  },
  ordo_idel_npad: {
    template: "/ORDO%20IDEL%20NPAD.pdf", ...STD, date: { x: 516, y: 262 }, signature: { x: 470, y: 611 },
    // « jours » masqué (durée libre) + « Le » collé au bord + ligne de branchement réécrite
    blancs: [[112, 589, 40, 12], [567, 254, 22, 12], [48, 503, 458, 12]],
    textes: [{ s: "Le", pos: { x: 500, y: 262 } }],
    champs: [
      { k: "radio", key: "voie", map: { "Cathéter central": { x: 31, y: 361 }, "Picc-line": { x: 29, y: 390 }, "Chambre implantable": { x: 31, y: 420 } } },
      { k: "txt", key: "perfusion", pos: { x: 112, y: 465 } },
      { k: "phrase", pos: { x: 50, y: 511 }, size: 12, modele: "Avec un branchement à {heure_branchement} et un débranchement à {heure_debranchement}", suffixe: ", administration nocturne", suffixeSiCoche: { key: "nocturne", option: "Administration nocturne" } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 114, y: 597 } },
    ],
  },
  idel_kyste: {
    template: "/IDEL%20Kyste1.pdf", presc: { x: 90, y: 110 }, patient: { x: 450, y: 95 }, date: { x: 385, y: 177 }, signature: { x: 310, y: 597 },
    champs: [
      { k: "lignes", key: "autres", pos: { x: 43, y: 550 }, lineH: 14 },
      { k: "txt", key: "duree_jours", pos: { x: 80, y: 591 } },
    ],
  },
  // PDF image (sans couche texte) : en-tête + jours + signature (positions à affiner).
  nead: {
    template: "/NEAD%20Presta.pdf", presc: { x: 45, y: 80 }, rpps: { x: 45, y: 100 }, patient: { x: 465, y: 82 }, date: { x: 500, y: 198 }, signature: { x: 380, y: 765 },
    blancs: [[77, 708, 82, 24]], // efface entièrement « 14 jours » imprimé — ne reste que « QSP »
    champs: [
      { k: "checks", key: "produits", map: { "STANDARD": { x: 27, y: 270 }, "HYPERÉNERGÉTIQUE": { x: 27, y: 286 }, "HYPERÉNERGÉTIQUE HP": { x: 27, y: 300 }, "AUTRE": { x: 27, y: 314 } } },
      { k: "checks", key: "fibres", map: { "Fibres STANDARD": { x: 182, y: 270 }, "Fibres HYPERÉNERGÉTIQUE": { x: 182, y: 286 }, "Fibres HP": { x: 182, y: 300 }, "Fibres AUTRE": { x: 182, y: 314 } } },
      { k: "txt", key: "nom_std", pos: { x: 354, y: 270 }, centre: true, size: 11, masque: [228, 260, 252, 13] }, { k: "txt", key: "qte_std", pos: { x: 525, y: 270 }, centre: true, size: 11, masque: [482, 260, 87, 13] },
      { k: "txt", key: "nom_he", pos: { x: 354, y: 286 }, centre: true, size: 11, masque: [228, 276, 252, 13] }, { k: "txt", key: "qte_he", pos: { x: 525, y: 286 }, centre: true, size: 11, masque: [482, 276, 87, 13] },
      { k: "txt", key: "nom_hp", pos: { x: 354, y: 300 }, centre: true, size: 11, masque: [228, 290, 252, 13] }, { k: "txt", key: "qte_hp", pos: { x: 525, y: 300 }, centre: true, size: 11, masque: [482, 290, 87, 13] },
      { k: "txt", key: "nom_autre", pos: { x: 354, y: 314 }, centre: true, size: 11, masque: [228, 304, 252, 13] }, { k: "txt", key: "qte_autre", pos: { x: 525, y: 314 }, centre: true, size: 11, masque: [482, 304, 87, 13] },
      { k: "checks", key: "mode", map: { "Forfait Première Installation": { x: 20, y: 387 }, "Forfait 1 Sans Pompe": { x: 234, y: 387 }, "Forfait 2 Avec pompe": { x: 411, y: 387 }, "Location d'une Pompe Ambulatoire": { x: 20, y: 415 }, "Pied à sérum à roulettes": { x: 20, y: 427 } } },
      { k: "checks", key: "materiel", map: { "Sets de soins": { x: 20, y: 502 }, "Sonde Naso-Gastrique": { x: 20, y: 529 }, "Set de remplacement (sonde gastrostomie)": { x: 20, y: 556 }, "Bouton de gastrostomie": { x: 20, y: 582 }, "Prolongateur bouton de gastrostomie": { x: 20, y: 608 } } },
      { k: "txt", key: "frequence", pos: { x: 100, y: 663 } },
      { k: "txt", key: "debit", pos: { x: 70, y: 690 } },
      { k: "txt", key: "qsp", pos: { x: 81, y: 726 }, size: 11 },
    ],
  },
  nead_idel: {
    template: "/NEAD%20Idel%202.pdf", presc: { x: 45, y: 80 }, rpps: { x: 45, y: 100 }, patient: { x: 465, y: 82 }, date: { x: 500, y: 198 }, signature: { x: 400, y: 790 },
    champs: [
      { k: "checks", key: "admin", map: { "Pompe": { x: 21, y: 275 }, "Gravité": { x: 127, y: 275 }, "SNG": { x: 21, y: 291 }, "Sonde Naso-jéjunale": { x: 127, y: 291 }, "Bouton ou sonde de gastrostomie": { x: 270, y: 291 }, "Continu": { x: 21, y: 306 }, "Discontinu": { x: 127, y: 306 } } },
      { k: "radio", key: "per_os", map: { "OUI": { x: 21, y: 348 }, "NON": { x: 21, y: 364 } } },
      { k: "checks", key: "produits", map: { "STANDARD": { x: 25, y: 430 }, "HYPERÉNERGÉTIQUE": { x: 25, y: 444 }, "HYPERÉNERGÉTIQUE HP": { x: 25, y: 458 }, "AUTRE": { x: 25, y: 474 } } },
      { k: "checks", key: "fibres", map: { "Fibres STANDARD": { x: 182, y: 430 }, "Fibres HYPERÉNERGÉTIQUE": { x: 182, y: 444 }, "Fibres HP": { x: 182, y: 458 }, "Fibres AUTRE": { x: 182, y: 474 } } },
      { k: "txt", key: "nom_std", pos: { x: 354, y: 428 }, centre: true, size: 11, masque: [228, 418, 252, 13] }, { k: "txt", key: "qte_std", pos: { x: 525, y: 428 }, centre: true, size: 11, masque: [482, 418, 87, 13] },
      { k: "txt", key: "nom_he", pos: { x: 354, y: 442 }, centre: true, size: 11, masque: [228, 432, 252, 13] }, { k: "txt", key: "qte_he", pos: { x: 525, y: 442 }, centre: true, size: 11, masque: [482, 432, 87, 13] },
      { k: "txt", key: "nom_hp", pos: { x: 354, y: 456 }, centre: true, size: 11, masque: [228, 446, 252, 13] }, { k: "txt", key: "qte_hp", pos: { x: 525, y: 456 }, centre: true, size: 11, masque: [482, 446, 87, 13] },
      { k: "txt", key: "nom_autre", pos: { x: 354, y: 472 }, centre: true, size: 11, masque: [228, 462, 252, 13] }, { k: "txt", key: "qte_autre", pos: { x: 525, y: 472 }, centre: true, size: 11, masque: [482, 462, 87, 13] },
      { k: "txt", key: "frequence", pos: { x: 100, y: 720 } },
      { k: "txt", key: "renouveler", pos: { x: 210, y: 748 } },
    ],
  },

  // ── Catégorie ALD — CERFA bizone 14465*01 (en-tête BIZONE partagé) ──────────
  // NB : positions des champs variables à affiner à la génération test (phase 2).
  ald_pst: {
    template: "/PST%20ALD.pdf", ...BIZONE, date: { x: 430, y: 308 }, signature: { x: 380, y: 560 },
    blancs: [[44, 489, 20, 13], [102, 511, 9, 13]], // masque « 14 » (QSP) et « 2 » (renouveler)
    champs: [
      { k: "txt", key: "qsp_jours", pos: { x: 46, y: 499 } },
      { k: "txt", key: "a_renouveler", pos: { x: 103, y: 520 } },
    ],
  },
  ald_glycemie: {
    template: "/GLYCEMIE%20ALD.pdf", ...BIZONE, date: { x: 432, y: 309 }, signature: { x: 380, y: 560 },
    champs: [
      { k: "txt", key: "ordonnance_jours", pos: { x: 135, y: 470 } },
      { k: "txt", key: "a_renouveler", pos: { x: 118, y: 485 } },
    ],
  },
  ald_hemocs: {
    template: "/HEMOCS%20ALD.pdf", ...BIZONE, date: { x: 462, y: 310 }, signature: { x: 380, y: 590 },
    champs: [
      { k: "txt", key: "ordonnance_jours", pos: { x: 135, y: 527 } },
      { k: "txt", key: "a_renouveler", pos: { x: 118, y: 542 } },
    ],
  },
  ald_taurolock: {
    template: "/Taurolock%20ALD.pdf", ...BIZONE, date: { x: 415, y: 318 }, signature: { x: 380, y: 590 },
    champs: [
      { k: "txt", key: "qsp_jours", pos: { x: 52, y: 518 } },
      { k: "txt", key: "a_renouveler", pos: { x: 110, y: 530 } },
    ],
  },
  ald_pharma: {
    template: "/PHARMA%20ALD.pdf", ...BIZONE, date: { x: 430, y: 309 }, signature: { x: 380, y: 560 },
    // On masque « poches/jour » / « jours » imprimés et on réécrit « N poches/jour »
    // (chiffre devant, unité décalée à droite).
    blancs: [[149, 356, 86, 13], [141, 369, 82, 13], [58, 461, 46, 13]],
    champs: [
      { k: "phrase", modele: "{poches_100} poches/jour", pos: { x: 150, y: 365 } },
      { k: "phrase", modele: "{poches_50} poche/jour", pos: { x: 143, y: 378 } },
      { k: "phrase", modele: "{qsp_jours} jours", pos: { x: 44, y: 470 } },
    ],
  },
  ald_pharma_pac: {
    template: "/PHARMA%20PAC%20ALD.pdf", ...BIZONE, date: { x: 385, y: 324 }, signature: { x: 380, y: 560 },
    blancs: [[149, 387, 88, 14], [141, 400, 84, 14], [56, 503, 54, 14]],
    champs: [
      { k: "phrase", modele: "{poches_100} poches/jour", pos: { x: 150, y: 396 } },
      { k: "phrase", modele: "{poches_50} poche/jour", pos: { x: 143, y: 409 } },
      { k: "phrase", modele: "{qsp_jours} jours", pos: { x: 44, y: 512 } },
    ],
  },
  ald_bs: {
    template: "/ORDO%20BS%20ALD.pdf", ...BIZONE, date: { x: 460, y: 308 }, signature: { x: 380, y: 620 },
    champs: [
      { k: "radio", key: "voie", map: { "VVP": { x: 281, y: 331 }, "PAC": { x: 344, y: 331 }, "VVC": { x: 402, y: 331 }, "PICCLINE": { x: 489, y: 331 } } },
      { k: "checks", key: "analyses", map: { "NFS": { x: 22, y: 356 }, "Plaquettes": { x: 22, y: 369 }, "Ionogramme sanguin": { x: 22, y: 382 }, "Calcémie": { x: 22, y: 395 }, "Urée": { x: 22, y: 408 }, "Créatinémie": { x: 22, y: 422 }, "Albuminémie": { x: 22, y: 435 }, "Pré-albumine": { x: 22, y: 448 }, "VS": { x: 22, y: 461 }, "CRP + PCT": { x: 22, y: 474 }, "Transaminases SGOT SGPT": { x: 22, y: 487 }, "Gamma GT": { x: 22, y: 500 }, "Phosphatases alcalines": { x: 22, y: 513 }, "Bilirubine total": { x: 22, y: 526 } } },
      { k: "cocheSi", key: "autres", pos: { x: 24, y: 549 } },
      { k: "txt", key: "autres", pos: { x: 70, y: 549 } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 130, y: 630 } },
      { k: "txt", key: "a_renouveler", pos: { x: 118, y: 645 } },
    ],
  },
  ald_perfadom_npad: {
    template: "/PERFADOM%20NPAD%20ALD.pdf", ...BIZONE, date: { x: 450, y: 296 }, signature: { x: 380, y: 620 },
    blancs: [[122, 632, 42, 13]], // masque « jours » imprimé (durée libre : jour/semaine/mois)
    champs: [
      { k: "checks", key: "options", map: { "Première installation": { x: 31, y: 311 }, "12 premières semaines": { x: 31, y: 328 }, "Après les 12 premières semaines": { x: 31, y: 424 } } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 105, y: 640 } },
      { k: "txt", key: "a_renouveler", pos: { x: 80, y: 663 } },
    ],
  },
  ald_idel_npad: {
    template: "/IDEL%20NPAD%20ALD.pdf", ...BIZONE, date: { x: 420, y: 312 }, signature: { x: 380, y: 620 },
    champs: [
      { k: "radio", key: "voie", map: { "Cathéter central": { x: 22, y: 360 }, "Picc-line": { x: 22, y: 380 }, "Chambre implantable": { x: 22, y: 400 } } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 130, y: 650 } },
      { k: "txt", key: "a_renouveler", pos: { x: 118, y: 665 } },
    ],
  },
  ald_idel_pca: {
    template: "/IDEL%20PCA%20ALD.pdf", ...BIZONE, date: { x: 420, y: 312 }, signature: { x: 380, y: 640 },
    champs: [
      { k: "checks", key: "produit", map: { "Chlorhydrate de morphine": { x: 165, y: 405 }, "Oxynorm": { x: 315, y: 405 }, "Autre": { x: 420, y: 405 } } },
      { k: "txt", key: "concentration", pos: { x: 150, y: 460 } },
      { k: "txt", key: "debit_continu", pos: { x: 110, y: 490 } },
      { k: "txt", key: "debit_24h", pos: { x: 250, y: 490 } },
      { k: "txt", key: "bolus", pos: { x: 65, y: 520 } },
      { k: "txt", key: "interdiction_min", pos: { x: 300, y: 520 } },
      { k: "txt", key: "dose_24h", pos: { x: 250, y: 550 } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 130, y: 600 } },
      { k: "txt", key: "a_renouveler", pos: { x: 118, y: 615 } },
    ],
  },
  ald_idel_piccline: {
    template: "/IDEL%20ENTRETIEN%20PICCLINE%20ALD.pdf", ...BIZONE, date: { x: 420, y: 313 }, signature: { x: 380, y: 590 },
    blancs: [[114, 458, 14, 13], [101, 481, 13, 13]], // masque le « 1 » (MOIS) et le « 2 » (FOIS)
    champs: [
      { k: "txt", key: "ordonnance_jours", pos: { x: 116, y: 465 } },
      { k: "txt", key: "a_renouveler", pos: { x: 103, y: 488 } },
    ],
  },
  ald_idel: {
    template: "/ORDO%20IDEL%20ALD.pdf", ...BIZONE, date: { x: 420, y: 310 }, signature: { x: 380, y: 590 },
    champs: [
      { k: "txt", key: "ordonnance_jours", pos: { x: 116, y: 558 } },
      { k: "txt", key: "a_renouveler", pos: { x: 100, y: 588 } },
    ],
  },
};

export async function genererPdfModele(type: string, d: DocOrdoData, mode: "download" | "bloburl" = "download"): Promise<string | void> {
  const conf = CONFIGS[type];
  if (!conf) return;
  const { txt, txtC, coche, blanc, signer, finaliser } = await ouvrirTemplate(conf.template);
  if (conf.rppsBarres) blanc(...conf.rppsBarres);
  (conf.blancs ?? []).forEach((b) => blanc(...b));
  (conf.textes ?? []).forEach((t) => txt(t.s, t.pos, t.size));

  if (conf.presc) txt(nomPrescripteur(d), conf.presc);
  if (conf.rpps && d.prescripteurRpps) txt(`N° RPPS : ${d.prescripteurRpps}`, conf.rpps, 8);
  if (conf.patient) (conf.patientGauche ? txt : txtC)(d.patientNom, conf.patient);
  if (conf.date) txt(d.date || new Date().toLocaleDateString("fr-FR"), conf.date);

  const c = d.contenu;
  for (const ch of conf.champs) {
    if (ch.k === "txt") {
      let val = c[ch.key];
      if (ch.auto) {
        const cv = c[ch.auto.key];
        if (Array.isArray(cv) && (cv as string[]).includes(ch.auto.option)) val = ch.auto.valeur;
      }
      if (ch.masque && val != null && val !== "") blanc(...ch.masque);
      (ch.centre ? txtC : txt)(val, ch.pos, ch.size);
    } else if (ch.k === "date") txt(frDate(c[ch.key]), ch.pos);
    else if (ch.k === "lignes") {
      const v = typeof c[ch.key] === "string" ? (c[ch.key] as string).split("\n").filter((l) => l.trim()) : [];
      v.forEach((l, i) => txt(l.trim(), { x: ch.pos.x, y: ch.pos.y + i * (ch.lineH ?? 14) }));
    } else if (ch.k === "radio") {
      const v = c[ch.key] as string;
      if (v && ch.map[v]) coche(ch.map[v]);
    } else if (ch.k === "checks") {
      const arr = Array.isArray(c[ch.key]) ? (c[ch.key] as string[]) : [];
      arr.forEach((o) => { if (ch.map[o]) coche(ch.map[o]); });
    } else if (ch.k === "cocheSi") {
      const v = c[ch.key];
      if (v != null && String(v).trim() !== "") coche(ch.pos);
    } else if (ch.k === "phrase") {
      let s = ch.modele.replace(/\{(\w+)\}/g, (_, k) => { const v = c[k]; return v == null || v === "" ? "____" : String(v); });
      if (ch.suffixe && ch.suffixeSiCoche) {
        const cond = ch.suffixeSiCoche;
        const cv = c[cond.key];
        const ok = Array.isArray(cv) ? (cv as string[]).includes(cond.option) : cv === cond.option || cv === true;
        if (ok) s += ch.suffixe;
      } else if (ch.suffixe) s += ch.suffixe;
      txt(s, ch.pos, ch.size);
    }
  }
  if (conf.signature) await signer(d.signature, conf.signature);
  return finaliser(mode, `ordonnance-${type}.pdf`);
}
