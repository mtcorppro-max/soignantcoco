"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MESURES } from "@/lib/constants";
import type { Alerte, TypeMesure } from "@/lib/types";

export type AlerteEnrichie = Alerte & {
  patient: { id: string; nom: string } | null;
  mesure: { type: TypeMesure; valeur: number; horodatage: string } | null;
};

export function AlerteCard({
  alerte,
  peutTraiter,
  proId,
}: {
  alerte: AlerteEnrichie;
  peutTraiter: boolean;
  proId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [escaladeOuverte, setEscaladeOuverte] = useState(false);
  const [vers, setVers] = useState("");
  const [note, setNote] = useState("");

  const meta = alerte.mesure ? MESURES[alerte.mesure.type] : null;

  async function maj(patch: Record<string, unknown>) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("alerte")
      .update(patch)
      .eq("id", alerte.id);
    setBusy(false);
    if (!error) router.refresh();
    else alert("Action refusée (droits insuffisants ou erreur réseau).");
  }

  const acquitter = () =>
    maj({
      statut: "acquittee",
      acquittee_par: proId,
      acquittee_le: new Date().toISOString(),
    });

  const escalader = () => {
    maj({
      statut: "escaladee",
      escalade_vers: vers || null,
      escalade_note: note || null,
      escalade_le: new Date().toISOString(),
      canal: "telephone",
    });
    setEscaladeOuverte(false);
  };

  const resoudre = () =>
    maj({ statut: "resolue", resolue_le: new Date().toISOString() });

  const couleur =
    alerte.statut === "declenchee"
      ? "border-l-critique"
      : alerte.statut === "escaladee"
        ? "border-l-attention"
        : "border-l-rose-300";

  return (
    <div className={`card border-l-4 ${couleur}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/pro/patients/${alerte.patient?.id ?? ""}`}
              className="font-semibold text-slate-800 hover:text-brand"
            >
              {alerte.patient?.nom ?? "Patient"}
            </Link>
            <StatutBadge statut={alerte.statut} />
          </div>
          {alerte.mesure && meta && (
            <p className="mt-1 text-sm text-slate-600">
              {meta.label} :{" "}
              <span className="font-bold text-critique">
                {Number(alerte.mesure.valeur)} {meta.unite}
              </span>{" "}
              <span className="text-slate-400">
                (hors seuil — {new Date(alerte.mesure.horodatage).toLocaleString("fr-FR")})
              </span>
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            Déclenchée le {new Date(alerte.declenchee_le).toLocaleString("fr-FR")}
          </p>
          {alerte.escalade_le && (
            <p className="mt-1 text-xs text-attention">
              Escaladée le {new Date(alerte.escalade_le).toLocaleString("fr-FR")}
              {alerte.escalade_vers ? ` → ${alerte.escalade_vers}` : ""}
              {alerte.escalade_note ? ` · « ${alerte.escalade_note} »` : ""}
            </p>
          )}
        </div>

        {peutTraiter && (
          <div className="flex flex-wrap gap-2">
            {alerte.statut === "declenchee" && (
              <button onClick={acquitter} disabled={busy} className="btn-secondary">
                Acquitter
              </button>
            )}
            {alerte.statut !== "escaladee" && (
              <button
                onClick={() => setEscaladeOuverte((v) => !v)}
                disabled={busy}
                className="btn-danger"
              >
                J&apos;ai prévenu l&apos;hôpital
              </button>
            )}
            <button onClick={resoudre} disabled={busy} className="btn-secondary">
              Résoudre
            </button>
          </div>
        )}
      </div>

      {escaladeOuverte && peutTraiter && (
        <div className="mt-4 grid gap-3 rounded-xl bg-rose-50 p-4">
          <p className="text-xs text-slate-500">
            Horodatage automatique à l&apos;enregistrement —{" "}
            {new Date().toLocaleString("fr-FR")}
          </p>
          <div>
            <label className="label">Prévenu (ex. « Dr Martin, urgences »)</label>
            <input
              className="input"
              value={vers}
              onChange={(e) => setVers(e.target.value)}
              placeholder="Service / médecin contacté"
            />
          </div>
          <div>
            <label className="label">Note</label>
            <textarea
              className="input"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex. patient adressé aux urgences à 14h32"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEscaladeOuverte(false)}
              className="btn-secondary flex-1"
            >
              Annuler
            </button>
            <button onClick={escalader} disabled={busy} className="btn-danger flex-1">
              Enregistrer l&apos;escalade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatutBadge({ statut }: { statut: Alerte["statut"] }) {
  const map = {
    declenchee: { c: "bg-critique text-white", l: "Déclenchée" },
    acquittee: { c: "bg-amber-100 text-attention", l: "Acquittée" },
    escaladee: { c: "bg-orange-100 text-orange-700", l: "Escaladée" },
    resolue: { c: "bg-green-100 text-ok", l: "Résolue" },
  } as const;
  const s = map[statut];
  return <span className={`badge ${s.c}`}>{s.l}</span>;
}
