"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";

// Présente automatiquement le bilan les jours de suivi (J2 + jours du protocole),
// sauf si une alerte est active (l'infirmière coordinatrice appelle alors).
export function RappelBilanPatient() {
  const patient = usePatientSession();
  const [etat, setEtat] = useState<"rien" | "bilan" | "alerte" | "envoye" | "lu">("rien");

  useEffect(() => {
    if (!patient?.id) return;
    const supabase = createClient();
    const debutJour = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    (async () => {
      const [{ data: p }, { data: bilans }, { data: al }] = await Promise.all([
        supabase.from("patient").select("date_operation,jours_suivi,statut").eq("id", patient.id).maybeSingle(),
        supabase.from("bilan_etat").select("id,lu_le").eq("patient_id", patient.id).gte("created_at", debutJour.toISOString()).order("created_at", { ascending: false }),
        supabase.from("alerte").select("id").eq("patient_id", patient.id).in("statut", ["declenchee", "escaladee"]),
      ]);
      // Alerte active → pas de bilan auto (suivi en direct par l'infirmière).
      if (al && al.length > 0) { setEtat("alerte"); return; }
      // Bilan du jour déjà rempli → transmis, voire lu par l'infirmière.
      const bilanJour = (bilans ?? [])[0] as { lu_le: string | null } | undefined;
      if (bilanJour) { setEtat(bilanJour.lu_le ? "lu" : "envoye"); return; }
      const pp = p as { date_operation: string | null; jours_suivi: number[] | null; statut: string } | null;
      if (!pp?.date_operation || pp.statut !== "active") { setEtat("rien"); return; }
      const base = new Date(pp.date_operation); base.setHours(0, 0, 0, 0);
      const dayNum = Math.round((debutJour.getTime() - base.getTime()) / 86_400_000);
      const jours = new Set<number>([2, ...((pp.jours_suivi ?? []))]); // J2 = après la 1re nuit + protocole
      setEtat(jours.has(dayNum) ? "bilan" : "rien");
    })();
  }, [patient?.id]);

  if (etat === "lu") {
    return (
      <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-slate-700">
        ✅ Votre rapport d&apos;aujourd&apos;hui a bien été <b>reçu et lu par votre infirmière</b>.
      </div>
    );
  }
  if (etat === "envoye") {
    return (
      <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-700">
        ✓ Votre bilan du jour a bien été <b>transmis à votre équipe de soins</b>.
      </div>
    );
  }
  if (etat === "alerte") {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-attention">
        ⚠️ Une alerte a été détectée sur vos dernières mesures. <b>Votre infirmière coordinatrice va vous contacter</b> pour un suivi. En cas d&apos;urgence, appelez le 15.
      </div>
    );
  }
  if (etat === "bilan") {
    return (
      <Link href="/patient/bilan" prefetch className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-100 to-rose-50 px-4 py-4 transition hover:shadow-md">
        <div className="min-w-0">
          <p className="font-bold text-slate-800">📝 C&apos;est l&apos;heure de votre bilan du jour</p>
          <p className="text-sm text-slate-600">Quelques questions rapides sur votre état général.</p>
        </div>
        <span className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Commencer</span>
      </Link>
    );
  }
  return null;
}
