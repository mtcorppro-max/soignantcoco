import { MODELES_ORDONNANCE, valeurLisible } from "@/lib/ordonnances";

const ROSE: [number, number, number] = [190, 24, 93];
const GRIS: [number, number, number] = [90, 90, 90];
const NOIR: [number, number, number] = [40, 40, 40];

export type OrdonnancePdf = {
  type: string;
  titre: string;
  contenu: Record<string, unknown>;
  patientNom: string;
  prescripteurNom: string;
  prescripteurRpps?: string | null;
  signature?: string | null;
  signataireNom?: string | null;
  signeeLe?: string | null;
  date?: string | null;
};

async function chargerImage(path: string): Promise<{ url: string; w: number; h: number } | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    const dim = await new Promise<{ w: number; h: number }>((r) => { const im = new Image(); im.onload = () => r({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => r({ w: 0, h: 0 }); im.src = url; });
    return { url, ...dim };
  } catch { return null; }
}

export async function genererPdfOrdonnance(d: OrdonnancePdf, mode: "download" | "bloburl" = "download"): Promise<string | void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 16;
  const L = 210 - M * 2;

  const logo = await chargerImage("/logo-as2coeur-trim.png");
  if (logo?.url) { try { doc.addImage(logo.url, "PNG", M, 11, 52, 11); } catch { /* */ } }

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...NOIR);
  doc.text("Ordonnance", 210 - M, 16, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...GRIS);
  doc.text(`Établie le ${d.date || new Date().toLocaleDateString("fr-FR")}`, 210 - M, 21, { align: "right" });

  let y = 30;
  doc.setDrawColor(...ROSE); doc.setLineWidth(0.4); doc.line(M, y, 210 - M, y); y += 8;

  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...ROSE);
  doc.text(d.titre, 105, y, { align: "center" }); y += 9;

  const info = (label: string, valeur: string) => {
    if (!valeur) return;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...NOIR);
    const w = doc.splitTextToSize(valeur, L - 42);
    doc.text(w, M + 42, y);
    y += Math.max(w.length * 5, 6);
  };
  info("Patient :", d.patientNom);
  info("Prescripteur :", [d.prescripteurNom, d.prescripteurRpps ? `RPPS ${d.prescripteurRpps}` : ""].filter(Boolean).join(" — "));

  y += 4;
  doc.setDrawColor(244, 200, 220); doc.setLineWidth(0.2); doc.line(M, y, 210 - M, y); y += 8;

  // Champs du modèle
  const modele = MODELES_ORDONNANCE.find((m) => m.id === d.type);
  const champs = modele?.champs ?? [];
  champs.forEach((c) => {
    const val = valeurLisible(c, d.contenu[c.key]);
    if (!val || !val.trim()) return;
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...ROSE);
    doc.text(c.label, M, y); y += 5.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...NOIR);
    const w = doc.splitTextToSize(val, L);
    doc.text(w, M, y); y += w.length * 5 + 4;
  });

  // Signature
  y = Math.max(y, 235);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...GRIS);
  doc.text("Signature du médecin :", M, y);
  if (d.signature) {
    try { doc.addImage(d.signature, "PNG", M, y + 3, 55, 22); } catch { /* */ }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text(`${d.signataireNom ?? ""}${d.signeeLe ? ` — signé le ${new Date(d.signeeLe).toLocaleDateString("fr-FR")}` : ""}`, M, y + 28);
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...GRIS);
    doc.text("(en attente de signature)", M, y + 8);
  }

  const asdia = await chargerImage("/logoasdia.jpg");
  if (asdia?.w) {
    const w = 24; const h = (asdia.h * w) / asdia.w;
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.addImage(asdia.url, "JPEG", 105 - w / 2, 297 - 10 - h, w, h); }
  }

  if (mode === "bloburl") return doc.output("bloburl") as unknown as string;
  doc.save(`ordonnance-${d.titre.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
