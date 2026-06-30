"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { estCoordOuManager } from "@/lib/roles";

type GroupePlanning = "coordinatrice" | "livreur";
type ProLite = { id: string; nom: string; prenom: string | null; titre: string | null; role: GroupePlanning; agence_id: string | null };
const LIBELLE_GROUPE: Record<GroupePlanning, { singulier: string; pluriel: string }> = {
  coordinatrice: { singulier: "Coordinatrice", pluriel: "Coordinatrices" },
  livreur: { singulier: "Livreur", pluriel: "Livreurs" },
};
type TypeEvt = "astreinte" | "cp" | "rtt" | "arret_maladie" | "formation" | "autre";
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
  statut: "valide" | "en_attente";
};

const TYPES: Record<TypeEvt, { label: string; bar: string; chip: string }> = {
  astreinte:     { label: "Astreinte",     bar: "bg-indigo-500",  chip: "bg-indigo-100 text-indigo-700" },
  cp:            { label: "CP",            bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  rtt:           { label: "RTT",           bar: "bg-cyan-500",    chip: "bg-cyan-100 text-cyan-700" },
  arret_maladie: { label: "Arrêt maladie", bar: "bg-rose-500",    chip: "bg-rose-100 text-rose-700" },
  formation:     { label: "Formation",     bar: "bg-amber-500",   chip: "bg-amber-100 text-amber-700" },
  autre:         { label: "Autre",         bar: "bg-slate-400",   chip: "bg-slate-100 text-slate-600" },
};
const ABSENCES: TypeEvt[] = ["cp", "rtt", "arret_maladie", "formation"];

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
  const [agenceNom, setAgenceNom] = useState<Map<string, string>>(new Map());
  const [agenceRegion, setAgenceRegion] = useState<Map<string, string>>(new Map());
  const [moi, setMoi] = useState<{ niveau: number; agence_id: string | null; region_id: string | null } | null>(null);
  const [filtreAgence, setFiltreAgence] = useState("");
  // Groupe affiché : coordinatrices ou livreurs (calendriers séparés).
  const [groupe, setGroupe] = useState<GroupePlanning>("coordinatrice");

  const estLivreurMoi = pro?.role === "livreur" && pro.niveau !== 0;
  // Un livreur n'accède qu'au calendrier des livreurs (le sien).
  useEffect(() => { if (estLivreurMoi) setGroupe("livreur"); }, [estLivreurMoi]);

  const interdit = pro && !estCoordOuManager(pro.role) && pro.niveau !== 0 && pro.role !== "livreur";
  const fin = addDays(start, NB_JOURS - 1);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: pros }, { data: evts }, { data: ags }, { data: me }] = await Promise.all([
      supabase.from("professionnel").select("id,nom,prenom,titre,role,agence_id").in("role", ["coordinatrice", "livreur"]).order("nom"),
      supabase.from("evenement_planning").select("id,professionnel_id,type,date_debut,date_fin,heure_debut,heure_fin,remplacant_id,note,statut")
        .lte("date_debut", fin).gte("date_fin", start),
      supabase.from("agence").select("id,nom,region_id"),
      user ? supabase.from("professionnel").select("niveau,agence_id,region_id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setCoords((pros ?? []) as ProLite[]);
    setEvents((evts ?? []) as Evt[]);
    setAgenceNom(new Map((ags ?? []).map((a) => [a.id as string, a.nom as string])));
    setAgenceRegion(new Map((ags ?? []).map((a) => [a.id as string, a.region_id as string])));
    setMoi((me ?? null) as { niveau: number; agence_id: string | null; region_id: string | null } | null);
  }, [start, fin]);

  useEffect(() => { charger(); }, [charger]);

  // Cloisonnement par agence : chaque agence voit son organisation.
  // Niveau 0 = toutes ; niveau 1 = les agences de sa région ; niveau 2 = son agence.
  const niveauMoi = moi?.niveau ?? pro?.niveau ?? 3;
  // Région du compte : sa région directe (manager) sinon celle de son agence.
  const maRegion = moi?.region_id ?? (moi?.agence_id ? agenceRegion.get(moi.agence_id) : undefined);
  // Une agence est-elle dans le périmètre du compte connecté ?
  const agenceDansPerimetre = (agId: string) => {
    if (niveauMoi === 0) return true;
    if (niveauMoi === 1) return agenceRegion.get(agId) === maRegion;
    return agId === moi?.agence_id; // niveau 2
  };
  // Agences sélectionnables (pour basculer d'un calendrier d'agence à l'autre).
  const agencesPerimetre = [...agenceNom.entries()]
    .filter(([id]) => agenceDansPerimetre(id))
    .map(([id, nom]) => ({ value: id, label: nom }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Agence affichée : celle choisie, sinon la première du périmètre.
  const agenceCourante = filtreAgence || agencesPerimetre[0]?.value || "";
  // Lignes affichées : du groupe sélectionné (coordinatrices OU livreurs) et de l'agence courante.
  const lignesVisibles = coords.filter((c) => c.role === groupe && c.agence_id === agenceCourante);

  // Demandes en attente de validation (managers / niveau 0), sur tout le périmètre.
  const nomPro = new Map(coords.map((c) => [c.id, nomComplet(c)]));
  const dansPerimetre = (proId: string) => {
    const c = coords.find((x) => x.id === proId);
    return !!c?.agence_id && agenceDansPerimetre(c.agence_id);
  };
  // Seul le manager (niveau 1) valide les demandes.
  const demandes = niveauMoi === 1
    ? events.filter((e) => e.statut === "en_attente" && dansPerimetre(e.professionnel_id))
    : [];

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
    if (estLivreurMoi && proId !== pro?.id) return; // un livreur ne pose que ses propres congés
    setEditing({ id: "", professionnel_id: proId, type: "cp", date_debut: ds, date_fin: ds, heure_debut: null, heure_fin: null, remplacant_id: null, note: null, statut: "valide" });
  }

  async function sauver(ev: Evt) {
    const supabase = createClient();
    // Un manager/niveau 0 valide directement ; une coordinatrice fait une demande.
    const statut: Evt["statut"] = ev.id ? ev.statut : (niveauMoi <= 1 ? "valide" : "en_attente");
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
      statut,
    };
    const { error } = ev.id
      ? await supabase.from("evenement_planning").update(payload).eq("id", ev.id)
      : await supabase.from("evenement_planning").insert(payload);
    if (error) {
      alert("Enregistrement refusé : " + error.message);
      return;
    }
    setEditing(null);
    if (statut === "en_attente") alert("Demande envoyée au manager pour validation.");
    charger();
  }

  // Validation d'une demande par le manager.
  async function valider(id: string) {
    const { error } = await createClient().from("evenement_planning").update({ statut: "valide" }).eq("id", id);
    if (error) { alert("Validation refusée : " + error.message); return; }
    charger();
  }
  async function supprimer(id: string) {
    const { error } = await createClient().from("evenement_planning").delete().eq("id", id);
    if (error) { alert("Suppression refusée : " + error.message); return; }
    setEditing(null);
    charger();
  }

  if (interdit) {
    return <div className="card text-sm text-slate-500">L&apos;organisation est réservée aux coordinatrices, managers et livreurs.</div>;
  }

  return (
    <div className="grid gap-4">
      <Link href="/pro/agenda" prefetch className="text-sm text-slate-400 hover:text-brand">← Mon agenda</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Organisation de l&apos;équipe</h1>
          {/* Bascule entre les deux calendriers séparés (caché pour le livreur). */}
          {!estLivreurMoi && (
            <div className="inline-flex rounded-xl border border-rose-200 bg-white p-0.5">
              {(["coordinatrice", "livreur"] as GroupePlanning[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupe(g)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${groupe === g ? "bg-brand text-white" : "text-slate-500 hover:bg-rose-50"}`}
                >
                  {LIBELLE_GROUPE[g].pluriel}
                </button>
              ))}
            </div>
          )}
          {agencesPerimetre.length > 1 && (
            <div className="w-56">
              <Select
                value={agenceCourante}
                onChange={setFiltreAgence}
                options={agencesPerimetre}
              />
            </div>
          )}
        </div>
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

      {/* Demandes en attente (notification manager) */}
      {demandes.length > 0 && (
        <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            🔔 {demandes.length} demande(s) en attente de validation
          </p>
          {demandes.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-slate-700">{nomPro.get(d.professionnel_id) ?? "Soignant"}</span>
                <span className="text-slate-400"> · </span>
                <span className={`badge ${TYPES[d.type].chip}`}>{TYPES[d.type].label}</span>
                <span className="text-slate-500"> du {fmtHumain(d.date_debut)} au {fmtHumain(d.date_fin)}</span>
              </span>
              <span className="flex gap-2">
                <button onClick={() => valider(d.id)} className="rounded-lg bg-ok px-3 py-1 text-xs font-semibold text-white hover:opacity-90">Valider</button>
                <button onClick={() => supprimer(d.id)} className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-critique hover:bg-red-50">Refuser</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Calendrier */}
      <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white">
        <div className="min-w-[1100px]">
          {/* En-tête jours */}
          <div className="flex border-b border-rose-100">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-slate-400">{LIBELLE_GROUPE[groupe].singulier}</div>
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

          {/* Lignes du groupe sélectionné */}
          {lignesVisibles.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Aucun(e) {LIBELLE_GROUPE[groupe].singulier.toLowerCase()} dans votre périmètre.</p>
          ) : (
            lignesVisibles.map((c) => {
              const evs = events.filter((e) => e.professionnel_id === c.id);
              const lanes = assignerLanes(evs);
              const nbLanes = Math.max(1, ...lanes.values());
              const hauteur = nbLanes * 26 + 10;
              // Un livreur ne peut éditer que sa propre ligne ; les autres lignes
              // sont en lecture seule (consultation des absences de l'équipe).
              const editable = !estLivreurMoi || c.id === pro?.id;
              return (
                <div key={c.id} className="flex border-b border-rose-50">
                  <div className="flex w-40 shrink-0 items-center px-3 py-2 text-sm font-medium text-slate-700">
                    {nomComplet(c)}
                  </div>
                  <div data-zone className="relative flex-1" style={{ height: hauteur }}>
                    {/* cellules cliquables (seulement si éditable) */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${NB_JOURS}, minmax(0,1fr))` }}>
                      {jours.map((j) => (
                        <button
                          key={j.ds}
                          onClick={editable ? () => creer(c.id, j.ds) : undefined}
                          disabled={!editable}
                          className={`${j.premier && j.i > 0 ? "border-l-2 border-slate-300" : "border-l border-rose-50"} ${j.we ? "bg-rose-50/40" : ""} ${editable ? "hover:bg-rose-100/50" : "cursor-default"}`}
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
                          onPointerDown={editable ? (p) => demarrerDrag(p, ev, "move") : undefined}
                          onClick={editable ? (p) => { p.stopPropagation(); setEditing(ev); } : undefined}
                          className={`absolute flex items-center rounded-md px-1.5 text-[10px] font-medium text-white ${TYPES[ev.type].bar} ${editable ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${ev.statut === "en_attente" ? "opacity-50 ring-1 ring-amber-400 ring-offset-1" : ""}`}
                          style={{
                            left: `${(s / NB_JOURS) * 100}%`,
                            width: `${((e - s + 1) / NB_JOURS) * 100}%`,
                            top: (lane - 1) * 26 + 5,
                            height: 22,
                          }}
                          title={`${TYPES[ev.type].label}${ev.statut === "en_attente" ? " (en attente)" : ""}${ev.type === "astreinte" && ev.heure_debut ? ` ${ev.heure_debut}–${ev.heure_fin ?? ""}` : ""} — ${ev.date_debut} → ${ev.date_fin}`}
                        >
                          <span className="truncate">
                            {ev.statut === "en_attente" ? "⏳ " : ""}
                            {TYPES[ev.type].label}
                            {ev.type === "astreinte" && ev.heure_debut ? ` ${ev.heure_debut}–${ev.heure_fin ?? ""}` : ""}
                          </span>
                          {editable && (
                            <span
                              onPointerDown={(p) => demarrerDrag(p, ev, "resize-r")}
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-md bg-black/10"
                            />
                          )}
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
          coords={lignesVisibles}
          niveauMoi={niveauMoi}
          estService={groupe === "livreur"}
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
  ev, coords, niveauMoi, estService, onClose, onSave, onDelete,
}: {
  ev: Evt;
  coords: ProLite[];
  niveauMoi: number;
  estService: boolean;
  onClose: () => void;
  onSave: (e: Evt) => void;
  onDelete: (id: string) => void;
}) {
  const [f, setF] = useState<Evt>(ev);
  const coordCible = coords.find((c) => c.id === f.professionnel_id);
  const remplacants = coords.filter((c) => c.id !== f.professionnel_id);
  const estAbsence = ABSENCES.includes(f.type);
  // L'arrêt maladie n'est posable que par un manager / niveau 0.
  // Les livreurs n'ont pas d'astreinte (calendrier de service).
  const typesDispo = (Object.keys(TYPES) as TypeEvt[]).filter((t) => {
    if (t === "arret_maladie" && niveauMoi > 1) return false;
    if (t === "astreinte" && estService) return false;
    return true;
  });

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
            options={typesDispo.map((t) => ({ value: t, label: TYPES[t].label }))}
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
