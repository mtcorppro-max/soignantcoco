"use client";

import { usePatientSession } from "@/lib/hooks/useSession";
import { SaisieMesure } from "@/components/SaisieMesure";

export default function PageMesure() {
  const patient = usePatientSession();

  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-bold text-slate-800">Saisir une mesure</h1>
      {patient ? (
        <SaisieMesure patientId={patient.id} />
      ) : (
        <div className="animate-pulse grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-rose-100" />
          ))}
        </div>
      )}
    </div>
  );
}
