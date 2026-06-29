"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { STATUTS } from "@/lib/parc";
import { genererEtiquettes } from "@/lib/genererBons";

type ArtLoc = { code: string; designation: string; maintenance_jours: number; location_max_jours: number | null };
type Equip = {
  id: string; numero_serie: string; statut: string; prochaine_maintenance: string | null; chez_patient_depuis: string | null;
  article: { designation: string; location_max_jours: number | null } | { designation: string; location_max_jours: number | null }[] | null;
  patient: { nom: string } | { nom: string }[] | null;
  agence: { id: string; nom: string } | { id: string; nom: string }[] | null;
  article_code: string; agence_id: string;
};

const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");
const todayIso = () => new Date().toISOString().slice(0, 10);
function addDaysIso(jours: number) { const d = new Date(); d.setDate(d.getDate() + jours); return d.toISOString().slice(0, 10); }

export default function ParcPage() {
  const pro = useProSession();
  const [equips, setEquips] = useState<Equip[]>([]);
  const [arts, setArts] = useState<ArtLoc[]>([]);
  const [pret, setPret] = useState(false);
  const [fArticle, setFArticle] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fAgence, setFAgence] = useState("");
  const [retard, setRetard] = useState(false);
  const [longue, setLongue] = useState(false);
  const estN0 = pro?.niveau === 0;
  const [ajout, setAjout] = useState(false);
  const [nSerie, setNSerie] = useState("");
  const [artAjout, setArtAjout] = useState("");
  const [busy, setBusy] = useState(false);

  const peutGerer = pro?.role === "magasinier" || pro?.niveau === 0;

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: eq }, { data: a }] = await Promise.all([
      supabase.from("equipement").select("id,numero_serie,statut,prochaine_maintenance,chez_patient_depuis,article_code,agence_id,article:article_code(designation,location_max_jours),patient:patient_actuel_id(nom),agence:agence_id(id,nom)").order("numero_serie"),
      supabase.from("article").select("code,designation,maintenance_jours,location_max_jours").eq("est_location", true).order("designation"),
    ]);
    setEquips((eq ?? []) as unknown as Equip[]);
    setArts((a ?? []) as ArtLoc[]);
    setPret(true);
  }, []);
  useEffect(() => { if (pro && peutGerer) charger(); else if (pro) setPret(true); }, [pro, peutGerer, charger]);

  const enRetard = (e: Equip) => !!e.prochaine_maintenance && e.prochaine_maintenance < todayIso() && e.statut !== "hors_service";
  const locTropLongue = (e: Equip) => {
    const max = un(e.article)?.location_max_jours;
    if (e.statut !== "chez_patient" || !e.chez_patient_depuis || !max) return false;
    return (Date.now() - new Date(e.chez_patient_depuis).getTime()) / 86_400_000 > max;
  };

  const filtres = useMemo(() => equips.filter((e) =>
    (!fArticle || e.article_code === fArticle) &&
    (!fStatut || e.statut === fStatut) &&
    (!fAgence || e.agence_id === fAgence) &&
    (!retard || enRetard(e)) &&
    (!longue || locTropLongue(e))
  ), [equips, fArticle, fStatut, fAgence, retard, longue]);

  const nbRetard = equips.filter(enRetard).length;
  const nbLongue = equips.filter(locTropLongue).length;
  const agences = estN0
    ? [...new Map(equips.map((e) => [un(e.agence)?.id, un(e.agence)?.nom]).filter(([id]) => id) as [string, string][]).entries()].map(([value, label]) => ({ value, label }))
    : [];

  async function ajouter() {
    if (!nSerie.trim() || !artAjout || !pro?.agence_id) return;
    const a = arts.find((x) => x.code === artAjout);
    setBusy(true);
    const { data, error } = await createClient().from("equipement").insert({
      agence_id: pro.agence_id, article_code: artAjout, numero_serie: nSerie.trim(),
      statut: "disponible", prochaine_maintenance: addDaysIso(a?.maintenance_jours ?? 365),
    }).select("id").single();
    if (!error && data) {
      await createClient().from("equipement_mouvement").insert({
        equipement_id: data.id, type_mouvement: "ajout", auteur_id: pro.id,
        auteur_nom: [pro.prenom, pro.nom].filter(Boolean).join(" "), note: "Entrée au parc",
      });
    }
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    setNSerie(""); setArtAjout(""); setAjout(false); charger();
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
            <input className="input" value={nSerie} onChange={(e) => setNSerie(e.target.value)} placeholder="ex. POMPE-00128" />
          </div>
          <div>
            <label className="label">Article (matériel de location)</label>
            <Select value={artAjout} onChange={setArtAjout} placeholder="— Choisir —" options={arts.map((a) => ({ value: a.code, label: a.designation }))} />
          </div>
          <button onClick={ajouter} disabled={busy || !nSerie.trim() || !artAjout} className="btn-primary py-2.5 disabled:opacity-50">{busy ? "…" : "Ajouter"}</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48"><Select value={fArticle} onChange={setFArticle} placeholder="Tous les articles" options={[{ value: "", label: "Tous les articles" }, ...arts.map((a) => ({ value: a.code, label: a.designation }))]} /></div>
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
          onClick={() => { if (filtres.length) genererEtiquettes(filtres.map((e) => ({ code: e.numero_serie, designation: un(e.article)?.designation ?? "" }))); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-50"
          title="Étiquettes QR (n° de série) à coller sur le matériel"
        >
          Étiquettes QR
        </button>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : filtres.length === 0 ? (
        <p className="text-sm text-slate-400">{equips.length === 0 ? "Aucun équipement. Ajoutez-en un (article marqué « location »)." : "Aucun équipement ne correspond aux filtres."}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtres.map((e) => {
            const st = STATUTS[e.statut] ?? STATUTS.disponible;
            const r = enRetard(e);
            return (
              <Link key={e.id} href={`/pro/parc/${e.id}`} className={`card flex flex-wrap items-center justify-between gap-3 transition hover:border-rose-200 hover:shadow-md ${r ? "border-rose-200 bg-rose-50/40" : ""}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{un(e.article)?.designation ?? "Équipement"} · <span className="font-mono text-sm text-slate-500">{e.numero_serie}</span></p>
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
