"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Avatar } from "@/components/Avatar";

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
type Coord = { id: string; nom: string; prenom: string | null; titre: string | null; agence_id: string | null; photo_url: string | null };
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

export default function PecPage() {
  const pro = useProSession();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [liaisons, setLiaisons] = useState<Liaison[]>([]);
  const [agenceNom, setAgenceNom] = useState<Map<string, string>>(new Map());
  const [pret, setPret] = useState(false);
  const [detail, setDetail] = useState<{ titre: string; patients: Patient[] } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("patient").select("id,nom,date_operation,duree_prise_en_charge,chirurgien,delegue_nom,agence_id,traitement,statut"),
      supabase.from("professionnel").select("id,nom,prenom,titre,agence_id,photo_url").eq("role", "coordinatrice"),
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
    const parTraitement = grouper((p) => p.traitement?.trim() || "Non renseigné");

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
      parTraitement,
      parCoord,
    };
  }, [patients, coords, liaisons, agenceNom]);

  const estDir = pro?.role === "dirigeant";
  if (pro && pro.niveau > 1 && !estDir) {
    return <div className="card text-sm text-slate-500">La page PEC est réservée aux managers (niveau 1) et à l&apos;administration (niveau 0).</div>;
  }
  if (!pret) return <p className="text-sm text-slate-400">Chargement…</p>;

  const ouvrir = (titre: string, pts: Patient[]) => setDetail({ titre, patients: pts });

  // Extraction PDF d'UNE catégorie (tableau OU graphique) sur une période.
  async function exporterCategorie(catTitre: string, mode: "tableau" | "graphique", per: Periode) {
    const r = construireRapport(per, patients, agenceNom);
    const cat = r.categories.find((c) => c.titre === catTitre);
    if (!cat) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const NOIR: [number, number, number] = [40, 40, 40], GRIS: [number, number, number] = [90, 90, 90];
    const PAL: [number, number, number][] = [[190, 24, 93], [37, 99, 235], [22, 163, 74], [217, 119, 6], [147, 51, 234], [13, 148, 136], [219, 39, 119], [100, 116, 139], [180, 83, 9]];
    const M = 15; let y = 18;
    const P = r.periodes, lignes = cat.lignes;

    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NOIR);
    doc.text(catTitre, M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text(r.labelCourant, M, y); y += 10;

    if (mode === "graphique") {
      const x0 = M + 10, gw = 175, chartH = 75, base = y + chartH;
      const max = Math.max(1, ...lignes.flatMap((l) => l.serie));
      const xAt = (i: number) => x0 + (P.length <= 1 ? gw / 2 : (i * gw) / (P.length - 1));
      const yAt = (v: number) => base - (v / max) * chartH;
      doc.setDrawColor(220, 220, 225); doc.line(x0, base, x0 + gw, base); doc.line(x0, y, x0, base);
      doc.setFontSize(7); doc.setTextColor(...GRIS);
      doc.text(String(max), x0 - 2, y + 2, { align: "right" }); doc.text("0", x0 - 2, base, { align: "right" });
      P.forEach((lab, i) => doc.text(lab, xAt(i), base + 4, { align: "center" }));
      lignes.forEach((l, li) => {
        const c = PAL[li % PAL.length]; doc.setDrawColor(...c); doc.setFillColor(...c); doc.setLineWidth(0.5);
        l.serie.forEach((v, i) => { if (i > 0) doc.line(xAt(i - 1), yAt(l.serie[i - 1]), xAt(i), yAt(v)); doc.circle(xAt(i), yAt(v), 0.8, "F"); });
      });
      y = base + 12;
      // Légende
      doc.setFontSize(8);
      lignes.forEach((l, li) => {
        if (y > 285) { doc.addPage(); y = M; }
        const c = PAL[li % PAL.length]; doc.setFillColor(...c); doc.circle(M + 1.5, y - 1.2, 1, "F");
        doc.setTextColor(...NOIR); doc.text(`${l.nom} (${l.total})`, M + 5, y); y += 5;
      });
    } else {
      const colN = P.length, tw = 210 - 2 * M, c0 = 56, cw2 = (tw - c0 - 14) / colN;
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...GRIS);
      P.forEach((lab, i) => doc.text(lab, M + c0 + i * cw2 + cw2 / 2, y, { align: "center" }));
      doc.text("Total", 210 - M, y, { align: "right" }); y += 2;
      doc.setDrawColor(225, 225, 230); doc.line(M, y, 210 - M, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...NOIR);
      lignes.forEach((l) => {
        if (y > 288) { doc.addPage(); y = M; }
        doc.setTextColor(...NOIR); doc.text(l.nom.length > 30 ? l.nom.slice(0, 29) + "…" : l.nom, M, y);
        doc.setTextColor(...GRIS);
        l.serie.forEach((v, i) => doc.text(String(v), M + c0 + i * cw2 + cw2 / 2, y, { align: "center" }));
        doc.setTextColor(...NOIR); doc.setFont("helvetica", "bold"); doc.text(String(l.total), 210 - M, y, { align: "right" }); doc.setFont("helvetica", "normal");
        y += 5.5;
      });
    }
    const slug = catTitre.toLowerCase().replace(/[^a-z]+/g, "-");
    doc.save(`pec-${slug}-${mode}-${per}.pdf`);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Prises en charge</h1>
        {estDir && <p className="mt-1 text-sm text-slate-500">Vue nationale — toutes les régions et agences.</p>}
      </div>

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
        <Bloc titre="PEC par agence" lignes={stats.parAgence} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} onExtraire={(m, p) => exporterCategorie("PEC par agence", m, p)} />
        <Bloc titre="PEC par médecin" lignes={stats.parMedecin} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} onExtraire={(m, p) => exporterCategorie("PEC par médecin", m, p)} />
        <Bloc titre="PEC par délégué" lignes={stats.parDelegue} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} onExtraire={(m, p) => exporterCategorie("PEC par délégué", m, p)} />
        <Bloc titre="PEC par type de traitement" lignes={stats.parTraitement} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} onExtraire={(m, p) => exporterCategorie("PEC par type de traitement", m, p)} />
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
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-rose-50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar url={c.photo_url} prenom={c.prenom} nom={c.nom} taille="sm" />
                  <span className="min-w-0 text-left text-slate-700">
                    {nomComplet(c)}
                    {c.agence_id && <span className="text-slate-400"> · {agenceNom.get(c.agence_id)}</span>}
                  </span>
                </span>
                <span className="badge shrink-0 bg-rose-100 text-brand">{pts.length} patient(s)</span>
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

function Stat({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left transition hover:border-rose-200 hover:shadow-md">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : "text-slate-800"}`}>{value}</p>
    </button>
  );
}

function ExtraireMenu({ onExtraire }: { onExtraire: (mode: "tableau" | "graphique", periode: Periode) => void }) {
  const [open, setOpen] = useState<null | "tableau" | "graphique">(null);
  const periodes: [Periode, string][] = [["semaine", "Dernière semaine"], ["mois", "Dernier mois"], ["annee", "Dernière année"]];
  return (
    <div className="relative flex items-center gap-1.5">
      {(["tableau", "graphique"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => setOpen(open === mode ? null : mode)}
          className={`relative z-30 btn-secondary px-2.5 py-1 text-xs capitalize ${open === mode ? "bg-rose-50" : ""}`}
        >
          {mode}
        </button>
      ))}
      {open && (
        <>
          {/* Voile sous les boutons (z-20) : un seul tap pour basculer/fermer. */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(null)} />
          {/* Ancré à gauche sur mobile (boutons à gauche), à droite sur desktop. */}
          <div className="absolute left-0 top-full z-30 mt-1 w-44 max-w-[calc(100vw-3rem)] rounded-xl border border-rose-100 bg-white p-1 shadow-lg sm:left-auto sm:right-0">
            {periodes.map(([p, l]) => (
              <button
                key={p}
                onClick={() => { const m = open; setOpen(null); if (m) onExtraire(m, p); }}
                className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-rose-50"
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Bloc({ titre, lignes, onLigne, onExtraire }: { titre: string; lignes: [string, Patient[]][]; onLigne: (nom: string, pts: Patient[]) => void; onExtraire?: (mode: "tableau" | "graphique", periode: Periode) => void }) {
  return (
    <section className="card grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{titre}</h2>
        {onExtraire && <ExtraireMenu onExtraire={onExtraire} />}
      </div>
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
