import { createClient } from "@/lib/supabase/client";
import type { Patient, Suivi } from "@/lib/types";

const ROSE: [number, number, number] = [190, 24, 93];
const ROSE_CLAIR: [number, number, number] = [233, 128, 170];
const GRIS: [number, number, number] = [90, 90, 90];
const GRIS_CLAIR: [number, number, number] = [200, 200, 200];
const ROUGE: [number, number, number] = [220, 70, 70];
const NOIR: [number, number, number] = [40, 40, 40];

type Pt = { t: number; v: number };
type Serie = { label: string; couleur: [number, number, number]; points: Pt[] };
type Seuil = { min: number | null; max: number | null };

// Charge l'historique des mesures du patient, groupé par type, + les seuils actifs.
async function chargerMesures(
  patientId: string
): Promise<{ parType: Record<string, Pt[]>; seuils: Record<string, Seuil> }> {
  const supabase = createClient();
  const [{ data: mesures }, { data: seuils }] = await Promise.all([
    supabase
      .from("mesure")
      .select("type,valeur,horodatage")
      .eq("patient_id", patientId)
      .order("horodatage", { ascending: true })
      .limit(1000),
    supabase
      .from("seuil")
      .select("type_mesure,valeur_min,valeur_max,actif")
      .eq("patient_id", patientId)
      .eq("actif", true),
  ]);
  const parType: Record<string, Pt[]> = {};
  (mesures ?? []).forEach((m) => {
    const v = Number(m.valeur);
    if (!isFinite(v)) return;
    (parType[m.type as string] ??= []).push({ t: new Date(m.horodatage).getTime(), v });
  });
  const seuilMap: Record<string, Seuil> = {};
  (seuils ?? []).forEach((s) => {
    seuilMap[s.type_mesure as string] = { min: s.valeur_min, max: s.valeur_max };
  });
  return { parType, seuils: seuilMap };
}

// Charge une data-URL dans une image, la convertit en JPEG (gère png/webp) et
// renvoie ses dimensions. Retourne null si le format est illisible (ex. HEIC).
async function imageJpeg(dataUrl: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      try {
        resolve({ data: c.toDataURL("image/jpeg", 0.85), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Récupère les photos rattachées à un suivi, prêtes à insérer dans le PDF.
async function chargerPhotosSuivi(
  suiviId: string
): Promise<{ data: string; w: number; h: number; legende: string | null }[]> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("photo")
    .select("chemin_stockage,legende")
    .eq("suivi_id", suiviId);
  const photos = (rows ?? []) as { chemin_stockage: string; legende: string | null }[];
  if (photos.length === 0) return [];

  const res = await fetch("/api/photo-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chemins: photos.map((p) => p.chemin_stockage) }),
  });
  const map: Record<string, string> = (await res.json().catch(() => ({ data: {} }))).data ?? {};

  const out: { data: string; w: number; h: number; legende: string | null }[] = [];
  for (const p of photos) {
    const b64 = map[p.chemin_stockage];
    if (!b64) continue;
    const im = await imageJpeg(b64);
    if (im) out.push({ ...im, legende: p.legende });
  }
  return out;
}

// Dessine un mini graphique en courbe (axes + polyligne) aux couleurs de l'app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dessinerCourbe(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  ox: number,
  oy: number,
  w: number,
  h: number,
  titre: string,
  unite: string,
  series: Serie[],
  seuil?: Seuil
) {
  const GOUT = 11; // gouttière gauche pour les libellés d'axe
  const x0 = ox + GOUT;
  const x1 = ox + w;
  const y0 = oy; // haut du cadre
  const y1 = oy + h; // bas du cadre

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ROSE);
  doc.text(`${titre}  (${unite})`, ox, oy - 2.5);

  // Cadre
  doc.setDrawColor(...GRIS_CLAIR);
  doc.setLineWidth(0.2);
  doc.rect(x0, y0, x1 - x0, y1 - y0);

  const tousV: number[] = [];
  series.forEach((s) => s.points.forEach((p) => tousV.push(p.v)));
  if (seuil?.min != null) tousV.push(seuil.min);
  if (seuil?.max != null) tousV.push(seuil.max);

  if (tousV.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("Aucune donnée", (x0 + x1) / 2, (y0 + y1) / 2, { align: "center" });
    return;
  }

  let vmin = Math.min(...tousV);
  let vmax = Math.max(...tousV);
  if (vmin === vmax) { vmin -= 1; vmax += 1; }
  const pad = (vmax - vmin) * 0.12;
  vmin -= pad; vmax += pad;

  const tousT: number[] = [];
  series.forEach((s) => s.points.forEach((p) => tousT.push(p.t)));
  const tmin = Math.min(...tousT);
  const tmax = Math.max(...tousT);

  const xOf = (t: number) => (tmax === tmin ? (x0 + x1) / 2 : x0 + ((t - tmin) / (tmax - tmin)) * (x1 - x0));
  const yOf = (v: number) => y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0);

  const dec = vmax - vmin < 8 ? 1 : 0;

  // Libellés d'axe Y (max en haut, min en bas)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text(vmax.toFixed(dec), x0 - 1.5, y0 + 2, { align: "right" });
  doc.text(vmin.toFixed(dec), x0 - 1.5, y1, { align: "right" });

  // Seuils (lignes pointillées rouges)
  const ligneSeuil = (v: number | null | undefined) => {
    if (v == null || v < vmin || v > vmax) return;
    const yy = yOf(v);
    doc.setDrawColor(...ROUGE);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(x0, yy, x1, yy);
    doc.setLineDashPattern([], 0);
  };
  ligneSeuil(seuil?.min);
  ligneSeuil(seuil?.max);

  // Courbes
  series.forEach((s) => {
    if (s.points.length === 0) return;
    doc.setDrawColor(...s.couleur);
    doc.setFillColor(...s.couleur);
    doc.setLineWidth(0.5);
    for (let i = 1; i < s.points.length; i++) {
      doc.line(xOf(s.points[i - 1].t), yOf(s.points[i - 1].v), xOf(s.points[i].t), yOf(s.points[i].v));
    }
    s.points.forEach((p) => doc.circle(xOf(p.t), yOf(p.v), 0.5, "F"));
  });

  // Libellés d'axe X (première / dernière date)
  const fmtJour = (t: number) =>
    new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRIS);
  doc.text(fmtJour(tmin), x0, y1 + 3.5);
  if (tmax !== tmin) doc.text(fmtJour(tmax), x1, y1 + 3.5, { align: "right" });

  // Légende (si plusieurs séries) : en haut à droite, sur la ligne du titre
  if (series.length > 1) {
    let rx = x1;
    doc.setFontSize(6.5);
    [...series].reverse().forEach((s) => {
      const tw = doc.getTextWidth(s.label);
      doc.setTextColor(...GRIS);
      doc.text(s.label, rx, oy - 2.5, { align: "right" });
      doc.setFillColor(...s.couleur);
      doc.circle(rx - tw - 2, oy - 3.2, 0.8, "F");
      rx -= tw + 8;
    });
  }
}

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
export async function genererPdfSuivi(
  patient: Patient,
  s: Suivi,
  mode: "download" | "bloburl" = "download"
): Promise<string | void> {
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

  // Données des annexes, chargées en amont pour les intégrer dans le flux :
  // courbes juste après les constantes, photo dans la section Cicatrisation.
  const photos = await chargerPhotosSuivi(s.id);
  const { parType, seuils } = await chargerMesures(patient.id);
  const aDesMesures = ["ta_systolique", "ta_diastolique", "spo2", "temperature", "bpm"].some(
    (t) => (parType[t]?.length ?? 0) > 0
  );

  // Dessine les 4 courbes de surveillance (saut de page si besoin).
  const dessinerCourbes = () => {
    const colW = (L - 8) / 2;
    const plotH = 38;
    const blockH = 56;
    const hauteurCourbes = 12 + 4 + 2 * blockH;
    if (y + hauteurCourbes > 285) { doc.addPage(); y = M; }
    bandeau("Courbes de surveillance");

    const charts: { titre: string; unite: string; series: Serie[]; seuil?: Seuil }[] = [
      {
        titre: "Tension artérielle",
        unite: "mmHg",
        series: [
          { label: "Systolique", couleur: ROSE, points: parType["ta_systolique"] ?? [] },
          { label: "Diastolique", couleur: ROSE_CLAIR, points: parType["ta_diastolique"] ?? [] },
        ],
      },
      {
        titre: "Saturation (SpO₂)",
        unite: "%",
        series: [{ label: "SpO₂", couleur: ROSE, points: parType["spo2"] ?? [] }],
        seuil: seuils["spo2"],
      },
      {
        titre: "Température",
        unite: "°C",
        series: [{ label: "T°", couleur: ROSE, points: parType["temperature"] ?? [] }],
        seuil: seuils["temperature"],
      },
      {
        titre: "Pouls",
        unite: "bpm",
        series: [{ label: "Pouls", couleur: ROSE, points: parType["bpm"] ?? [] }],
        seuil: seuils["bpm"],
      },
    ];

    const topGrille = y + 4;
    charts.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ox = M + col * (colW + 8);
      const oy = topGrille + row * blockH;
      dessinerCourbe(doc, ox, oy, colW, plotH, c.titre, c.unite, c.series, c.seuil);
    });
    y = topGrille + 2 * blockH + 2;
  };

  // Dessine les photos de cicatrice (sous le texte de la section Cicatrisation).
  const dessinerPhotos = () => {
    photos.forEach((im) => {
      let w = 80;
      let h = (w * im.h) / im.w;
      if (h > 60) { h = 60; w = (h * im.w) / im.h; }
      if (y + h + 8 > 285) { doc.addPage(); y = M; }
      try {
        doc.addImage(im.data, "JPEG", M, y, w, h);
      } catch {
        /* image illisible : on ignore */
      }
      y += h + 2;
      if (im.legende) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...GRIS);
        doc.text(im.legende, M, y + 3);
        y += 5;
      }
      y += 4;
    });
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

  // Courbes de surveillance juste après les constantes
  if (aDesMesures) dessinerCourbes();

  champ("Douleurs (EN)", s.douleur_en);
  champ("Alimentation", s.alimentation);
  champ("Hydratation", s.hydratation);
  champ("Transit", s.transit);
  champ("Cicatrisation", s.cicatrisation);
  // Photo(s) de la cicatrice dans la section Cicatrisation
  if (photos.length > 0) dessinerPhotos();
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
  if (mode === "bloburl") {
    return doc.output("bloburl") as unknown as string;
  }
  doc.save(nomFichier);
}
