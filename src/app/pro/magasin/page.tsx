"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type Ligne = { id: string; code: string; designation: string; quantite: number };
type StockRow = {
  id: string;
  article_code: string;
  quantite: number;
  article: { designation: string } | { designation: string }[] | null;
};

const AFFICHAGE_MAX = 100;

export default function MagasinPage() {
  const pro = useProSession();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [pret, setPret] = useState(false);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Réservé aux coordinatrices et livreurs (+ plateforme).
  const peutAcceder = pro?.role === "coordinatrice" || pro?.role === "livreur" || pro?.niveau === 0;

  useEffect(() => {
    if (!pro || !peutAcceder) { if (pro) setPret(true); return; }
    const supabase = createClient();
    (async () => {
      // Pagination : la table dépasse la limite de 1000 lignes par requête.
      const all: StockRow[] = [];
      const chunk = 1000;
      for (let from = 0; ; from += chunk) {
        const { data, error } = await supabase
          .from("stock")
          .select("id,article_code,quantite,article:article_code(designation)")
          .order("article_code")
          .range(from, from + chunk - 1);
        if (error || !data) break;
        all.push(...(data as unknown as StockRow[]));
        if (data.length < chunk) break;
      }
      setLignes(
        all.map((s) => ({
          id: s.id,
          code: s.article_code,
          quantite: s.quantite,
          designation: (Array.isArray(s.article) ? s.article[0]?.designation : s.article?.designation) ?? "",
        }))
      );
      setPret(true);
    })();
  }, [pro, peutAcceder]);

  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return lignes;
    return lignes.filter((l) => l.code.toLowerCase().includes(t) || l.designation.toLowerCase().includes(t));
  }, [lignes, q]);

  async function majQuantite(l: Ligne, val: number) {
    if (isNaN(val) || val < 0 || val === l.quantite) return;
    setSavingId(l.id);
    const { error } = await createClient()
      .from("stock")
      .update({ quantite: val, updated_at: new Date().toISOString() })
      .eq("id", l.id);
    setSavingId(null);
    if (error) { alert("Échec : " + error.message); return; }
    setLignes((arr) => arr.map((x) => (x.id === l.id ? { ...x, quantite: val } : x)));
  }

  if (pro && !peutAcceder) {
    return <div className="card text-sm text-slate-500">Le magasin est réservé aux coordinatrices et aux livreurs.</div>;
  }

  const affichees = filtrees.slice(0, AFFICHAGE_MAX);
  const total = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Magasin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock de votre agence — {lignes.length} référence(s), {total} unité(s) au total.
        </p>
      </div>

      <input
        className="input"
        placeholder="Rechercher un article (désignation ou référence)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        inputMode="search"
      />

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun article en stock pour votre agence.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {affichees.map((l) => (
            <div key={l.id} className="card flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words font-medium text-slate-700">{l.designation}</p>
                <p className="text-xs text-slate-400">Réf. {l.code}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={l.quantite}
                  onBlur={(e) => majQuantite(l, parseInt(e.target.value, 10))}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="input w-20 text-right"
                  aria-label={`Quantité ${l.designation}`}
                />
                <span className="w-8 text-xs text-slate-400">{savingId === l.id ? "…" : "u."}</span>
              </div>
            </div>
          ))}
          {filtrees.length > AFFICHAGE_MAX && (
            <p className="text-center text-xs text-slate-400">
              {filtrees.length} résultats — affinez la recherche pour voir les autres.
            </p>
          )}
          {filtrees.length === 0 && (
            <p className="text-center text-sm text-slate-400">Aucun article ne correspond à « {q} ».</p>
          )}
        </div>
      )}
    </div>
  );
}
