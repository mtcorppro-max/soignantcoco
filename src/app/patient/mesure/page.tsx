import { requirePatient } from "@/lib/auth";
import { SaisieMesure } from "@/components/SaisieMesure";

export default async function PageMesure() {
  const patient = await requirePatient();
  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-bold text-slate-800">Saisir une mesure</h1>
      <SaisieMesure patientId={patient.id} />
    </div>
  );
}
