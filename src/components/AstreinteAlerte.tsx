"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { astreintesIncompletes } from "@/lib/astreinte";

// Bannière d'alerte si les astreintes ne sont pas renseignées pour les
// 15 prochains jours. Affichée sur le tableau de bord et la page Organisation.
export function AstreinteAlerte() {
  const [incomplet, setIncomplet] = useState(false);

  useEffect(() => {
    createClient()
      .from("astreinte")
      .select("semaine_debut,type")
      .then(({ data }) => {
        const cles = new Set(
          (data ?? []).map((a) => `${a.semaine_debut}|${a.type}`)
        );
        setIncomplet(astreintesIncompletes(cles));
      });
  }, []);

  if (!incomplet) return null;

  return (
    <Link
      href="/pro/calendrier"
      className="block rounded-xl bg-rose-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-900"
    >
      ⚠️ Astreintes non renseignées pour les 15 prochains jours — cliquez pour désigner les soignants d&apos;astreinte.
    </Link>
  );
}
