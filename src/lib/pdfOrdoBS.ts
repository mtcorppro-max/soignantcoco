import { ouvrirTemplate, nomPrescripteur, frDate, type DocOrdoData, type Pt } from "@/lib/pdfOverlay";

const TEMPLATE = "/ORDO%20BS.pdf";

const POS_VOIE: Record<string, Pt> = {
  VVP: { x: 279, y: 356 }, PAC: { x: 339, y: 356 }, VVC: { x: 401, y: 356 }, PICCLINE: { x: 487, y: 356 },
};
const POS_ANALYSE: Record<string, Pt> = {
  "NFS": { x: 20, y: 381 }, "Plaquettes": { x: 20, y: 394 }, "Ionogramme sanguin": { x: 20, y: 407 },
  "Calcémie": { x: 20, y: 420 }, "Urée": { x: 20, y: 433 }, "Créatinémie": { x: 20, y: 446 },
  "Albuminémie": { x: 20, y: 459 }, "Pré-albumine": { x: 20, y: 472 }, "VS": { x: 20, y: 485 },
  "CRP": { x: 20, y: 498 }, "Transaminases SGOT SGPT": { x: 20, y: 511 }, "Gamma GT": { x: 20, y: 524 },
  "Phosphatases alcalines": { x: 20, y: 537 }, "Bilirubine total": { x: 20, y: 550 },
};

export async function genererPdfOrdoBS(d: DocOrdoData, mode: "download" | "bloburl" = "download"): Promise<string | void> {
  const { txt, coche, blanc, signer, finaliser } = await ouvrirTemplate(TEMPLATE);
  const c = d.contenu;

  txt(nomPrescripteur(d), { x: 70, y: 128 });
  blanc(84, 134, 130, 12); // masque les barres |__|__| de l'identifiant
  if (d.prescripteurRpps) txt(`N° RPPS : ${d.prescripteurRpps}`, { x: 86, y: 143 }, 8);
  txt(d.patientNom, { x: 215, y: 212 });
  txt(d.date || new Date().toLocaleDateString("fr-FR"), { x: 32, y: 308 });

  const voie = c.voie as string;
  if (voie && POS_VOIE[voie]) coche(POS_VOIE[voie]);
  const analyses = Array.isArray(c.analyses) ? (c.analyses as string[]) : [];
  analyses.forEach((a) => { if (POS_ANALYSE[a]) coche(POS_ANALYSE[a]); });

  txt(c.autres, { x: 70, y: 574 });
  txt(frDate(c.a_faire_le), { x: 375, y: 407 });

  await signer(d.signature, { x: 390, y: 690 });
  return finaliser(mode, "ordonnance-bilan-sanguin.pdf");
}
