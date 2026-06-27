const ROSE: [number, number, number] = [190, 24, 93];
const GRIS: [number, number, number] = [90, 90, 90];
const NOIR: [number, number, number] = [40, 40, 40];

type Med = { nom: string; posologie: string };

export type ProtocolePdf = {
  intervention: string;
  duree: string;
  jours: number[];
  molecules: Med[];
  pansement: boolean;
  pansement_detail: string;
  cryotherapie: boolean;
  cryotherapie_duree: string;
  cryotherapie_machine: string;
  envoi_ordo: string[];
  pharmacie_per_os: boolean;
  medicaments_per_os: Med[];
  surveiller_constantes?: boolean;
  constantes?: { type: string; min: string; max: string }[];
  bilan_sanguin?: boolean;
  bilan_voie?: string;
  bilan_analyses?: string[];
  bilan_autres?: string;
  materiel: boolean;
  materiel_paramedical: string;
  autres: string;
};

const LABEL_CONST: Record<string, string> = {
  temperature: "Température",
  ta_systolique: "TA systolique",
  ta_diastolique: "TA diastolique",
  spo2: "SpO2",
  bpm: "Pouls",
  poids: "Poids",
};

export type ConsignesData = {
  titre: string;
  prenom: string;
  nom: string;
  specialite: string;
  rpps?: string;
  telephone: string;
  cabinets: string;
  secretariat_nom: string;
  secretariat_email: string;
  secretariat_tel: string;
  protocoles: ProtocolePdf[];
};

// Charge le logo AS2CŒUR (PNG transparent) en data-URL.
async function chargerLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo-as2coeur-trim.png");
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

// Charge une image (avec ses dimensions naturelles) en data-URL.
async function chargerImage(path: string): Promise<{ url: string; w: number; h: number } | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
    const dim = await new Promise<{ w: number; h: number }>((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => resolve({ w: 0, h: 0 });
      im.src = url;
    });
    return { url, ...dim };
  } catch {
    return null;
  }
}

// Génère et télécharge le PDF des consignes d'un médecin / chirurgien.
export async function genererPdfConsignes(
  d: ConsignesData,
  mode: "download" | "bloburl" = "download"
): Promise<string | void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 15;
  const L = 210 - M * 2;

  // ── En-tête ───────────────────────────────────────────────────────
  const logo = await chargerLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M, 11, 52, 11);
    } catch {
      /* format non supporté */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NOIR);
  doc.text("Consignes prescripteur", 210 - M, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(
    `Établi le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    210 - M,
    21,
    { align: "right" }
  );

  let y = 30;
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.4);
  doc.line(M, y, 210 - M, y);
  y += 9;

  // Nom du médecin
  const nomComplet = [d.titre, d.prenom, d.nom.toUpperCase()].filter(Boolean).join(" ");
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NOIR);
  doc.text(nomComplet || "—", 105, y, { align: "center" });
  y += 6;
  if (d.specialite) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...ROSE);
    doc.text(d.specialite, 105, y, { align: "center" });
    y += 7;
  } else {
    y += 1;
  }

  // Toutes les coordonnées regroupées sous le nom (médecin + secrétaire), centrées.
  const infos: string[] = [];
  if (d.rpps) infos.push(`RPPS : ${d.rpps}`);
  if (d.telephone) infos.push(`Téléphone : ${d.telephone}`);
  if (d.cabinets) infos.push(`Lieu d'exercice : ${d.cabinets}`);
  if (d.secretariat_nom) infos.push(`Secrétaire : ${d.secretariat_nom}`);
  if (d.secretariat_email) infos.push(`Email secrétaire : ${d.secretariat_email}`);
  if (d.secretariat_tel) infos.push(`Téléphone secrétaire : ${d.secretariat_tel}`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...NOIR);
  infos.forEach((t) => {
    doc.text(t, 105, y, { align: "center" });
    y += 5.6;
  });

  y += 6;
  doc.setDrawColor(...ROSE);
  doc.setLineWidth(0.3);
  doc.line(M, y, 210 - M, y);
  y += 10;

  // ── Helpers ───────────────────────────────────────────────────────
  const sautSiBesoin = (besoin: number) => {
    if (y + besoin > 270) {
      doc.addPage();
      y = M;
    }
  };

  // En-tête de protocole : encadré arrondi, fond rose très clair, accent rose à gauche.
  const bandeau = (titre: string) => {
    sautSiBesoin(20);
    y += 2;
    doc.setFillColor(253, 242, 248); // rose-50
    doc.setDrawColor(...ROSE);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, L, 10, 2.2, 2.2, "FD");
    doc.setFillColor(...ROSE);
    doc.rect(M, y, 1.6, 10, "F"); // accent vertical
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ROSE);
    doc.text(titre, M + 6, y + 6.6);
    y += 16;
  };

  const sousTitre = (texte: string) => {
    sautSiBesoin(10);
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...ROSE);
    doc.text(texte.toUpperCase(), M, y);
    doc.setDrawColor(244, 200, 220);
    doc.setLineWidth(0.2);
    doc.line(M, y + 1.6, M + 60, y + 1.6);
    y += 6.5;
  };

  const ligne = (label: string, valeur: string) => {
    if (!valeur || !valeur.trim()) return;
    sautSiBesoin(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRIS);
    doc.text(label, M + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NOIR);
    const wrapped = doc.splitTextToSize(valeur, L - 47);
    doc.text(wrapped, M + 47, y);
    y += Math.max(wrapped.length * 5, 5.5);
  };

  const paragraphe = (texte: string) => {
    if (!texte || !texte.trim()) return;
    sautSiBesoin(8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...NOIR);
    const wrapped = doc.splitTextToSize(texte, L - 2);
    doc.text(wrapped, M + 2, y);
    y += wrapped.length * 5 + 2;
  };

  const listeMolecules = (items: Med[]) => {
    items.forEach((m) => {
      if (!m.nom) return;
      sautSiBesoin(6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ROSE);
      doc.text("•", M + 2, y);
      doc.setTextColor(...NOIR);
      doc.text(m.nom, M + 6, y);
      if (m.posologie) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...GRIS);
        const wrapped = doc.splitTextToSize(m.posologie, L - 57);
        doc.text(wrapped, M + 57, y);
        y += Math.max(wrapped.length * 5, 5.5);
      } else {
        y += 5.5;
      }
    });
  };

  // ── Protocoles ────────────────────────────────────────────────────
  d.protocoles.forEach((p, i) => {
    const titre = p.intervention ? p.intervention : `Protocole ${i + 1}`;
    bandeau(`PROTOCOLE ${i + 1} — ${titre.toUpperCase()}`);

    ligne("Durée :", p.duree ? `${p.duree} jours` : "");
    ligne("Jours de suivi :", p.jours.length ? p.jours.map((j) => `J${j}`).join(", ") : "");

    if (p.molecules.length) {
      sousTitre("Molécules prescrites (IV)");
      listeMolecules(p.molecules);
    }

    if (p.pharmacie_per_os && p.medicaments_per_os.length) {
      sousTitre("Médicaments Per os à commander");
      listeMolecules(p.medicaments_per_os);
    }

    if (p.surveiller_constantes && p.constantes && p.constantes.length) {
      sousTitre("Constantes à surveiller (seuils d'alerte)");
      p.constantes.forEach((c) => {
        const seuil = [c.min ? `min ${c.min}` : "", c.max ? `max ${c.max}` : ""].filter(Boolean).join(" / ");
        ligne(`${LABEL_CONST[c.type] ?? c.type} :`, seuil || "à surveiller");
      });
    }

    if (p.bilan_sanguin) {
      sousTitre("Bilan sanguin");
      if (p.bilan_voie) ligne("Voie d'abord :", p.bilan_voie);
      const analyses = [...(p.bilan_analyses ?? []), ...(p.bilan_autres ? [p.bilan_autres] : [])];
      ligne("À doser :", analyses.length ? analyses.join(", ") : "à préciser");
    }

    const aSoins = p.pansement || p.cryotherapie || p.envoi_ordo.length || p.materiel;
    if (aSoins) {
      sousTitre("Soins & logistique");
      if (p.pansement) ligne("Pansement :", p.pansement_detail || "Oui");
      if (p.cryotherapie) {
        const cryo = [p.cryotherapie_machine, p.cryotherapie_duree ? `prêt ${p.cryotherapie_duree}` : ""]
          .filter(Boolean)
          .join(" — ");
        ligne("Cryothérapie :", cryo || "Oui");
      }
      if (p.envoi_ordo.length) {
        const cibles = p.envoi_ordo
          .map((c) => (c === "secretariat" ? "Secrétariat" : c === "medecin" ? "Médecin" : c))
          .join(" et ");
        ligne("Envoi Ordo/CR :", cibles);
      }
      if (p.materiel) ligne("Matériel :", p.materiel_paramedical || "Oui");
    }

    if (p.autres && p.autres.trim()) {
      sousTitre("Autres consignes");
      paragraphe(p.autres);
    }

    y += 8;
  });

  // ── Logo Asdia en pied de page (centré) ───────────────────────────
  const asdia = await chargerImage("/logoasdia.jpg");
  if (asdia && asdia.w) {
    const w = 26;
    const h = (asdia.h * w) / asdia.w;
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.addImage(asdia.url, "JPEG", 105 - w / 2, 297 - 12 - h, w, h);
    }
  }

  // ── Sortie ────────────────────────────────────────────────────────
  if (mode === "bloburl") {
    return doc.output("bloburl") as unknown as string;
  }
  const nomFichier = `consignes-${(d.nom || "medecin").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(nomFichier);
}
