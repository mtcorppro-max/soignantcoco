"use client";

import { useProSession } from "@/lib/hooks/useSession";
import { SoignantForm } from "@/components/SoignantForm";

export default function NouveauSoignant() {
  const pro = useProSession();

  // Réservé aux comptes de niveau 1
  if (pro && pro.niveau !== 1) {
    return (
      <div className="card text-sm text-slate-500">
        La création de comptes soignants est réservée aux comptes de niveau 1.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Nouveau compte soignant</h1>
      <SoignantForm />
    </div>
  );
}
