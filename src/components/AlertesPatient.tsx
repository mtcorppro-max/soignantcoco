"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { invalidate } from "@/lib/hooks/useData";
import { MESURES } from "@/lib/constants";
import type { TypeMesure } from "@/lib/types";

type AlerteLigne = {
  id: string;
  statut: "declenchee" | "acquittee" | "escaladee";
  declenchee_le: string;
  mesure: { type: TypeMesure; valeur: number; horodatage: string } | null;
};

// Alertes en cours d'un patient, clôturables directement depuis sa fiche.
// Être sur cette page vaut consultation : le bouton est donc toujours actif.
export function AlertesPatient({ patientId }: { patientId: string }) {
  const [alertes, setAlertes] = useState<AlerteLigne[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("alerte")
      .select("id,statut,declenchee_le, mesure:mesure_id(type,valeur,horodatage)")
      .eq("patient_id", patientId)
      .in("statut", ["declenchee", "acquittee", "escaladee"])
      .order("declenchee_le", { ascending: false })
      .then(({ data }) => {
        setAlertes((data ?? []) as unknown as AlerteLigne[]);
        setReady(true);
      });
  }, [patientId]);

  async function finAlerte(id: string) {
    setBusy(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("alerte")
      .update({ statut: "resolue", resolue_le: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) {
      alert("Action refusée (droits insuffisants ou erreur réseau).");
      return;
    }
    invalidate("pro:alertes");
    invalidate("pro:dashboard");
    setAlertes((prev) => prev.filter((a) => a.id !== id));
  }

  if (!ready || alertes.length === 0) return null;

  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold text-slate-600">Alertes en cours</h2>
      {alertes.map((a) => {
        const meta = a.mesure ? MESURES[a.mesure.type] : null;
        return (
          <div
            key={a.id}
            className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-critique"
          >
            <div>
              {a.mesure && meta ? (
                <p className="text-sm text-slate-600">
                  {meta.label} :{" "}
                  <span className="font-bold text-critique">
                    {Number(a.mesure.valeur)} {meta.unite}
                  </span>{" "}
                  <span className="text-slate-400">(hors seuil)</span>
                </p>
              ) : (
                <p className="text-sm font-medium text-slate-700">Alerte</p>
              )}
              <p className="mt-0.5 text-xs text-slate-400">
                Déclenchée le {new Date(a.declenchee_le).toLocaleString("fr-FR")}
              </p>
            </div>
            <button
              onClick={() => finAlerte(a.id)}
              disabled={busy === a.id}
              className="btn-primary disabled:opacity-50"
            >
              {busy === a.id ? "…" : "Fin de l'alerte"}
            </button>
          </div>
        );
      })}
    </section>
  );
}
