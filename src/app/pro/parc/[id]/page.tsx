"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { STATUTS } from "@/lib/parc";

type Equip = {
  id: string; numero_serie: string; statut: string; etat: string | null;
  chez_patient_depuis: string | null; derniere_maintenance: string | null; prochaine_maintenance: string | null;
  article: { designation: string; maintenance_jours: number } | { designation: string; maintenance_jours: number }[] | null;
  patient: { nom: string } | { nom: string }[] | null;
};
type Mvt = { id: string; type_mouvement: string; date: string; etat: string | null; note: string | null; auteur_nom: string | null; patient: { nom: string } | { nom: string }[] | null };

const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");
const fmtDt = (s: string) => new Date(s).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const todayIso = () => new Date().toISOString().slice(0, 10);
function addDaysIso(jours: number) { const d = new Date(); d.setDate(d.getDate() + jours); return d.toISOString().slice(0, 10); }

const MVT: Record<string, string> = {
  ajout: "Entrée au parc", affectation: "Affecté à une livraison", livraison: "Livré chez le patient",
  recuperation_patient: "Repris chez le patient", retour_agence: "Retour à l'agence",
  mise_maintenance: "Mise en maintenance", fin_maintenance: "Maintenance terminée", reforme: "Réformé",
};

export default function FicheEquipement() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const pro = useProSession();
  const [eq, setEq] = useState<Equip | null>(null);
  const [mvts, setMvts] = useState<Mvt[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);

  const peutGerer = pro?.role === "magasinier" || pro?.niveau === 0;

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: e }, { data: m }] = await Promise.all([
      supabase.from("equipement").select("id,numero_serie,statut,etat,chez_patient_depuis,derniere_maintenance,prochaine_maintenance,article:article_code(designation,maintenance_jours),patient:patient_actuel_id(nom)").eq("id", id).maybeSingle(),
      supabase.from("equipement_mouvement").select("id,type_mouvement,date,etat,note,auteur_nom,patient:patient_id(nom)").eq("equipement_id", id).order("date", { ascending: false }),
    ]);
    setEq((e ?? null) as unknown as Equip | null);
    setMvts((m ?? []) as unknown as Mvt[]);
    setPret(true);
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  async function mouvement(type_mouvement: string, note?: string) {
    if (!eq) return;
    await createClient().from("equipement_mouvement").insert({
      equipement_id: eq.id, type_mouvement, auteur_id: pro?.id ?? null,
      auteur_nom: [pro?.prenom, pro?.nom].filter(Boolean).join(" ") || null, note: note ?? null,
    });
  }
  async function majStatut(statut: string, extra: Record<string, unknown>, mvt: string) {
    if (!eq) return;
    setBusy(true);
    const { error } = await createClient().from("equipement").update({ statut, updated_at: new Date().toISOString(), ...extra }).eq("id", eq.id);
    if (!error) await mouvement(mvt);
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }

  const mettreEnMaintenance = () => majStatut("en_maintenance", {}, "mise_maintenance");
  const finMaintenance = () => {
    const j = un(eq!.article)?.maintenance_jours ?? 365;
    majStatut("disponible", { derniere_maintenance: todayIso(), prochaine_maintenance: addDaysIso(j) }, "fin_maintenance");
  };
  const reformer = () => { if (confirm("Réformer cet équipement (hors service définitif) ?")) majStatut("hors_service", {}, "reforme"); };

  if (pro && !peutGerer) return <div className="card text-sm text-slate-500">Le parc matériel est géré par le magasinier.</div>;
  if (!pret) return <p className="text-sm text-slate-400">Chargement…</p>;
  if (!eq) return <div className="card text-sm text-slate-500">Équipement introuvable.</div>;

  const st = STATUTS[eq.statut] ?? STATUTS.disponible;
  const retard = !!eq.prochaine_maintenance && eq.prochaine_maintenance < todayIso() && eq.statut !== "hors_service";

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-1 gap-5">
      <Link href="/pro/parc" className="text-sm font-medium text-brand hover:underline">← Parc matériel</Link>

      <div className="card grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{un(eq.article)?.designation ?? "Équipement"}</h1>
            <p className="font-mono text-sm text-slate-500">N° {eq.numero_serie}</p>
          </div>
          <span className={`badge ${st.cls}`}>{st.label}</span>
        </div>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          <Info label="Patient actuel" value={un(eq.patient)?.nom ?? "—"} />
          <Info label="Depuis" value={eq.chez_patient_depuis ? fmt(eq.chez_patient_depuis) : "—"} />
          <Info label="Dernière maintenance" value={fmt(eq.derniere_maintenance)} />
          <Info label="Prochaine maintenance" value={fmt(eq.prochaine_maintenance)} alerte={retard} />
          {eq.etat && <Info label="Dernier état constaté" value={eq.etat} />}
        </div>
        {peutGerer && (
          <div className="flex flex-wrap gap-2 border-t border-rose-50 pt-3">
            {eq.statut === "en_transit" && (
              <>
                <button onClick={() => majStatut("disponible", {}, "retour_agence")} disabled={busy} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Retour OK (remettre en stock)</button>
                <button onClick={() => majStatut("en_maintenance", {}, "retour_agence")} disabled={busy} className="btn-secondary px-3 py-1.5 text-sm">Retour → maintenance</button>
              </>
            )}
            {eq.statut === "en_maintenance" ? (
              <button onClick={finMaintenance} disabled={busy} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Maintenance terminée</button>
            ) : eq.statut === "disponible" ? (
              <button onClick={mettreEnMaintenance} disabled={busy} className="btn-secondary px-3 py-1.5 text-sm">Mettre en maintenance</button>
            ) : null}
            {eq.statut !== "hors_service" && (
              <button onClick={reformer} disabled={busy} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-critique hover:bg-red-50">Réformer</button>
            )}
          </div>
        )}
      </div>

      <section className="grid grid-cols-1 gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Historique</h2>
        {mvts.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun mouvement.</p>
        ) : (
          <ol className="grid grid-cols-1 gap-2">
            {mvts.map((m) => (
              <li key={m.id} className="card flex items-start gap-3 py-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">{MVT[m.type_mouvement] ?? m.type_mouvement}{un(m.patient) ? ` · ${un(m.patient)?.nom}` : ""}</p>
                  <p className="text-xs text-slate-400">{fmtDt(m.date)}{m.auteur_nom ? ` · ${m.auteur_nom}` : ""}{m.etat ? ` · état : ${m.etat}` : ""}{m.note ? ` · ${m.note}` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Info({ label, value, alerte }: { label: string; value: string; alerte?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-slate-400">{label} :</span>
      <span className={`font-medium ${alerte ? "text-critique" : "text-slate-700"}`}>{value}{alerte ? " ⚠️" : ""}</span>
    </div>
  );
}
