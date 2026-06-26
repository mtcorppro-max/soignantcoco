"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";

type RolePro = "coordinatrice" | "chirurgien" | "delegue";
type ProLite = { id: string; nom: string; prenom: string | null; titre: string | null; role: RolePro };
type TypeEvt = "astreinte" | "conges" | "arret_maladie" | "formation" | "autre";
type Evt = {
  id: string;
  professionnel_id: string;
  type: TypeEvt;
  date_debut: string; // YYYY-MM-DD
  date_fin: string;
  heure_debut: string | null;
  heure_fin: string | null;
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

const NB_JOURS = 45; // fenêtre glissante (~1,5 mois)

export default function OrganisationPage() {
  const pro = useProSession();
  const todayStr = useMemo(() => { const n = new Date(); return ymd(n.getFullYear(), n.getMonth(), n.getDate()); }, []);
  const [start, setStart] = useState(() => addDays(todayStr, -1)); // démarre à J-1
  const [coords, setCoords] = useState<ProLite[]>([]);
  const [events, setEvents] = useState<Evt[]>([]);
  const [editing, setEditing] = useState<Evt | null>(null);

  const interdit = pro && pro.role !== "coordinatrice" && pro.niveau !== 0;
  const fin = addDays(start, NB_JOURS - 1);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pros }, { data: evts }] = await Promise.all([
      supabase.from("professionnel").select("id,nom,prenom,titre,role").eq("role", "coordinatrice").order("nom"),
      supabase.from("evenement_planning").select("id,professionnel_id,type,date_debut,date_fin,heure_debut,heure_fin,remplacant_id,note")
        .lte("date_debut", fin).gte("date_fin", start),
    ]);
    setCoords((pros ?? []) as ProLite[]);
    setEvents((evts ?? []) as Evt[]);
  }, [start, fin]);

  useEffect(() => { charger(); }, [charger]);

  // Jours de la fenêtre (à partir de J-1)
  const jours = useMemo(() => Array.from({ length: NB_JOURS }, (_, i) => {
    const ds = addDays(start, i);
    const p = parse(ds);
    const dt = new Date(p.y, p.m, p.d);
    const dow = dt.getDay();
    return {
      i, ds, jour: p.d, dow,
      we: dow === 0 || dow === 6,
      premier: p.d === 1,
      estAuj: ds === todayStr,
      moisAbbr: dt.toLocaleDateString("fr-FR", { month: "short" }),
    };
  }), [start, todayStr]);

  const fmtHumain = (ds: string) => { const p = parse(ds); return new Date(p.y, p.m, p.d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); };

  // ── Drag (déplacer / étendre) ───────────────────────────────────────
  const drag = useRef<{ id: string; kind: "move" | "resize-l" | "resize-r"; left: number; dayW: number; lastIdx: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const idx = Math.max(0, Math.min(NB_JOURS - 1, Math.floor((e.clientX - d.left) / d.dayW)));
    if (idx === d.lastIdx) return;
    const delta = idx - d.lastIdx;
    d.lastIdx = idx;
    setEvents((arr) => arr.map((ev) => {
      if (ev.id !== d.id) return ev;
      if (d.kind === "move") return { ...ev, date_debut: addDays(ev.date_debut, delta), date_fin: addDays(ev.date_fin, delta) };
      const date = addDays(start, idx);
      if (d.kind === "resize-r") return diffDays(ev.date_debut, date) >= 0 ? { ...ev, date_fin: date } : ev;
      return diffDays(date, ev.date_fin) >= 0 ? { ...ev, date_debut: date } : ev;
    }));
  }, [start]);

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
    drag.current = { id: ev.id, kind, left: rect.left, dayW: rect.width / NB_JOURS, lastIdx: idxDepuisXInit(e.clientX, rect.left, rect.width / NB_JOURS, NB_JOURS) };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // ── Création par clic sur une cellule ───────────────────────────────
  function creer(proId: string, ds: string) {
    setEditing({ id: "", professionnel_id: proId, type: "conges", date_debut: ds, date_fin: ds, heure_debut: null, heure_fin: null, remplacant_id: null, note: null });
  }

  async function sauver(ev: Evt) {
    const supabase = createClient();
    const payload = {
      prestataire_id: pro!.prestataire_id,
      professionnel_id: ev.professionnel_id,
      type: ev.type,
      date_debut: ev.date_debut,
      date_fin: ev.date_fin,
      heure_debut: ev.type === "astreinte" ? ev.heure_debut || null : null,
      heure_fin: ev.type === "astreinte" ? ev.heure_fin || null : null,
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
        <h1 className="text-2xl font-bold text-slate-800">Organisation</h1>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-sm capitalize text-slate-500">{fmtHumain(start)} – {fmtHumain(fin)}</span>
          <button onClick={() => setStart((s) => addDays(s, -30))} className="btn-secondary px-3 py-1.5">←</button>
          <button onClick={() => setStart(addDays(todayStr, -1))} className="btn-secondary px-3 py-1.5 text-sm">Aujourd&apos;hui</button>
          <button onClick={() => setStart((s) => addDays(s, 30))} className="btn-secondary px-3 py-1.5">→</button>
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
        <div className="min-w-[1100px]">
          {/* En-tête jours */}
          <div className="flex border-b border-rose-100">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-slate-400">Coordinatrice</div>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${NB_JOURS}, minmax(0,1fr))` }}>
              {jours.map((j) => (
                <div
                  key={j.ds}
                  className={`py-1 text-center text-[10px] leading-tight ${j.premier && j.i > 0 ? "border-l-2 border-slate-300" : "border-l border-rose-50"} ${j.we ? "bg-rose-50/50" : ""} ${j.estAuj ? "font-bold text-brand" : "text-slate-400"}`}
                >
                  {j.premier && <span className="block text-[8px] font-semibold capitalize text-slate-500">{j.moisAbbr}</span>}
                  {j.jour}
                </div>
              ))}
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
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${NB_JOURS}, minmax(0,1fr))` }}>
                      {jours.map((j) => (
                        <button
                          key={j.ds}
                          onClick={() => creer(c.id, j.ds)}
                          className={`${j.premier && j.i > 0 ? "border-l-2 border-slate-300" : "border-l border-rose-50"} ${j.we ? "bg-rose-50/40" : ""} hover:bg-rose-100/50`}
                        />
                      ))}
                    </div>
                    {/* barres */}
                    {evs.map((ev) => {
                      const s = Math.max(0, diffDays(start, ev.date_debut));
                      const e = Math.min(NB_JOURS - 1, diffDays(start, ev.date_fin));
                      if (e < 0 || s > NB_JOURS - 1) return null;
                      const lane = lanes.get(ev.id) ?? 1;
                      return (
                        <div
                          key={ev.id}
                          onPointerDown={(p) => demarrerDrag(p, ev, "move")}
                          onClick={(p) => { p.stopPropagation(); setEditing(ev); }}
                          className={`absolute flex cursor-grab items-center rounded-md px-1.5 text-[10px] font-medium text-white ${TYPES[ev.type].bar} active:cursor-grabbing`}
                          style={{
                            left: `${(s / NB_JOURS) * 100}%`,
                            width: `${((e - s + 1) / NB_JOURS) * 100}%`,
                            top: (lane - 1) * 26 + 5,
                            height: 22,
                          }}
                          title={`${TYPES[ev.type].label}${ev.type === "astreinte" && ev.heure_debut ? ` ${ev.heure_debut}–${ev.heure_fin ?? ""}` : ""} — ${ev.date_debut} → ${ev.date_fin}`}
                        >
                          <span className="truncate">
                            {TYPES[ev.type].label}
                            {ev.type === "astreinte" && ev.heure_debut ? ` ${ev.heure_debut}–${ev.heure_fin ?? ""}` : ""}
                          </span>
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
          <Select
            value={f.type}
            onChange={(v) => setF({ ...f, type: v as TypeEvt })}
            options={(Object.keys(TYPES) as TypeEvt[]).map((t) => ({ value: t, label: TYPES[t].label }))}
          />
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

        {f.type === "astreinte" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Heure de début</label>
              <input type="time" className="input" value={f.heure_debut ?? ""} onChange={(e) => setF({ ...f, heure_debut: e.target.value || null })} />
            </div>
            <div>
              <label className="label">Heure de fin</label>
              <input type="time" className="input" value={f.heure_fin ?? ""} onChange={(e) => setF({ ...f, heure_fin: e.target.value || null })} />
            </div>
          </div>
        )}

        {estAbsence && (
          <div>
            <label className="label">Remplacé(e) par (reroutage des alertes / suivis)</label>
            <Select
              value={f.remplacant_id ?? ""}
              onChange={(v) => setF({ ...f, remplacant_id: v || null })}
              placeholder="— Aucun —"
              options={[{ value: "", label: "— Aucun —" }, ...remplacants.map((c) => ({ value: c.id, label: nomComplet(c) }))]}
            />
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
