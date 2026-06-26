"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";

type Prestataire = { id: string; nom: string };
type Region = { id: string; nom: string; prestataire_id: string };
type Agence = { id: string; nom: string; region_id: string };

export default function StructurePage() {
  const pro = useProSession();
  const niveau = pro?.niveau ?? 3;
  const estN0 = niveau === 0;

  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [agences, setAgences] = useState<Agence[]>([]);

  // Création de région (niveau 0)
  const [presta, setPresta] = useState("");
  const [nomRegion, setNomRegion] = useState("");
  // Saisie d'agence par région (id région -> nom en cours)
  const [nomAgence, setNomAgence] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: regs }, { data: ags }, { data: prs }] = await Promise.all([
      supabase.from("region").select("id,nom,prestataire_id").order("nom"),
      supabase.from("agence").select("id,nom,region_id").order("nom"),
      estN0 ? supabase.from("prestataire").select("id,nom").order("nom") : Promise.resolve({ data: [] }),
    ]);
    setRegions((regs ?? []) as Region[]);
    setAgences((ags ?? []) as Agence[]);
    setPrestataires((prs ?? []) as Prestataire[]);
    if (prs && prs.length === 1) setPresta(prs[0].id);
  }, [estN0]);

  useEffect(() => { charger(); }, [charger]);

  async function ajouterRegion() {
    if (!nomRegion.trim() || !presta) return;
    setBusy(true);
    await createClient().from("region").insert({ prestataire_id: presta, nom: nomRegion.trim() });
    setNomRegion("");
    setBusy(false);
    charger();
  }

  async function ajouterAgence(regionId: string) {
    const nom = (nomAgence[regionId] ?? "").trim();
    if (!nom) return;
    setBusy(true);
    await createClient().from("agence").insert({ region_id: regionId, nom });
    setNomAgence((m) => ({ ...m, [regionId]: "" }));
    setBusy(false);
    charger();
  }

  async function supprimerAgence(id: string) {
    if (!confirm("Supprimer cette agence ? Le personnel et les patients rattachés seront détachés.")) return;
    await createClient().from("agence").delete().eq("id", id);
    charger();
  }

  async function supprimerRegion(id: string) {
    if (!confirm("Supprimer cette région et toutes ses agences ?")) return;
    await createClient().from("region").delete().eq("id", id);
    charger();
  }

  if (pro && niveau > 1) {
    return <div className="card text-sm text-slate-500">La gestion de la structure est réservée aux niveaux 0 et 1.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl grid gap-6">
      <h1 className="text-2xl font-bold text-slate-800">Structure — régions & agences</h1>

      {/* Création de région (niveau 0) */}
      {estN0 && (
        <div className="card grid gap-3">
          <p className="text-sm font-semibold text-slate-700">Ajouter une région</p>
          {prestataires.length > 1 && (
            <Select
              value={presta}
              onChange={setPresta}
              placeholder="— Choisir un prestataire —"
              options={prestataires.map((p) => ({ value: p.id, label: p.nom }))}
            />
          )}
          <div className="flex gap-2">
            <input className="input flex-1" value={nomRegion} onChange={(e) => setNomRegion(e.target.value)} placeholder="ex. Languedoc-Roussillon" />
            <button onClick={ajouterRegion} disabled={busy || !nomRegion.trim() || !presta} className="btn-primary px-4 disabled:opacity-50">Ajouter</button>
          </div>
        </div>
      )}

      {/* Liste des régions + agences */}
      {regions.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune région{estN0 ? " — crée-en une ci-dessus." : "."}</p>
      ) : (
        regions.map((r) => {
          const ags = agences.filter((a) => a.region_id === r.id);
          return (
            <div key={r.id} className="card grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">{r.nom}</h2>
                {estN0 && (
                  <button onClick={() => supprimerRegion(r.id)} className="text-xs text-slate-400 hover:text-critique">Supprimer la région</button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {ags.length === 0 ? (
                  <span className="text-sm text-slate-400">Aucune agence</span>
                ) : (
                  ags.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-slate-700">
                      {a.nom}
                      <button onClick={() => supprimerAgence(a.id)} className="text-slate-400 hover:text-critique" title="Supprimer">✕</button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={nomAgence[r.id] ?? ""}
                  onChange={(e) => setNomAgence((m) => ({ ...m, [r.id]: e.target.value }))}
                  placeholder="Nouvelle agence (ex. Montpellier)"
                />
                <button onClick={() => ajouterAgence(r.id)} disabled={busy || !(nomAgence[r.id] ?? "").trim()} className="btn-secondary px-4 disabled:opacity-50">+ Agence</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
