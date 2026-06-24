import type { Patient, Suivi } from "@/lib/types";

const ROSE: [number, number, number] = [190, 24, 93];
const GRIS: [number, number, number] = [90, 90, 90];
const NOIR: [number, number, number] = [40, 40, 40];

function fdate(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.length > 10 ? new Date(iso) : null;
  if (d && !isNaN(d.getTime())) {
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

function age(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return `${a} ans`;
}

// Charge le logo Asdia depuis public/logoasdia.jpg.
async function chargerLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logoasdia.jpg");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Génère et télécharge le PDF "Compte rendu" d'une fiche de suivi.
export async function genererPdfSuivi(patient: Patient, s: Suivi) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 15; // marge
  const L = 210 - M * 2; // largeur utile
  const logo = await chargerLogo();

  // ── En-tête ───────────────────────────────────────────────────────
  if (logo) {
    try {
      doc.addImage(logo, "JPEG", M, 9, 46, 17);
    } catch {
      /* format non supporté : on ignore */
    }
  } else {
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(15);
    doc.setTextColor(...ROSE);
    doc.text("Asdia", M, 18);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "italic");
    doc.text("perfusion", M + 21, 18);
  }

  // Titre centré
  doc.setFont("times", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(...NOIR);
  doc.text(patient.nom, 118, 16, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...NOIR);
  doc.text(`Compte rendu du ${fdate(s.created_at)}`, 118, 24, { align: "center" });

  if (patient.operation || patient.date_operation) {
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    const sub = [
      patient.operation ? `Opération : ${patient.operation}` : "",
      patient.date_operation ? `le ${fdate(patient.date_operation)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    doc.text(sub, 118, 29, { align: "center" });
  }

  let y = 36;
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.4);
  doc.line(M, y, 210 - M, y);
  y += 8;

  // ── Infos patient (deux colonnes) ─────────────────────────────────
  const colG = M;
  const colD = 110;
  const interligne = 5.5;

  const ligne = (x: number, yy: number, label: string, valeur: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text(label, x, yy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NOIR);
    doc.text(valeur || "—", x + 30, yy);
  };

  const naissance = patient.date_naissance
    ? `${fdate(patient.date_naissance)}${age(patient.date_naissance) ? `  (${age(patient.date_naissance)})` : ""}`
    : "—";
  const villeLigne = [patient.code_postal, patient.ville].filter(Boolean).join(" ");

  let yG = y;
  ligne(colG, yG, "Né(e) le :", naissance); yG += interligne;
  ligne(colG, yG, "Téléphone :", patient.telephone ?? "—"); yG += interligne;
  ligne(colG, yG, "Adresse :", patient.adresse ?? "—"); yG += interligne;
  if (villeLigne) { ligne(colG, yG, "", villeLigne); yG += interligne; }

  let yD = y;
  ligne(colD, yD, "Chirurgien :", patient.chirurgien ?? "—"); yD += interligne;
  ligne(colD, yD, "Pharmacie :", patient.pharmacie ?? "—"); yD += interligne;
  ligne(colD, yD, "Infirmière :", patient.infirmiere_nom ?? "—"); yD += interligne;
  ligne(colD, yD, "Suivi par :", s.auteur_nom ?? "—"); yD += interligne;

  y = Math.max(yG, yD) + 4;

  // ── Bandeau de section ────────────────────────────────────────────
  const bandeau = (titre: string) => {
    if (y > 270) { doc.addPage(); y = M; }
    doc.setFillColor(...ROSE);
    doc.rect(M, y, L, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(titre, 105, y + 4.8, { align: "center" });
    y += 12;
  };

  const champ = (label: string, valeur: string | null) => {
    if (y > 275) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...ROSE);
    doc.text(label.toUpperCase(), M, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...NOIR);
    const wrapped = doc.splitTextToSize(valeur && valeur.trim() ? valeur : "—", L);
    doc.text(wrapped, M, y);
    y += wrapped.length * 5 + 4;
  };

  // ── Surveillance clinique ─────────────────────────────────────────
  bandeau("Surveillance clinique");
  champ("État général", s.etat_general);

  // Constantes sur une ligne
  if (y > 275) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...ROSE);
  doc.text("CONSTANTES", M, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...NOIR);
  const constantes = [
    `TA : ${s.ta || "—"}`,
    `Pouls : ${s.pouls || "—"}`,
    `T° : ${s.temperature || "—"}`,
    `SpO2 : ${s.spo2 || "—"}`,
  ].join("      ");
  doc.text(constantes, M, y);
  y += 9;

  champ("Douleurs (EN)", s.douleur_en);
  champ("Alimentation", s.alimentation);
  champ("Hydratation", s.hydratation);
  champ("Transit", s.transit);
  champ("Cicatrisation", s.cicatrisation);
  champ("Mobilisation", s.mobilisation);
  champ("Bilan sanguin", s.bilan_sanguin);

  // ── Pied de page ──────────────────────────────────────────────────
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.3);
  doc.line(M, ph - 16, 210 - M, ph - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, M, ph - 11);
  doc.text("Asdia Perfusion", 210 - M, ph - 11, { align: "right" });

  const nomFichier = `compte-rendu-${patient.nom.replace(/\s+/g, "-").toLowerCase()}-${fdate(s.created_at).replace(/\//g, "-")}.pdf`;
  doc.save(nomFichier);
}
