"use client";

import { NouveauPatientForm } from "@/components/NouveauPatientForm";

export default function NouveauPatient() {
  return (
    <div className="mx-auto grid max-w-lg gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Nouveau patient</h1>
        <p className="mt-1 text-sm text-slate-500">
          Un code unique sera généré : remettez-le au patient pour sa connexion.
        </p>
      </div>
      <NouveauPatientForm />
    </div>
  );
}
