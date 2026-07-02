"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useProSession } from "@/lib/hooks/useSession";
import { SoignantForm } from "@/components/SoignantForm";
import { RetourNouveau } from "@/components/RetourNouveau";
import { estRoleService } from "@/lib/roles";

// Champs pré-remplissables via l'URL (fiche annuaire santé → bouton « + »).
const CHAMPS_PREFILL = [
  "role", "titre", "prenom", "nom", "specialite", "rpps",
  "telephone", "email", "cabinets", "zone_exercice",
] as const;

function Contenu() {
  const pro = useProSession();
  const params = useSearchParams();

  // Pré-remplissage depuis la fiche annuaire (la coordinatrice n'a plus
  // qu'à valider : email de connexion + agence).
  const prefill: Record<string, string> = {};
  for (const c of CHAMPS_PREFILL) {
    const v = params.get(c);
    if (v) prefill[c] = v;
  }

  // Réservé aux comptes gestionnaires (niveau 0/1/2, hors médecins / chirurgiens
  // et hors comptes service livreur/pharmacie ; le super-admin niveau 0 n'est
  // jamais bloqué)
  if (pro && pro.niveau !== 0 && (pro.niveau > 2 || pro.role === "chirurgien" || estRoleService(pro.role))) {
    return (
      <div className="card text-sm text-slate-500">
        La création de comptes soignants n&apos;est pas accessible à ce compte.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RetourNouveau />
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Nouveau compte soignant</h1>
      <p className="mb-5 text-sm text-slate-500">
        {Object.keys(prefill).length > 0
          ? "Formulaire pré-rempli depuis l'annuaire santé — vérifiez puis validez."
          : "Médecin, infirmière libérale ou pharmacie."}
      </p>
      <SoignantForm categorie="soignant" prefill={prefill} />
    </div>
  );
}

export default function NouveauSoignant() {
  return (
    <Suspense fallback={<div className="card text-sm text-slate-400">Chargement…</div>}>
      <Contenu />
    </Suspense>
  );
}
