"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QUESTIONS_BILAN, formatReponse, reponsePreoccupante, type ReponsesBilan } from "@/lib/bilanEtat";

type Bilan = { id: string; created_at: string; reponses: ReponsesBilan };
const vide = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

// Bilans « état général » remplis par le patient (côté soignant).
export function BilansPatient({ patientId }: { patientId: string }) {
  const [bilans, setBilans] = useState<Bilan[]>([]);
  const [pret, setPret] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    createClient().from("bilan_etat").select("id,created_at,reponses").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { setBilans((data ?? []) as Bilan[]); setPret(true); });
  }, [patientId]);

  if (!pret) return null;

  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-semibold text-slate-600">Bilans « état général » du patient</h2>
      {bilans.length === 0 ? (
        <p className="card text-sm text-slate-400">Aucun bilan rempli par le patient.</p>
      ) : bilans.map((b) => {
        const r = b.reponses;
        const alertes = QUESTIONS_BILAN.filter((q) => reponsePreoccupante(q.id, r[q.id]));
        const open = ouvert === b.id;
        return (
          <div key={b.id} className="card grid gap-2">
            <button onClick={() => setOuvert(open ? null : b.id)} className="flex items-center justify-between gap-2 text-left">
              <span className="font-medium text-slate-700">
                {new Date(b.created_at).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}
                <span className="ml-1 text-xs text-slate-400">{new Date(b.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </span>
              {alertes.length > 0
                ? <span className="badge bg-red-100 text-critique">{alertes.length} point{alertes.length > 1 ? "s" : ""} d&apos;attention</span>
                : <span className="badge bg-green-100 text-ok">RAS</span>}
            </button>
            {open && (
              <div className="grid gap-1.5 border-t border-rose-100 pt-2">
                {QUESTIONS_BILAN.map((q) => {
                  const v = r[q.id];
                  if (vide(v)) return null;
                  const ko = reponsePreoccupante(q.id, v);
                  return (
                    <div key={q.id} className="flex justify-between gap-3 text-sm">
                      <span className="shrink-0 text-slate-400">{q.label}</span>
                      <span className={`min-w-0 break-words text-right font-medium ${ko ? "text-critique" : "text-slate-700"}`}>{formatReponse(q, v)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
