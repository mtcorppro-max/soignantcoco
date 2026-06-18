import { requirePatient } from "@/lib/auth";
import { ConseilCard } from "@/components/ConseilCard";
import { conseilDuJour, conseilMeteo, tousLesConseils } from "@/lib/conseils";

export const dynamic = "force-dynamic";

export default async function PageConseils() {
  const patient = await requirePatient();
  const [meteo] = await Promise.all([conseilMeteo(patient.code_postal)]);
  const duJour = conseilDuJour();
  const autres = tousLesConseils().filter((c) => c.titre !== duJour.titre);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mes conseils</h1>
        <p className="mt-1 text-sm text-slate-500">
          Petits conseils du quotidien pour votre rétablissement.
        </p>
      </div>

      {meteo && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold text-slate-600">Aujourd'hui</h2>
          <ConseilCard conseil={meteo} highlight />
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-slate-600">Conseil du jour</h2>
        <ConseilCard conseil={duJour} />
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-slate-600">À garder en tête</h2>
        <div className="grid gap-3">
          {autres.map((c) => (
            <ConseilCard key={c.titre} conseil={c} />
          ))}
        </div>
      </section>

      <p className="text-center text-[11px] text-slate-400">
        Ces conseils ne remplacent pas l'avis de votre équipe médicale.
      </p>
    </div>
  );
}
