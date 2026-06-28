"use client";

import { useEffect, useState } from "react";
import { genererPdfConsignes } from "@/lib/pdfConsignes";
import { Select } from "@/components/Select";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { optionsNiveau } from "@/lib/niveaux";
import { ProtocoleEditor, protocoleVide, protocolePropre, type Protocole } from "@/components/protocole";

type Prestataire = { id: string; nom: string };

const SPECIALITES = [
  "Chirurgien orthopédique",
  "Chirurgien cardiaque",
  "Chirurgien vasculaire",
  "Chirurgien thoracique",
  "Chirurgien viscéral / digestif",
  "Chirurgien urologique",
  "Chirurgien gynécologique",
  "Chirurgien plasticien",
  "Chirurgien maxillo-facial",
  "Chirurgien ORL",
  "Neurochirurgien",
  "Ophtalmologue",
  "Cardiologue",
  "Pneumologue",
  "Gastro-entérologue",
  "Néphrologue",
  "Endocrinologue",
  "Rhumatologue",
  "Dermatologue",
  "Addictologue",
  "Médecin généraliste",
  "Autre",
];

const VIDE = {
  nom: "",
  prenom: "",
  titre: "Docteur",
  email: "",
  motDePasse: "",
  role: "chirurgien",
  niveau: "3",
  prestataire_id: "",
  telephone: "",
  specialite: "",
  rpps: "",
  cabinets: "",
  secretariat_nom: "",
  secretariat_email: "",
  secretariat_tel: "",
  zone_exercice: "",
};

// Formulaire de création d'un compte soignant.
// Si `prestataires` est fourni (contexte admin), un sélecteur de prestataire
// est affiché et envoyé ; sinon le compte est rattaché au prestataire de la
// coordinatrice connectée (géré côté API).
export function SoignantForm({ prestataires }: { prestataires?: Prestataire[] }) {
  const pro = useProSession();
  // Contexte admin (prestataires fournis) = super-admin niveau 0 ; sinon le
  // niveau du créateur connecté. On ne peut octroyer qu'un niveau ≥ au sien.
  const niveauCreateur = prestataires ? 0 : (pro?.niveau ?? 3);
  const niveauxDispo = optionsNiveau(niveauCreateur);

  const [form, setForm] = useState({ ...VIDE });
  const [recevoirAlertes, setRecevoirAlertes] = useState(false);
  const [protocoles, setProtocoles] = useState<Protocole[]>([protocoleVide()]);
  const [agenceId, setAgenceId] = useState("");
  const [agencesDelegue, setAgencesDelegue] = useState<string[]>([]); // délégué : plusieurs agences
  const [regionId, setRegionId] = useState("");
  const [agences, setAgences] = useState<{ value: string; label: string }[]>([]);
  const [regions, setRegions] = useState<{ value: string; label: string }[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cree, setCree] = useState<{ email: string; motDePasse: string } | null>(null);

  // Régions (pour niveau 1) et agences (pour niveau 2/3) de rattachement.
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("region").select("id,nom"),
      supabase.from("agence").select("id,nom,region_id"),
    ]).then(([{ data: regs }, { data: ags }]) => {
      const nomRegion = new Map((regs ?? []).map((r) => [r.id as string, r.nom as string]));
      setRegions((regs ?? []).map((r) => ({ value: r.id as string, label: r.nom as string })));
      setAgences(
        (ags ?? []).map((a) => ({
          value: a.id as string,
          label: `${nomRegion.get(a.region_id as string) ?? "?"} · ${a.nom}`,
        }))
      );
    });
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () => {
    setForm({ ...VIDE });
    setRecevoirAlertes(false);
    setProtocoles([protocoleVide()]);
    setAgenceId("");
    setAgencesDelegue([]);
    setRegionId("");
  };

  const toggleAgenceDelegue = (id: string) =>
    setAgencesDelegue((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const majProtocole = (i: number, patch: Partial<Protocole>) =>
    setProtocoles((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const ajouterProtocole = () => setProtocoles((arr) => [...arr, protocoleVide()]);
  const supprimerProtocole = (i: number) => setProtocoles((arr) => arr.filter((_, idx) => idx !== i));

  const estChirurgien = form.role === "chirurgien";
  const estPharmacie = form.role === "pharmacie";

  const telechargerPdf = () =>
    genererPdfConsignes({
      titre: form.titre,
      prenom: form.prenom,
      nom: form.nom,
      specialite: form.specialite,
      rpps: form.rpps,
      telephone: form.telephone,
      cabinets: form.cabinets,
      secretariat_nom: form.secretariat_nom,
      secretariat_email: form.secretariat_email,
      secretariat_tel: form.secretariat_tel,
      protocoles: protocoles.map(protocolePropre),
    });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (form.niveau === "1" && !regionId) {
      setErreur("Choisissez une région de rattachement (ou créez-en une).");
      return;
    }
    const estInfLib = form.role === "infirmiere_liberale";
    const estPharma = form.role === "pharmacie";
    const estDelegue = form.role === "delegue";
    const estDir = form.role === "dirigeant";
    const niveau23 = form.niveau === "2" || form.niveau === "3";
    const sansAgence = estInfLib || estPharma || estDir; // pas de rattachement à une agence
    if (estInfLib && !form.zone_exercice.trim()) {
      setErreur("Indiquez la zone d'exercice de l'infirmière libérale.");
      return;
    }
    if (estDelegue && niveau23 && agencesDelegue.length === 0) {
      setErreur("Choisissez au moins une agence de rattachement.");
      return;
    }
    if (!sansAgence && !estDelegue && niveau23 && !agenceId) {
      setErreur("Choisissez une agence de rattachement (ou créez-en une).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/soignants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          agence_id: estDelegue && niveau23 ? (agencesDelegue[0] ?? null) : (!sansAgence && niveau23 ? agenceId : null),
          agences: estDelegue && niveau23 ? agencesDelegue : null,
          region_id: form.niveau === "1" ? regionId : null,
          protocoles: estChirurgien ? protocoles.map(protocolePropre) : [],
          recevoir_alertes: estChirurgien ? recevoirAlertes : false,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? "Erreur.");
      setCree({ email: j.email, motDePasse: j.motDePasse });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  if (cree) {
    return (
      <div className="card grid gap-4 text-center">
        <p className="text-sm text-slate-500">Compte soignant créé ✓ — identifiants de connexion :</p>
        <div className="grid gap-2 rounded-xl bg-rose-50 p-4 text-left">
          <p className="text-sm"><span className="text-slate-400">Email : </span><span className="font-mono font-semibold text-brand">{cree.email}</span></p>
          <p className="text-sm"><span className="text-slate-400">Mot de passe : </span><span className="font-mono font-semibold text-brand">{cree.motDePasse}</span></p>
        </div>
        <p className="text-xs text-slate-400">
          À transmettre au soignant. Connexion sur l&apos;écran « Équipe médicale ».
        </p>
        {estChirurgien && (
          <button onClick={telechargerPdf} className="btn-primary">
            📄 Télécharger le PDF des consignes
          </button>
        )}
        <button onClick={() => { setCree(null); reset(); }} className="btn-secondary">
          Créer un autre compte
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-5">
      {/* ── Identité & connexion ── */}
      <div className="grid gap-4">
        <div>
          <label className="label">Rôle *</label>
          <Select
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v, niveau: v === "manager" ? "1" : v === "livreur" ? "2" : (v === "infirmiere_liberale" || v === "pharmacie" || v === "chirurgien" || v === "dirigeant") ? "3" : f.niveau }))}
            options={[
              { value: "chirurgien", label: "Chirurgien / Médecin" },
              { value: "coordinatrice", label: "Infirmière coordinatrice" },
              ...(niveauCreateur === 0 ? [{ value: "manager", label: "Manager (région)" }] : []),
              { value: "infirmiere_liberale", label: "Infirmière libérale" },
              { value: "delegue", label: "Délégué médical" },
              { value: "livreur", label: "Livreur" },
              { value: "pharmacie", label: "Pharmacie" },
              ...(niveauCreateur === 0 ? [{ value: "dirigeant", label: "Dirigeant" }] : []),
            ]}
          />
        </div>
        {estChirurgien && (
          <div>
            <label className="label">Spécialité</label>
            <Select
              value={form.specialite}
              onChange={(v) => setForm((f) => ({ ...f, specialite: v }))}
              placeholder="— Choisir une spécialité —"
              options={SPECIALITES.map((s) => ({ value: s, label: s }))}
            />
          </div>
        )}
        {(form.role === "coordinatrice" || form.role === "delegue") && (
          <div>
            <label className="label">Niveau d&apos;accès *</label>
            <Select
              value={form.niveau}
              onChange={(v) => setForm((f) => ({ ...f, niveau: v }))}
              options={niveauxDispo}
            />
          </div>
        )}
        {form.niveau === "1" && (
          <div>
            <label className="label">Région de rattachement *</label>
            <Select
              value={regionId}
              onChange={setRegionId}
              placeholder={regions.length ? "— Choisir une région —" : "Aucune région (créez-en une)"}
              options={regions}
            />
          </div>
        )}
        {(form.niveau === "2" || form.niveau === "3") && form.role === "delegue" && (
          <div>
            <label className="label">Agences de rattachement * <span className="font-normal text-slate-400">(plusieurs possibles)</span></label>
            {agences.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune agence (créez-en une).</p>
            ) : (
              <div className="grid gap-1.5 rounded-xl border border-rose-100 p-3">
                {agences.map((a) => (
                  <label key={a.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={agencesDelegue.includes(a.value)} onChange={() => toggleAgenceDelegue(a.value)} className="accent-brand" />
                    {a.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {(form.niveau === "2" || form.niveau === "3") && form.role !== "infirmiere_liberale" && form.role !== "pharmacie" && form.role !== "delegue" && form.role !== "dirigeant" && (
          <div>
            <label className="label">Agence de rattachement *</label>
            <Select
              value={agenceId}
              onChange={setAgenceId}
              placeholder={agences.length ? "— Choisir une agence —" : "Aucune agence (créez-en une)"}
              options={agences}
            />
          </div>
        )}
        {form.role === "infirmiere_liberale" && (
          <div>
            <label className="label">Zone(s) d&apos;exercice *</label>
            <input
              className="input"
              value={form.zone_exercice}
              onChange={set("zone_exercice")}
              placeholder="ex. Montpellier / Hérault"
            />
            <p className="mt-1 text-xs text-slate-400">Lieu géographique où elle intervient (pas d&apos;agence).</p>
          </div>
        )}
        {estChirurgien && (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Médecin</p>
            <div className="flex gap-4">
              {(["Interne", "Docteur", "Professeur"] as const).map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="titre"
                    value={t}
                    checked={form.titre === t}
                    onChange={() => setForm((f) => ({ ...f, titre: t }))}
                    className="accent-brand"
                  />
                  {t}
                </label>
              ))}
            </div>
          </>
        )}
        {estPharmacie ? (
          <div>
            <label className="label">Raison sociale *</label>
            <input className="input" value={form.nom} onChange={set("nom")} placeholder="Pharmacie du Centre" required />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Prénom *</label>
              <input className="input" value={form.prenom} onChange={set("prenom")} placeholder={estChirurgien ? "Jean" : "Marie"} required />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={form.nom} onChange={set("nom")} placeholder={estChirurgien ? "MARTIN" : "DUPONT"} required />
            </div>
          </div>
        )}
        {prestataires && (
          <div>
            <label className="label">Prestataire *</label>
            <Select
              value={form.prestataire_id}
              onChange={(v) => setForm((f) => ({ ...f, prestataire_id: v }))}
              placeholder="— Choisir un prestataire —"
              options={prestataires.map((p) => ({ value: p.id, label: p.nom }))}
            />
          </div>
        )}
        {!estChirurgien && (
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="0…" inputMode="tel" />
          </div>
        )}
        {estPharmacie && (
          <div>
            <label className="label">Adresse postale</label>
            <input className="input" value={form.cabinets} onChange={set("cabinets")} placeholder="12 rue de la Paix, 34000 Montpellier" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Email de connexion *</label>
            <input className="input" type="email" value={form.email} onChange={set("email")} placeholder="nom@email.fr" inputMode="email" required />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input" value={form.motDePasse} onChange={set("motDePasse")} placeholder="Laisser vide pour générer" />
          </div>
        </div>
      </div>

      {/* ── Consignes chirurgien / médecin ── */}
      {estChirurgien && (
        <>
          <div className="grid gap-4 border-t border-rose-100 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Téléphone (personnel)</label>
                <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" />
              </div>
              <div>
                <label className="label">Numéro RPPS <span className="text-slate-400">(facultatif)</span></label>
                <input className="input" value={form.rpps} onChange={set("rpps")} placeholder="11 chiffres" inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="label">Adresse du lieu d&apos;exercice</label>
              <input className="input" value={form.cabinets} onChange={set("cabinets")} placeholder="Clinique du Parc à Castelnau-le-Lez / …" />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
              <input type="checkbox" checked={recevoirAlertes} onChange={(e) => setRecevoirAlertes(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
              <span className="text-sm text-slate-700">
                Recevoir les alertes patients
                <span className="block text-xs text-slate-400">Par défaut, le médecin ne reçoit pas les alertes patients ni les messages d&apos;organisation interne (astreintes). Cochez si ce médecin souhaite être destinataire des alertes patients.</span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 border-t border-rose-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Secrétariat</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={form.secretariat_nom} onChange={set("secretariat_nom")} placeholder="Nathalie" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.secretariat_email} onChange={set("secretariat_email")} placeholder="secretariat@…" inputMode="email" />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.secretariat_tel} onChange={set("secretariat_tel")} placeholder="0…" inputMode="tel" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-rose-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
                Protocoles par intervention
              </p>
              <span className="text-xs text-slate-400">{protocoles.length} protocole(s)</span>
            </div>
            <p className="-mt-2 text-xs text-slate-400">
              Un protocole par type d&apos;intervention (ex. prothèse de genou 7j, hallux valgus 5j…).
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
              className="justify-self-start rounded-lg border border-dashed border-rose-300 px-4 py-2 text-sm font-semibold text-brand hover:bg-rose-50"
            >
              + Ajouter un protocole / une intervention
            </button>
          </div>

        </>
      )}

      {erreur && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{erreur}</p>
      )}
      <button className="btn-primary py-3" disabled={busy}>
        {busy ? "Création…" : "Créer le compte soignant"}
      </button>
    </form>
  );
}

