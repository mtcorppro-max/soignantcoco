"use client";

import Link from "next/link";
import { useProSession } from "@/lib/hooks/useSession";

export default function NouveauHub() {
  const pro = useProSession();
  const peutPatient = pro?.role === "coordinatrice";
  const peutSoignant = pro?.niveau === 1;

  if (pro && !peutPatient && !peutSoignant) {
    return (
      <div className="card text-sm text-slate-500">
        La création est réservée à la coordinatrice et aux comptes de niveau 1.
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
      </div>
    </div>
  );
}

function Choix({ href, icon, titre, desc }: { href: string; icon: string; titre: string; desc: string }) {
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
