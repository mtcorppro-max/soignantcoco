"use client";

import { useProSession } from "@/lib/hooks/useSession";
import { peutMarketing } from "@/lib/roles";

export default function MarketingPage() {
  const pro = useProSession();

  // Réservé au dirigeant, RH, manager, délégué (+ administration).
  if (pro && !peutMarketing(pro.role, pro.niveau)) {
    return <div className="card text-sm text-slate-500">Cet espace est réservé à la direction, aux RH, managers et délégués.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Marketing</h1>
      <p className="mb-6 text-sm text-slate-500">Espace marketing — le contenu sera ajouté prochainement.</p>

      <div className="card grid place-items-center gap-2 py-16 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-rose-300" aria-hidden="true">
          <path d="M4 10.5v3a1 1 0 0 0 1 1h2.5l6 3.5V6l-6 3.5H5a1 1 0 0 0-1 1Z" />
          <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M7.5 14.5 9 20" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Bientôt disponible</p>
        <p className="max-w-sm text-xs text-slate-400">Cet espace accueillera les outils et contenus marketing.</p>
      </div>
    </div>
  );
}
