import Link from "next/link";
import { CadrePatient } from "@/components/apercu/CadrePatient";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { mockMesures } from "@/lib/mock";
import type { Mesure } from "@/lib/types";

export default function ApercuPatientAccueil() {
  const dernieres = new Map<string, Mesure>();
  mockMesures.forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, m);
  });

  return (
    <CadrePatient active="Accueil">
      <div className="grid gap-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bonjour Monsieur 👋</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pensez à relever vos constantes du jour.
          </p>
        </div>

        <span className="btn-primary py-4 text-base">➕ Saisir une mesure</span>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">
            Mes dernières valeurs
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {TYPES_MESURE.map((type) => {
              const m = dernieres.get(type);
              const meta = MESURES[type];
              return (
                <div key={type} className="card p-4">
                  <p className="text-xs text-slate-400">{meta.label}</p>
                  <p className="mt-1 text-2xl font-bold text-brand">
                    {m ? Number(m.valeur) : "—"}
                    <span className="ml-1 text-sm font-normal text-slate-400">
                      {meta.unite}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <Link
          href="/apercu/patient/suivi"
          className="text-center text-sm font-medium text-brand hover:underline"
        >
          Voir mes graphiques de suivi →
        </Link>
      </div>
    </CadrePatient>
  );
}
