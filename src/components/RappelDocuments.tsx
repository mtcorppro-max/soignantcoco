"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";

// Rappel au patient de renseigner sa carte Vitale / mutuelle si ce n'est pas fait.
export function RappelDocuments() {
  const patient = usePatientSession();
  const [manquants, setManquants] = useState<string[] | null>(null);

  useEffect(() => {
    if (!patient?.id) return;
    createClient()
      .from("patient")
      .select("carte_vitale_chemin,mutuelle_chemin")
      .eq("id", patient.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = (data ?? {}) as { carte_vitale_chemin?: string | null; mutuelle_chemin?: string | null };
        const m: string[] = [];
        if (!d.carte_vitale_chemin) m.push("votre carte Vitale");
        if (!d.mutuelle_chemin) m.push("votre mutuelle");
        setManquants(m);
      });
  }, [patient?.id]);

  if (!manquants || manquants.length === 0) return null;

  return (
    <Link
      href="/patient/profil"
      className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 transition hover:border-brand"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6 shrink-0 text-brand">
        <rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" d="M3 9h18M7 14h5" />
      </svg>
      <div className="text-sm">
        <p className="font-semibold text-slate-800">Complétez votre profil</p>
        <p className="text-slate-600">Pensez à ajouter {manquants.join(" et ")} dans votre profil.</p>
      </div>
      <span className="ml-auto text-brand">→</span>
    </Link>
  );
}
