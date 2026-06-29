import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export type BonPatient = {
  nom: string;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  telephone?: string | null;
};
export type BonLigne = { code: string; designation: string; quantite: number };
export type BonInfo = { reference: string; agence?: string | null; date?: Date };

const NOIR: [number, number, number] = [40, 40, 40];
const GRIS: [number, number, number] = [110, 110, 110];
const ROSE: [number, number, number] = [150, 20, 70];
const M = 15;

function fmtDate(d: Date) {
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function entete(doc: jsPDF, titre: string, info: BonInfo) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...ROSE);
  doc.text("AS2CŒUR", M, 16);
  doc.setFontSize(16); doc.setTextColor(...NOIR);
  doc.text(titre, M, 26);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text(`Référence : ${info.reference}`, M, 33);
  doc.text(`Date : ${fmtDate(info.date ?? new Date())}`, M, 38);
  if (info.agence) doc.text(`Agence : ${info.agence}`, M, 43);
}

function blocPatient(doc: jsPDF, p: BonPatient, y: number) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text("LIVRER À", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...NOIR);
  doc.text(p.nom, M, y + 6);
  const ville = [p.code_postal, p.ville].filter(Boolean).join(" ");
  const lignes = [p.adresse, ville, p.telephone ? `Tél. ${p.telephone}` : null].filter(Boolean) as string[];
  lignes.forEach((l, i) => doc.text(l, M, y + 12 + i * 5));
  return y + 12 + lignes.length * 5 + 4;
}

function tableArticles(doc: jsPDF, lignes: BonLigne[], y: number) {
  const xCode = M, xDes = M + 35, xQte = 210 - M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GRIS);
  doc.text("RÉFÉRENCE", xCode, y);
  doc.text("DÉSIGNATION", xDes, y);
  doc.text("QTÉ", xQte, y, { align: "right" });
  y += 2; doc.setDrawColor(220, 220, 225); doc.line(M, y, 210 - M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...NOIR);
  lignes.forEach((l) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(l.code, xCode, y);
    const des = l.designation.length > 60 ? l.designation.slice(0, 59) + "…" : l.designation;
    doc.text(des, xDes, y);
    doc.text(String(l.quantite), xQte, y, { align: "right" });
    y += 6;
  });
  const total = lignes.reduce((s, l) => s + l.quantite, 0);
  doc.setDrawColor(220, 220, 225); doc.line(M, y, 210 - M, y); y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`${lignes.length} référence(s) — ${total} unité(s)`, xCode, y);
  return y + 8;
}

// Bon de commande (panier de préparation).
export function genererBonCommande(info: BonInfo, patient: BonPatient, lignes: BonLigne[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  entete(doc, "BON DE COMMANDE", info);
  const y = blocPatient(doc, patient, 52);
  tableArticles(doc, lignes, y + 4);
  doc.save(`bon-commande-${info.reference}.pdf`);
}

// Bon de livraison avec QR (+ signature si fournie).
export async function genererBonLivraison(
  info: BonInfo, patient: BonPatient, lignes: BonLigne[], urlQR: string,
  signature?: { image: string; nom: string; date: Date } | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  entete(doc, "BON DE LIVRAISON", info);
  // QR en haut à droite
  try {
    const qr = await QRCode.toDataURL(urlQR, { margin: 0, width: 200 });
    doc.addImage(qr, "PNG", 210 - M - 28, 12, 28, 28);
    doc.setFontSize(7); doc.setTextColor(...GRIS);
    doc.text("Scannez pour ouvrir", 210 - M - 14, 43, { align: "center" });
  } catch { /* QR non bloquant */ }

  const y = blocPatient(doc, patient, 52);
  let yy = tableArticles(doc, lignes, y + 4);

  // Zone de signature
  if (yy > 240) { doc.addPage(); yy = 20; }
  yy += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text("BON POUR RÉCEPTION — signature du patient", M, yy);
  yy += 4;
  doc.setDrawColor(200, 200, 205); doc.roundedRect(M, yy, 80, 30, 2, 2);
  if (signature) {
    try { doc.addImage(signature.image, "PNG", M + 2, yy + 2, 76, 26); } catch { /* */ }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...NOIR);
    doc.text(`Signé par ${signature.nom} le ${fmtDate(signature.date)}`, M, yy + 36);
  }
  doc.save(`bon-livraison-${info.reference}${signature ? "-signe" : ""}.pdf`);
}

// Planche d'étiquettes QR (une par article) — le QR encode la référence,
// scannée à la préparation pour cocher le panier.
export async function genererEtiquettes(articles: { code: string; designation: string }[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const COLS = 3, RANGS = 8, CW = 63, CH = 33, X0 = 9, Y0 = 12;
  for (let i = 0; i < articles.length; i++) {
    if (i > 0 && i % (COLS * RANGS) === 0) doc.addPage();
    const a = articles[i];
    const idx = i % (COLS * RANGS);
    const x = X0 + (idx % COLS) * CW;
    const y = Y0 + Math.floor(idx / COLS) * CH;
    try {
      const qr = await QRCode.toDataURL(a.code, { margin: 0, width: 120 });
      doc.addImage(qr, "PNG", x, y, 22, 22);
    } catch { /* QR non bloquant */ }
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(...NOIR);
    const des = a.designation.length > 46 ? a.designation.slice(0, 45) + "…" : a.designation;
    doc.text(des, x + 24, y + 4, { maxWidth: CW - 25 });
    doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text(a.code, x + 24, y + 20);
  }
  doc.save("etiquettes-qr.pdf");
}
