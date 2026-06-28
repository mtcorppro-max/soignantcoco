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
};

// Compte de direction : pas de gestion de patients ; accès PEC (national) +
// annuaire « équipe dirigeante » uniquement. Créé seulement par un admin.
export const estDirigeant = (r: string | undefined | null) => r === "dirigeant";

// Un manager a les mêmes droits qu'une coordinatrice (+ des fonctions en plus).
export const estCoordOuManager = (r: string | undefined | null) =>
  r === "coordinatrice" || r === "manager";

// Comptes « service » (livreur, pharmacie) : pas de gestion d'équipe ni
// d'accès élargi. Ils se connectent et ne voient que les patients rattachés.
export const estRoleService = (r: string | undefined | null) =>
  r === "livreur" || r === "pharmacie";

// Matrice des droits (cf. §4 du cahier des charges).
export const peut = {
  ecrirePatient: (r: RolePro) => r === "coordinatrice",
  parametrerSeuils: (r: RolePro) => r === "coordinatrice",
  traiterAlerte: (r: RolePro) => r === "coordinatrice",
  saisirMesure: (r: RolePro) => r === "coordinatrice",
  messagerie: (r: RolePro) => r === "coordinatrice" || r === "manager" || r === "chirurgien",
};
