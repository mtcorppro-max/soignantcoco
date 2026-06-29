"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Eq = { id: string; numero_serie: string; chez_patient_depuis: string | null; article: { designation: string } | { designation: string }[] | null };
const nomType = (v: Eq["article"]) => (Array.isArray(v) ? v[0]?.designation : v?.designation) ?? "Équipement";

// Matériel de location actuellement chez le patient (lecture). Rien ne s'affiche
// si le compte n'a pas le droit de voir le parc (RLS) ou si aucun matériel.
export function EquipementsPatient({ patientId }: { patientId: string }) {
  const [eqs, setEqs] = useState<Eq[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    createClient()
      .from("equipement")
      .select("id,numero_serie,chez_patient_depuis,article:article_code(designation)")
      .eq("patient_actuel_id", patientId)
      .eq("statut", "chez_patient")
      .then(({ data }) => { setEqs((data ?? []) as unknown as Eq[]); setPret(true); });
  }, [patientId]);

  if (!pret || eqs.length === 0) return null;

  return (
    <section className="card grid gap-2">
      <h2 className="text-sm font-semibold text-slate-600">Matériel loué en cours</h2>
      <div className="grid grid-cols-1 gap-1.5">
        {eqs.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-100 px-3 py-1.5 text-sm">
            <span className="text-slate-700">{nomType(e.article)} · <span className="font-mono text-slate-500">{e.numero_serie}</span></span>
            {e.chez_patient_depuis && <span className="text-xs text-slate-400">depuis le {new Date(e.chez_patient_depuis).toLocaleDateString("fr-FR")}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
