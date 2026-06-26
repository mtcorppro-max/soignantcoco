"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { ProtocoleEditor, protocoleVide, protocolePropre, type Protocole } from "@/components/protocole";

const SPECIALITES = [
  "Chirurgien orthopédique", "Chirurgien cardiaque", "Chirurgien vasculaire", "Chirurgien thoracique",
  "Chirurgien viscéral / digestif", "Chirurgien urologique", "Chirurgien gynécologique", "Chirurgien plasticien",
  "Chirurgien maxillo-facial", "Chirurgien ORL", "Neurochirurgien", "Ophtalmologue", "Cardiologue",
  "Pneumologue", "Gastro-entérologue", "Néphrologue", "Endocrinologue", "Rhumatologue", "Dermatologue",
  "Médecin généraliste", "Autre",
];

const VIDE = {
  type: "medecin",
  titre: "Docteur",
  prenom: "",
  nom: "",
  specialite: "",
  telephone: "",
  email: "",
  zone_exercice: "",
};

export default function NouveauSoignantExterne() {
  const pro = useProSession();
  const [f, setF] = useState({ ...VIDE });
  const [protocoles, setProtocoles] = useState<Protocole[]>([protocoleVide()]);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const majProtocole = (i: number, patch: Partial<Protocole>) =>
    setProtocoles((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const ajouterProtocole = () => setProtocoles((arr) => [...arr, protocoleVide()]);
  const supprimerProtocole = (i: number) => setProtocoles((arr) => arr.filter((_, idx) => idx !== i));

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const estMedecin = f.type === "medecin";

  async function enregistrer() {
    setErreur(null);
    if (!f.nom.trim()) { setErreur("Le nom est requis."); return; }
    if (!pro?.prestataire_id) { setErreur("Aucun prestataire associé à votre compte."); return; }
    setBusy(true);
    const { error } = await createClient().from("soignant_externe").insert({
      prestataire_id: pro.prestataire_id,
      type: f.type,
      titre: estMedecin ? f.titre || null : null,
      prenom: f.prenom.trim() || null,
      nom: f.nom.trim(),
      specialite: estMedecin ? f.specialite || null : null,
      telephone: f.telephone.trim() || null,
      email: f.email.trim() || null,
      zone_exercice: estMedecin ? null : f.zone_exercice.trim() || null,
      protocoles: estMedecin ? protocoles.map(protocolePropre) : [],
    });
    setBusy(false);
    if (error) { setErreur("Échec : " + error.message); return; }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="mx-auto max-w-lg card grid gap-4 text-center">
        <p className="text-sm text-slate-600">Soignant externe enregistré ✓</p>
        <p className="text-xs text-slate-400">Il est désormais sélectionnable lors de la création d&apos;un patient.</p>
        <button onClick={() => { setF({ ...VIDE }); setProtocoles([protocoleVide()]); setOk(false); }} className="btn-secondary">Enregistrer un autre</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg grid gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Nouveau soignant externe</h1>
        <p className="mt-1 text-sm text-slate-500">
          Soignant hors entreprise, sans compte AS2CŒUR (médecin, chirurgien ou infirmière libérale).
        </p>
      </div>

      <div className="card grid gap-4">
        <div>
          <label className="label">Type *</label>
          <Select
            value={f.type}
            onChange={(v) => setF((s) => ({ ...s, type: v }))}
            options={[
              { value: "medecin", label: "Médecin / Chirurgien" },
              { value: "infirmiere", label: "Infirmière libérale" },
            ]}
          />
        </div>

        {estMedecin && (
          <>
            <div>
              <label className="label">Titre</label>
              <div className="flex gap-4">
                {(["Interne", "Docteur", "Professeur"] as const).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                    <input type="radio" name="titre" value={t} checked={f.titre === t} onChange={() => setF((s) => ({ ...s, titre: t }))} className="accent-brand" />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Spécialité</label>
              <Select
                value={f.specialite}
                onChange={(v) => setF((s) => ({ ...s, specialite: v }))}
                placeholder="— Choisir une spécialité —"
                options={SPECIALITES.map((x) => ({ value: x, label: x }))}
              />
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Prénom</label>
            <input className="input" value={f.prenom} onChange={set("prenom")} placeholder={estMedecin ? "Jean" : "Marie"} />
          </div>
          <div>
            <label className="label">Nom *</label>
            <input className="input" value={f.nom} onChange={set("nom")} placeholder={estMedecin ? "MARTIN" : "DUPONT"} />
          </div>
        </div>

        {!estMedecin && (
          <div>
            <label className="label">Zone(s) d&apos;exercice</label>
            <input className="input" value={f.zone_exercice} onChange={set("zone_exercice")} placeholder="ex. Montpellier / Hérault" />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={f.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={f.email} onChange={set("email")} placeholder="nom@email.fr" inputMode="email" />
          </div>
        </div>

        {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{erreur}</p>}
        <button onClick={enregistrer} disabled={busy} className="btn-primary py-3">
          {busy ? "Enregistrement…" : "Enregistrer le soignant externe"}
        </button>
      </div>

      {estMedecin && (
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Protocoles & consignes</p>
            <span className="text-xs text-slate-400">{protocoles.length} protocole(s)</span>
          </div>
          <p className="text-sm text-slate-500">
            Un protocole par intervention. Réutilisé automatiquement lors de la création d&apos;un patient.
          </p>
          {protocoles.map((p, i) => (
            <ProtocoleEditor
              key={i}
              index={i}
              value={p}
              onChange={(patch) => majProtocole(i, patch)}
              onRemove={() => supprimerProtocole(i)}
              canRemove={protocoles.length > 1}
            />
          ))}
          <button
            type="button"
            onClick={ajouterProtocole}
            className="justify-self-start rounded-lg border border-dashed border-rose-300 px-4 py-2 text-sm font-medium text-brand hover:bg-rose-50"
          >
            + Ajouter un protocole (autre intervention)
          </button>
        </div>
      )}
    </div>
  );
}
