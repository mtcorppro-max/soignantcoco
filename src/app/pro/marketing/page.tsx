"use client";

import { useState } from "react";
import { useProSession } from "@/lib/hooks/useSession";
import { peutMarketing } from "@/lib/roles";

type RubriqueId = "congres" | "supports" | "videos";

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">{children}</svg>
);
const ICongres = () => svg(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /></>);
const ISupports = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><line x1="8.5" y1="13" x2="15.5" y2="13" /><line x1="8.5" y1="16.5" x2="13" y2="16.5" /></>);
const IVideos = () => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>);

const RUBRIQUES: { id: RubriqueId; label: string; icon: React.ReactNode; vide: string }[] = [
  { id: "congres", label: "Congrès et événements", icon: <ICongres />, vide: "Les congrès et événements à venir seront listés ici." },
  { id: "supports", label: "Supports", icon: <ISupports />, vide: "Les supports marketing (brochures, affiches, documents…) seront disponibles ici." },
  { id: "videos", label: "Vidéos", icon: <IVideos />, vide: "Les vidéos seront disponibles ici." },
];

export default function MarketingPage() {
  const pro = useProSession();
  const [onglet, setOnglet] = useState<RubriqueId>("congres");

  // Réservé au dirigeant, RH, manager, délégué (+ administration).
  if (pro && !peutMarketing(pro.role, pro.niveau)) {
    return <div className="card text-sm text-slate-500">Cet espace est réservé à la direction, aux RH, managers et délégués.</div>;
  }

  const courante = RUBRIQUES.find((r) => r.id === onglet) ?? RUBRIQUES[0];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Marketing</h1>
      <p className="mb-5 text-sm text-slate-500">Congrès et événements, supports et vidéos.</p>

      {/* Rubriques */}
      <div className="mb-5 flex flex-wrap gap-2">
        {RUBRIQUES.map((r) => {
          const actif = r.id === onglet;
          return (
            <button
              key={r.id}
              onClick={() => setOnglet(r.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${actif ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`}
            >
              {r.icon}
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu de la rubrique (vide pour l'instant) */}
      <div className="card grid place-items-center gap-2 py-16 text-center">
        <span className="text-rose-300">{courante.icon}</span>
        <p className="text-sm font-medium text-slate-500">{courante.label}</p>
        <p className="max-w-sm text-xs text-slate-400">{courante.vide}</p>
      </div>
    </div>
  );
}
