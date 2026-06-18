import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { MesureChart } from "@/components/MesureChart";
import { MesureTable } from "@/components/MesureTable";
import type { Mesure, Seuil } from "@/lib/types";

export default async function PageSuivi() {
  const patient = await requirePatient();
  const supabase = createClient();

  const [{ data: mesures }, { data: seuils }] = await Promise.all([
    supabase
      .from("mesure")
      .select("*")
      .eq("patient_id", patient.id)
      .order("horodatage", { ascending: false })
      .limit(300),
    supabase.from("seuil").select("*").eq("patient_id", patient.id).eq("actif", true),
  ]);

  const seuilParType = new Map<string, Seuil>();
  (seuils ?? []).forEach((s) => seuilParType.set(s.type_mesure, s as Seuil));

  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-bold text-slate-800">Mon suivi</h1>
      <p className="-mt-3 text-sm text-slate-500">
        La <span className="font-semibold text-critique">ligne rouge</span> est
        le seuil fixé par votre équipe médicale.
      </p>

      {TYPES_MESURE.map((type) => {
        const liste = (mesures ?? []).filter((m) => m.type === type) as Mesure[];
        const seuil = seuilParType.get(type);
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
            <MesureTable
              type={type}
              mesures={liste}
              seuilMin={seuil?.valeur_min ?? null}
              seuilMax={seuil?.valeur_max ?? null}
            />
          </section>
        );
      })}
    </div>
  );
}
