"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Rappel = {
  patientId: string;
  nom: string;
  type: "J1" | "dernier";
  dateIso: string; // YYYY-MM-DD de l'échéance
  retard: boolean; // échéance passée (avant aujourd'hui)
};

// "YYYY-MM-DD" (heure locale) du jour
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ajoute n jours à une date "YYYY-MM-DD" → "YYYY-MM-DD"
function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// timestamptz → "YYYY-MM-DD" local
function jourLocal(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtFr(iso: string): string {
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

// Rappels de suivi à réaliser (J1 et dernier jour de prise en charge).
// Le rappel disparaît dès qu'un suivi est enregistré le jour de l'échéance.
export function RappelsSuivi() {
  const [rappels, setRappels] = useState<Rappel[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: pts } = await supabase
        .from("patient")
        .select("id,nom,date_operation,duree_prise_en_charge,statut");
      const patients = (pts ?? []).filter(
        (p) => p.date_operation && p.statut !== "terminee"
      ) as { id: string; nom: string; date_operation: string; duree_prise_en_charge: number | null }[];
      if (patients.length === 0) {
        setRappels([]);
        return;
      }

      const today = todayIso();
      // Échéances dont la date est arrivée (aujourd'hui ou passée)
      const echeances: Rappel[] = [];
      patients.forEach((p) => {
        const j1 = addDays(p.date_operation, 1);
        if (j1 && j1 <= today) echeances.push({ patientId: p.id, nom: p.nom, type: "J1", dateIso: j1, retard: j1 < today });
        if (p.duree_prise_en_charge) {
          const dernier = addDays(p.date_operation, p.duree_prise_en_charge);
          if (dernier && dernier <= today)
            echeances.push({ patientId: p.id, nom: p.nom, type: "dernier", dateIso: dernier, retard: dernier < today });
        }
      });
      if (echeances.length === 0) {
        setRappels([]);
        return;
      }

      // Suivis existants pour savoir lesquels sont déjà faits le jour de l'échéance
      const ids = [...new Set(echeances.map((e) => e.patientId))];
      const { data: sv } = await supabase
        .from("suivi")
        .select("patient_id,created_at")
        .in("patient_id", ids);
      const faits = new Set((sv ?? []).map((s) => `${s.patient_id}|${jourLocal(s.created_at)}`));

      const restants = echeances
        .filter((e) => !faits.has(`${e.patientId}|${e.dateIso}`))
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      setRappels(restants);
    })();
  }, []);

  if (rappels.length === 0) return null;

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <p className="mb-2 text-sm font-bold text-rose-800">
        Suivis à réaliser ({rappels.length})
      </p>
      <div className="grid gap-2">
        {rappels.map((r) => (
          <Link
            key={`${r.patientId}-${r.type}`}
            href={`/pro/patients/${r.patientId}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-sm transition hover:shadow-sm"
          >
            <span className="min-w-0 truncate font-semibold text-slate-700">{r.nom}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="badge bg-rose-100 text-brand">
                {r.type === "J1" ? "Suivi J1" : "Suivi dernier jour"}
              </span>
              {r.retard ? (
                <span className="badge bg-critique text-white">En retard · {fmtFr(r.dateIso)}</span>
              ) : (
                <span className="badge bg-rose-800 text-white">Aujourd&apos;hui</span>
              )}
              <span className="text-brand">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
