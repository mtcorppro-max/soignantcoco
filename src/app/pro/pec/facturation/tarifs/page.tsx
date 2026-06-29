"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";

type Lpp = { code: string; libelle: string; prix_ttc: number | null; periodicite: string; famille: string | null; a_verifier: boolean };

const PERIODICITES = [
  { value: "unitaire", label: "Unitaire" },
  { value: "installation", label: "Installation (1×)" },
  { value: "journalier", label: "Journalier" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "mensuel", label: "Mensuel" },
];
const FAMILLES = [
  { value: "", label: "—" },
  { value: "perfusion", label: "Perfusion" },
  { value: "nead", label: "Nutrition entérale" },
  { value: "npad", label: "Nutrition parentérale" },
];
const AFFICHAGE_MAX = 150;

export default function TarifsLppPage() {
  const pro = useProSession();
  const [lignes, setLignes] = useState<Lpp[]>([]);
  const [pret, setPret] = useState(false);
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<"a_verifier" | "forfaits" | "tous">("a_verifier");
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const peut = !!pro && (pro.niveau === 0 || ["dirigeant", "magasinier"].includes(pro.role));

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("lpp")
      .select("code,libelle,prix_ttc,periodicite,famille,a_verifier")
      .order("a_verifier", { ascending: false })
      .order("libelle");
    setLignes((data ?? []) as Lpp[]);
    setPret(true);
  }, []);
  useEffect(() => { if (pro && peut) charger(); else if (pro) setPret(true); }, [pro, peut, charger]);

  async function maj(code: string, patch: Partial<Lpp>) {
    setSavingCode(code);
    const { error } = await createClient().from("lpp").update({ ...patch, updated_at: new Date().toISOString() }).eq("code", code);
    setSavingCode(null);
    if (error) { alert("Échec : " + error.message); return; }
    setLignes((arr) => arr.map((l) => (l.code === code ? { ...l, ...patch } : l)));
  }

  const nbAVerifier = useMemo(() => lignes.filter((l) => l.a_verifier).length, [lignes]);
  const nbForfaits = useMemo(() => lignes.filter((l) => l.periodicite !== "unitaire").length, [lignes]);

  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = lignes;
    if (filtre === "a_verifier") r = r.filter((l) => l.a_verifier);
    else if (filtre === "forfaits") r = r.filter((l) => l.periodicite !== "unitaire");
    if (t) r = r.filter((l) => l.code.includes(t) || l.libelle.toLowerCase().includes(t));
    return r;
  }, [lignes, filtre, q]);

  if (pro && !peut) return <div className="card text-sm text-slate-500">L&apos;édition des tarifs LPP est réservée à la plateforme, au dirigeant et au magasinier.</div>;

  const affichees = filtrees.slice(0, AFFICHAGE_MAX);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tarifs LPP & forfaits</h1>
          <p className="mt-1 text-sm text-slate-500">{lignes.length} codes · {nbForfaits} forfaits · <span className="font-medium text-attention">{nbAVerifier} à vérifier</span>.</p>
        </div>
        <Link href="/pro/pec/facturation" className="btn-secondary text-sm">← Facturation</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input flex-1" placeholder="Rechercher (code ou libellé)…" value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
        {([["a_verifier", `À vérifier${nbAVerifier ? ` (${nbAVerifier})` : ""}`], ["forfaits", "Forfaits"], ["tous", "Tous"]] as const).map(([v, lab]) => (
          <button key={v} onClick={() => setFiltre(v)} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${filtre === v ? "border-rose-300 bg-rose-100 text-brand" : "border-rose-200 bg-white text-slate-600 hover:bg-rose-50"}`}>{lab}</button>
        ))}
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : filtrees.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun code ne correspond.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {affichees.map((l) => (
            <div key={l.code} className={`card grid gap-2 py-3 ${l.a_verifier ? "border-amber-200 bg-amber-50/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{l.code}</span>
                {l.a_verifier && <span className="badge bg-amber-100 text-attention">à vérifier</span>}
                {l.prix_ttc === null && <span className="badge bg-rose-100 text-critique">prix manquant</span>}
                <span className="ml-auto text-xs text-slate-400">{savingCode === l.code ? "enregistrement…" : ""}</span>
              </div>
              <input
                className="input text-sm" defaultValue={l.libelle}
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== l.libelle) maj(l.code, { libelle: v }); }}
              />
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-400">
                  Prix TTC (€)
                  <input
                    type="number" step="0.01" min={0} defaultValue={l.prix_ttc ?? ""}
                    onBlur={(e) => { const raw = e.target.value.trim().replace(",", "."); const v = raw === "" ? null : parseFloat(raw); if (v !== l.prix_ttc) maj(l.code, { prix_ttc: v }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="input mt-0.5 w-28 text-right"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Périodicité
                  <div className="mt-0.5 w-40"><Select value={l.periodicite} onChange={(v) => maj(l.code, { periodicite: v })} options={PERIODICITES} /></div>
                </label>
                <label className="text-xs text-slate-400">
                  Famille
                  <div className="mt-0.5 w-44"><Select value={l.famille ?? ""} onChange={(v) => maj(l.code, { famille: v || null })} options={FAMILLES} /></div>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 pb-2 text-sm text-slate-600">
                  <input type="checkbox" checked={!l.a_verifier} onChange={(e) => maj(l.code, { a_verifier: !e.target.checked })} className="h-4 w-4 accent-brand" />
                  Validé
                </label>
              </div>
            </div>
          ))}
          {filtrees.length > AFFICHAGE_MAX && <p className="text-center text-xs text-slate-400">{filtrees.length} résultats — affinez la recherche.</p>}
        </div>
      )}
    </div>
  );
}
