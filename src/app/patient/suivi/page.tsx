"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { MesureChart } from "@/components/MesureChart";
import { MesureTable } from "@/components/MesureTable";
import type { Mesure, Seuil } from "@/lib/types";

export default function PageSuivi() {
  const patient = usePatientSession();
  const [mesures, setMesures] = useState<Mesure[]>([]);
  const [seuils, setSeuils] = useState<Map<string, Seuil>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!patient) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from("mesure")
        .select("id,patient_id,type,valeur,horodatage")
        .eq("patient_id", patient.id)
        .order("horodatage", { ascending: false })
        .limit(150),
      supabase
        .from("seuil")
        .select("id,patient_id,type_mesure,valeur_min,valeur_max,actif")
        .eq("patient_id", patient.id)
        .eq("actif", true),
    ]).then(([{ data: m }, { data: s }]) => {
      setMesures((m ?? []) as Mesure[]);
      const map = new Map<string, Seuil>();
      (s ?? []).forEach((s) => map.set(s.type_mesure, s as Seuil));
      setSeuils(map);
      setReady(true);
    });
  }, [patient?.id]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mon suivi</h1>
        <p className="mt-1 text-sm text-slate-500">
          La <span className="font-semibold text-critique">ligne rouge</span> est le seuil fixé par votre équipe médicale.
        </p>
      </div>

      {!ready ? (
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
          const seuil = seuils.get(type);
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
