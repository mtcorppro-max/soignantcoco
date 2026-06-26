"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type RolePro = "coordinatrice" | "chirurgien" | "delegue";
type ProLite = { id: string; nom: string; prenom: string | null; titre: string | null; role: RolePro };
type TypeEvt = "astreinte" | "conges" | "arret_maladie" | "formation" | "autre";
type Evt = {
  id: string;
  professionnel_id: string;
  type: TypeEvt;
  date_debut: string; // YYYY-MM-DD
  date_fin: string;
  remplacant_id: string | null;
  note: string | null;
};

const TYPES: Record<TypeEvt, { label: string; bar: string; chip: string }> = {
  astreinte:     { label: "Astreinte",     bar: "bg-indigo-500",  chip: "bg-indigo-100 text-indigo-700" },
  conges:        { label: "Congés",        bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  arret_maladie: { label: "Arrêt maladie", bar: "bg-rose-500",    chip: "bg-rose-100 text-rose-700" },
  formation:     { label: "Formation",     bar: "bg-amber-500",   chip: "bg-amber-100 text-amber-700" },
  autre:         { label: "Autre",         bar: "bg-slate-400",   chip: "bg-slate-100 text-slate-600" },
};
const ABSENCES: TypeEvt[] = ["conges", "arret_maladie", "formation"];

const nomComplet = (p: { titre?: string | null; prenom?: string | null; nom: string }) =>
  [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");

// ── Helpers date (YYYY-MM-DD, sans fuseau) ──────────────────────────────
function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parse(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
function addDays(s: string, n: number) {
  const { y, m, d } = parse(s);
  const dt = new Date(y, m, d + n);
  return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function diffDays(a: string, b: string) {
  const pa = parse(a), pb = parse(b);
  return Math.round((new Date(pb.y, pb.m, pb.d).getTime() - new Date(pa.y, pa.m, pa.d).getTime()) / 86_400_000);
}

export default function OrganisationPage() {
  const pro = useProSession();
  const [mois, setMois] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [coords, setCoords] = useState<ProLite[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [editing, setEditing] = useState<Evt | null>(null);

  const interdit = pro && pro.role !== "coordinatrice";

  const charger = useCallback(async () => {
    const supabase = createClient();
    const debutMois = ymd(mois.y, mois.m, 1);
    const finMois = ymd(mois.y, mois.m, new Date(mois.y, mois.m + 1, 0).getDate());
    const [{ data: pros }, { data: evts }] = await Promise.all([
      supabase.from("professionnel").select("id,nom,prenom,titre,role").eq("role", "coordinatrice").order("nom"),
      supabase.from("evenement_planning").select("id,professionnel_id,type,date_debut,date_fin,remplacant_id,note")
        .lte("date_debut", finMois).gte("date_fin", debutMois),
    ]);
    setCoords((pros ?? []) as ProLite[]);
    setEvents((evts ?? []) as Evt[]);
  }, [mois]);

  useEffect(() => { charger(); }, [charger]);

  const nbJours = new Date(mois.y, mois.m + 1, 0).getDate();
  const jours = Array.from({ length: nbJours }, (_, i) => i + 1);
  const today = new Date();
  const moisLabel = new Date(mois.y, mois.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // ── Drag (déplacer / étendre) ───────────────────────────────────────
  const drag = useRef<{ id: string; kind: "move" | "resize-l" | "resize-r"; left: number; dayW: number; lastIdx: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const idx = Math.max(0, Math.min(nbJours - 1, Math.floor((e.clientX - d.left) / d.dayW)));
    if (idx === d.lastIdx) return;
    const delta = idx - d.lastIdx;
    d.lastIdx = idx;
    setEvents((arr) => arr.map((ev) => {
      if (ev.id !== d.id) return ev;
      if (d.kind === "move") return { ...ev, date_debut: addDays(ev.date_debut, delta), date_fin: addDays(ev.date_fin, delta) };
      if (d.kind === "resize-r") {
        const nf = ymd(mois.y, mois.m, idx + 1);
        return diffDays(ev.date_debut, nf) >= 0 ? { ...ev, date_fin: nf } : ev;
      }
      const nd = ymd(mois.y, mois.m, idx + 1);
      return diffDays(nd, ev.date_fin) >= 0 ? { ...ev, date_debut: nd } : ev;
    }));
  }, [nbJours, mois]);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (!d) return;
    // Persiste les dates à jour de l'événement déplacé / redimensionné.
    setEvents((arr) => {
      const cur = arr.find((x) => x.id === d.id);
      if (cur) {
        void createClient()
          .from("evenement_planning")
          .update({ date_debut: cur.date_debut, date_fin: cur.date_fin })
          .eq("id", cur.id);
      }
      return arr;
    });
  }, [onPointerMove]);

  function demarrerDrag(e: React.PointerEvent, ev: Evt, kind: "move" | "resize-l" | "resize-r") {
    e.stopPropagation();
    const zone = (e.currentTarget as HTMLElement).closest("[data-zone]") as HTMLElement | null;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    drag.current = { id: ev.id, kind, left: rect.left, dayW: rect.width / nbJours, lastIdx: idxDepuisXInit(e.clientX, rect.left, rect.width / nbJours, nbJours) };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // ── Création par clic sur une cellule ───────────────────────────────
  function creer(proId: string, jour: number) {
    const date = ymd(mois.y, mois.m, jour);
    setEditing({ id: "", professionnel_id: proId, type: "conges", date_debut: date, date_fin: date, remplacant_id: null, note: null });
  }

  async function sauver(ev: Evt) {
    const supabase = createClient();
    const payload = {
      prestataire_id: pro!.prestataire_id,
      professionnel_id: ev.professionnel_id,
      type: ev.type,
      date_debut: ev.date_debut,
      date_fin: ev.date_fin,
      remplacant_id: ev.remplacant_id,
      note: ev.note,
    };
    if (ev.id) await supabase.from("evenement_planning").update(payload).eq("id", ev.id);
    else await supabase.from("evenement_planning").insert(payload);
    setEditing(null);
    charger();
  }
  async function supprimer(id: string) {
    await createClient().from("evenement_planning").delete().eq("id", id);
    setEditing(null);
    charger();
  }

  if (interdit) {
    return <div className="card text-sm text-slate-500">L&apos;organisation est réservée aux infirmières coordinatrices.</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold capitalize text-slate-800">{moisLabel}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMois((s) => ({ y: s.m === 0 ? s.y - 1 : s.y, m: s.m === 0 ? 11 : s.m - 1 }))} className="btn-secondary px-3 py-1.5">←</button>
          <button onClick={() => { const n = new Date(); setMois({ y: n.getFullYear(), m: n.getMonth() }); }} className="btn-secondary px-3 py-1.5 text-sm">Aujourd&apos;hui</button>
          <button onClick={() => setMois((s) => ({ y: s.m === 11 ? s.y + 1 : s.y, m: s.m === 11 ? 0 : s.m + 1 }))} className="btn-secondary px-3 py-1.5">→</button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3">
        {(Object.keys(TYPES) as TypeEvt[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-3 w-3 rounded ${TYPES[t].bar}`} />{TYPES[t].label}
          </span>
        ))}
        <span className="text-xs text-slate-400">· Clic sur un jour = ajouter · Glisser la barre = déplacer · Bord droit = étendre</span>
      </div>

      {/* Calendrier */}
      <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white">
        <div className="min-w-[760px]">
          {/* En-tête jours */}
          <div className="flex border-b border-rose-100">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-slate-400">Coordinatrice</div>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${nbJours}, minmax(0,1fr))` }}>
              {jours.map((j) => {
                const estAuj = today.getFullYear() === mois.y && today.getMonth() === mois.m && today.getDate() === j;
                const dow = new Date(mois.y, mois.m, j).getDay();
                const we = dow === 0 || dow === 6;
                return (
                  <div key={j} className={`border-l border-rose-50 py-1 text-center text-[10px] ${we ? "bg-rose-50/50" : ""} ${estAuj ? "font-bold text-brand" : "text-slate-400"}`}>
                    {j}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lignes coordinatrices */}
          {coords.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Aucune infirmière coordinatrice.</p>
          ) : (
            coords.map((c) => {
              const evs = events.filter((e) => e.professionnel_id === c.id);
              const lanes = assignerLanes(evs);
              const nbLanes = Math.max(1, ...lanes.values());
              const hauteur = nbLanes * 26 + 10;
              return (
                <div key={c.id} className="flex border-b border-rose-50">
                  <div className="flex w-40 shrink-0 items-center px-3 py-2 text-sm font-medium text-slate-700">
                    {nomComplet(c)}
                  </div>
                  <div data-zone className="relative flex-1" style={{ height: hauteur }}>
                    {/* cellules cliquables */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${nbJours}, minmax(0,1fr))` }}>
                      {jours.map((j) => {
                        const dow = new Date(mois.y, mois.m, j).getDay();
                        const we = dow === 0 || dow === 6;
                        return <button key={j} onClick={() => creer(c.id, j)} className={`border-l border-rose-50 ${we ? "bg-rose-50/40" : ""} hover:bg-rose-100/50`} />;
                      })}
                    </div>
                    {/* barres */}
                    {evs.map((ev) => {
                      const s = Math.max(0, diffDays(ymd(mois.y, mois.m, 1), ev.date_debut));
                      const e = Math.min(nbJours - 1, diffDays(ymd(mois.y, mois.m, 1), ev.date_fin));
                      if (e < 0 || s > nbJours - 1) return null;
                      const lane = lanes.get(ev.id) ?? 1;
                      return (
                        <div
                          key={ev.id}
                          onPointerDown={(p) => demarrerDrag(p, ev, "move")}
                          onClick={(p) => { p.stopPropagation(); setEditing(ev); }}
                          className={`absolute flex cursor-grab items-center rounded-md px-1.5 text-[10px] font-medium text-white ${TYPES[ev.type].bar} active:cursor-grabbing`}
                          style={{
                            left: `${(s / nbJours) * 100}%`,
                            width: `${((e - s + 1) / nbJours) * 100}%`,
                            top: (lane - 1) * 26 + 5,
                            height: 22,
                          }}
                          title={`${TYPES[ev.type].label} — ${ev.date_debut} → ${ev.date_fin}`}
                        >
                          <span className="truncate">{TYPES[ev.type].label}</span>
                          <span
                            onPointerDown={(p) => demarrerDrag(p, ev, "resize-r")}
                            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-black/10"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editing && (
        <EditeurEvenement
          ev={editing}
          coords={coords}
          onClose={() => setEditing(null)}
          onSave={sauver}
          onDelete={supprimer}
        />
      )}
    </div>
  );
}

// Index initial de jour (au pointerdown) pour les déplacements.
function idxDepuisXInit(clientX: number, left: number, dayW: number, n: number) {
  return Math.max(0, Math.min(n - 1, Math.floor((clientX - left) / dayW)));
}

// Affecte une "voie" (lane) à chaque événement pour éviter le chevauchement.
function assignerLanes(evs: Evt[]): Map<string, number> {
  const map = new Map<string, number>();
  const finsParLane: string[] = []; // date_fin par lane (index 0 = lane 1)
  [...evs].sort((a, b) => a.date_debut.localeCompare(b.date_debut)).forEach((ev) => {
    let lane = 0;
    while (lane < finsParLane.length && finsParLane[lane] >= ev.date_debut) lane++;
    finsParLane[lane] = ev.date_fin;
    map.set(ev.id, lane + 1);
  });
  return map;
}

function EditeurEvenement({
  ev, coords, onClose, onSave, onDelete,
}: {
  ev: Evt;
  coords: ProLite[];
  onClose: () => void;
  onSave: (e: Evt) => void;
  onDelete: (id: string) => void;
}) {
  const [f, setF] = useState<Evt>(ev);
  const coordCible = coords.find((c) => c.id === f.professionnel_id);
  const remplacants = coords.filter((c) => c.id !== f.professionnel_id);
  const estAbsence = ABSENCES.includes(f.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-md grid gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-700">
          {ev.id ? "Modifier" : "Ajouter"} — {coordCible ? nomComplet(coordCible) : ""}
        </h2>

        <div>
          <label className="label">Type</label>
          <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TypeEvt })}>
            {(Object.keys(TYPES) as TypeEvt[]).map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Du</label>
            <input type="date" className="input" value={f.date_debut} onChange={(e) => setF({ ...f, date_debut: e.target.value, date_fin: e.target.value > f.date_fin ? e.target.value : f.date_fin })} />
          </div>
          <div>
            <label className="label">Au</label>
            <input type="date" className="input" value={f.date_fin} min={f.date_debut} onChange={(e) => setF({ ...f, date_fin: e.target.value })} />
          </div>
        </div>

        {estAbsence && (
          <div>
            <label className="label">Remplacé(e) par (reroutage des alertes / suivis)</label>
            <select className="select" value={f.remplacant_id ?? ""} onChange={(e) => setF({ ...f, remplacant_id: e.target.value || null })}>
              <option value="">— Aucun —</option>
              {remplacants.map((c) => <option key={c.id} value={c.id}>{nomComplet(c)}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Note (optionnel)</label>
          <input className="input" value={f.note ?? ""} onChange={(e) => setF({ ...f, note: e.target.value || null })} />
        </div>

        <div className="flex gap-2">
          {ev.id && (
            <button onClick={() => onDelete(ev.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-critique hover:bg-red-50">
              Supprimer
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={() => onSave(f)} className="btn-primary flex-1">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
