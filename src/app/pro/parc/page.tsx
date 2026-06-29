"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { STATUTS } from "@/lib/parc";
import { genererEtiquettes } from "@/lib/genererBons";

type TypeEq = { id: string; nom: string; maintenance_jours: number; location_max_jours: number | null };
type Equip = {
  id: string; numero_serie: string; statut: string; prochaine_maintenance: string | null; chez_patient_depuis: string | null;
  type: { nom: string; location_max_jours: number | null } | { nom: string; location_max_jours: number | null }[] | null;
  patient: { nom: string } | { nom: string }[] | null;
  agence: { id: string; nom: string } | { id: string; nom: string }[] | null;
  type_id: string; agence_id: string;
};

const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");
const todayIso = () => new Date().toISOString().slice(0, 10);
function addDaysIso(jours: number) {
  const d = new Date(); d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}

export default function ParcPage() {
  const pro = useProSession();
  const [equips, setEquips] = useState<Equip[]>([]);
  const [types, setTypes] = useState<TypeEq[]>([]);
  const [pret, setPret] = useState(false);
  const [fType, setFType] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fAgence, setFAgence] = useState("");
  const [retard, setRetard] = useState(false);
  const [longue, setLongue] = useState(false);
  const estN0 = pro?.niveau === 0;
  // Formulaire d'ajout
  const [ajout, setAjout] = useState(false);
  const [nSerie, setNSerie] = useState("");
  const [typeAjout, setTypeAjout] = useState("");
  const [busy, setBusy] = useState(false);

  const peutGerer = pro?.role === "magasinier" || pro?.niveau === 0;

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: eq }, { data: ty }] = await Promise.all([
      supabase.from("equipement").select("id,numero_serie,statut,prochaine_maintenance,chez_patient_depuis,type_id,agence_id,type:type_id(nom,location_max_jours),patient:patient_actuel_id(nom),agence:agence_id(id,nom)").order("numero_serie"),
      supabase.from("equipement_type").select("id,nom,maintenance_jours,location_max_jours").order("nom"),
    ]);
    setEquips((eq ?? []) as unknown as Equip[]);
    setTypes((ty ?? []) as TypeEq[]);
    setPret(true);
  }, []);
  useEffect(() => { if (pro && peutGerer) charger(); else if (pro) setPret(true); }, [pro, peutGerer, charger]);

  const enRetard = (e: Equip) => !!e.prochaine_maintenance && e.prochaine_maintenance < todayIso() && e.statut !== "hors_service";
  const locTropLongue = (e: Equip) => {
    const max = un(e.type)?.location_max_jours;
    if (e.statut !== "chez_patient" || !e.chez_patient_depuis || !max) return false;
    return (Date.now() - new Date(e.chez_patient_depuis).getTime()) / 86_400_000 > max;
  };

  const filtres = useMemo(() => {
    return equips.filter((e) =>
      (!fType || e.type_id === fType) &&
      (!fStatut || e.statut === fStatut) &&
      (!fAgence || e.agence_id === fAgence) &&
      (!retard || enRetard(e)) &&
      (!longue || locTropLongue(e))
    );
  }, [equips, fType, fStatut, fAgence, retard, longue]);

  const nbRetard = equips.filter(enRetard).length;
  const nbLongue = equips.filter(locTropLongue).length;
  // Agences présentes (filtre réservé au niveau 0, multi-agence).
  const agences = estN0
    ? [...new Map(equips.map((e) => [un(e.agence)?.id, un(e.agence)?.nom]).filter(([id]) => id) as [string, string][]).entries()].map(([value, label]) => ({ value, label }))
    : [];

  async function ajouter() {
    if (!nSerie.trim() || !typeAjout || !pro?.agence_id) return;
    const ty = types.find((t) => t.id === typeAjout);
    setBusy(true);
    const { data, error } = await createClient().from("equipement").insert({
      agence_id: pro.agence_id, type_id: typeAjout, numero_serie: nSerie.trim(),
      statut: "disponible", prochaine_maintenance: addDaysIso(ty?.maintenance_jours ?? 365),
    }).select("id").single();
    if (!error && data) {
      await createClient().from("equipement_mouvement").insert({
        equipement_id: data.id, type_mouvement: "ajout", auteur_id: pro.id,
        auteur_nom: [pro.prenom, pro.nom].filter(Boolean).join(" "), note: "Entrée au parc",
      });
    }
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    setNSerie(""); setTypeAjout(""); setAjout(false); charger();
  }

  if (pro && !peutGerer) {
    return <div className="card text-sm text-slate-500">Le parc matériel est géré par le magasinier.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parc matériel</h1>
          <p className="mt-1 text-sm text-slate-500">{equips.length} équipement(s).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/pro/parc/maintenance" className="btn-secondary text-sm">Planning de maintenance →</Link>
          {pro?.agence_id && <button onClick={() => setAjout((v) => !v)} className="btn-primary text-sm">{ajout ? "Fermer" : "+ Ajouter un équipement"}</button>}
        </div>
      </div>

      {(nbRetard > 0 || nbLongue > 0) && (
        <div className="grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
          {nbRetard > 0 && (
            <button onClick={() => { setRetard(true); setLongue(false); }} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-rose-50">
              <span className="font-medium text-critique">Maintenance en retard</span>
              <span className="badge bg-critique text-white">{nbRetard}</span>
            </button>
          )}
          {nbLongue > 0 && (
            <button onClick={() => { setLongue(true); setRetard(false); }} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-rose-50">
              <span className="font-medium text-attention">Location trop longue</span>
              <span className="badge bg-amber-100 text-attention">{nbLongue}</span>
            </button>
          )}
        </div>
      )}

      {ajout && (
        <div className="card grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label">N° de série</label>
            <input className="input" value={nSerie} onChange={(e) => setNSerie(e.target.value)} placeholder="ex. CO2-00128" />
          </div>
          <div>
            <label className="label">Type</label>
            <Select value={typeAjout} onChange={setTypeAjout} placeholder="— Choisir —" options={types.map((t) => ({ value: t.id, label: t.nom }))} />
          </div>
          <button onClick={ajouter} disabled={busy || !nSerie.trim() || !typeAjout} className="btn-primary py-2.5 disabled:opacity-50">{busy ? "…" : "Ajouter"}</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44"><Select value={fType} onChange={setFType} placeholder="Tous les types" options={[{ value: "", label: "Tous les types" }, ...types.map((t) => ({ value: t.id, label: t.nom }))]} /></div>
        <div className="w-44"><Select value={fStatut} onChange={setFStatut} placeholder="Tous les statuts" options={[{ value: "", label: "Tous les statuts" }, ...Object.entries(STATUTS).map(([v, s]) => ({ value: v, label: s.label }))]} /></div>
        {estN0 && agences.length > 0 && (
          <div className="w-48"><Select value={fAgence} onChange={setFAgence} placeholder="Toutes les agences" options={[{ value: "", label: "Toutes les agences" }, ...agences]} /></div>
        )}
        <button onClick={() => setRetard((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${retard ? "border-rose-300 bg-rose-100 text-critique" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}>
          Maintenance en retard{nbRetard > 0 ? ` (${nbRetard})` : ""}
        </button>
        <button onClick={() => setLongue((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${longue ? "border-amber-300 bg-amber-100 text-attention" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}>
          Location longue{nbLongue > 0 ? ` (${nbLongue})` : ""}
        </button>
        <button
          onClick={() => { if (filtres.length) genererEtiquettes(filtres.map((e) => ({ code: e.numero_serie, designation: un(e.type)?.nom ?? "" }))); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-50"
          title="Étiquettes QR (n° de série) à coller sur le matériel"
        >
          Étiquettes QR
        </button>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : filtres.length === 0 ? (
        <p className="text-sm text-slate-400">{equips.length === 0 ? "Aucun équipement. Ajoutez-en un." : "Aucun équipement ne correspond aux filtres."}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtres.map((e) => {
            const st = STATUTS[e.statut] ?? STATUTS.disponible;
            const r = enRetard(e);
            return (
              <Link key={e.id} href={`/pro/parc/${e.id}`} className={`card flex flex-wrap items-center justify-between gap-3 transition hover:border-rose-200 hover:shadow-md ${r ? "border-rose-200 bg-rose-50/40" : ""}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{un(e.type)?.nom ?? "Équipement"} · <span className="font-mono text-sm text-slate-500">{e.numero_serie}</span></p>
                  <p className="text-xs text-slate-400">
                    {estN0 && un(e.agence) ? `${un(e.agence)?.nom} · ` : ""}{un(e.patient) ? `Chez ${un(e.patient)?.nom}` : "—"} · Prochaine maintenance : {fmt(e.prochaine_maintenance)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {r && <span className="badge bg-critique text-white">Maintenance dépassée</span>}
                  {locTropLongue(e) && <span className="badge bg-amber-100 text-attention">Location longue</span>}
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
