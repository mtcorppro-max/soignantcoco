import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Pt = { x: number; y: number }; // y depuis le HAUT de la page

// Ouvre un PDF modèle (page 1) et fournit des helpers pour écrire par-dessus.
export async function ouvrirTemplate(path: string) {
  const tplBytes = await fetch(path).then((r) => r.arrayBuffer());
  const tpl = await PDFDocument.load(tplBytes);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(tpl, [0]);
  out.addPage(page);
  const font = await out.embedFont(StandardFonts.Helvetica);
  const H = page.getHeight();

  const txt = (s: unknown, p: Pt, size = 9) => {
    if (s == null || s === "") return;
    page.drawText(String(s), { x: p.x, y: H - p.y, size, font, color: rgb(0.1, 0.1, 0.12) });
  };
  const coche = (p: Pt) => page.drawText("X", { x: p.x, y: H - p.y, size: 10, font, color: rgb(0.75, 0.1, 0.36) });
  // Masque une zone (rectangle blanc) — yTop = bord haut de la zone.
  const blanc = (x: number, yTop: number, w: number, h: number) => page.drawRectangle({ x, y: H - yTop - h, width: w, height: h, color: rgb(1, 1, 1) });
  const signer = async (dataUrl: string | null | undefined, p: Pt, w = 95, h = 28) => {
    if (!dataUrl) return;
    try { const png = await out.embedPng(dataUrl); page.drawImage(png, { x: p.x, y: H - p.y - h, width: w, height: h }); } catch { /* */ }
  };
  const finaliser = async (mode: "download" | "bloburl", filename: string): Promise<string | void> => {
    const bytes = await out.save();
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    if (mode === "bloburl") return url;
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return { txt, coche, blanc, signer, finaliser };
}

export const frDate = (v: unknown) => (v ? new Date(v as string).toLocaleDateString("fr-FR") : "");

// Données communes passées aux ordonnances à modèle.
export type DocOrdoData = {
  patientNom: string;
  prescripteurNom?: string | null;
  prescripteurPrenom?: string | null;
  prescripteurTitre?: string | null;
  prescripteurRpps?: string | null;
  date?: string | null; // JJ/MM/AAAA
  contenu: Record<string, unknown>;
  signature?: string | null;
};

export const nomPrescripteur = (d: DocOrdoData) =>
  [d.prescripteurTitre, d.prescripteurPrenom, d.prescripteurNom].filter(Boolean).join(" ");
