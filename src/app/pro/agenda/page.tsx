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
  | { k: "suivi"; date: string; heure: null; jour: number; patientId: string; patientNom: string; echeance: string }
  | { k: "livraison"; date: string; heure: null; statut: string; patientNom: string }
  | { k: "action"; date: string; heure: string | null; action: Action };

const TYPES_ACTION = [
  { value: "suivi", label: "Suivi" },
  { value: "livraison", label: "Livraison" },
  { value: "reunion", label: "Réunion" },
  { value: "autre", label: "Autre" },
];
const libAction = (t: string) => TYPES_ACTION.find((x) => x.value === t)?.label ?? t;
const BADGE_ACTION: Record<string, string> = { suivi: "bg-rose-100 text-brand", livraison: "bg-sky-100 text-sky-700", reunion: "bg-violet-100 text-violet-700", autre: "bg-slate-100 text-slate-500" };

const iso = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); };
const ajoute = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const lundi = (d: Date) => { const x = new Date(d); const j = (x.getDay() + 6) % 7; return ajoute(x, -j); };
const unP = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const fmtJour = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });

const VIDE = { type: "reunion", titre: "", date: "", heure: "", patient_id: "", description: "" };

export default function AgendaPage() {
  const pro = useProSession();
  const monNom = pro ? [pro.titre, pro.prenom, pro.nom].filter(Boolean).join(" ") : "";
  const [mode, setMode] = useState<"jour" | "semaine">("semaine");
  const [ancre, setAncre] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [livs, setLivs] = useState<LivraisonLite[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [faits, setFaits] = useState<Set<string>>(new Set());
  const [pret, setPret] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...VIDE });
  const [busy, setBusy] = useState(false);

  const jours = useMemo(() => (mode === "jour" ? [new Date(ancre)] : Array.from({ length: 7 }, (_, i) => ajoute(lundi(ancre), i))), [mode, ancre]);
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

  // Items par jour (clé = date ISO)
  const parJour = useMemo(() => {
    const map = new Map<string, Item[]>();
    jours.forEach((d) => map.set(iso(d), []));
    // Suivis dont je suis responsable (alerte 1 ou 2)
    patients.forEach((p) => {
      if (p.statut !== "active" || !p.date_operation) return;
      if (p.alerte_1_nom !== monNom && p.alerte_2_nom !== monNom) return;
      const base = new Date(p.date_operation);
      if (isNaN(base.getTime())) return;
      (p.jours_suivi ?? []).forEach((j) => {
        const dd = iso(ajoute(base, j));
        if (!map.has(dd)) return;
        if (faits.has(`${p.id}|${dd}`)) return;
        map.get(dd)!.push({ k: "suivi", date: dd, heure: null, jour: j, patientId: p.id, patientNom: p.nom, echeance: dd });
      });
    });
    livs.forEach((l) => { if (l.date_prevue && map.has(l.date_prevue)) map.get(l.date_prevue)!.push({ k: "livraison", date: l.date_prevue, heure: null, statut: l.statut, patientNom: unP(l.patient)?.nom ?? "Patient" }); });
    actions.forEach((a) => { if (map.has(a.date)) map.get(a.date)!.push({ k: "action", date: a.date, heure: a.heure, action: a }); });
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
    if (data.date >= debut && data.date <= fin) setActions((arr) => [...arr, data as Action]);
    else charger();
  }

  const ongletBtn = (actif: boolean) => `rounded-xl border px-4 py-2 text-sm font-semibold transition ${actif ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`;
  const labelPeriode = mode === "jour" ? fmtJour(jours[0]) : `${jours[0].toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${jours[6].toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Agenda</h1>
        <button onClick={() => { setF({ ...VIDE, date: iso(ancre) }); setOpen((v) => !v); }} className="btn-primary px-4 py-2 text-sm">+ Ajouter</button>
      </div>

      {/* Bascule individuel / équipe */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button className={ongletBtn(true)}>Mon agenda</button>
        <Link href="/pro/calendrier" prefetch className={ongletBtn(false)}>Organisation de l&apos;équipe</Link>
      </div>

      {/* Mode + navigation */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button onClick={() => setMode("jour")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "jour" ? "bg-rose-100 text-brand" : "text-slate-500 hover:bg-rose-50"}`}>Jour</button>
          <button onClick={() => setMode("semaine")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "semaine" ? "bg-rose-100 text-brand" : "text-slate-500 hover:bg-rose-50"}`}>Semaine</button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setAncre((d) => ajoute(d, mode === "jour" ? -1 : -7))} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-sm text-brand hover:bg-rose-50" aria-label="Précédent">‹</button>
          <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAncre(d); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-brand hover:bg-rose-50">Aujourd&apos;hui</button>
          <button onClick={() => setAncre((d) => ajoute(d, mode === "jour" ? 1 : 7))} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-sm text-brand hover:bg-rose-50" aria-label="Suivant">›</button>
        </div>
      </div>
      <p className="mb-3 text-sm font-semibold capitalize text-slate-600">{labelPeriode}</p>

      {/* Formulaire d'ajout */}
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
      ) : (
        <div className="grid gap-3">
          {jours.map((d) => {
            const k = iso(d);
            const items = parJour.get(k) ?? [];
            const estAujourdhui = k === iso(new Date());
            return (
              <section key={k} className="grid gap-2">
                <h2 className={`text-sm font-semibold capitalize ${estAujourdhui ? "text-brand" : "text-slate-600"}`}>{fmtJour(d)}{estAujourdhui ? " · aujourd'hui" : ""}</h2>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-rose-100 px-3 py-2 text-xs text-slate-300">Rien de prévu</p>
                ) : (
                  items.map((it, idx) => <LigneAgenda key={idx} it={it} onSuiviFait={marquerSuiviFait} onToggle={toggleAction} onDelete={supprimerAction} />)
                )}
              </section>
            );
          })}
        </div>
      )}
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
        <div className="min-w-0">
          <span className="badge bg-rose-100 text-brand">Suivi J{it.jour}</span>
          <Link href={`/pro/patients/${it.patientId}`} prefetch className="ml-2 font-medium text-slate-700 hover:text-brand">{it.patientNom}</Link>
        </div>
        <button onClick={() => onSuiviFait(it.patientId, it.echeance, it.jour)} className="shrink-0 text-sm font-medium text-brand hover:underline">Marquer fait</button>
      </div>
    );
  }
  if (it.k === "livraison") {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 py-2.5">
        <div className="min-w-0">
          <span className="badge bg-sky-100 text-sky-700">Livraison</span>
          <span className="ml-2 font-medium text-slate-700">{it.patientNom}</span>
        </div>
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
