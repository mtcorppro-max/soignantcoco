"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { DateField } from "@/components/DateField";

type PatientLite = { id: string; nom: string; statut: string; date_operation: string | null; jours_suivi: number[] | null; alerte_1_nom: string | null; alerte_2_nom: string | null };
type LivraisonLite = { id: string; statut: string; date_prevue: string | null; patient: { nom: string } | { nom: string }[] | null };
type Action = { id: string; type: string; titre: string; date: string; heure: string | null; patient_id: string | null; description: string | null; fait: boolean };

type Item =
  | { k: "suivi"; heure: null; jour: number; patientId: string; patientNom: string; echeance: string }
  | { k: "livraison"; heure: null; statut: string; patientNom: string }
  | { k: "action"; heure: string | null; action: Action };

const TYPES_ACTION = [
  { value: "suivi", label: "Suivi" },
  { value: "livraison", label: "Livraison" },
  { value: "reunion", label: "Réunion" },
  { value: "autre", label: "Autre" },
];
const libAction = (t: string) => TYPES_ACTION.find((x) => x.value === t)?.label ?? t;
const BADGE_ACTION: Record<string, string> = { suivi: "bg-rose-100 text-brand", livraison: "bg-sky-100 text-sky-700", reunion: "bg-violet-100 text-violet-700", autre: "bg-slate-100 text-slate-600" };

const iso = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const off = x.getTimezoneOffset(); return new Date(x.getTime() - off * 60000).toISOString().slice(0, 10); };
const ajoute = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const lundi = (d: Date) => { const x = new Date(d); const j = (x.getDay() + 6) % 7; return ajoute(x, -j); };
const unP = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const fmtJour = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

// Libellé + couleurs d'un item (chip / pastille).
const itemLabel = (it: Item) => it.k === "suivi" ? `Suivi · ${it.patientNom}` : it.k === "livraison" ? `Livr. · ${it.patientNom}` : `${it.heure ? it.heure.slice(0, 5) + " " : ""}${it.action.titre}`;
const itemChip = (it: Item) => it.k === "suivi" ? "bg-rose-100 text-brand" : it.k === "livraison" ? "bg-sky-100 text-sky-700" : (BADGE_ACTION[it.action.type] ?? BADGE_ACTION.autre);
const itemDot = (it: Item) => it.k === "suivi" ? "bg-brand" : it.k === "livraison" ? "bg-sky-500" : it.action.type === "reunion" ? "bg-violet-500" : it.action.type === "livraison" ? "bg-sky-500" : it.action.type === "suivi" ? "bg-brand" : "bg-slate-400";

const VIDE = { type: "reunion", titre: "", date: "", heure: "", patient_id: "", description: "" };

export default function AgendaPage() {
  const pro = useProSession();
  const monNom = pro ? [pro.titre, pro.prenom, pro.nom].filter(Boolean).join(" ") : "";
  const [mode, setMode] = useState<"mois" | "semaine" | "jour">("mois");
  const [ancre, setAncre] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [livs, setLivs] = useState<LivraisonLite[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [faits, setFaits] = useState<Set<string>>(new Set());
  const [pret, setPret] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...VIDE });
  const [busy, setBusy] = useState(false);

  // Jours affichés selon le mode (mois = grille 6 semaines).
  const jours = useMemo(() => {
    if (mode === "jour") return [new Date(ancre)];
    if (mode === "semaine") return Array.from({ length: 7 }, (_, i) => ajoute(lundi(ancre), i));
    const premier = new Date(ancre.getFullYear(), ancre.getMonth(), 1);
    const dernier = new Date(ancre.getFullYear(), ancre.getMonth() + 1, 0);
    const out: Date[] = [];
    for (let d = lundi(premier); d <= ajoute(lundi(dernier), 6); d = ajoute(d, 1)) out.push(new Date(d));
    return out;
  }, [mode, ancre]);
  const debut = iso(jours[0]);
  const fin = iso(jours[jours.length - 1]);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pts }, { data: lv }, { data: act }, { data: rsv }] = await Promise.all([
      supabase.from("patient").select("id,nom,statut,date_operation,jours_suivi,alerte_1_nom,alerte_2_nom"),
      supabase.from("livraison").select("id,statut,date_prevue,patient:patient_id(nom)").gte("date_prevue", debut).lte("date_prevue", fin),
      supabase.from("agenda_action").select("id,type,titre,date,heure,patient_id,description,fait").gte("date", debut).lte("date", fin),
      supabase.from("rappel_suivi_valide").select("patient_id,echeance").gte("echeance", debut).lte("echeance", fin),
    ]);
    setPatients((pts ?? []) as PatientLite[]);
    setLivs((lv ?? []) as unknown as LivraisonLite[]);
    setActions((act ?? []) as Action[]);
    setFaits(new Set((rsv ?? []).map((r) => `${r.patient_id}|${r.echeance}`)));
    setPret(true);
  }, [debut, fin]);
  useEffect(() => { charger(); }, [charger]);

  const parJour = useMemo(() => {
    const map = new Map<string, Item[]>();
    jours.forEach((d) => map.set(iso(d), []));
    patients.forEach((p) => {
      if (p.statut !== "active" || !p.date_operation) return;
      if (p.alerte_1_nom !== monNom && p.alerte_2_nom !== monNom) return;
      const base = new Date(p.date_operation);
      if (isNaN(base.getTime())) return;
      (p.jours_suivi ?? []).forEach((j) => {
        const dd = iso(ajoute(base, j));
        if (!map.has(dd) || faits.has(`${p.id}|${dd}`)) return;
        map.get(dd)!.push({ k: "suivi", heure: null, jour: j, patientId: p.id, patientNom: p.nom, echeance: dd });
      });
    });
    livs.forEach((l) => { if (l.date_prevue && map.has(l.date_prevue)) map.get(l.date_prevue)!.push({ k: "livraison", heure: null, statut: l.statut, patientNom: unP(l.patient)?.nom ?? "Patient" }); });
    actions.forEach((a) => { if (map.has(a.date)) map.get(a.date)!.push({ k: "action", heure: a.heure, action: a }); });
    for (const [, items] of map) items.sort((x, y) => (x.heure ?? "99").localeCompare(y.heure ?? "99"));
    return map;
  }, [jours, patients, livs, actions, faits, monNom]);

  async function marquerSuiviFait(patientId: string, echeance: string, jour: number) {
    setFaits((s) => new Set(s).add(`${patientId}|${echeance}`));
    await createClient().from("rappel_suivi_valide").insert({ patient_id: patientId, type: `J${jour}`, echeance, validee_par: pro?.nom ?? null });
  }
  async function toggleAction(a: Action) {
    setActions((arr) => arr.map((x) => (x.id === a.id ? { ...x, fait: !x.fait } : x)));
    await createClient().from("agenda_action").update({ fait: !a.fait }).eq("id", a.id);
  }
  async function supprimerAction(id: string) {
    setActions((arr) => arr.filter((x) => x.id !== id));
    await createClient().from("agenda_action").delete().eq("id", id);
  }
  async function ajouterAction(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titre.trim() || !f.date) { alert("Titre et date requis."); return; }
    if (!pro?.prestataire_id) return;
    setBusy(true);
    const { data, error } = await createClient().from("agenda_action").insert({
      prestataire_id: pro.prestataire_id, professionnel_id: pro.id, type: f.type, titre: f.titre.trim(),
      date: f.date, heure: f.heure || null, patient_id: f.patient_id || null, description: f.description.trim() || null,
    }).select("id,type,titre,date,heure,patient_id,description,fait").single();
    setBusy(false);
    if (error || !data) { alert("Échec : " + (error?.message ?? "")); return; }
    setOpen(false); setF({ ...VIDE });
    if (data.date >= debut && data.date <= fin) setActions((arr) => [...arr, data as Action]); else charger();
  }

  function navig(dir: number) {
    setAncre((d) => (mode === "mois" ? new Date(d.getFullYear(), d.getMonth() + dir, 1) : ajoute(d, dir * (mode === "jour" ? 1 : 7))));
  }
  const ouvrirJour = (d: Date) => { setAncre(new Date(d)); setMode("jour"); };

  const ongletBtn = (actif: boolean) => `rounded-xl border px-4 py-2 text-sm font-semibold transition ${actif ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`;
  const modeBtn = (actif: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${actif ? "bg-rose-100 text-brand" : "text-slate-500 hover:bg-rose-50"}`;
  const labelPeriode = mode === "mois" ? ancre.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : mode === "jour" ? fmtJour(jours[0])
    : `${jours[0].toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${jours[6].toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
  const auj = iso(new Date());

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>
        <button onClick={() => { setF({ ...VIDE, date: iso(ancre) }); setOpen((v) => !v); }} className="btn-primary px-4 py-2 text-sm">+ Ajouter</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button className={ongletBtn(true)}>Mon agenda</button>
        <Link href="/pro/calendrier" prefetch className={ongletBtn(false)}>Organisation de l&apos;équipe</Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button onClick={() => setMode("mois")} className={modeBtn(mode === "mois")}>Mois</button>
          <button onClick={() => setMode("semaine")} className={modeBtn(mode === "semaine")}>Semaine</button>
          <button onClick={() => setMode("jour")} className={modeBtn(mode === "jour")}>Jour</button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => navig(-1)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-sm text-brand hover:bg-rose-50" aria-label="Précédent">‹</button>
          <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAncre(d); setMode("jour"); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-brand hover:bg-rose-50">Aujourd&apos;hui</button>
          <button onClick={() => navig(1)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-sm text-brand hover:bg-rose-50" aria-label="Suivant">›</button>
        </div>
      </div>
      <p className="mb-3 text-base font-semibold capitalize text-slate-700">{labelPeriode}</p>

      {open && (
        <form onSubmit={ajouterAction} className="card mb-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Type</label><Select value={f.type} onChange={(v) => setF((s) => ({ ...s, type: v }))} options={TYPES_ACTION} /></div>
            <div><label className="label">Date</label><DateField value={f.date} onChange={(v) => setF((s) => ({ ...s, date: v }))} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Heure <span className="text-slate-400">(facultatif)</span></label><input type="time" className="input" value={f.heure} onChange={(e) => setF((s) => ({ ...s, heure: e.target.value }))} /></div>
            <div><label className="label">Patient <span className="text-slate-400">(facultatif)</span></label><Select value={f.patient_id} onChange={(v) => setF((s) => ({ ...s, patient_id: v }))} placeholder="— Aucun —" options={[{ value: "", label: "— Aucun —" }, ...patients.map((p) => ({ value: p.id, label: p.nom }))]} /></div>
          </div>
          <div><label className="label">Intitulé *</label><input className="input" value={f.titre} onChange={(e) => setF((s) => ({ ...s, titre: e.target.value }))} placeholder="Réunion d'équipe, appel patient…" required /></div>
          <div><label className="label">Note <span className="text-slate-400">(facultatif)</span></label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
          <button className="btn-primary py-2.5" disabled={busy}>{busy ? "Ajout…" : "Ajouter à l'agenda"}</button>
        </form>
      )}

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : mode === "jour" ? (
        <JourDetail d={jours[0]} items={parJour.get(iso(jours[0])) ?? []} onSuiviFait={marquerSuiviFait} onToggle={toggleAction} onDelete={supprimerAction} />
      ) : (
        <div className="card overflow-hidden p-0">
          {/* En-tête jours de la semaine */}
          <div className="grid grid-cols-7 border-b border-rose-100 bg-rose-50/50">
            {JOURS_COURTS.map((j) => <div key={j} className="py-2 text-center text-xs font-semibold capitalize text-slate-500">{j}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {jours.map((d, i) => {
              const k = iso(d);
              const items = parJour.get(k) ?? [];
              const horsMois = mode === "mois" && d.getMonth() !== ancre.getMonth();
              const estAuj = k === auj;
              const max = mode === "mois" ? 3 : 6;
              return (
                <button
                  key={k}
                  onClick={() => ouvrirJour(d)}
                  className={`flex flex-col gap-1 border-b border-r border-rose-100 p-1.5 text-left align-top transition hover:bg-rose-50/50 ${mode === "mois" ? "min-h-[70px] sm:min-h-[88px]" : "min-h-[120px]"} ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${horsMois ? "bg-slate-50/60" : "bg-white"}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${estAuj ? "bg-brand text-white" : horsMois ? "text-slate-300" : "text-slate-600"}`}>{d.getDate()}</span>
                  {mode === "mois" ? (
                    <div className="flex flex-wrap gap-0.5">
                      {items.slice(0, max).map((it, idx) => <span key={idx} className={`h-1.5 w-1.5 rounded-full ${itemDot(it)}`} />)}
                      {items.length > max && <span className="text-[9px] font-semibold text-slate-400">+{items.length - max}</span>}
                    </div>
                  ) : (
                    <div className="grid gap-0.5">
                      {items.slice(0, max).map((it, idx) => <span key={idx} className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${itemChip(it)}`}>{itemLabel(it)}</span>)}
                      {items.length > max && <span className="text-[10px] font-semibold text-slate-400">+{items.length - max}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function JourDetail({ d, items, onSuiviFait, onToggle, onDelete }: {
  d: Date; items: Item[];
  onSuiviFait: (pid: string, ech: string, jour: number) => void;
  onToggle: (a: Action) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {items.length === 0 ? (
        <p className="card text-sm text-slate-400">Rien de prévu ce jour.</p>
      ) : items.map((it, idx) => <LigneAgenda key={idx} it={it} onSuiviFait={onSuiviFait} onToggle={onToggle} onDelete={onDelete} />)}
      <p className="px-1 text-xs text-slate-300">{items.length} élément(s) · {fmtJour(d)}</p>
    </div>
  );
}

function LigneAgenda({ it, onSuiviFait, onToggle, onDelete }: {
  it: Item;
  onSuiviFait: (pid: string, ech: string, jour: number) => void;
  onToggle: (a: Action) => void;
  onDelete: (id: string) => void;
}) {
  if (it.k === "suivi") {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 py-2.5">
        <div className="min-w-0"><span className="badge bg-rose-100 text-brand">Suivi J{it.jour}</span><Link href={`/pro/patients/${it.patientId}`} prefetch className="ml-2 font-medium text-slate-700 hover:text-brand">{it.patientNom}</Link></div>
        <button onClick={() => onSuiviFait(it.patientId, it.echeance, it.jour)} className="shrink-0 text-sm font-medium text-brand hover:underline">Marquer fait</button>
      </div>
    );
  }
  if (it.k === "livraison") {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 py-2.5">
        <div className="min-w-0"><span className="badge bg-sky-100 text-sky-700">Livraison</span><span className="ml-2 font-medium text-slate-700">{it.patientNom}</span></div>
        <Link href="/pro/livraisons" prefetch className="shrink-0 text-sm font-medium text-brand hover:underline">Tournée →</Link>
      </div>
    );
  }
  const a = it.action;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-2 py-2.5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input type="checkbox" checked={a.fait} onChange={() => onToggle(a)} className="accent-brand" />
        <span className="min-w-0">
          {a.heure && <span className="mr-1.5 text-xs font-semibold text-slate-400">{a.heure.slice(0, 5)}</span>}
          <span className={`badge ${BADGE_ACTION[a.type] ?? BADGE_ACTION.autre}`}>{libAction(a.type)}</span>
          <span className={`ml-2 font-medium ${a.fait ? "text-slate-400 line-through" : "text-slate-700"}`}>{a.titre}</span>
          {a.description && <span className="block truncate text-xs text-slate-400">{a.description}</span>}
        </span>
      </label>
      <button onClick={() => onDelete(a.id)} className="shrink-0 text-xs font-medium text-critique hover:underline">Suppr.</button>
    </div>
  );
}
