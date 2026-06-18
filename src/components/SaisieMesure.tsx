"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MESURES } from "@/lib/constants";
import type { TypeMesure } from "@/lib/types";

type Choix = "temperature" | "tension" | "spo2" | "poids";

const CHOIX: { key: Choix; label: string; icon: string }[] = [
  { key: "temperature", label: "Température", icon: "🌡️" },
  { key: "tension", label: "Tension", icon: "💓" },
  { key: "spo2", label: "Saturation O₂", icon: "🫁" },
  { key: "poids", label: "Poids", icon: "⚖️" },
];

export function SaisieMesure({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [choix, setChoix] = useState<Choix | null>(null);
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState(""); // diastolique pour la tension
  const [etat, setEtat] = useState<"idle" | "envoi" | "ok" | "erreur">("idle");
  const [message, setMessage] = useState("");

  function reset() {
    setChoix(null);
    setV1("");
    setV2("");
    setEtat("idle");
    setMessage("");
  }

  async function enregistrer() {
    setEtat("envoi");
    setMessage("");
    const supabase = createClient();

    const lignes: { patient_id: string; type: TypeMesure; valeur: number }[] = [];
    if (choix === "tension") {
      lignes.push({ patient_id: patientId, type: "ta_systolique", valeur: Number(v1) });
      lignes.push({ patient_id: patientId, type: "ta_diastolique", valeur: Number(v2) });
    } else if (choix) {
      lignes.push({ patient_id: patientId, type: choix as TypeMesure, valeur: Number(v1) });
    }

    const { error } = await supabase.from("mesure").insert(lignes);
    if (error) {
      setEtat("erreur");
      setMessage("Échec de l'enregistrement. Réessayez.");
      return;
    }
    setEtat("ok");
    setMessage("Mesure enregistrée ✓");
    setTimeout(() => {
      router.push("/patient");
      router.refresh();
    }, 900);
  }

  if (!choix) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {CHOIX.map((c) => (
          <button
            key={c.key}
            onClick={() => setChoix(c.key)}
            className="card flex flex-col items-center gap-2 py-6 text-base font-semibold text-slate-700 hover:border-brand"
          >
            <span className="text-3xl">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
    );
  }

  const meta =
    choix === "tension" ? MESURES.ta_systolique : MESURES[choix as TypeMesure];
  const valide =
    choix === "tension" ? v1 !== "" && v2 !== "" : v1 !== "";

  return (
    <div className="card grid gap-4">
      {choix === "tension" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Systolique (mmHg)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input text-center text-2xl font-bold"
              value={v1}
              onChange={(e) => setV1(e.target.value)}
              placeholder="120"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Diastolique (mmHg)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input text-center text-2xl font-bold"
              value={v2}
              onChange={(e) => setV2(e.target.value)}
              placeholder="80"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="label">
            {MESURES[choix as TypeMesure].label} ({meta.unite})
          </label>
          <input
            type="number"
            inputMode="decimal"
            step={meta.pas}
            className="input text-center text-3xl font-bold"
            value={v1}
            onChange={(e) => setV1(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            etat === "ok"
              ? "bg-green-50 text-ok"
              : "bg-red-50 text-critique"
          }`}
        >
          {message}
        </p>
      )}

      <div className="flex gap-3">
        <button onClick={reset} className="btn-secondary flex-1">
          Annuler
        </button>
        <button
          onClick={enregistrer}
          disabled={!valide || etat === "envoi" || etat === "ok"}
          className="btn-primary flex-1"
        >
          {etat === "envoi" ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
