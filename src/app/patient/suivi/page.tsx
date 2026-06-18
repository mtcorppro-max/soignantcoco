"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { useData } from "@/lib/hooks/useData";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { MesureChart } from "@/components/MesureChart";
import { MesureTable } from "@/components/MesureTable";
import type { Mesure, Seuil } from "@/lib/types";

type SuiviData = { mesures: Mesure[]; seuilParType: Map<string, Seuil> };

async function fetchSuivi(patientId: string): Promise<SuiviData> {
  const supabase = createClient();
  const [{ data: m }, { data: s }] = await Promise.all([
    supabase
      .from("mesure")
      .select("id,patient_id,type,valeur,horodatage")
      .eq("patient_id", patientId)
      .order("horodatage", { ascending: false })
      .limit(150),
    supabase
      .from("seuil")
      .select("id,patient_id,type_mesure,valeur_min,valeur_max,actif")
      .eq("patient_id", patientId)
      .eq("actif", true),
  ]);
  const seuilParType = new Map<string, Seuil>();
  (s ?? []).forEach((s) => seuilParType.set(s.type_mesure, s as Seuil));
  return { mesures: (m ?? []) as Mesure[], seuilParType };
}

export default function PageSuivi() {
  const patient = usePatientSession();
  const data = useData<SuiviData>(
    `patient:suivi:${patient?.id ?? ""}`,
    () => fetchSuivi(patient!.id),
    [patient?.id],
    !!patient,
  );

  const { mesures, seuilParType } = useMemo(() => (
    data ?? { mesures: [], seuilParType: new Map<string, Seuil>() }
  ), [data]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mon suivi</h1>
        <p className="mt-1 text-sm text-slate-500">
          La <span className="font-semibold text-critique">ligne rouge</span> est le seuil fixé par votre équipe médicale.
        </p>
      </div>

      {!data ? (
        <div className="grid gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-rose-100 bg-white p-5">
              <div className="mb-3 h-5 w-32 rounded bg-rose-100" />
              <div className="h-48 rounded-xl bg-rose-50" />
            </div>
          ))}
        </div>
      ) : (
        TYPES_MESURE.map((type) => {
          const liste = mesures.filter((m) => m.type === type);
          const seuil = seuilParType.get(type);
          return (
            <section key={type} className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{MESURES[type].label}</h2>
              <MesureChart type={type} mesures={liste} seuilMin={seuil?.valeur_min ?? null} seuilMax={seuil?.valeur_max ?? null} />
              <MesureTable type={type} mesures={liste} seuilMin={seuil?.valeur_min ?? null} seuilMax={seuil?.valeur_max ?? null} />
            </section>
          );
        })
      )}
    </div>
  );
}
