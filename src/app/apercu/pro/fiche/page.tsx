import Link from "next/link";
import { CadrePro } from "@/components/apercu/CadrePro";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { SeuilEditor } from "@/components/SeuilEditor";
import { mockMesures, mockSeuils } from "@/lib/mock";
import type { Mesure } from "@/lib/types";

export default function ApercuProFiche() {
  const dernieres = new Map<string, Mesure>();
  mockMesures.forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, m);
  });

  return (
    <CadrePro active="Tableau de bord">
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/apercu/pro" className="text-sm text-slate-400 hover:text-brand">
              ← Tableau de bord
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-slate-800">Monsieur Démo</h1>
            <p className="text-sm text-slate-500">
              Code patient : <span className="font-mono font-semibold">DEMO1234</span> · 49000
            </p>
          </div>
          <span className="badge bg-critique text-white">1 alerte(s) active(s)</span>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">Dernières valeurs</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {TYPES_MESURE.map((type) => {
              const m = dernieres.get(type);
              const meta = MESURES[type];
              return (
                <div key={type} className="card p-3 text-center">
                  <p className="text-[11px] text-slate-400">{meta.court}</p>
                  <p className="mt-1 text-xl font-bold text-brand">
                    {m ? Number(m.valeur) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {TYPES_MESURE.map((type) => (
            <SeuilEditor
              key={type}
              type={type}
              patientId="apercu"
              mesures={mockMesures.filter((m) => m.type === type)}
              seuil={mockSeuils[type] ?? null}
              modifiable
            />
          ))}
        </section>
      </div>
    </CadrePro>
  );
}
