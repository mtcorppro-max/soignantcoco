"use client";

import { useProSession } from "@/lib/hooks/useSession";
import { SoignantForm } from "@/components/SoignantForm";
import { RetourNouveau } from "@/components/RetourNouveau";

export default function NouveauSoignant() {
  const pro = useProSession();

  // Réservé aux comptes gestionnaires (niveau 0/1/2, hors médecins / chirurgiens ;
  // le super-admin niveau 0 n'est jamais bloqué)
  if (pro && pro.niveau !== 0 && (pro.niveau > 2 || pro.role === "chirurgien")) {
    return (
      <div className="card text-sm text-slate-500">
        La création de comptes soignants n&apos;est pas accessible à ce compte.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RetourNouveau />
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Nouveau compte soignant</h1>
      <SoignantForm />
    </div>
  );
}
