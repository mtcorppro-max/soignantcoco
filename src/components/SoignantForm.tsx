"use client";

import { useEffect, useState } from "react";
import { genererPdfConsignes } from "@/lib/pdfConsignes";
import { Select } from "@/components/Select";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { optionsNiveau } from "@/lib/niveaux";

type Prestataire = { id: string; nom: string };

type Molecule = { nom: string; predefini: boolean; coche: boolean; posologie: string };

const predef = (noms: string[]): Molecule[] =>
  noms.map((nom) => ({ nom, predefini: true, coche: false, posologie: "" }));

const MOLECULES_INIT = (): Molecule[] => predef(["Acupan", "Primperan", "Spasfon"]);
const MOLECULES_PER_OS_INIT = (): Molecule[] => predef(["Paracétamol", "Lovenox", "Topalgic"]);

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
  "Médecin généraliste",
  "Autre",
];

// Un protocole = une intervention chirurgicale avec sa prise en charge propre.
type Protocole = {
  intervention: string;
  duree: string;
  jours: number[];
  molecules: Molecule[];
  pansement: boolean;
  pansement_detail: string;
  cryotherapie: boolean;
  cryotherapie_duree: string;
  cryotherapie_machine: string;
  envoi_ordo: string[];
  pharmacie_per_os: boolean;
  medicaments_per_os: Molecule[];
  materiel: boolean;
  materiel_paramedical: string;
  autres: string;
};

const protocoleVide = (): Protocole => ({
  intervention: "",
  duree: "",
  jours: [],
  molecules: MOLECULES_INIT(),
  pansement: false,
  pansement_detail: "",
  cryotherapie: false,
  cryotherapie_duree: "",
  cryotherapie_machine: "",
  envoi_ordo: [],
  pharmacie_per_os: false,
  medicaments_per_os: MOLECULES_PER_OS_INIT(),
  materiel: false,
  materiel_paramedical: "",
  autres: "",
});

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
  cabinets: "",
  secretariat_nom: "",
  secretariat_email: "",
  secretariat_tel: "",
};

const propres = (arr: Molecule[]) =>
  arr.filter((m) => m.coche && m.nom.trim()).map((m) => ({ nom: m.nom.trim(), posologie: m.posologie.trim() }));

// Nettoie un protocole pour l'envoi API / le PDF.
const protocolePropre = (p: Protocole) => ({
  intervention: p.intervention.trim(),
  duree: p.duree,
  jours: p.jours,
  molecules: propres(p.molecules),
  pansement: p.pansement,
  pansement_detail: p.pansement ? p.pansement_detail.trim() : "",
  cryotherapie: p.cryotherapie,
  cryotherapie_duree: p.cryotherapie ? p.cryotherapie_duree.trim() : "",
  cryotherapie_machine: p.cryotherapie ? p.cryotherapie_machine.trim() : "",
  envoi_ordo: p.envoi_ordo,
  pharmacie_per_os: p.pharmacie_per_os,
  medicaments_per_os: p.pharmacie_per_os ? propres(p.medicaments_per_os) : [],
  materiel: p.materiel,
  materiel_paramedical: p.materiel ? p.materiel_paramedical.trim() : "",
  autres: p.autres.trim(),
});

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
  const [protocoles, setProtocoles] = useState<Protocole[]>([protocoleVide()]);
  const [agenceId, setAgenceId] = useState("");
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
    setProtocoles([protocoleVide()]);
    setAgenceId("");
    setRegionId("");
  };

  const majProtocole = (i: number, patch: Partial<Protocole>) =>
    setProtocoles((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const ajouterProtocole = () => setProtocoles((arr) => [...arr, protocoleVide()]);
  const supprimerProtocole = (i: number) => setProtocoles((arr) => arr.filter((_, idx) => idx !== i));

  const estChirurgien = form.role === "chirurgien";

  const telechargerPdf = () =>
    genererPdfConsignes({
      titre: form.titre,
      prenom: form.prenom,
      nom: form.nom,
      specialite: form.specialite,
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
    if ((form.niveau === "2" || form.niveau === "3") && !agenceId) {
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
          agence_id: (form.niveau === "2" || form.niveau === "3") ? agenceId : null,
          region_id: form.niveau === "1" ? regionId : null,
          protocoles: estChirurgien ? protocoles.map(protocolePropre) : [],
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
            onChange={(v) => setForm((f) => ({ ...f, role: v, niveau: v === "manager" ? "1" : f.niveau }))}
            options={[
              { value: "chirurgien", label: "Chirurgien / Médecin" },
              { value: "coordinatrice", label: "Infirmière coordinatrice" },
              ...(niveauCreateur === 0 ? [{ value: "manager", label: "Manager (région)" }] : []),
              { value: "delegue", label: "Délégué médical" },
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
        {form.role !== "manager" && (
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
        {(form.niveau === "2" || form.niveau === "3") && (
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
            <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" />
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
            <div>
              <label className="label">Téléphone (personnel)</label>
              <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" />
            </div>
            <div>
              <label className="label">Adresse du / des cabinets</label>
              <input className="input" value={form.cabinets} onChange={set("cabinets")} placeholder="Clinique du Parc à Castelnau-le-Lez / …" />
            </div>
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

// Éditeur d'un protocole (intervention + prise en charge complète).
function ProtocoleEditor({
  index,
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  value: Protocole;
  onChange: (patch: Partial<Protocole>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const nb = parseInt(value.duree, 10);
  const total = nb && nb > 0 ? Math.min(nb, 60) : 0;
  const toggleEnvoi = (cible: string) =>
    onChange({
      envoi_ordo: value.envoi_ordo.includes(cible)
        ? value.envoi_ordo.filter((c) => c !== cible)
        : [...value.envoi_ordo, cible],
    });

  return (
    <div className="grid gap-4 rounded-2xl border-2 border-rose-100 bg-rose-50/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
          Protocole {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-rose-100 hover:text-critique"
            title="Supprimer ce protocole"
          >
            ✕ Supprimer
          </button>
        )}
      </div>

      <div>
        <label className="label">Intervention</label>
        <input
          className="input"
          value={value.intervention}
          onChange={(e) => onChange({ intervention: e.target.value })}
          placeholder="ex. Prothèse totale de genou, Hallux Valgus…"
        />
      </div>

      <div>
        <label className="label">Combien de jours de prise en charge ?</label>
        <input
          className="input"
          value={value.duree}
          onChange={(e) => onChange({ duree: e.target.value, jours: [] })}
          placeholder="ex. 7"
          inputMode="numeric"
        />
      </div>

      {total > 0 && (
        <div>
          <label className="label">Jours de suivi</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {Array.from({ length: total }, (_, k) => k + 1).map((j) => {
              const actif = value.jours.includes(j);
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() =>
                    onChange({
                      jours: actif
                        ? value.jours.filter((x) => x !== j)
                        : [...value.jours, j].sort((a, b) => a - b),
                    })
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    actif
                      ? "border-brand bg-brand text-white"
                      : "border-rose-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                  }`}
                >
                  J{j}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ListeMolecules
        titre="Molécules prescrites (IV)"
        items={value.molecules}
        onChange={(molecules) => onChange({ molecules })}
        posologiePlaceholder="Posologie IV (ex. 1 amp. IV x3/j)"
      />

      {/* Pansement */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">Pansement</label>
          <OuiNon valeur={value.pansement} onChange={(v) => onChange({ pansement: v })} nom={`pansement-${index}`} />
        </div>
        {value.pansement && (
          <textarea
            className="input"
            rows={3}
            value={value.pansement_detail}
            onChange={(e) => onChange({ pansement_detail: e.target.value })}
            placeholder="Type de pansement, fréquence de réfection, produits…"
          />
        )}
      </div>

      {/* Cryothérapie */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">Cryothérapie</label>
          <OuiNon valeur={value.cryotherapie} onChange={(v) => onChange({ cryotherapie: v })} nom={`cryo-${index}`} />
        </div>
        {value.cryotherapie && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="input"
              value={value.cryotherapie_machine}
              onChange={(e) => onChange({ cryotherapie_machine: e.target.value })}
              placeholder="Quelle machine ?"
            />
            <input
              className="input"
              value={value.cryotherapie_duree}
              onChange={(e) => onChange({ cryotherapie_duree: e.target.value })}
              placeholder="Durée de prêt (ex. 15 jours)"
            />
          </div>
        )}
      </div>

      {/* Envoi Ordo / CR */}
      <div className="grid gap-2">
        <label className="label mb-0">Envoi des ordonnances / comptes rendus</label>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "secretariat", l: "Secrétariat" },
            { v: "medecin", l: "Médecin" },
          ].map(({ v, l }) => {
            const actif = value.envoi_ordo.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleEnvoi(v)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  actif
                    ? "border-brand bg-brand text-white"
                    : "border-rose-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pharmacie / Per os */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">Médicaments Per os à commander en pharmacie ?</label>
          <OuiNon valeur={value.pharmacie_per_os} onChange={(v) => onChange({ pharmacie_per_os: v })} nom={`peros-${index}`} />
        </div>
        {value.pharmacie_per_os && (
          <ListeMolecules
            items={value.medicaments_per_os}
            onChange={(medicaments_per_os) => onChange({ medicaments_per_os })}
            posologiePlaceholder="Posologie Per os (ex. 1 g x3/j)"
          />
        )}
      </div>

      {/* Matériel paramédical */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">Matériel paramédical à commander</label>
          <OuiNon valeur={value.materiel} onChange={(v) => onChange({ materiel: v })} nom={`materiel-${index}`} />
        </div>
        {value.materiel && (
          <textarea
            className="input"
            rows={3}
            value={value.materiel_paramedical}
            onChange={(e) => onChange({ materiel_paramedical: e.target.value })}
            placeholder="ex. Attelle de genou, bas de contention…"
          />
        )}
      </div>

      <div>
        <label className="label">Autres consignes</label>
        <textarea
          className="input"
          rows={4}
          value={value.autres}
          onChange={(e) => onChange({ autres: e.target.value })}
          placeholder={"Allo docteur si urgence\nJour de consultation du médecin…"}
        />
      </div>
    </div>
  );
}

function ListeMolecules({
  titre,
  items,
  onChange,
  posologiePlaceholder,
}: {
  titre?: string;
  items: Molecule[];
  onChange: (m: Molecule[]) => void;
  posologiePlaceholder: string;
}) {
  const maj = (i: number, champ: Partial<Molecule>) =>
    onChange(items.map((m, idx) => (idx === i ? { ...m, ...champ } : m)));
  const ajouter = () => onChange([...items, { nom: "", predefini: false, coche: true, posologie: "" }]);
  const supprimer = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="grid gap-3">
      {titre && <label className="label">{titre}</label>}
      {items.map((m, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-rose-100 bg-white p-3">
          <div className="flex items-center gap-2">
            {m.predefini ? (
              <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={m.coche}
                  onChange={(e) => maj(i, { coche: e.target.checked })}
                  className="h-4 w-4 accent-brand"
                />
                {m.nom}
              </label>
            ) : (
              <>
                <input
                  className="input flex-1"
                  value={m.nom}
                  onChange={(e) => maj(i, { nom: e.target.value })}
                  placeholder="Nom de la molécule"
                />
                <button
                  type="button"
                  onClick={() => supprimer(i)}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-rose-100 hover:text-critique"
                  title="Retirer cette molécule"
                >
                  ✕
                </button>
              </>
            )}
          </div>
          {m.coche && (
            <input
              className="input"
              value={m.posologie}
              onChange={(e) => maj(i, { posologie: e.target.value })}
              placeholder={posologiePlaceholder}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={ajouter}
        className="justify-self-start rounded-lg border border-dashed border-rose-300 px-3 py-1.5 text-sm font-medium text-brand hover:bg-rose-50"
      >
        + Ajouter une autre molécule
      </button>
    </div>
  );
}

function OuiNon({ valeur, onChange, nom }: { valeur: boolean; onChange: (v: boolean) => void; nom: string }) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, l: "Oui" },
        { v: false, l: "Non" },
      ].map(({ v, l }) => (
        <button
          key={l}
          type="button"
          name={nom}
          onClick={() => onChange(v)}
          className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
            valeur === v
              ? "border-brand bg-brand text-white"
              : "border-rose-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
