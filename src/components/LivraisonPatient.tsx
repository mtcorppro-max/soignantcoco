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

  // Livreurs et coordinatrices de l'agence du patient, désignables comme livreur.
  const [livreurs, setLivreurs] = useState<{ value: string; label: string }[]>([]);
  const [choix, setChoix] = useState(""); // "" = laisser au pool

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
      {livraisons.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune livraison. {peutGerer ? "Choisissez un livreur (ou laissez au pool de l'agence) puis « Programmer »." : ""}</p>
      ) : (
        <div className="grid gap-2">
          {livraisons.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {badge(l.statut)}
                {l.livreur_id ? (
                  <span className="text-slate-600">Livreur : {nomPro(l.livreur)}</span>
                ) : (
                  <span className="text-slate-400">En attente d&apos;un livreur</span>
                )}
                {l.date_prevue && <span className="text-slate-500">· {fmt(l.date_prevue)}</span>}
              </div>
              {peutGerer && l.statut === "a_programmer" && (
                <button onClick={() => supprimer(l.id)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-critique hover:bg-red-50">Supprimer</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
