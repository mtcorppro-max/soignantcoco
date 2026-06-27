import { ouvrirTemplate, nomPrescripteur, type DocOrdoData } from "@/lib/pdfOverlay";

const TEMPLATE = "/Pharma%20perf.pdf";

export async function genererPdfPharmaPerf(d: DocOrdoData, mode: "download" | "bloburl" = "download"): Promise<string | void> {
  const { txt, blanc, signer, finaliser } = await ouvrirTemplate(TEMPLATE);
  const c = d.contenu;

  // Masque la mention préimprimée « Centre Hospitalier de Perpignan / N° FINESS … ».
  blanc(335, 116, 210, 24);

  txt(nomPrescripteur(d), { x: 65, y: 128 });
  if (d.prescripteurRpps) txt(`RPPS ${d.prescripteurRpps}`, { x: 65, y: 143 }, 8);
  txt(d.patientNom, { x: 215, y: 210 });
  txt(d.date || new Date().toLocaleDateString("fr-FR"), { x: 450, y: 263 });

  txt(c.serum_100, { x: 148, y: 394 });
  txt(c.serum_50, { x: 143, y: 417 });

  // Molécules à commander : écrites ligne par ligne dans l'espace libre (sous « Container »).
  const molecules = typeof c.molecules === "string" ? c.molecules.split("\n").filter((l) => l.trim()) : [];
  molecules.forEach((ligne, i) => txt(ligne.trim(), { x: 14, y: 466 + i * 16 }));

  txt(c.qsp_jours, { x: 44, y: 543 });

  await signer(d.signature, { x: 392, y: 668 });
  return finaliser(mode, "ordonnance-pharmacie.pdf");
}
