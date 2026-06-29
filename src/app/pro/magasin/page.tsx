"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { genererEtiquettes } from "@/lib/genererBons";

type Ligne = {
  id: string;
  code: string;
  designation: string;
  quantite: number;
  en_commande: number;
  reserve: number;
  seuil: number;
};
type StockRow = {
  id: string;
  article_code: string;
  quantite: number;
  en_commande: number;
  seuil_alerte: number;
  article: { designation: string } | { designation: string }[] | null;
};

const AFFICHAGE_MAX = 100;

export default function MagasinPage() {
  const pro = useProSession();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [pret, setPret] = useState(false);
  const [q, setQ] = useState("");
  const [stockBas, setStockBas] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const peutAcceder = pro?.role === "coordinatrice" || pro?.role === "livreur" || pro?.niveau === 0;

  useEffect(() => {
    if (!pro || !peutAcceder) { if (pro) setPret(true); return; }
    const supabase = createClient();
    (async () => {
      const all: StockRow[] = [];
      const chunk = 1000;
      for (let from = 0; ; from += chunk) {
        const { data, error } = await supabase
          .from("stock")
          .select("id,article_code,quantite,en_commande,seuil_alerte,article:article_code(designation)")
          .order("article_code")
          .range(from, from + chunk - 1);
        if (error || !data) break;
        all.push(...(data as unknown as StockRow[]));
        if (data.length < chunk) break;
      }
      // « Réservé » par article (livraisons non livrées) — calculé côté serveur.
      const { data: res } = await supabase.rpc("stock_reserve");
      const reserveParArticle = new Map<string, number>(
        ((res ?? []) as { article_code: string; qte: number }[]).map((r) => [r.article_code, Number(r.qte)])
      );
      setLignes(
        all.map((s) => ({
          id: s.id,
          code: s.article_code,
          quantite: s.quantite,
          en_commande: s.en_commande ?? 0,
          reserve: reserveParArticle.get(s.article_code) ?? 0,
          seuil: s.seuil_alerte ?? 0,
          designation: (Array.isArray(s.article) ? s.article[0]?.designation : s.article?.designation) ?? "",
        }))
      );
      setPret(true);
    })();
  }, [pro, peutAcceder]);

  const nbBas = useMemo(() => lignes.filter((l) => l.quantite <= l.seuil).length, [lignes]);

  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = lignes;
    if (t) r = r.filter((l) => l.code.toLowerCase().includes(t) || l.designation.toLowerCase().includes(t));
    if (stockBas) r = r.filter((l) => l.quantite <= l.seuil);
    return r;
  }, [lignes, q, stockBas]);

  async function maj(l: Ligne, champ: "quantite" | "seuil_alerte", val: number) {
    if (isNaN(val) || val < 0) return;
    const actuel = champ === "quantite" ? l.quantite : l.seuil;
    if (val === actuel) return;
    setSavingId(l.id);
    const { error } = await createClient()
      .from("stock")
      .update({ [champ]: val, updated_at: new Date().toISOString() })
      .eq("id", l.id);
    setSavingId(null);
    if (error) { alert("Échec : " + error.message); return; }
    setLignes((arr) => arr.map((x) => (x.id === l.id ? { ...x, ...(champ === "quantite" ? { quantite: val } : { seuil: val }) } : x)));
  }

  if (pro && !peutAcceder) {
    return <div className="card text-sm text-slate-500">Le magasin est réservé aux coordinatrices et aux livreurs.</div>;
  }

  const affichees = filtrees.slice(0, AFFICHAGE_MAX);
  const total = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Magasin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Stock de votre agence — {lignes.length} référence(s), {total} unité(s) disponibles.
          </p>
        </div>
        <Link href="/pro/reappro" className="btn-secondary text-sm">Réapprovisionnement →</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1"
          placeholder="Rechercher (désignation ou référence)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="search"
        />
        <button
          onClick={() => setStockBas((v) => !v)}
          className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition ${stockBas ? "border-amber-300 bg-amber-100 text-attention" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}
        >
          ⚠️ Stock bas{nbBas > 0 ? ` (${nbBas})` : ""}
        </button>
        <button
          onClick={() => {
            const sel = filtrees.slice(0, 200);
            if (filtrees.length > 200 && !confirm(`${filtrees.length} articles filtrés. Générer les étiquettes des 200 premiers ? (affinez la recherche pour cibler)`)) return;
            genererEtiquettes(sel.map((l) => ({ code: l.code, designation: l.designation })));
          }}
          className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-50"
          title="Planche d'étiquettes QR (une par article) à imprimer"
        >
          🏷️ Étiquettes QR
        </button>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun article en stock pour votre agence.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {affichees.map((l) => {
            const bas = l.quantite <= l.seuil;
            return (
              <div key={l.id} className={`card grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center ${bas ? "border-amber-200 bg-amber-50/40" : ""}`}>
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-700">
                    {l.designation}
                    {bas && <span className="ml-2 badge bg-amber-100 text-attention">Stock bas</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    Réf. {l.code}
                    {l.en_commande > 0 && <span className="ml-2 text-sky-600">· {l.en_commande} en commande</span>}
                    {l.reserve > 0 && <span className="ml-2 text-rose-500">· {l.reserve} réservé(s)</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-end gap-3">
                  <label className="text-xs text-slate-400">
                    Disponible
                    <input
                      type="number" min={0} defaultValue={l.quantite}
                      onBlur={(e) => maj(l, "quantite", parseInt(e.target.value, 10))}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="input mt-0.5 w-20 text-right"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Seuil
                    <input
                      type="number" min={0} defaultValue={l.seuil}
                      onBlur={(e) => maj(l, "seuil_alerte", parseInt(e.target.value, 10))}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="input mt-0.5 w-16 text-right"
                    />
                  </label>
                  <span className="pb-2 text-xs text-slate-400">{savingId === l.id ? "…" : ""}</span>
                </div>
              </div>
            );
          })}
          {filtrees.length > AFFICHAGE_MAX && (
            <p className="text-center text-xs text-slate-400">{filtrees.length} résultats — affinez la recherche.</p>
          )}
          {filtrees.length === 0 && (
            <p className="text-center text-sm text-slate-400">Aucun article ne correspond.</p>
          )}
        </div>
      )}
    </div>
  );
}
