"use client";

import { useProSession } from "@/lib/hooks/useSession";
import { SoignantForm } from "@/components/SoignantForm";
import { RetourNouveau } from "@/components/RetourNouveau";
import { estRoleService } from "@/lib/roles";

export default function NouveauPersonnel() {
  const pro = useProSession();

  // Réservé aux comptes gestionnaires (niveau 0/1/2, hors médecins / chirurgiens
  // et hors comptes service livreur/pharmacie ; le super-admin niveau 0 n'est
  // jamais bloqué)
  if (pro && pro.niveau !== 0 && (pro.niveau > 2 || pro.role === "chirurgien" || estRoleService(pro.role))) {
    return (
      <div className="card text-sm text-slate-500">
        La création de comptes personnel n&apos;est pas accessible à ce compte.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RetourNouveau />
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Nouveau compte personnel</h1>
      <p className="mb-5 text-sm text-slate-500">
        Coordinatrice, délégué médical, livreur, magasinier… et autres fonctions internes.
      </p>
      <SoignantForm categorie="personnel" />
    </div>
  );
}
