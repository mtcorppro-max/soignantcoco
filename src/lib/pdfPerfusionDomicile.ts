import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TEMPLATE = "/formulaire-prescription_perfusions_urps-ph-paca-2016.pdf";

export type PerfDomicileData = {
  patientNom: string;
  patientNaissance?: string | null;   // ISO
  prescripteurNom?: string | null;
  prescripteurPrenom?: string | null;
  prescripteurRpps?: string | null;
  prescripteurStructure?: string | null; // raison sociale / lieu d'exercice
  date?: string | null;                // date de prescription (JJ/MM/AAAA)
  contenu: Record<string, unknown>;
  signature?: string | null;
};

// Positions (points, repère depuis le HAUT de la page A4 595x842).
const POS = {
  initiation: { x: 25, y: 73 },
  presta_22: { x: 270, y: 203 },         // case 2.2 (Ville)
  patient_nom: { x: 300, y: 60 },
  presc_nom: { x: 55, y: 122 },
  presc_prenom: { x: 58, y: 134 },
  presc_rpps: { x: 90, y: 159 },
  struct_raison: { x: 320, y: 122 },
  struct_adresse: { x: 300, y: 134 },
  produit: { x: 52, y: 335 },
  duree_h: { x: 190, y: 383 },
  duree_min: { x: 252, y: 383 },
  nb_perfusions: { x: 140, y: 407 },
  frequence_nb: { x: 231, y: 411 },
  signature: { x: 405, y: 805 },
};
const POS_FREQ: Record<string, { x: number; y: number }> = {
  jour: { x: 290, y: 396 },
  semaine: { x: 290, y: 404 },
  mois: { x: 289, y: 413 },
};
// Zones de cases-dates à effacer (barre blanche) puis réécrire : [xTop, yTop, largeur]
const BLANC = {
  date_presc: { x: 108, y: 61, w: 70 },
  naissance: { x: 340, y: 72, w: 72 },
  rpps: { x: 88, y: 159, w: 95 },
  cure_debut: { x: 46, y: 437, w: 77 },
  cure_fin: { x: 163, y: 437, w: 77 },
};
const POS_VOIE: Record<string, { x: number; y: number }> = {
  "Veineuse centrale (VC)": { x: 359, y: 301 },
  "Chambre implantable": { x: 375, y: 312 },
  "Cathéter central": { x: 375, y: 324 },
  "PICC-line": { x: 375, y: 335 },
  "Péri-nerveuse": { x: 359, y: 355 },
  "Veineuse périphérique": { x: 359, y: 367 },
  "Sous-cutanée": { x: 359, y: 380 },
};
const POS_MODE: Record<string, { x: number; y: number }> = {
  "Gravité": { x: 461, y: 301 },
  "Diffuseur": { x: 461, y: 313 },
  "Système actif électrique": { x: 461, y: 326 },
  "Transfuseur": { x: 461, y: 396 },
};

const frDate = (v: unknown) => (v ? new Date(v as string).toLocaleDateString("fr-FR") : "");

export async function genererPdfPerfusionDomicile(d: PerfDomicileData, mode: "download" | "bloburl" = "download"): Promise<string | void> {
  const tplBytes = await fetch(TEMPLATE).then((r) => r.arrayBuffer());
  const tpl = await PDFDocument.load(tplBytes);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(tpl, [0]);
  out.addPage(page);
  const font = await out.embedFont(StandardFonts.Helvetica);
  const H = page.getHeight();

  const txt = (s: string | null | undefined, p: { x: number; y: number }, size = 9) => {
    if (!s) return;
    page.drawText(String(s), { x: p.x, y: H - p.y, size, font, color: rgb(0.1, 0.1, 0.12) });
  };
  const coche = (p: { x: number; y: number }) => page.drawText("X", { x: p.x, y: H - p.y, size: 10, font, color: rgb(0.75, 0.1, 0.36) });
  const blanc = (z: { x: number; y: number; w: number }) => page.drawRectangle({ x: z.x, y: H - z.y - 2, width: z.w, height: 11, color: rgb(1, 1, 1) });

  const c = d.contenu;

  // En-tête : date de prescription (barres effacées), Initiation
  blanc(BLANC.date_presc); txt(d.date || new Date().toLocaleDateString("fr-FR"), { x: BLANC.date_presc.x + 2, y: BLANC.date_presc.y });
  coche(POS.initiation);

  // Patient : nom + date de naissance
  txt(d.patientNom, POS.patient_nom);
  if (d.patientNaissance) { blanc(BLANC.naissance); txt(frDate(d.patientNaissance), { x: BLANC.naissance.x + 2, y: BLANC.naissance.y }); }

  // Prescripteur + structure
  txt(d.prescripteurNom ?? "", POS.presc_nom);
  txt(d.prescripteurPrenom ?? "", POS.presc_prenom);
  if (d.prescripteurRpps) { blanc(BLANC.rpps); txt(d.prescripteurRpps, { x: BLANC.rpps.x + 2, y: BLANC.rpps.y }); }
  txt(d.prescripteurStructure ?? "", POS.struct_raison, 8);

  // Ville : toujours cocher 2.2
  coche(POS.presta_22);

  // Produit n°1
  txt(c.produit as string, POS.produit, 9);
  txt(c.duree_heures as string, POS.duree_h);
  txt(c.duree_minutes as string, POS.duree_min);
  txt(c.nb_perfusions as string, POS.nb_perfusions);
  txt(c.frequence_nb as string, POS.frequence_nb);
  const periode = c.frequence_periode as string;
  if (periode && POS_FREQ[periode]) coche(POS_FREQ[periode]);

  const voie = c.voie as string;
  if (voie && POS_VOIE[voie]) coche(POS_VOIE[voie]);
  const md = c.mode as string;
  if (md && POS_MODE[md]) coche(POS_MODE[md]);

  // Dates de cure (barres effacées)
  if (c.date_debut) { blanc(BLANC.cure_debut); txt(frDate(c.date_debut), { x: BLANC.cure_debut.x + 2, y: BLANC.cure_debut.y }); }
  if (c.date_fin) { blanc(BLANC.cure_fin); txt(frDate(c.date_fin), { x: BLANC.cure_fin.x + 2, y: BLANC.cure_fin.y }); }

  if (d.signature) {
    try {
      const png = await out.embedPng(d.signature);
      page.drawImage(png, { x: POS.signature.x, y: H - POS.signature.y, width: 95, height: 28 });
    } catch { /* */ }
  }

  const bytes = await out.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  if (mode === "bloburl") return url;
  const a = document.createElement("a");
  a.href = url; a.download = "prescription-perfusion-domicile.pdf"; a.click();
  URL.revokeObjectURL(url);
}
