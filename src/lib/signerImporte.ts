// Incruste la signature du médecin sur une ordonnance importée (PDF ou photo).
// Retourne toujours un PDF (les images sont converties en page A4).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const estPdf = (bytes: ArrayBuffer, mime: string) =>
  mime === "application/pdf" || String.fromCharCode(...new Uint8Array(bytes.slice(0, 5))) === "%PDF-";

export async function signerFichierImporte(
  bytes: ArrayBuffer,
  mime: string,
  signatureDataUrl: string,
  signataire: string,
  dateFr: string,
): Promise<Uint8Array> {
  let out: PDFDocument;
  let page;

  if (estPdf(bytes, mime)) {
    out = await PDFDocument.load(bytes);
    const pages = out.getPages();
    page = pages[pages.length - 1]; // signature sur la dernière page
  } else {
    out = await PDFDocument.create();
    page = out.addPage([595.28, 841.89]); // A4
    let img;
    try { img = mime.includes("png") ? await out.embedPng(bytes) : await out.embedJpg(bytes); }
    catch { try { img = await out.embedPng(bytes); } catch { img = await out.embedJpg(bytes); } }
    const { width: PW, height: PH } = page.getSize();
    const m = 24, r = Math.min((PW - 2 * m) / img.width, (PH - 2 * m) / img.height);
    const dw = img.width * r, dh = img.height * r;
    page.drawImage(img, { x: (PW - dw) / 2, y: (PH - dh) / 2, width: dw, height: dh });
  }

  const W = page.getWidth();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const x = W - 210;

  // Cadre discret + signature en bas à droite.
  page.drawRectangle({ x: x - 8, y: 30, width: 200, height: 66, borderColor: rgb(0.8, 0.8, 0.83), borderWidth: 0.5 });
  try {
    const sig = await out.embedPng(signatureDataUrl);
    const sr = Math.min(150 / sig.width, 34 / sig.height);
    page.drawImage(sig, { x, y: 54, width: sig.width * sr, height: sig.height * sr });
  } catch { /* signature illisible : on garde au moins la mention */ }
  page.drawText(`Signé électroniquement par ${signataire}`, { x, y: 44, size: 6.5, font, color: rgb(0.3, 0.3, 0.35) });
  page.drawText(`le ${dateFr}`, { x, y: 35, size: 6.5, font, color: rgb(0.3, 0.3, 0.35) });

  return out.save();
}
