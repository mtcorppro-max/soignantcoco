"use client";

import { useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { useData } from "@/lib/hooks/useData";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { conseilDuJour } from "@/lib/conseils";
import { AvatarGuide } from "@/components/AvatarGuide";
import { RappelDocuments } from "@/components/RappelDocuments";
import { RappelBilanPatient } from "@/components/RappelBilanPatient";
import { CalendrierSuivi } from "@/components/CalendrierSuivi";
import type { Mesure } from "@/lib/types";

type AccueilData = { dernieres: Map<string, Mesure>; aujourdhui: number };

async function fetchAccueil(patientId: string): Promise<AccueilData> {
  const supabase = createClient();
  const { data } = await supabase
    .from("mesure")
    .select("id,patient_id,type,valeur,horodatage")
    .eq("patient_id", patientId)
    .order("horodatage", { ascending: false })
    .limit(50);
  const dernieres = new Map<string, Mesure>();
  let aujourdhui = 0;
  const today = new Date().toDateString();
  (data ?? []).forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, m as Mesure);
    if (new Date(m.horodatage).toDateString() === today) aujourdhui++;
  });
  return { dernieres, aujourdhui };
}

export default function PatientAccueil() {
  const patient = usePatientSession();
  const data = useData<AccueilData>(
    `patient:accueil:${patient?.id ?? ""}`,
    () => fetchAccueil(patient!.id),
    [patient?.id],
    !!patient,
  );
  const duJour = useMemo(() => conseilDuJour(), []);

  const { dernieres, aujourdhui } = useMemo(() => (
    data ?? { dernieres: new Map<string, Mesure>(), aujourdhui: 0 }
  ), [data]);

  if (!patient) return <Skeleton />;

  return (
    <div className="grid gap-5">
      <div className="grid gap-5">
        <RappelBilanPatient />
        <RappelDocuments />
        {/* Avatar-guide : bonjour + conseil du jour dans la bulle */}
        <AvatarGuide
          dateNaissance={patient.date_naissance}
          sexe={patient.sexe}
          taille={72}
          bulle={
            <div className="grid gap-1.5">
              <p className="text-lg font-bold text-slate-800">Bonjour {patient.nom.split(" ")[0]} !</p>
              <p className="text-sm text-slate-500">
                {aujourdhui > 0 ? `${aujourdhui} mesure(s) saisie(s) aujourd'hui.` : "Pensez à relever vos constantes du jour."}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-brand">Conseil du jour — {duJour.titre} : </span>
                {duJour.contenu}
              </p>
              <Link href="/patient/conseils" className="text-xs font-medium text-brand hover:underline">
                Tous les conseils →
              </Link>
            </div>
          }
        />

        <CalendrierSuivi patientId={patient.id} />

        <Link href="/patient/mesure" className="btn-primary py-4 text-center text-base">
          ＋ Saisir une mesure
        </Link>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Mes dernières valeurs</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {TYPES_MESURE.map((type) => {
              const m = dernieres.get(type);
              const meta = MESURES[type];
              return (
                <div key={type} className="card p-4">
                  <p className="text-xs text-slate-400">{meta.label}</p>
                  <p className="mt-1 text-2xl font-bold text-brand">
                    {m ? Number(m.valeur) : "—"}
                    <span className="ml-1 text-sm font-normal text-slate-400">{meta.unite}</span>
                  </p>
                  {m && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {new Date(m.horodatage).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-5 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-rose-100" />
      <div className="h-14 rounded-2xl bg-rose-200" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white shadow-sm" />)}
      </div>
    </div>
  );
}
