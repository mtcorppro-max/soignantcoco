"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Infos = {
  date_operation: string | null;
  duree_prise_en_charge: number | null;
  jours_suivi: number[] | null;
  operation: string | null;
};

type Etape = {
  jour: number;
  label: string;
  date: Date;
  type: "operation" | "suivi" | "fin";
  statut: "passe" | "aujourdhui" | "avenir";
};

function ajoute(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "long" });
}

export function CalendrierSuivi({ patientId }: { patientId: string }) {
  const [infos, setInfos] = useState<Infos | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    createClient()
      .from("patient")
      .select("date_operation,duree_prise_en_charge,jours_suivi,operation")
      .eq("id", patientId)
      .maybeSingle()
      .then(({ data }) => {
        setInfos((data ?? null) as Infos | null);
        setPret(true);
      });
  }, [patientId]);

  if (!pret) return null;
  if (!infos?.date_operation) {
    return (
      <section className="card">
        <h2 className="mb-1 text-sm font-semibold text-slate-600">Mon calendrier de prise en charge</h2>
        <p className="text-sm text-slate-400">
          Votre calendrier apparaîtra dès que la date d&apos;opération sera renseignée par votre équipe soignante.
        </p>
      </section>
    );
  }

  const base = new Date(infos.date_operation);
  base.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const statutDe = (d: Date): Etape["statut"] =>
    d.getTime() < today.getTime() ? "passe" : d.getTime() === today.getTime() ? "aujourdhui" : "avenir";

  const etapes: Etape[] = [];
  etapes.push({ jour: 0, label: "Opération", date: base, type: "operation", statut: statutDe(base) });

  (infos.jours_suivi ?? []).forEach((j) => {
    const d = ajoute(base, j);
    etapes.push({ jour: j, label: `Suivi J${j}`, date: d, type: "suivi", statut: statutDe(d) });
  });

  if (infos.duree_prise_en_charge) {
    const d = ajoute(base, infos.duree_prise_en_charge);
    etapes.push({ jour: infos.duree_prise_en_charge, label: "Fin de prise en charge", date: d, type: "fin", statut: statutDe(d) });
  }

  etapes.sort((a, b) => a.jour - b.jour);

  // Prochaine étape à venir / aujourd'hui
  const prochaine = etapes.find((e) => e.statut !== "passe");
  const finEtape = etapes.find((e) => e.type === "fin");
  const joursRestants = finEtape
    ? Math.max(0, Math.round((finEtape.date.getTime() - today.getTime()) / 86_400_000))
    : null;

  return (
    <section className="card grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-600">Mon calendrier de prise en charge</h2>
        {joursRestants != null && finEtape && finEtape.statut !== "passe" && (
          <span className="badge bg-rose-100 text-brand">
            {joursRestants === 0 ? "Dernier jour" : `${joursRestants} jour(s) restant(s)`}
          </span>
        )}
      </div>

      {infos.operation && (
        <p className="-mt-2 text-xs text-slate-400">{infos.operation}</p>
      )}

      <ol className="relative grid gap-4 pl-6">
        {/* trait vertical */}
        <span className="absolute left-[7px] top-1 bottom-1 w-px bg-rose-100" aria-hidden />
        {etapes.map((e, i) => {
          const couleur =
            e.statut === "aujourdhui"
              ? "bg-brand ring-4 ring-rose-100"
              : e.statut === "passe"
                ? "bg-rose-300"
                : "bg-white border-2 border-rose-300";
          return (
            <li key={i} className="relative">
              <span className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full ${couleur}`} aria-hidden />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={`text-sm font-semibold ${e.type === "fin" ? "text-brand" : "text-slate-700"}`}>
                  {e.label}
                </p>
                {e.statut === "aujourdhui" && <span className="badge bg-brand text-white">Aujourd&apos;hui</span>}
                {e.statut === "passe" && e.type === "suivi" && <span className="text-xs text-slate-400">passé</span>}
                {prochaine === e && e.statut === "avenir" && <span className="badge bg-amber-100 text-attention">Prochain</span>}
              </div>
              <p className="text-xs capitalize text-slate-400">{fmt(e.date)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
