"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MESURES } from "@/lib/constants";
import { dateVisite } from "@/lib/visites";
import type { Alerte, TypeMesure } from "@/lib/types";

export type AlerteEnrichie = Alerte & {
  patient: {
    id: string;
    nom: string;
    telephone: string | null;
    chirurgien: string | null;
    operation: string | null;
    date_operation: string | null;
  } | null;
  mesure: { type: TypeMesure; valeur: number; horodatage: string } | null;
};

export function AlerteCard({
  alerte,
  peutTraiter,
  onUpdated,
}: {
  alerte: AlerteEnrichie;
  peutTraiter: boolean;
  proId?: string;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checkee, setCheckee] = useState(false);

  const patientId = alerte.patient?.id ?? "";
  const lien = `/pro/patients/${patientId}`;
  const meta = alerte.mesure ? MESURES[alerte.mesure.type] : null;

  // La fiche a-t-elle été consultée depuis le déclenchement de l'alerte ?
  useEffect(() => {
    const v = dateVisite(patientId);
    setCheckee(v != null && v >= new Date(alerte.declenchee_le).getTime());
  }, [patientId, alerte.declenchee_le]);

  async function finAlerte() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("alerte")
      .update({ statut: "resolue", resolue_le: new Date().toISOString() })
      .eq("id", alerte.id);
    setBusy(false);
    if (!error) onUpdated?.();
    else alert("Action refusée (droits insuffisants ou erreur réseau).");
  }

  const couleur =
    alerte.statut === "declenchee"
      ? "border-l-critique"
      : alerte.statut === "escaladee"
        ? "border-l-attention"
        : "border-l-rose-300";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => patientId && router.push(lien)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && patientId) {
          e.preventDefault();
          router.push(lien);
        }
      }}
      className={`flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-rose-100 border-l-[5px] bg-white px-4 py-2.5 transition hover:shadow-md ${couleur}`}
    >
      {/* Patient + alerte (mise en avant) */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-800">{alerte.patient?.nom ?? "Patient"}</span>
          <StatutBadge statut={alerte.statut} />
          {alerte.mesure && meta && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 text-sm font-bold text-critique">
              {meta.label} : {Number(alerte.mesure.valeur)} {meta.unite}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Déclenchée le {new Date(alerte.declenchee_le).toLocaleString("fr-FR")}
        </p>
      </div>

      {/* Infos patient (à droite) pour réagir vite */}
      <div className="grid gap-0.5 text-xs sm:text-right">
        {alerte.patient?.telephone && (
          <p>
            <span className="text-slate-400">Tél. : </span>
            <a href={`tel:${alerte.patient.telephone}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand hover:underline">
              {alerte.patient.telephone}
            </a>
          </p>
        )}
        {alerte.patient?.chirurgien && (
          <p><span className="text-slate-400">Opéré par : </span><span className="font-medium text-slate-600">{alerte.patient.chirurgien}</span></p>
        )}
        {(alerte.patient?.operation || alerte.patient?.date_operation) && (
          <p>
            <span className="text-slate-400">Chirurgie : </span>
            <span className="font-medium text-slate-600">
              {alerte.patient.operation || "—"}
              {alerte.patient.date_operation ? ` (le ${new Date(alerte.patient.date_operation).toLocaleDateString("fr-FR")})` : ""}
            </span>
          </p>
        )}
      </div>

      {peutTraiter && (
        <div className="flex shrink-0 flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={finAlerte}
            disabled={busy || !checkee}
            title={checkee ? undefined : "Consultez d'abord la fiche du patient"}
            className="btn-primary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "…" : "Fin de l'alerte"}
          </button>
          {!checkee && <span className="text-[10px] text-slate-400">Ouvrez la fiche pour clôturer</span>}
        </div>
      )}
    </div>
  );
}

function StatutBadge({ statut }: { statut: Alerte["statut"] }) {
  const map = {
    declenchee: { c: "bg-critique text-white", l: "Déclenchée" },
    acquittee: { c: "bg-amber-100 text-attention", l: "Traitée" },
    escaladee: { c: "bg-orange-100 text-orange-700", l: "Escaladée" },
    resolue: { c: "bg-green-100 text-ok", l: "Résolue" },
  } as const;
  const s = map[statut];
  return <span className={`badge ${s.c}`}>{s.l}</span>;
}
