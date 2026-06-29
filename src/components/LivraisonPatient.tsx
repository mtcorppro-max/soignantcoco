"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { estCoordOuManager } from "@/lib/roles";
import { Select } from "@/components/Select";

type Pro = { nom: string; prenom: string | null; titre: string | null };
type Livraison = { id: string; livreur_id: string | null; statut: string; date_prevue: string | null; created_at: string; livreur: Pro | Pro[] | null };

function fmt(iso: string | null): string {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}
const nomPro = (p: Pro | Pro[] | null): string => {
  const x = Array.isArray(p) ? p[0] : p;
  return x ? [x.titre, x.prenom, x.nom].filter(Boolean).join(" ") : "";
};

// Livraisons d'un patient (côté pro). La coordinatrice/manager déclenche une
// « livraison à programmer » ; un livreur de l'agence la prend ensuite en charge.
export function LivraisonPatient({ patientId, prestataireId }: { patientId: string; prestataireId: string }) {
  const pro = useProSession();
  const [livraisons, setLivraisons] = useState<Livraison[]>([]);
  const [busy, setBusy] = useState(false);
  // Coordinatrice / manager / plateforme, mais aussi l'infirmière libérale qui
  // suit le patient : tous peuvent programmer une livraison.
  const peutGerer = estCoordOuManager(pro?.role) || pro?.niveau === 0 || pro?.role === "infirmiere_liberale";
  // Composition du panier (articles) : réservée aux coordinatrices (+ plateforme).
  const peutPanier = pro?.role === "coordinatrice" || pro?.niveau === 0;

  // Livreurs et coordinatrices de l'agence du patient, désignables comme livreur.
  const [livreurs, setLivreurs] = useState<{ value: string; label: string }[]>([]);
  const [choix, setChoix] = useState(""); // "" = laisser au pool
  const [changeId, setChangeId] = useState<string | null>(null); // ligne en cours de réassignation

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("livraison")
      .select("id,livreur_id,statut,date_prevue,created_at,livreur:livreur_id(nom,prenom,titre)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    setLivraisons((data ?? []) as Livraison[]);
  }, [patientId]);
  useEffect(() => { charger(); }, [charger]);

  // Liste des livreurs/coordinatrices de l'agence du patient (pour l'assignation).
  useEffect(() => {
    if (!peutGerer) return;
    const supabase = createClient();
    (async () => {
      const { data: pat } = await supabase.from("patient").select("agence_id").eq("id", patientId).maybeSingle();
      let q = supabase.from("professionnel").select("id,nom,prenom,titre,role,agence_id").in("role", ["livreur", "coordinatrice"]);
      const agence = (pat as { agence_id?: string | null } | null)?.agence_id ?? null;
      if (agence) q = q.eq("agence_id", agence);
      const { data: pros } = await q.order("nom");
      setLivreurs(
        (pros ?? []).map((p) => ({
          value: p.id as string,
          label: `${[p.titre, p.prenom, p.nom].filter(Boolean).join(" ")} · ${p.role === "livreur" ? "Livreur" : "Coordinatrice"}`,
        }))
      );
    })();
  }, [patientId, peutGerer]);

  async function programmer() {
    setBusy(true);
    // Livreur choisi → assignation directe (planifiée) ; sinon → pool (à programmer).
    const payload = {
      patient_id: patientId,
      prestataire_id: prestataireId,
      statut: choix ? "planifiee" : "a_programmer",
      livreur_id: choix || null,
    };
    const { error } = await createClient().from("livraison").insert(payload);
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    setChoix("");
    charger();
  }
  // (Ré)assigner le livreur d'une livraison, ou la remettre au pool (livreurId vide).
  async function reassigner(id: string, livreurId: string) {
    const patch = livreurId
      ? { livreur_id: livreurId, statut: "planifiee", updated_at: new Date().toISOString() }
      : { livreur_id: null, statut: "a_programmer", updated_at: new Date().toISOString() };
    const { error } = await createClient().from("livraison").update(patch).eq("id", id);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }
  // Options du sélecteur de livreur (avec le livreur actuel s'il n'est pas dans la liste).
  const optionsLivreur = (l: Livraison) => {
    const base = [{ value: "", label: "— Pool (aucun livreur) —" }, ...livreurs];
    if (l.livreur_id && !livreurs.some((x) => x.value === l.livreur_id)) {
      base.push({ value: l.livreur_id, label: nomPro(l.livreur) || "Livreur actuel" });
    }
    return base;
  };
  async function supprimer(id: string) {
    if (!confirm("Supprimer cette livraison à programmer ?")) return;
    const { error } = await createClient().from("livraison").delete().eq("id", id);
    if (error) { alert("Échec : " + error.message); return; }
    setLivraisons((arr) => arr.filter((l) => l.id !== id));
  }

  const badge = (s: string) =>
    s === "livree" ? <span className="badge bg-green-100 text-ok">Livrée</span>
      : s === "planifiee" ? <span className="badge bg-sky-100 text-sky-700">Prise en charge</span>
        : <span className="badge bg-amber-100 text-attention">À programmer</span>;

  return (
    <section className="card grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-600">Livraisons</h2>
        {peutGerer && (
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <div className="w-full sm:w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Qui livre ?</label>
              <Select
                value={choix}
                onChange={setChoix}
                placeholder="— Laisser au pool —"
                options={[{ value: "", label: "— Laisser au pool —" }, ...livreurs]}
              />
            </div>
            <button onClick={programmer} disabled={busy} className="btn-primary px-3 py-2 text-sm disabled:opacity-50">
              {busy ? "…" : "Programmer"}
            </button>
          </div>
        )}
      </div>
      {peutGerer && livraisons.some((l) => l.statut === "a_programmer" && !l.livreur_id) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-attention">
          ⚠️ Livraison à attribuer — indiquez qui livre.
        </p>
      )}
      {livraisons.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune livraison. {peutGerer ? "Choisissez un livreur (ou laissez au pool de l'agence) puis « Programmer »." : ""}</p>
      ) : (
        <div className="grid gap-2">
          {livraisons.map((l) => (
            <div key={l.id} className="grid grid-cols-1 gap-2 rounded-xl border border-rose-100 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {badge(l.statut)}
                {!peutGerer || l.statut === "livree" ? (
                  l.livreur_id ? (
                    <span className="text-slate-600">Livreur : {nomPro(l.livreur)}</span>
                  ) : (
                    <span className="text-slate-400">En attente d&apos;un livreur</span>
                  )
                ) : changeId === l.id ? (
                  <div className="w-52">
                    <Select
                      value={l.livreur_id ?? ""}
                      onChange={(v) => { reassigner(l.id, v); setChangeId(null); }}
                      placeholder="Choisir un livreur"
                      options={optionsLivreur(l)}
                    />
                  </div>
                ) : l.livreur_id ? (
                  <span className="text-slate-600">
                    Livreur : {nomPro(l.livreur)}
                    <button onClick={() => setChangeId(l.id)} className="ml-2 text-xs font-medium text-brand hover:underline">Changer</button>
                  </span>
                ) : (
                  <button onClick={() => setChangeId(l.id)} className="text-sm font-medium text-brand hover:underline">Attribuer un livreur</button>
                )}
                {l.date_prevue && <span className="text-slate-500">· {fmt(l.date_prevue)}</span>}
              </div>
              {peutGerer && l.statut === "a_programmer" && (
                <button onClick={() => supprimer(l.id)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-critique hover:bg-red-50">Supprimer</button>
              )}
              </div>
              {peutGerer && <LignesLivraison livraisonId={l.id} editable={peutPanier && l.statut !== "livree"} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Articles attachés à une livraison (sortie de stock). Réservé tant que la
// livraison n'est pas livrée ; décrémenté du stock au passage « Livrée ».
function LignesLivraison({ livraisonId, editable }: { livraisonId: string; editable: boolean }) {
  type LigneArt = { id: string; article_code: string; quantite: number; designation: string };
  type ArtRow = { code: string; designation: string };
  type SelLigne = { id: string; article_code: string; quantite: number; article: { designation: string } | { designation: string }[] | null };
  const [lignes, setLignes] = useState<LigneArt[]>([]);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ArtRow[]>([]);
  const [ouvert, setOuvert] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("livraison_ligne")
      .select("id,article_code,quantite,article:article_code(designation)")
      .eq("livraison_id", livraisonId);
    setLignes(
      ((data ?? []) as unknown as SelLigne[]).map((r) => ({
        id: r.id, article_code: r.article_code, quantite: r.quantite,
        designation: (Array.isArray(r.article) ? r.article[0]?.designation : r.article?.designation) ?? "",
      }))
    );
  }, [livraisonId]);
  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    const t = recherche.trim().replace(/[(),%]/g, " ").trim();
    if (t.length < 2) { setResultats([]); return; }
    let annule = false;
    createClient().from("article").select("code,designation").or(`designation.ilike.%${t}%,code.ilike.%${t}%`).limit(12)
      .then(({ data }) => { if (!annule) setResultats((data ?? []) as ArtRow[]); });
    return () => { annule = true; };
  }, [recherche]);

  async function ajouter(a: ArtRow) {
    const { error } = await createClient().from("livraison_ligne").insert({ livraison_id: livraisonId, article_code: a.code, quantite: 1 });
    if (error) { alert("Échec : " + error.message); return; }
    setRecherche(""); setResultats([]); charger();
  }
  async function majQ(id: string, q: number) {
    if (isNaN(q) || q < 1) return;
    await createClient().from("livraison_ligne").update({ quantite: q }).eq("id", id);
    charger();
  }
  async function retirer(id: string) {
    await createClient().from("livraison_ligne").delete().eq("id", id);
    charger();
  }

  if (!editable && lignes.length === 0) return null;

  return (
    <div className="rounded-lg bg-rose-50/40 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Articles{lignes.length > 0 ? ` (${lignes.length})` : ""}</span>
        {editable && <button onClick={() => setOuvert((v) => !v)} className="text-xs font-medium text-brand hover:underline">{ouvert ? "Fermer" : "+ Ajouter"}</button>}
      </div>
      {lignes.length > 0 && (
        <div className="mt-1 grid grid-cols-1 gap-1">
          {lignes.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-slate-600">{l.designation}</span>
              <div className="flex shrink-0 items-center gap-1">
                {editable ? (
                  <>
                    <input type="number" min={1} defaultValue={l.quantite} onBlur={(e) => majQ(l.id, parseInt(e.target.value, 10))} className="input w-14 px-1 py-0.5 text-right text-xs" />
                    <button onClick={() => retirer(l.id)} className="px-1 text-critique" title="Retirer">✕</button>
                  </>
                ) : (
                  <span className="font-semibold text-slate-700">×{l.quantite}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {editable && ouvert && (
        <div className="mt-1.5 grid grid-cols-1 gap-1">
          <input className="input py-1 text-xs" placeholder="Rechercher un article…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {resultats.map((a) => (
            <button key={a.code} onClick={() => ajouter(a)} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-rose-100">
              <span className="min-w-0 truncate text-slate-700">{a.designation}</span>
              <span className="shrink-0 text-brand">+ ajouter</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
