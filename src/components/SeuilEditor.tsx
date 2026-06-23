"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MESURES } from "@/lib/constants";
import { MesureChart } from "@/components/MesureChart";
import type { Mesure, Seuil, TypeMesure } from "@/lib/types";

// Courbe d'une constante + réglage du seuil (ligne rouge).
// Les bornes min/max se déplacent en live ; « Enregistrer » persiste le seuil.
export function SeuilEditor({
  type,
  patientId,
  mesures,
  seuil,
  modifiable,
}: {
  type: TypeMesure;
  patientId: string;
  mesures: Mesure[];
  seuil: Seuil | null;
  modifiable: boolean;
}) {
  const meta = MESURES[type];
  const [min, setMin] = useState<string>(
    seuil?.valeur_min != null ? String(seuil.valeur_min) : ""
  );
  const [max, setMax] = useState<string>(
    seuil?.valeur_max != null ? String(seuil.valeur_max) : ""
  );
  const [etat, setEtat] = useState<"idle" | "saving" | "ok">("idle");

  const minNum = min === "" ? null : Number(min);
  // SpO₂ (et assimilés) : pas de seuil max.
  const maxNum = meta.sansSeuilMax || max === "" ? null : Number(max);

  async function enregistrer() {
    setEtat("saving");
    const supabase = createClient();
    const payload = {
      patient_id: patientId,
      type_mesure: type,
      valeur_min: minNum,
      valeur_max: maxNum,
      actif: true,
    };
    const { error } = seuil
      ? await supabase.from("seuil").update(payload).eq("id", seuil.id)
      : await supabase.from("seuil").insert(payload);
    if (error) {
      setEtat("idle");
      alert("Enregistrement refusé (droits ou réseau).");
      return;
    }
    setEtat("ok");
    setTimeout(() => setEtat("idle"), 1500);
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{meta.label}</h3>
        <span className="text-xs text-slate-400">{meta.unite}</span>
      </div>

      <MesureChart
        type={type}
        mesures={mesures}
        seuilMin={minNum}
        seuilMax={maxNum}
      />

      {meta.pertePoidsPct ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-slate-500">
          Pas de seuil fixe. Une alerte se déclenche automatiquement dès une perte
          ≥ {meta.pertePoidsPct} % par rapport au poids de référence (premier poids enregistré).
        </p>
      ) : modifiable ? (
        <div className="mt-4 grid gap-3">
          <div className={`grid gap-3 ${meta.sansSeuilMax ? "grid-cols-1" : "grid-cols-2"}`}>
            <label className="text-xs text-slate-500">
              Seuil min
              <input
                type="number"
                step={meta.pas}
                className="input mt-1"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="—"
              />
            </label>
            {!meta.sansSeuilMax && (
              <label className="text-xs text-slate-500">
                Seuil max
                <input
                  type="number"
                  step={meta.pas}
                  className="input mt-1"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  placeholder="—"
                />
              </label>
            )}
          </div>
          <button
            onClick={enregistrer}
            disabled={etat === "saving"}
            className="btn-primary"
          >
            {etat === "saving"
              ? "Enregistrement…"
              : etat === "ok"
                ? "Seuil enregistré ✓"
                : "Enregistrer le seuil"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          {meta.sansSeuilMax
            ? `Seuil min : ${minNum ?? "—"} ${meta.unite} (lecture seule)`
            : `Seuil : ${minNum ?? "—"} / ${maxNum ?? "—"} ${meta.unite} (lecture seule)`}
        </p>
      )}
    </div>
  );
}
