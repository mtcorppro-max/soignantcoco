import { requirePro } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NouveauPatientForm } from "@/components/NouveauPatientForm";

export default async function NouveauPatient() {
  const pro = await requirePro();
  if (pro.role !== "coordinatrice") redirect("/pro");

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
