import type { RolePro } from "./types";

export const LIBELLE_ROLE: Record<RolePro, string> = {
  coordinatrice: "Coordinatrice",
  chirurgien: "Chirurgien",
  delegue: "Délégué médical",
};

// Matrice des droits (cf. §4 du cahier des charges).
export const peut = {
  ecrirePatient: (r: RolePro) => r === "coordinatrice",
  parametrerSeuils: (r: RolePro) => r === "coordinatrice",
  traiterAlerte: (r: RolePro) => r === "coordinatrice",
  saisirMesure: (r: RolePro) => r === "coordinatrice",
  messagerie: (r: RolePro) => r === "coordinatrice" || r === "chirurgien",
};
