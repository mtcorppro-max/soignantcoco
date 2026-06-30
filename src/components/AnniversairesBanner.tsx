"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { peutNotesFrais } from "@/lib/notesFrais";

type ProAnniv = { id: string; nom: string; prenom: string | null; titre: string | null; role: string; date_naissance: string | null; agence_id: string | null; region_id: string | null };

const cleJour = () => `anniv_vu_${new Date().toISOString().slice(0, 10)}`;

// Rappel d'anniversaire : prévient les comptes INTERNES de la MÊME RÉGION le jour J.
export function AnniversairesBanner() {
  const pro = useProSession();
  const [noms, setNoms] = useState<string[]>([]);
  const [vu, setVu] = useState(true);

  useEffect(() => {
    if (!pro || !peutNotesFrais(pro.role)) return;
    try { if (localStorage.getItem(cleJour())) return; } catch { /* */ }
    setVu(false);
    const supabase = createClient();
    Promise.all([
      supabase.from("professionnel").select("id,nom,prenom,titre,role,date_naissance,agence_id,region_id").not("date_naissance", "is", null),
      supabase.from("agence").select("id,region_id"),
    ]).then(([{ data: pros }, { data: ags }]) => {
      const regAg = new Map((ags ?? []).map((a) => [a.id as string, a.region_id as string]));
      const region = (p: { region_id: string | null; agence_id: string | null }) => p.region_id ?? (p.agence_id ? regAg.get(p.agence_id) : undefined);
      const maRegion = region(pro);
      if (!maRegion) return;
      const t = new Date();
      const md = `${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      const list = ((pros ?? []) as ProAnniv[])
        .filter((p) => p.id !== pro.id && peutNotesFrais(p.role) && region(p) === maRegion && (p.date_naissance ?? "").slice(5) === md)
        .map((p) => [p.titre, p.prenom, p.nom].filter(Boolean).join(" "));
      setNoms(list);
    });
  }, [pro]);

  if (vu || noms.length === 0) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <p className="text-sm text-slate-700">🎂 Aujourd&apos;hui, c&apos;est l&apos;anniversaire de <b className="text-brand">{noms.join(", ")}</b> ! Pensez à lui souhaiter.</p>
      <button onClick={() => { try { localStorage.setItem(cleJour(), "1"); } catch { /* */ } setVu(true); }} className="shrink-0 text-slate-400 hover:text-brand" aria-label="Fermer">✕</button>
    </div>
  );
}
