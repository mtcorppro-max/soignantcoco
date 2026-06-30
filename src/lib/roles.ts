import type { RolePro } from "./types";

export const LIBELLE_ROLE: Record<RolePro, string> = {
  coordinatrice: "Coordinatrice",
  manager: "Manager",
  chirurgien: "Chirurgien",
  delegue: "Délégué médical",
  infirmiere_liberale: "Infirmière libérale",
  livreur: "Livreur",
  pharmacie: "Pharmacie",
  dirigeant: "Dirigeant",
  magasinier: "Magasinier",
  rh: "Ressources humaines",
  personnel: "Personnel",
};

// RH : compte « hors niveau d'accès ». Aucun accès patient, mais lecture de tout
// le personnel interne (annuaire des équipes). Créé seulement par un admin.
export const estRh = (r: string | undefined | null) => r === "rh";

// Personnel : compte interne générique, hors niveau d'accès (aucun patient).
// Sa dénomination de poste est gérée par RH / dirigeant / manager.
export const estPersonnel = (r: string | undefined | null) => r === "personnel";

// Peut gérer l'annuaire & les postes du personnel : RH, dirigeant, manager, admin.
export const peutGererPersonnel = (role: string | undefined | null, niveau: number | undefined | null) =>
  niveau === 0 || role === "rh" || role === "dirigeant" || role === "manager";

// Accès à l'espace Marketing : dirigeant, RH, manager, délégué (+ admin niveau 0).
export const peutMarketing = (role: string | undefined | null, niveau: number | undefined | null) =>
  niveau === 0 || role === "dirigeant" || role === "rh" || role === "manager" || role === "delegue";

// Magasinier : gère le stock et la préparation des commandes (pas de patient).
export const estMagasinier = (r: string | undefined | null) => r === "magasinier";

// Compte de direction : pas de gestion de patients ; accès PEC (national) +
// annuaire « équipe dirigeante » uniquement. Créé seulement par un admin.
export const estDirigeant = (r: string | undefined | null) => r === "dirigeant";

// Un manager a les mêmes droits qu'une coordinatrice (+ des fonctions en plus).
export const estCoordOuManager = (r: string | undefined | null) =>
  r === "coordinatrice" || r === "manager";

// Comptes « service » (livreur, pharmacie) : pas de gestion d'équipe ni
// d'accès élargi. Ils se connectent et ne voient que les patients rattachés.
export const estRoleService = (r: string | undefined | null) =>
  r === "livreur" || r === "pharmacie" || r === "magasinier";

// Matrice des droits (cf. §4 du cahier des charges).
export const peut = {
  ecrirePatient: (r: RolePro) => r === "coordinatrice",
  parametrerSeuils: (r: RolePro) => r === "coordinatrice",
  traiterAlerte: (r: RolePro) => r === "coordinatrice",
  saisirMesure: (r: RolePro) => r === "coordinatrice",
  messagerie: (r: RolePro) => r === "coordinatrice" || r === "manager" || r === "chirurgien",
};
