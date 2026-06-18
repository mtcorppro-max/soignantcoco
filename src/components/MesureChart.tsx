"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { MESURES } from "@/lib/constants";
import type { Mesure, TypeMesure } from "@/lib/types";

// Courbe d'une constante avec ligne(s) rouge(s) = seuil.
// Lecture seule côté patient ; côté pro on passe seuilMin/seuilMax dynamiques
// (ajustables) via les props pour un aperçu live.
export function MesureChart({
  type,
  mesures,
  seuilMin,
  seuilMax,
  hauteur = 220,
}: {
  type: TypeMesure;
  mesures: Mesure[];
  seuilMin?: number | null;
  seuilMax?: number | null;
  hauteur?: number;
}) {
  const meta = MESURES[type];
  const data = [...mesures]
    .sort(
      (a, b) =>
        new Date(a.horodatage).getTime() - new Date(b.horodatage).getTime()
    )
    .map((m) => ({
      t: new Date(m.horodatage).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      v: Number(m.valeur),
    }));

  if (data.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-xl bg-rose-50 text-sm text-slate-400"
        style={{ height: hauteur }}
      >
        Aucune mesure enregistrée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#fbd0e0" />
        <XAxis dataKey="t" fontSize={11} stroke="#94a3b8" />
        <YAxis
          fontSize={11}
          stroke="#94a3b8"
          domain={["auto", "auto"]}
          unit={meta.unite === "%" ? "%" : ""}
        />
        <Tooltip
          formatter={(v) => [`${v} ${meta.unite}`, meta.court]}
          contentStyle={{ borderRadius: 12, borderColor: "#fbd0e0" }}
        />
        {seuilMin != null && (
          <ReferenceLine
            y={seuilMin}
            stroke="#dc2626"
            strokeDasharray="6 3"
            label={{ value: `min ${seuilMin}`, fontSize: 10, fill: "#dc2626", position: "insideBottomLeft" }}
          />
        )}
        {seuilMax != null && (
          <ReferenceLine
            y={seuilMax}
            stroke="#dc2626"
            strokeDasharray="6 3"
            label={{ value: `max ${seuilMax}`, fontSize: 10, fill: "#dc2626", position: "insideTopLeft" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="v"
          stroke="#961446"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#961446" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
