"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { QUESTIONS_BILAN, type ReponsesBilan } from "@/lib/bilanEtat";

export default function BilanPage() {
  const patient = usePatientSession();
  const [rep, setRep] = useState<ReponsesBilan>({});
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [dernier, setDernier] = useState<{ created_at: string } | null>(null);

  useEffect(() => {
    if (!patient?.id) return;
    createClient().from("bilan_etat").select("created_at").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => setDernier(data?.[0] ?? null));
  }, [patient?.id]);

  const setVal = (id: string, v: string | number) => setRep((r) => ({ ...r, [id]: v }));
  const toggleMulti = (id: string, opt: string) => setRep((r) => {
    const arr = Array.isArray(r[id]) ? (r[id] as string[]) : [];
    return { ...r, [id]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
  });

  async function envoyer() {
    if (!patient?.id) return;
    if (!rep.etat_general) { alert("Indiquez au moins comment vous vous sentez globalement."); return; }
    setBusy(true);
    const { error } = await createClient().from("bilan_etat").insert({ patient_id: patient.id, reponses: rep });
    setBusy(false);
    if (error) { alert("Échec de l'envoi. Réessayez."); return; }
    setEnvoye(true);
  }

  if (envoye) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card grid place-items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-2xl">✓</span>
          <p className="text-lg font-bold text-slate-800">Vos données ont bien été transmises à votre équipe de soins</p>
          <p className="max-w-sm text-sm text-slate-500">Vous serez notifié(e) dès que votre infirmière les aura consultées. En cas d&apos;urgence, appelez le 15.</p>
          <button onClick={() => { setRep({}); setEnvoye(false); }} className="btn-secondary mt-2">Faire un nouveau bilan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Mon bilan du jour</h1>
      <p className="mb-5 text-sm text-slate-500">
        Quelques questions rapides sur votre état général.
        {dernier && <> Dernier bilan : {new Date(dernier.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}.</>}
      </p>

      <div className="grid gap-4">
        {QUESTIONS_BILAN.map((q) => (
          <div key={q.id} className="card grid gap-2.5">
            <p className="text-sm font-semibold text-slate-700">{q.label}</p>

            {q.type === "echelle" && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 11 }).map((_, n) => (
                  <button key={n} onClick={() => setVal(q.id, n)} className={`h-9 w-9 rounded-lg border text-sm font-semibold transition ${rep[q.id] === n ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}>{n}</button>
                ))}
              </div>
            )}

            {(q.type === "choix" || q.type === "ouinon") && (
              <div className="flex flex-wrap gap-2">
                {(q.type === "ouinon" ? ["Oui", "Non"] : q.options ?? []).map((opt) => (
                  <button key={opt} onClick={() => setVal(q.id, opt)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${rep[q.id] === opt ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}>{opt}</button>
                ))}
              </div>
            )}

            {q.type === "multi" && (
              <div className="flex flex-wrap gap-2">
                {(q.options ?? []).map((opt) => {
                  const actif = Array.isArray(rep[q.id]) && (rep[q.id] as string[]).includes(opt);
                  return <button key={opt} onClick={() => toggleMulti(q.id, opt)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${actif ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}>{opt}</button>;
                })}
              </div>
            )}

            {q.type === "texte" && (
              <textarea className="input min-h-20" value={(rep[q.id] as string) ?? ""} onChange={(e) => setVal(q.id, e.target.value)} placeholder="Votre message (facultatif)…" />
            )}
          </div>
        ))}

        <button onClick={envoyer} disabled={busy} className="btn-primary py-3 text-base">{busy ? "Envoi…" : "Envoyer mon bilan"}</button>
        <p className="pb-2 text-center text-xs text-slate-400">Ce questionnaire ne remplace pas un avis médical. En cas d&apos;urgence, appelez le 15.</p>
      </div>
    </div>
  );
}
