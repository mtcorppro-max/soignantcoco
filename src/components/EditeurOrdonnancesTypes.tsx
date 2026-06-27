"use client";

import { useState } from "react";
import { MODELES_ORDONNANCE, type OrdonnanceType } from "@/lib/ordonnances";
import { Select } from "@/components/Select";
import { ChampsOrdonnance } from "@/components/ChampsOrdonnance";

export type { OrdonnanceType };

const MODELE_DEFAUT = MODELES_ORDONNANCE[0];

// Gestion des « ordonnances types » d'un médecin (modèles pré-remplis réutilisés
// lors de la génération d'une ordonnance : seul le patient change).
export function EditeurOrdonnancesTypes({ value, onChange }: { value: OrdonnanceType[]; onChange: (v: OrdonnanceType[]) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  const ajouter = () => {
    const t: OrdonnanceType = { id: crypto.randomUUID(), nom: "", type: MODELE_DEFAUT.id, contenu: {} };
    onChange([...value, t]);
    setOuvert(t.id);
  };
  const maj = (id: string, patch: Partial<OrdonnanceType>) => onChange(value.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const setChamp = (id: string, key: string, val: unknown) =>
    onChange(value.map((t) => (t.id === id ? { ...t, contenu: { ...t.contenu, [key]: val } } : t)));
  const supprimer = (id: string) => onChange(value.filter((t) => t.id !== id));

  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-500">
        Pré-remplissez des ordonnances récurrentes : elles seront proposées en un clic lors de la génération (seul le patient change).
      </p>

      {value.map((t) => {
        const modele = MODELES_ORDONNANCE.find((m) => m.id === t.type) ?? MODELE_DEFAUT;
        const estOuvert = ouvert === t.id;
        return (
          <div key={t.id} className="rounded-xl border border-rose-100 bg-rose-50/30 p-3">
            <div className="flex items-center gap-2">
              <input
                className="input flex-1" placeholder="Nom de l'ordonnance type (ex. « Acupan IV post-op »)"
                value={t.nom} onChange={(e) => maj(t.id, { nom: e.target.value })}
              />
              <button type="button" onClick={() => setOuvert(estOuvert ? null : t.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-brand hover:bg-rose-50">
                {estOuvert ? "Réduire" : "Remplir"}
              </button>
              <button type="button" onClick={() => supprimer(t.id)} className="rounded-lg border border-rose-200 px-2 py-2 text-sm text-critique hover:bg-red-50">✕</button>
            </div>
            {estOuvert && (
              <div className="mt-3 grid gap-3 border-t border-rose-100 pt-3">
                {MODELES_ORDONNANCE.length > 1 && (
                  <div>
                    <label className="label">Type d&apos;ordonnance</label>
                    <Select
                      value={t.type}
                      onChange={(v) => maj(t.id, { type: v, contenu: {} })}
                      options={MODELES_ORDONNANCE.map((m) => ({ value: m.id, label: m.label }))}
                    />
                  </div>
                )}
                <ChampsOrdonnance champs={modele.champs} valeurs={t.contenu} set={(k, val) => setChamp(t.id, k, val)} />
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={ajouter} className="justify-self-start rounded-lg border border-dashed border-rose-300 px-4 py-2 text-sm font-semibold text-brand hover:bg-rose-50">
        + Ajouter une ordonnance type
      </button>
    </div>
  );
}
