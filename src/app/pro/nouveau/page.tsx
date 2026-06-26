"use client";

import Link from "next/link";
import { useProSession } from "@/lib/hooks/useSession";

export default function NouveauHub() {
  const pro = useProSession();
  const estN0 = pro?.niveau === 0;                 // super-admin : tout
  const peutPatient = !!pro; // tout soignant (niveau 0 à 3) peut créer un patient
  const peutSoignant = estN0 || (!!pro && pro.niveau <= 2 && pro.role !== "chirurgien");
  const peutRegion = estN0;                         // créer une région
  const peutAgence = !!pro && pro.niveau <= 1;     // créer une agence

  if (pro && !peutPatient && !peutSoignant && !peutAgence) {
    return (
      <div className="card text-sm text-slate-500">
        La création n&apos;est pas accessible à ce compte.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Créer…</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {peutPatient && (
          <Choix
            href="/pro/nouveau-patient"
            icon="＋"
            titre="Nouveau patient"
            desc="Créer un dossier patient et générer son code d'accès."
          />
        )}
        {peutSoignant && (
          <Choix
            href="/pro/nouveau-soignant"
            icon="✚"
            titre="Nouveau compte soignant"
            desc="Créer un compte coordinatrice, chirurgien/médecin ou délégué."
          />
        )}
        {peutPatient && (
          <Choix
            href="/pro/nouveau-soignant-externe"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V21" />
                <circle cx="9.5" cy="7" r="3.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6M22 11h-6" />
              </svg>
            }
            titre="Nouveau soignant externe"
            desc="Médecin, chirurgien ou infirmière libérale hors entreprise, sans compte."
          />
        )}
        {peutRegion && (
          <Choix
            href="/pro/structure"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v12.7M15 6.8v12.7" />
              </svg>
            }
            titre="Nouvelle région"
            desc="Créer une région et y organiser les agences."
          />
        )}
        {peutAgence && (
          <Choix
            href="/pro/structure"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h5a1 1 0 0 1 1 1v10M3 21h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8h3M7.5 12h3M7.5 16h3" />
              </svg>
            }
            titre="Nouvelle agence"
            desc="Ajouter une agence à une région existante."
          />
        )}
      </div>
    </div>
  );
}

function Choix({ href, icon, titre, desc }: { href: string; icon: React.ReactNode; titre: string; desc: string }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="card flex flex-col gap-3 transition hover:shadow-md hover:border-rose-200"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand text-2xl leading-none text-white">
        {icon}
      </span>
      <h2 className="font-bold text-slate-800">{titre}</h2>
      <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
    </Link>
  );
}
