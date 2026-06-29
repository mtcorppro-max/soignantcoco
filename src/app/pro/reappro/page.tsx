"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type Article = { code: string; designation: string };
type Ligne = { id: string; article_code: string; quantite: number; article: Article | Article[] | null };
type Commande = { id: string; reference: string | null; statut: string; created_at: string; lignes: Ligne[] };

const desig = (a: Article | Article[] | null) => (Array.isArray(a) ? a[0]?.designation : a?.designation) ?? "";
const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

const STATUT = {
  brouillon: { label: "Brouillon", cls: "bg-slate-100 text-slate-600" },
  commandee: { label: "Commandée (en transit)", cls: "bg-sky-100 text-sky-700" },
  recue: { label: "Reçue ✓", cls: "bg-green-100 text-ok" },
  annulee: { label: "Annulée", cls: "bg-rose-100 text-rose-500" },
} as const;

export default function ReapproPage() {
  const pro = useProSession();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Article[]>([]);

  const peutAcceder = pro?.role === "coordinatrice" || pro?.role === "livreur" || pro?.niveau === 0;

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("commande")
      .select("id,reference,statut,created_at,lignes:commande_ligne(id,article_code,quantite,article:article_code(designation))")
      .order("created_at", { ascending: false });
    setCommandes((data ?? []) as unknown as Commande[]);
    setPret(true);
  }, []);
  useEffect(() => { if (pro && peutAcceder) charger(); else if (pro) setPret(true); }, [pro, peutAcceder, charger]);

  // Recherche d'articles (côté serveur) pour ajouter une ligne.
  useEffect(() => {
    const t = recherche.trim().replace(/[(),%]/g, " ").trim();
    if (t.length < 2) { setResultats([]); return; }
    let annule = false;
    createClient()
      .from("article")
      .select("code,designation")
      .or(`designation.ilike.%${t}%,code.ilike.%${t}%`)
      .limit(15)
      .then(({ data }) => { if (!annule) setResultats((data ?? []) as Article[]); });
    return () => { annule = true; };
  }, [recherche]);

  async function nouveau() {
    if (!pro?.agence_id || !pro?.prestataire_id) { alert("Votre compte n'est rattaché à aucune agence."); return; }
    setBusy(true);
    const { data, error } = await createClient()
      .from("commande")
      .insert({ agence_id: pro.agence_id, prestataire_id: pro.prestataire_id, statut: "brouillon" })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) { alert("Échec : " + (error?.message ?? "")); return; }
    setEditId(data.id);
    charger();
  }

  async function ajouterLigne(a: Article) {
    if (!editId) return;
    const { error } = await createClient().from("commande_ligne").insert({ commande_id: editId, article_code: a.code, quantite: 1 });
    if (error) { alert("Échec : " + error.message); return; }
    setRecherche(""); setResultats([]);
    charger();
  }
  async function majQte(ligneId: string, q: number) {
    if (isNaN(q) || q < 1) return;
    await createClient().from("commande_ligne").update({ quantite: q }).eq("id", ligneId);
    charger();
  }
  async function retirerLigne(ligneId: string) {
    await createClient().from("commande_ligne").delete().eq("id", ligneId);
    charger();
  }
  async function supprimerCommande(id: string) {
    if (!confirm("Supprimer ce brouillon ?")) return;
    await createClient().from("commande").delete().eq("id", id);
    if (editId === id) setEditId(null);
    charger();
  }
  async function rpc(fn: "commande_valider" | "commande_receptionner", id: string) {
    setBusy(true);
    const { error } = await createClient().rpc(fn, { p_commande: id });
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    if (fn === "commande_valider") setEditId(null);
    charger();
  }

  if (pro && !peutAcceder) {
    return <div className="card text-sm text-slate-500">Le réapprovisionnement est réservé aux coordinatrices et aux livreurs.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Réapprovisionnement</h1>
          <p className="mt-1 text-sm text-slate-500">Bon de commande → validation (en transit) → réception (entre en stock).</p>
        </div>
        <Link href="/pro/magasin" className="btn-secondary text-sm">← Magasin</Link>
      </div>

      <button onClick={nouveau} disabled={busy} className="btn-primary w-fit disabled:opacity-50">+ Nouveau bon de commande</button>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : commandes.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun bon de commande.</p>
      ) : (
        commandes.map((c) => {
          const st = STATUT[c.statut as keyof typeof STATUT] ?? STATUT.brouillon;
          const total = c.lignes.reduce((s, l) => s + l.quantite, 0);
          const enEdition = editId === c.id && c.statut === "brouillon";
          return (
            <section key={c.id} className="card grid grid-cols-1 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  <span className="text-sm text-slate-500">{fmt(c.created_at)} · {c.lignes.length} article(s) · {total} unité(s)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.statut === "brouillon" && (
                    <>
                      <button onClick={() => setEditId(enEdition ? null : c.id)} className="btn-secondary px-3 py-1.5 text-sm">{enEdition ? "Fermer" : "Modifier"}</button>
                      <button onClick={() => rpc("commande_valider", c.id)} disabled={busy || c.lignes.length === 0} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Valider la commande</button>
                      <button onClick={() => supprimerCommande(c.id)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-xs text-critique hover:bg-red-50">Supprimer</button>
                    </>
                  )}
                  {c.statut === "commandee" && (
                    <button onClick={() => rpc("commande_receptionner", c.id)} disabled={busy} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Réceptionner (bon de livraison)</button>
                  )}
                </div>
              </div>

              {/* Lignes */}
              {c.lignes.length > 0 && (
                <div className="grid grid-cols-1 gap-1.5">
                  {c.lignes.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 px-3 py-1.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{desig(l.article)}</p>
                        <p className="text-xs text-slate-400">Réf. {l.article_code}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {enEdition ? (
                          <>
                            <input type="number" min={1} defaultValue={l.quantite} onBlur={(e) => majQte(l.id, parseInt(e.target.value, 10))} className="input w-20 text-right" />
                            <button onClick={() => retirerLigne(l.id)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-critique hover:bg-red-50">✕</button>
                          </>
                        ) : (
                          <span className="font-semibold text-slate-700">{l.quantite}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Ajout d'article (brouillon en édition) */}
              {enEdition && (
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-rose-200 p-3">
                  <input className="input" placeholder="Rechercher un article à ajouter…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
                  {resultats.length > 0 && (
                    <div className="grid grid-cols-1 gap-1">
                      {resultats.map((a) => (
                        <button key={a.code} onClick={() => ajouterLigne(a)} className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-rose-50">
                          <span className="min-w-0 truncate text-slate-700">{a.designation}</span>
                          <span className="shrink-0 text-xs text-brand">+ ajouter</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
