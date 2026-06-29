"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type Eq = {
  id: string; numero_serie: string; statut: string; prochaine_maintenance: string | null;
  type: { nom: string } | { nom: string }[] | null;
  agence: { nom: string } | { nom: string }[] | null;
};
const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");

function joursAvant(iso: string): number {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export default function MaintenancePage() {
  const pro = useProSession();
  const [eqs, setEqs] = useState<Eq[]>([]);
  const [pret, setPret] = useState(false);
  const peutGerer = pro?.role === "magasinier" || pro?.niveau === 0;
  const estN0 = pro?.niveau === 0;

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("equipement")
      .select("id,numero_serie,statut,prochaine_maintenance,type:type_id(nom),agence:agence_id(nom)")
      .neq("statut", "hors_service")
      .not("prochaine_maintenance", "is", null)
      .order("prochaine_maintenance", { ascending: true });
    setEqs((data ?? []) as unknown as Eq[]);
    setPret(true);
  }, []);
  useEffect(() => { if (pro && peutGerer) charger(); else if (pro) setPret(true); }, [pro, peutGerer, charger]);

  if (pro && !peutGerer) return <div className="card text-sm text-slate-500">Le parc matériel est géré par le magasinier.</div>;

  const groupes: { titre: string; cls: string; items: Eq[] }[] = [
    { titre: "En retard", cls: "text-critique", items: [] },
    { titre: "Dans les 30 jours", cls: "text-attention", items: [] },
    { titre: "Dans les 90 jours", cls: "text-sky-700", items: [] },
    { titre: "Plus tard", cls: "text-slate-500", items: [] },
  ];
  eqs.forEach((e) => {
    if (!e.prochaine_maintenance) return;
    const j = joursAvant(e.prochaine_maintenance);
    const g = j < 0 ? 0 : j <= 30 ? 1 : j <= 90 ? 2 : 3;
    groupes[g].items.push(e);
  });

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planning de maintenance</h1>
          <p className="mt-1 text-sm text-slate-500">Maintenances préventives à venir, par échéance.</p>
        </div>
        <Link href="/pro/parc" className="btn-secondary text-sm">← Parc</Link>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : eqs.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune maintenance planifiée.</p>
      ) : (
        groupes.filter((g) => g.items.length > 0).map((g) => (
          <section key={g.titre} className="grid grid-cols-1 gap-2">
            <h2 className={`text-xs font-bold uppercase tracking-widest ${g.cls}`}>{g.titre} ({g.items.length})</h2>
            {g.items.map((e) => (
              <Link key={e.id} href={`/pro/parc/${e.id}`} className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-rose-200 hover:shadow-md">
                <div className="min-w-0">
                  <p className="font-medium text-slate-700">{un(e.type)?.nom} · <span className="font-mono text-sm text-slate-500">{e.numero_serie}</span></p>
                  {estN0 && <p className="text-xs text-slate-400">{un(e.agence)?.nom}</p>}
                </div>
                <span className={`text-sm font-medium ${g.cls}`}>{fmt(e.prochaine_maintenance)}</span>
              </Link>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
