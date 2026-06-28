"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type Patient = {
  id: string;
  nom: string;
  date_operation: string | null;
  duree_prise_en_charge: number | null;
  chirurgien: string | null;
  delegue_nom: string | null;
  agence_id: string | null;
  traitement: string | null;
  statut: string;
};
type Coord = { id: string; nom: string; prenom: string | null; titre: string | null; agence_id: string | null };
type Liaison = { patient_id: string; professionnel_id: string };

const nomComplet = (p: { titre?: string | null; prenom?: string | null; nom: string }) =>
  [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");

function jour(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addJours(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

type Periode = "semaine" | "mois" | "annee";

// Construit le rapport d'une période (clôtures : vendredi 17h / dernier jour du mois 17h / 31 déc. 17h).
function construireRapport(type: Periode, patients: Patient[], agenceNom: Map<string, string>) {
  // Fin de la période contenant d.
  const finP = (d: Date): Date => {
    let r: Date;
    if (type === "semaine") {
      r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 0, 0, 0);
      r.setDate(r.getDate() + ((5 - r.getDay() + 7) % 7));
    } else if (type === "mois") {
      r = new Date(d.getFullYear(), d.getMonth() + 1, 0, 17, 0, 0, 0);
    } else {
      r = new Date(d.getFullYear(), 11, 31, 17, 0, 0, 0);
    }
    if (r.getTime() < d.getTime()) {
      if (type === "semaine") r.setDate(r.getDate() + 7);
      else if (type === "mois") r = new Date(r.getFullYear(), r.getMonth() + 2, 0, 17, 0, 0, 0);
      else r = new Date(r.getFullYear() + 1, 11, 31, 17, 0, 0, 0);
    }
    return r;
  };
  const prec = (end: Date): Date =>
    type === "semaine" ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7, 17, 0, 0, 0)
      : type === "mois" ? new Date(end.getFullYear(), end.getMonth(), 0, 17, 0, 0, 0)
        : new Date(end.getFullYear() - 1, 11, 31, 17, 0, 0, 0);

  const nbStats = type === "semaine" ? 52 : type === "mois" ? 12 : 5;
  const nbChart = type === "semaine" ? 12 : type === "mois" ? 12 : 5;

  const now = new Date();
  let courant = finP(now);
  if (courant.getTime() > now.getTime()) courant = prec(courant);

  const ends: number[] = [];
  let w = new Date(courant);
  for (let i = 0; i < nbStats; i++) { ends.unshift(w.getTime()); w = prec(w); }

  const avecDate = patients.filter((p) => p.date_operation);
  const finOf = (p: Patient) => finP(new Date(p.date_operation!)).getTime();
  const counts = ends.map((e) => avecDate.filter((p) => finOf(p) === e).length);
  const courantCount = counts[counts.length - 1] ?? 0;
  const best = counts.length ? Math.max(...counts) : 0;
  const worst = counts.length ? Math.min(...counts) : 0;
  const moyenne = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

  const sem = avecDate.filter((p) => finOf(p) === courant.getTime());

  const labelBar = (e: number) => {
    const d = new Date(e);
    if (type === "semaine") return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    if (type === "mois") return d.toLocaleDateString("fr-FR", { month: "short" });
    return String(d.getFullYear());
  };

  // Série par catégorie : pour chaque entité, le nombre de PEC démarrées sur
  // chacune des nbChart dernières périodes (sert au graphique en ligne + tableau).
  const chartEnds = ends.slice(-nbChart);
  const TOP = 8;
  const serie = (getK: (p: Patient) => string) => {
    const m = new Map<string, number[]>();
    avecDate.forEach((p) => {
      const idx = chartEnds.indexOf(finOf(p));
      if (idx < 0) return;
      const k = getK(p);
      if (!m.has(k)) m.set(k, new Array(nbChart).fill(0));
      m.get(k)![idx] += 1;
    });
    let arr = [...m.entries()].map(([nom, s]) => ({ nom, serie: s, total: s.reduce((a, b) => a + b, 0) }));
    arr.sort((a, b) => b.total - a.total);
    if (arr.length > TOP) {
      const autres = { nom: "Autres", serie: new Array(nbChart).fill(0) as number[], total: 0 };
      arr.slice(TOP).forEach((r) => { r.serie.forEach((v, i) => (autres.serie[i] += v)); autres.total += r.total; });
      arr = [...arr.slice(0, TOP), autres];
    }
    return arr;
  };

  const labelCourant =
    type === "semaine"
      ? `Semaine du ${new Date(courant.getFullYear(), courant.getMonth(), courant.getDate() - 7).toLocaleDateString("fr-FR")} au ${courant.toLocaleDateString("fr-FR")} (vendredi 17h)`
      : type === "mois"
        ? `Mois de ${courant.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} (clôture le ${courant.toLocaleDateString("fr-FR")} 17h)`
        : `Année ${courant.getFullYear()} (clôture le 31/12 17h)`;

  const mot = type === "semaine" ? "semaine" : type === "mois" ? "mois" : "année";
  const motMaj = type === "semaine" ? "Semaine" : type === "mois" ? "Mois" : "Année";
  const fenetre = type === "annee" ? "5 ans" : "12 mois";
  const periodes = chartEnds.map(labelBar);
  const totalSerie = counts.slice(-nbChart);

  return {
    courant, courantCount, best, worst, moyenne, sem, labelCourant, motMaj, periodes,
    kpi: {
      cette: type === "annee" ? "Cette année" : type === "mois" ? "Ce mois" : "Cette semaine",
      meilleur: type === "annee" ? "Meilleure année" : `Meilleur${type === "semaine" ? "e" : ""} ${mot}`,
      pire: `Pire ${mot}`,
      moyenne: `Moyenne / ${type === "annee" ? "an" : mot} (${fenetre})`,
    },
    categories: [
      { titre: "Ensemble des prises en charge", lignes: [{ nom: "Total PEC", serie: totalSerie, total: totalSerie.reduce((a, b) => a + b, 0) }] },
      { titre: "PEC par agence", lignes: serie((p) => (p.agence_id ? (agenceNom.get(p.agence_id) ?? "Agence ?") : "Non rattaché")) },
      { titre: "PEC par médecin", lignes: serie((p) => p.chirurgien?.trim() || "Non renseigné") },
      { titre: "PEC par délégué", lignes: serie((p) => p.delegue_nom?.trim() || "Non renseigné") },
      { titre: "PEC par type de traitement", lignes: serie((p) => p.traitement?.trim() || "Non renseigné") },
    ],
  };
}

type LigneCat = { nom: string; serie: number[]; total: number };

export default function PecPage() {
  const pro = useProSession();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [liaisons, setLiaisons] = useState<Liaison[]>([]);
  const [agenceNom, setAgenceNom] = useState<Map<string, string>>(new Map());
  const [pret, setPret] = useState(false);
  const [detail, setDetail] = useState<{ titre: string; patients: Patient[] } | null>(null);
  const [periode, setPeriode] = useState<Periode>("semaine");

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("patient").select("id,nom,date_operation,duree_prise_en_charge,chirurgien,delegue_nom,agence_id,traitement,statut"),
      supabase.from("professionnel").select("id,nom,prenom,titre,agence_id").eq("role", "coordinatrice"),
      supabase.from("patient_soignant").select("patient_id,professionnel_id"),
      supabase.from("agence").select("id,nom"),
    ]).then(([{ data: pts }, { data: cs }, { data: ls }, { data: ags }]) => {
      setPatients((pts ?? []) as Patient[]);
      setCoords((cs ?? []) as Coord[]);
      setLiaisons((ls ?? []) as Liaison[]);
      setAgenceNom(new Map((ags ?? []).map((a) => [a.id as string, a.nom as string])));
      setPret(true);
    });
  }, []);

  const stats = useMemo(() => {
    const today = jour(new Date());
    const lundi = addJours(today, -((today.getDay() + 6) % 7));
    const moisDebut = new Date(today.getFullYear(), today.getMonth(), 1);
    const anneeDebut = new Date(today.getFullYear(), 0, 1);

    const avecDate = patients.filter((p) => p.date_operation);
    const dOp = (p: Patient) => jour(new Date(p.date_operation!));
    const finPec = (p: Patient) => addJours(dOp(p), p.duree_prise_en_charge ?? 0);
    const periode = (debut: Date) => avecDate.filter((p) => dOp(p) >= debut && dOp(p) <= today);

    const enCours = avecDate.filter((p) => p.statut !== "terminee" && dOp(p) <= today && finPec(p) >= today);
    const aVenir = avecDate.filter((p) => dOp(p) > today).sort((a, b) => dOp(a).getTime() - dOp(b).getTime());

    const grouper = (cle: (p: Patient) => string) => {
      const m = new Map<string, Patient[]>();
      patients.forEach((p) => { const k = cle(p); (m.get(k) ?? m.set(k, []).get(k)!).push(p); });
      return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    };

    const parMedecin = grouper((p) => p.chirurgien?.trim() || "Non renseigné");
    const parDelegue = grouper((p) => p.delegue_nom?.trim() || "Non renseigné");
    const parAgence = grouper((p) => (p.agence_id ? (agenceNom.get(p.agence_id) ?? "Agence ?") : "Non rattaché"));

    const patientsParId = new Map(patients.map((p) => [p.id, p]));
    const parCoord = coords.map((c) => {
      const ids = liaisons.filter((l) => l.professionnel_id === c.id).map((l) => l.patient_id);
      const pts = ids.map((id) => patientsParId.get(id)).filter((p): p is Patient => !!p);
      return { c, pts };
    }).sort((a, b) => b.pts.length - a.pts.length);

    return {
      total: patients,
      enCours,
      aVenir,
      semaine: periode(lundi),
      mois: periode(moisDebut),
      annee: periode(anneeDebut),
      parMedecin,
      parDelegue,
      parAgence,
      parCoord,
    };
  }, [patients, coords, liaisons, agenceNom]);

  // ── Rapport périodique (semaine vendredi 17h / mois / année) ──
  const rapport = useMemo(() => construireRapport(periode, patients, agenceNom), [periode, patients, agenceNom]);

  if (pro && pro.niveau > 1) {
    return <div className="card text-sm text-slate-500">La page PEC est réservée aux managers (niveau 1) et à l&apos;administration (niveau 0).</div>;
  }
  if (!pret) return <p className="text-sm text-slate-400">Chargement…</p>;

  const ouvrir = (titre: string, pts: Patient[]) => setDetail({ titre, patients: pts });

  async function exporterRapport() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const ROSE: [number, number, number] = [190, 24, 93], NOIR: [number, number, number] = [40, 40, 40], GRIS: [number, number, number] = [90, 90, 90];
    const M = 15; let y = 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NOIR);
    doc.text(`Rapport ${rapport.motMaj.toLowerCase()} — Prises en charge`, M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text(rapport.labelCourant, M, y); y += 9;

    const kpis: [string, string | number][] = [[rapport.kpi.cette, rapport.courantCount], [rapport.kpi.meilleur, rapport.best], [rapport.kpi.pire, rapport.worst], [rapport.kpi.moyenne, rapport.moyenne.toFixed(1)]];
    kpis.forEach(([l, v], i) => {
      const x = M + i * 45;
      doc.setDrawColor(244, 200, 220); doc.roundedRect(x, y, 43, 17, 2, 2);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(String(l), x + 2.5, y + 5, { maxWidth: 39 });
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...ROSE); doc.text(String(v), x + 2.5, y + 14);
    });
    y += 26;

    const P = rapport.periodes;
    const PAL: [number, number, number][] = [[190, 24, 93], [37, 99, 235], [22, 163, 74], [217, 119, 6], [147, 51, 234], [13, 148, 136], [219, 39, 119], [100, 116, 139], [180, 83, 9]];

    // Graphe en ligne + tableau (périodes en colonnes) pour une catégorie.
    const bloc = (titre: string, lignes: LigneCat[]) => {
      const chartH = 38, gw = 180, x0 = M + 8;
      const need = 6 + chartH + 14 + lignes.length * 5 + 14;
      if (y + need > 285) { doc.addPage(); y = M; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NOIR); doc.text(titre, M, y); y += 6;
      const top2 = y; const b2 = top2 + chartH;
      const max = Math.max(1, ...lignes.flatMap((l) => l.serie));
      const xAt = (i: number) => x0 + (P.length <= 1 ? gw / 2 : (i * gw) / (P.length - 1));
      const yAt = (v: number) => b2 - (v / max) * chartH;
      doc.setDrawColor(225, 225, 230); doc.line(x0, b2, x0 + gw, b2);
      doc.setFontSize(6); doc.setTextColor(...GRIS);
      P.forEach((lab, i) => doc.text(lab, xAt(i), b2 + 3, { align: "center" }));
      lignes.forEach((l, li) => {
        const c = PAL[li % PAL.length]; doc.setDrawColor(...c); doc.setFillColor(...c);
        l.serie.forEach((v, i) => {
          if (i > 0) doc.line(xAt(i - 1), yAt(l.serie[i - 1]), xAt(i), yAt(v));
          doc.circle(xAt(i), yAt(v), 0.6, "F");
        });
      });
      y = b2 + 7;
      // Tableau : entité + colonnes périodes + total
      const colN = P.length, tw = 210 - 2 * M, c0 = 52, cw2 = (tw - c0 - 14) / colN;
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...GRIS);
      P.forEach((lab, i) => doc.text(lab, M + c0 + i * cw2 + cw2 / 2, y, { align: "center" }));
      doc.text("Tot.", 210 - M, y, { align: "right" }); y += 3;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...NOIR);
      lignes.forEach((l, li) => {
        if (y > 288) { doc.addPage(); y = M; }
        const c = PAL[li % PAL.length]; doc.setFillColor(...c); doc.circle(M + 1.5, y - 1.2, 0.9, "F");
        doc.setTextColor(...NOIR); doc.text(l.nom.length > 28 ? l.nom.slice(0, 27) + "…" : l.nom, M + 4, y);
        doc.setTextColor(...GRIS);
        l.serie.forEach((v, i) => doc.text(String(v), M + c0 + i * cw2 + cw2 / 2, y, { align: "center" }));
        doc.setTextColor(...NOIR); doc.setFont("helvetica", "bold"); doc.text(String(l.total), 210 - M, y, { align: "right" }); doc.setFont("helvetica", "normal");
        y += 5;
      });
      y += 6;
    };
    rapport.categories.forEach((cat) => bloc(cat.titre, cat.lignes));

    doc.save(`rapport-pec-${periode}-${rapport.courant.toLocaleDateString("fr-FR").replace(/\//g, "-")}.pdf`);
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold text-slate-800">Prises en charge</h1>

      {/* Rapport périodique (semaine vendredi 17h / mois / année) */}
      <section className="card grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Rapport {rapport.motMaj.toLowerCase()}</h2>
            <p className="text-xs text-slate-400">{rapport.labelCourant}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-rose-200 bg-white p-0.5">
              {([["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setPeriode(v)} className={`rounded-lg px-3 py-1 text-sm font-medium transition ${periode === v ? "bg-brand text-white" : "text-slate-600 hover:text-brand"}`}>{l}</button>
              ))}
            </div>
            <button onClick={exporterRapport} className="btn-secondary inline-flex items-center gap-2 text-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></svg>
              Extraire (PDF)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label={rapport.kpi.cette} value={rapport.courantCount} accent />
          <Kpi label={rapport.kpi.meilleur} value={rapport.best} />
          <Kpi label={rapport.kpi.pire} value={rapport.worst} />
          <Kpi label={rapport.kpi.moyenne} value={rapport.moyenne.toFixed(1)} />
        </div>

        <div className="grid gap-6">
          {rapport.categories.map((cat) => (
            <CategorieRapport key={cat.titre} titre={cat.titre} periodes={rapport.periodes} lignes={cat.lignes} />
          ))}
        </div>
      </section>

      {/* Chiffres clés — cliquables */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={stats.total.length} onClick={() => ouvrir("Toutes les PEC", stats.total)} />
        <Stat label="En cours" value={stats.enCours.length} accent onClick={() => ouvrir("PEC en cours", stats.enCours)} />
        <Stat label="À venir" value={stats.aVenir.length} onClick={() => ouvrir("PEC à venir", stats.aVenir)} />
        <Stat label="Cette semaine" value={stats.semaine.length} onClick={() => ouvrir("PEC cette semaine", stats.semaine)} />
        <Stat label="Ce mois" value={stats.mois.length} onClick={() => ouvrir("PEC ce mois", stats.mois)} />
        <Stat label="Cette année" value={stats.annee.length} onClick={() => ouvrir("PEC cette année", stats.annee)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloc titre="PEC par agence" lignes={stats.parAgence} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} />
        <Bloc titre="PEC par médecin" lignes={stats.parMedecin} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} />
        <Bloc titre="PEC par délégué" lignes={stats.parDelegue} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} />
      </div>

      <section className="card grid gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Patients gérés par coordinatrice</h2>
        {stats.parCoord.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune coordinatrice.</p>
        ) : (
          <div className="grid gap-1.5">
            {stats.parCoord.map(({ c, pts }) => (
              <button
                key={c.id}
                onClick={() => ouvrir(`Patients de ${nomComplet(c)}`, pts)}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-rose-50"
              >
                <span className="text-slate-700">
                  {nomComplet(c)}
                  {c.agence_id && <span className="text-slate-400"> · {agenceNom.get(c.agence_id)}</span>}
                </span>
                <span className="badge bg-rose-100 text-brand">{pts.length} patient(s)</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setDetail(null)}>
          <div className="card grid max-h-[80vh] w-full max-w-lg gap-3 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{detail.titre} · {detail.patients.length}</h2>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-critique">✕</button>
            </div>
            {detail.patients.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun patient.</p>
            ) : (
              <div className="grid gap-1.5">
                {[...detail.patients].sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => (
                  <Link
                    key={p.id}
                    href={`/pro/patients/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 px-3 py-2 text-sm transition hover:border-rose-200 hover:bg-rose-50"
                  >
                    <span className="font-medium text-slate-700">{p.nom}</span>
                    <span className="text-right text-xs text-slate-500">
                      {p.chirurgien ? `${p.chirurgien} · ` : ""}{fmtDate(p.date_operation)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-rose-100 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-brand" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

const PALETTE = ["#be185d", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0d9488", "#db2777", "#64748b", "#b45309"];

// Graphique en ligne (SVG) + tableau pour une catégorie (entités × périodes).
function CategorieRapport({ titre, periodes, lignes }: { titre: string; periodes: string[]; lignes: LigneCat[] }) {
  const W = 720, H = 170, padL = 28, padR = 12, padT = 12, padB = 22;
  const n = periodes.length;
  const max = Math.max(1, ...lignes.flatMap((l) => l.serie));
  const xAt = (i: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const yAt = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  return (
    <div className="rounded-xl border border-rose-100 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-700">{titre}</p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" style={{ height: 180 }}>
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e5e7eb" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#e5e7eb" />
          <text x={padL - 4} y={yAt(max) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{max}</text>
          <text x={padL - 4} y={yAt(0) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">0</text>
          {periodes.map((lab, i) => (
            <text key={i} x={xAt(i)} y={H - padB + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">{lab}</text>
          ))}
          {lignes.map((l, li) => {
            const col = PALETTE[li % PALETTE.length];
            const d = l.serie.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
            return (
              <g key={l.nom}>
                <path d={d} fill="none" stroke={col} strokeWidth={1.8} />
                {l.serie.map((v, i) => <circle key={i} cx={xAt(i)} cy={yAt(v)} r={2} fill={col} />)}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400">
              <th className="px-1 py-1 text-left font-medium"> </th>
              {periodes.map((lab) => <th key={lab} className="px-1 py-1 text-center font-medium">{lab}</th>)}
              <th className="px-1 py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, li) => (
              <tr key={l.nom} className="border-t border-rose-50">
                <td className="px-1 py-1 text-slate-700">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: PALETTE[li % PALETTE.length] }} />
                  {l.nom}
                </td>
                {l.serie.map((v, i) => <td key={i} className="px-1 py-1 text-center text-slate-500">{v}</td>)}
                <td className="px-1 py-1 text-right font-bold text-brand">{l.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left transition hover:border-rose-200 hover:shadow-md">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : "text-slate-800"}`}>{value}</p>
    </button>
  );
}

function Bloc({ titre, lignes, onLigne }: { titre: string; lignes: [string, Patient[]][]; onLigne: (nom: string, pts: Patient[]) => void }) {
  return (
    <section className="card grid gap-3">
      <h2 className="text-sm font-semibold text-slate-700">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune donnée.</p>
      ) : (
        <div className="grid gap-1.5">
          {lignes.map(([nom, pts]) => (
            <button
              key={nom}
              onClick={() => onLigne(nom, pts)}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-rose-50"
            >
              <span className="text-slate-700">{nom}</span>
              <span className="badge bg-rose-100 text-brand">{pts.length}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
