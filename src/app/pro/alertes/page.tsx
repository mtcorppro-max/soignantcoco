import { requirePro } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AlerteCard, type AlerteEnrichie } from "@/components/AlerteCard";

export default async function CentreAlertes() {
  const pro = await requirePro();
  const supabase = createClient();

  const { data } = await supabase
    .from("alerte")
    .select(
      "*, patient:patient_id(id, nom), mesure:mesure_id(type, valeur, horodatage)"
    )
    .in("statut", ["declenchee", "acquittee", "escaladee"])
    .order("declenchee_le", { ascending: false });

  const alertes = (data ?? []) as unknown as AlerteEnrichie[];
  const peutTraiter = pro.role === "coordinatrice";

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Centre d&apos;alertes</h1>
        <p className="mt-1 text-sm text-slate-500">
          L&apos;escalade vers l&apos;hôpital est <strong>toujours une décision
          humaine</strong> : prévenez par téléphone, puis tracez-le ici.
        </p>
      </div>

      {!peutTraiter && (
        <p className="rounded-xl bg-rose-800 px-4 py-3 text-sm font-medium text-white">
          Accès en lecture seule — seule la coordinatrice peut acquitter ou
          escalader.
        </p>
      )}

      {alertes.length === 0 ? (
        <div className="card text-center text-slate-400">
          Aucune alerte en cours. 🌿
        </div>
      ) : (
        <div className="grid gap-3">
          {alertes.map((a) => (
            <AlerteCard
              key={a.id}
              alerte={a}
              peutTraiter={peutTraiter}
              proId={pro.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
