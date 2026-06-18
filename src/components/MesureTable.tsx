import { MESURES } from "@/lib/constants";
import type { Mesure, TypeMesure } from "@/lib/types";

// Tableau simplifié des dernières mesures d'un type, avec repère hors-seuil.
export function MesureTable({
  type,
  mesures,
  seuilMin,
  seuilMax,
  limite = 6,
}: {
  type: TypeMesure;
  mesures: Mesure[];
  seuilMin?: number | null;
  seuilMax?: number | null;
  limite?: number;
}) {
  const meta = MESURES[type];
  const lignes = [...mesures]
    .sort(
      (a, b) =>
        new Date(b.horodatage).getTime() - new Date(a.horodatage).getTime()
    )
    .slice(0, limite);

  if (lignes.length === 0) return null;

  const horsSeuil = (v: number) =>
    (seuilMin != null && v < seuilMin) || (seuilMax != null && v > seuilMax);

  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-400">
          <th className="pb-1 font-medium">Date</th>
          <th className="pb-1 text-right font-medium">Valeur</th>
          <th className="pb-1 text-right font-medium">État</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((m) => {
          const v = Number(m.valeur);
          const ko = horsSeuil(v);
          return (
            <tr key={m.id} className="border-t border-rose-100">
              <td className="py-1.5 text-slate-500">
                {new Date(m.horodatage).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td
                className={
                  ko
                    ? "py-1.5 text-right font-semibold text-critique"
                    : "py-1.5 text-right font-semibold text-slate-700"
                }
              >
                {v} {meta.unite}
              </td>
              <td className="py-1.5 text-right">
                {ko ? (
                  <span className="text-xs font-medium text-critique">
                    ⚠ hors seuil
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600">✓ ok</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
