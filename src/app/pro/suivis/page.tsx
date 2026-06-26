"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { estCoordOuManager } from "@/lib/roles";

type PatientLite = {
  id: string;
  nom: string;
  statut: string;
  date_operation: string | null;
  jours_suivi: number[] | null;
  chirurgien: string | null;
  alerte_1_nom: string | null;
};

type Suivi = {
  patientId: string;
  patientNom: string;
  jour: number;
  date: Date;
  echeance: string; // YYYY-MM-DD
  chirurgien: string | null;
  responsable: string | null;
};

function minuit(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function ajoute(base: Date, n: number): Date {
  const d = minuit(base);
  d.setDate(d.getDate() + n);
  return d;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function cle(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function libelleJour(d: Date, today: Date): string {
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
}

export default function SuivisPage() {
  const pro = useProSession();
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [faits, setFaits] = useState<Set<string>>(new Set()); // `${patientId}|${echeance}`
  const [pret, setPret] = useState(false);
  const [filtreChir, setFiltreChir] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pts }, { data: rps }, { data: svs }] = await Promise.all([
      supabase.from("patient").select("id,nom,statut,date_operation,jours_suivi,chirurgien,alerte_1_nom"),
      supabase.from("rappel_suivi_valide").select("patient_id,echeance"),
      supabase.from("suivi").select("patient_id,created_at"),
    ]);
    const set = new Set<string>();
    (rps ?? []).forEach((r) => set.add(`${r.patient_id}|${r.echeance}`));
    (svs ?? []).forEach((s) => set.add(`${s.patient_id}|${iso(new Date(s.created_at))}`));
    setFaits(set);
    setPatients((pts ?? []) as PatientLite[]);
    setPret(true);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const today = useMemo(() => minuit(new Date()), []);
  const monNom = pro ? [pro.titre, pro.prenom, pro.nom].filter(Boolean).join(" ") : "";

  const chirurgiens = useMemo(
    () => [...new Set(patients.map((p) => p.chirurgien).filter(Boolean) as string[])].sort(),
    [patients]
  );

  // Suivis programmés (aujourd'hui + futur + retards 7j), hors suivis déjà faits.
  const groupes = useMemo(() => {
    const suivis: Suivi[] = [];
    patients.forEach((p) => {
      if (!p.date_operation || p.statut === "terminee") return;
      if (filtreChir && p.chirurgien !== filtreChir) return;
      const base = new Date(p.date_operation);
      if (isNaN(base.getTime())) return;
      (p.jours_suivi ?? []).forEach((j) => {
        const date = ajoute(base, j);
        const echeance = iso(date);
        if (faits.has(`${p.id}|${echeance}`)) return;
        suivis.push({ patientId: p.id, patientNom: p.nom, jour: j, date, echeance, chirurgien: p.chirurgien, responsable: p.alerte_1_nom });
      });
    });
    const limiteBasse = ajoute(today, -7);
    const visibles = suivis.filter((s) => s.date.getTime() >= limiteBasse.getTime());
    visibles.sort((a, b) => a.date.getTime() - b.date.getTime() || a.patientNom.localeCompare(b.patientNom));

    const map = new Map<string, { date: Date; items: Suivi[] }>();
    visibles.forEach((s) => {
      const k = cle(s.date);
      if (!map.has(k)) map.set(k, { date: s.date, items: [] });
      map.get(k)!.items.push(s);
    });
    return [...map.values()];
  }, [patients, filtreChir, today, faits]);

  async function valider(s: Suivi) {
    setBusy(`${s.patientId}|${s.echeance}`);
    await createClient().from("rappel_suivi_valide").insert({
      patient_id: s.patientId, type: `J${s.jour}`, echeance: s.echeance, validee_par: pro?.nom ?? null,
    });
    setBusy(null);
    setFaits((prev) => new Set(prev).add(`${s.patientId}|${s.echeance}`));
  }

  async function supprimer(s: Suivi) {
    if (!confirm(`Supprimer le suivi J${s.jour} de ${s.patientNom} ? Il ne sera plus programmé.`)) return;
    setBusy(`${s.patientId}|${s.echeance}`);
    const p = patients.find((x) => x.id === s.patientId);
    const nouveau = (p?.jours_suivi ?? []).filter((j) => j !== s.jour);
    const { error } = await createClient().from("patient").update({ jours_suivi: nouveau }).eq("id", s.patientId);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    setPatients((arr) => arr.map((x) => (x.id === s.patientId ? { ...x, jours_suivi: nouveau } : x)));
  }

  if (pro && !estCoordOuManager(pro.role) && pro.niveau !== 0) {
    return (
      <div className="card text-sm text-slate-500">
        Le calendrier des suivis est réservé aux infirmières coordinatrices.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Suivis à réaliser</h1>
        {chirurgiens.length > 0 && (
          <div className="w-64">
            <Select
              value={filtreChir}
              onChange={setFiltreChir}
              placeholder="Tous les médecins"
              options={[{ value: "", label: "Tous les médecins" }, ...chirurgiens.map((c) => ({ value: c, label: c }))]}
            />
          </div>
        )}
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="card text-sm text-slate-400">Aucun suivi à réaliser. 🌿</p>
      ) : (
        <div className="grid gap-5">
          {groupes.map((g) => {
            const estAujourdhui = cle(g.date) === cle(today);
            const enRetard = g.date.getTime() < today.getTime();
            return (
              <section key={cle(g.date)} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-bold capitalize ${estAujourdhui ? "text-brand" : "text-slate-600"}`}>
                    {libelleJour(g.date, today)}
                  </h2>
                  {estAujourdhui && <span className="badge bg-brand text-white">Aujourd&apos;hui</span>}
                  {enRetard && <span className="rounded-full border border-rose-800 px-2 py-0.5 text-[11px] font-semibold text-rose-800">En retard</span>}
                  <span className="text-xs text-slate-400">{g.items.length} suivi(s)</span>
                </div>
                <div className="grid gap-2">
                  {g.items.map((s) => {
                    const occupe = busy === `${s.patientId}|${s.echeance}`;
                    // Actions possibles uniquement si le suivi est échu (retard) ou du jour,
                    // et seulement par la coordinatrice en alerte 1 ou la manager.
                    const echu = s.date.getTime() <= today.getTime();
                    const peutAgir = pro?.role === "manager" || pro?.niveau === 0 || (!!s.responsable && s.responsable === monNom);
                    return (
                      <div key={`${s.patientId}|${s.echeance}`} className="card flex flex-wrap items-center justify-between gap-3 py-3">
                        <Link href={`/pro/patients/${s.patientId}`} className="min-w-0 flex-1 transition hover:opacity-80">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800">{s.patientNom}</p>
                            <span className="badge bg-rose-100 text-brand">Suivi J{s.jour}</span>
                          </div>
                          {s.chirurgien && <p className="text-xs text-slate-400">{s.chirurgien}</p>}
                          <p className="mt-0.5 text-xs">
                            <span className="text-slate-400">À réaliser par : </span>
                            <span className="font-medium text-slate-600">{s.responsable || "Non attribué"}</span>
                          </p>
                        </Link>
                        {echu && peutAgir && (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => valider(s)}
                              disabled={occupe}
                              className="rounded-lg bg-rose-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                            >
                              ✓ Valider
                            </button>
                            <button
                              onClick={() => supprimer(s)}
                              disabled={occupe}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-critique transition hover:bg-red-50 disabled:opacity-50"
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
