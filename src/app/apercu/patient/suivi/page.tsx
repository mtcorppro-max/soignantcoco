import { CadrePatient } from "@/components/apercu/CadrePatient";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { MesureChart } from "@/components/MesureChart";
import { mockMesures, mockSeuils } from "@/lib/mock";

export default function ApercuPatientSuivi() {
  return (
    <CadrePatient active="Suivi">
      <div className="grid gap-5">
        <h1 className="text-xl font-bold text-slate-800">Mon suivi</h1>
        <p className="-mt-3 text-sm text-slate-500">
          La <span className="font-semibold text-critique">ligne rouge</span> est
          le seuil fixé par votre équipe médicale.
        </p>
        {TYPES_MESURE.map((type) => {
          const liste = mockMesures.filter((m) => m.type === type);
          const seuil = mockSeuils[type];
          return (
            <section key={type} className="card">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">
                {MESURES[type].label}
              </h2>
              <MesureChart
                type={type}
                mesures={liste}
                seuilMin={seuil?.valeur_min ?? null}
                seuilMax={seuil?.valeur_max ?? null}
              />
            </section>
          );
        })}
      </div>
    </CadrePatient>
  );
}
