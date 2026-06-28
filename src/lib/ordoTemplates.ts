import { ouvrirTemplate, nomPrescripteur, frDate, type DocOrdoData, type Pt } from "@/lib/pdfOverlay";

// Moteur générique d'ordonnances à modèle (overlay sur CERFA), piloté par config.
type Champ =
  | { k: "txt" | "date"; key: string; pos: Pt; size?: number }
  | { k: "lignes"; key: string; pos: Pt; lineH?: number }
  | { k: "radio" | "checks"; key: string; map: Record<string, Pt> };

type Conf = {
  template: string;
  presc?: Pt; rpps?: Pt; patient?: Pt; date?: Pt; signature?: Pt;
  blancs?: [number, number, number, number][];
  champs: Champ[];
};

const STD = { presc: { x: 70, y: 128 } as Pt, rpps: { x: 90, y: 152 } as Pt, patient: { x: 215, y: 212 } as Pt };

export const CONFIGS: Record<string, Conf> = {
  // Remplace « Pharmacie (perfusion) » — ordonnance bizone ALD.
  pharma_perf: {
    template: "/ORDO%20PHARMA%20(2).pdf", presc: { x: 45, y: 78 }, rpps: { x: 45, y: 98 }, patient: { x: 325, y: 78 }, date: { x: 52, y: 256 }, signature: { x: 400, y: 615 },
    champs: [
      { k: "txt", key: "poches_50", pos: { x: 208, y: 386 } },
      { k: "txt", key: "poches_100", pos: { x: 217, y: 405 } },
      { k: "lignes", key: "molecules", pos: { x: 54, y: 428 }, lineH: 16 },
      { k: "txt", key: "qsp_jours", pos: { x: 65, y: 555 } },
    ],
  },
  ordo_pst: {
    template: "/ORDO%20PST.pdf", ...STD, date: { x: 478, y: 248 }, signature: { x: 390, y: 518 },
    champs: [{ k: "lignes", key: "protocole", pos: { x: 20, y: 330 }, lineH: 13 }],
  },
  ordo_pharma_npad: {
    template: "/ORDO%20PHARMA%20NPAD.pdf", presc: { x: 45, y: 78 }, rpps: { x: 45, y: 98 }, patient: { x: 325, y: 78 }, signature: { x: 400, y: 585 },
    champs: [
      { k: "txt", key: "poches_50", pos: { x: 200, y: 337 } },
      { k: "txt", key: "poches_100", pos: { x: 200, y: 355 } },
      { k: "txt", key: "qsp_jours", pos: { x: 70, y: 505 } },
      { k: "txt", key: "renouvelable", pos: { x: 150, y: 524 } },
    ],
  },
  ordo_pharma_piccline: {
    template: "/ORDO%20PHARMA%20PICCLINE.pdf", ...STD, date: { x: 110, y: 283 }, signature: { x: 390, y: 572 },
    champs: [
      { k: "txt", key: "nacl_50", pos: { x: 175, y: 353 } },
      { k: "txt", key: "nacl_100", pos: { x: 175, y: 364 } },
      { k: "txt", key: "qsp_jours", pos: { x: 50, y: 467 } },
    ],
  },
  ordo_glycemie: {
    template: "/ORDO%20GLYCEMIE.pdf", ...STD, date: { x: 441, y: 269 }, signature: { x: 390, y: 560 },
    champs: [{ k: "txt", key: "ordonnance_jours", pos: { x: 110, y: 461 } }],
  },
  ordo_taurolock: {
    template: "/ORDO%20TAUROLOCK.pdf", ...STD, date: { x: 500, y: 269 }, signature: { x: 390, y: 681 },
    champs: [{ k: "txt", key: "qsp_jours", pos: { x: 50, y: 564 } }, { k: "txt", key: "a_renouveler", pos: { x: 106, y: 576 } }],
  },
  perfadom_npad: {
    template: "/PERFADOM%20NPAD.pdf", ...STD, date: { x: 440, y: 258 }, signature: { x: 390, y: 714 },
    champs: [
      { k: "checks", key: "options", map: { "Première installation": { x: 31, y: 313 }, "12 premières semaines": { x: 31, y: 343 }, "Après les 12 premières semaines": { x: 29, y: 490 } } },
      { k: "txt", key: "jours7_avant", pos: { x: 38, y: 388 } },
      { k: "txt", key: "jours7_apres", pos: { x: 38, y: 549 } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 100, y: 655 } },
    ],
  },
  ordo_idel_po: {
    template: "/ORDO%20IDEL%20PO%20ET%20CONSTANTES.pdf", ...STD, date: { x: 520, y: 270 }, signature: { x: 390, y: 493 },
    champs: [{ k: "txt", key: "ordonnance_jours", pos: { x: 113, y: 430 } }, { k: "txt", key: "a_renouveler", pos: { x: 90, y: 445 } }],
  },
  ordo_idel_npad: {
    template: "/ORDO%20IDEL%20NPAD.pdf", ...STD, date: { x: 540, y: 274 }, signature: { x: 470, y: 611 },
    champs: [
      { k: "radio", key: "voie", map: { "Cathéter central": { x: 31, y: 361 }, "Picc-line": { x: 29, y: 390 }, "Chambre implantable": { x: 31, y: 420 } } },
      { k: "txt", key: "perfusion", pos: { x: 112, y: 465 } },
      { k: "txt", key: "ordonnance_jours", pos: { x: 100, y: 597 } },
    ],
  },
  idel_kyste: {
    template: "/IDEL%20Kyste1.pdf", presc: { x: 90, y: 100 }, patient: { x: 350, y: 100 }, date: { x: 385, y: 177 }, signature: { x: 310, y: 597 },
    champs: [{ k: "txt", key: "duree_jours", pos: { x: 80, y: 591 } }],
  },
  // PDF image (sans couche texte) : en-tête + jours + signature (positions à affiner).
  nead: {
    template: "/NEAD.pdf", presc: { x: 60, y: 110 }, patient: { x: 310, y: 110 }, date: { x: 360, y: 240 }, signature: { x: 400, y: 665 },
    champs: [{ k: "txt", key: "ordonnance_jours", pos: { x: 385, y: 613 } }, { k: "txt", key: "a_renouveler", pos: { x: 410, y: 631 } }],
  },
  nead_idel: {
    template: "/NEAD%20IDEL.pdf", presc: { x: 60, y: 110 }, patient: { x: 310, y: 110 }, date: { x: 360, y: 240 }, signature: { x: 400, y: 665 },
    champs: [{ k: "txt", key: "ordonnance_jours", pos: { x: 385, y: 613 } }, { k: "txt", key: "a_renouveler", pos: { x: 410, y: 631 } }],
  },
};

export async function genererPdfModele(type: string, d: DocOrdoData, mode: "download" | "bloburl" = "download"): Promise<string | void> {
  const conf = CONFIGS[type];
  if (!conf) return;
  const { txt, coche, blanc, signer, finaliser } = await ouvrirTemplate(conf.template);
  (conf.blancs ?? []).forEach((b) => blanc(...b));
  if (conf.presc) txt(nomPrescripteur(d), conf.presc);
  if (conf.rpps && d.prescripteurRpps) txt(d.prescripteurRpps, conf.rpps, 8);
  if (conf.patient) txt(d.patientNom, conf.patient);
  if (conf.date) txt(d.date || new Date().toLocaleDateString("fr-FR"), conf.date);

  const c = d.contenu;
  for (const ch of conf.champs) {
    if (ch.k === "txt") txt(c[ch.key], ch.pos, ch.size);
    else if (ch.k === "date") txt(frDate(c[ch.key]), ch.pos);
    else if (ch.k === "lignes") {
      const v = typeof c[ch.key] === "string" ? (c[ch.key] as string).split("\n").filter((l) => l.trim()) : [];
      v.forEach((l, i) => txt(l.trim(), { x: ch.pos.x, y: ch.pos.y + i * (ch.lineH ?? 14) }));
    } else if (ch.k === "radio") {
      const v = c[ch.key] as string;
      if (v && ch.map[v]) coche(ch.map[v]);
    } else if (ch.k === "checks") {
      const arr = Array.isArray(c[ch.key]) ? (c[ch.key] as string[]) : [];
      arr.forEach((o) => { if (ch.map[o]) coche(ch.map[o]); });
    }
  }
  if (conf.signature) await signer(d.signature, conf.signature);
  return finaliser(mode, `ordonnance-${type}.pdf`);
}
