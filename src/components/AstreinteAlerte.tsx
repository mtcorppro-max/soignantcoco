"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { estRoleService } from "@/lib/roles";
import { premierJourNonCouvert } from "@/lib/astreinte";

// "YYYY-MM-DD" -> "JJ/MM/AAAA"
function formatFr(iso: string): string {
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

// Bannière d'alerte si les astreintes ne sont pas renseignées pour les
// 15 prochains jours. Affichée sur le tableau de bord et la page Organisation.
// Message d'organisation interne : jamais affiché aux médecins/chirurgiens ni
// aux comptes service (livreur/pharmacie), qui ne gèrent pas les astreintes.
export function AstreinteAlerte() {
  const pro = useProSession();
  const [manque, setManque] = useState<string | null>(null);
  const estMedecin = pro?.role === "chirurgien" || estRoleService(pro?.role);

  useEffect(() => {
    if (estMedecin) return;
    createClient()
      .from("evenement_planning")
      .select("date_debut,date_fin")
      .eq("type", "astreinte")
      .then(({ data }) => {
        setManque(premierJourNonCouvert((data ?? []) as { date_debut: string | null; date_fin: string | null }[]));
      });
  }, [estMedecin]);

  if (estMedecin || !manque) return null;

  return (
    <Link
      href="/pro/calendrier"
      className="block rounded-xl bg-rose-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-900"
    >
      ⚠️ Astreintes incomplètes sur les 15 prochains jours — premier jour non couvert : {formatFr(manque)}. Cliquez pour désigner les soignants d&apos;astreinte.
    </Link>
  );
}
