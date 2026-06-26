"use client";

import { useEffect, useMemo, useState } from "react";
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
};

type Suivi = {
  patientId: string;
  patientNom: string;
  jour: number;
  date: Date;
  chirurgien: string | null;
  responsables: string[];
};

const nomPro = (p: { titre: string | null; prenom: string | null; nom: string }) =>
  [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");

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
  const [responsablesParPatient, setResponsablesParPatient] = useState<Map<string, string[]>>(new Map());
  const [pret, setPret] = useState(false);
  const [filtreChir, setFiltreChir] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("patient")
      .select("id,nom,statut,date_operation,jours_suivi,chirurgien")
      .then(({ data }) => {
        setPatients((data ?? []) as PatientLite[]);
        setPret(true);
      });
    // Soignants rattachés (qui réalisent le suivi) : coordinatrices & infirmières.
    supabase
      .from("patient_soignant")
      .select("patient_id, professionnel:professionnel_id(titre,prenom,nom,role)")
      .then(({ data }) => {
        type Pro = { titre: string | null; prenom: string | null; nom: string; role: string };
        const m = new Map<string, string[]>();
        ((data ?? []) as unknown as { patient_id: string; professionnel: Pro | Pro[] | null }[]).forEach((l) => {
          const p = Array.isArray(l.professionnel) ? l.professionnel[0] : l.professionnel;
          if (!p || p.role === "chirurgien") return;
          if (!m.has(l.patient_id)) m.set(l.patient_id, []);
          m.get(l.patient_id)!.push(nomPro(p));
        });
        setResponsablesParPatient(m);
      });
  }, []);

  const today = useMemo(() => minuit(new Date()), []);

  const chirurgiens = useMemo(
    () => [...new Set(patients.map((p) => p.chirurgien).filter(Boolean) as string[])].sort(),
    [patients]
  );

  // Tous les suivis programmés (futurs + aujourd'hui + retards récents).
  const groupes = useMemo(() => {
    const suivis: Suivi[] = [];
    patients.forEach((p) => {
      if (!p.date_operation || p.statut === "terminee") return;
      if (filtreChir && p.chirurgien !== filtreChir) return;
      const base = new Date(p.date_operation);
      if (isNaN(base.getTime())) return;
      (p.jours_suivi ?? []).forEach((j) => {
        suivis.push({
          patientId: p.id,
          patientNom: p.nom,
          jour: j,
          date: ajoute(base, j),
          chirurgien: p.chirurgien,
          responsables: responsablesParPatient.get(p.id) ?? [],
        });
      });
    });
    // On garde aujourd'hui + futur + retards des 7 derniers jours
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
  }, [patients, filtreChir, today, responsablesParPatient]);

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
        <p className="card text-sm text-slate-400">Aucun suivi programmé à venir.</p>
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
                  {enRetard && <span className="badge bg-amber-100 text-attention">En retard</span>}
                  <span className="text-xs text-slate-400">{g.items.length} suivi(s)</span>
                </div>
                <div className="grid gap-2">
                  {g.items.map((s, i) => (
                    <Link
                      key={i}
                      href={`/pro/patients/${s.patientId}`}
                      className="card flex items-center justify-between gap-3 py-3 transition hover:border-rose-200 hover:shadow-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{s.patientNom}</p>
                        {s.chirurgien && <p className="text-xs text-slate-400">{s.chirurgien}</p>}
                        <p className="mt-0.5 text-xs">
                          <span className="text-slate-400">À réaliser par : </span>
                          <span className="font-medium text-slate-600">
                            {s.responsables.length ? s.responsables.join(", ") : "Non attribué"}
                          </span>
                        </p>
                      </div>
                      <span className="badge bg-rose-100 text-brand">Suivi J{s.jour}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
