"use client";

import { useState } from "react";

type Prestataire = { id: string; nom: string };

type Molecule = { nom: string; predefini: boolean; coche: boolean; posologie: string };

const predef = (noms: string[]): Molecule[] =>
  noms.map((nom) => ({ nom, predefini: true, coche: false, posologie: "" }));

const MOLECULES_INIT: Molecule[] = predef(["Acupan", "Primperan", "Spasfon"]);
const MOLECULES_PER_OS_INIT: Molecule[] = predef(["Paracétamol", "Lovenox", "Topalgic"]);

const VIDE = {
  nom: "",
  prenom: "",
  titre: "Docteur",
  email: "",
  motDePasse: "",
  role: "chirurgien",
  prestataire_id: "",
  telephone: "",
  specialite: "",
  cabinets: "",
  secretariat_nom: "",
  secretariat_email: "",
  secretariat_tel: "",
  duree_prise_en_charge: "",
  pansement: false,
  pansement_detail: "",
  cryotherapie: false,
  cryotherapie_duree: "",
  cryotherapie_machine: "",
  pharmacie_per_os: false,
  materiel: false,
  materiel_paramedical: "",
  protocole: "",
};

// Formulaire de création d'un compte soignant.
// Si `prestataires` est fourni (contexte admin), un sélecteur de prestataire
// est affiché et envoyé ; sinon le compte est rattaché au prestataire de la
// coordinatrice connectée (géré côté API).
export function SoignantForm({ prestataires }: { prestataires?: Prestataire[] }) {
  const [form, setForm] = useState({ ...VIDE });
  const [joursActifs, setJoursActifs] = useState<number[]>([]);
  const [molecules, setMolecules] = useState<Molecule[]>(MOLECULES_INIT.map((m) => ({ ...m })));
  const [moleculesPerOs, setMoleculesPerOs] = useState<Molecule[]>(MOLECULES_PER_OS_INIT.map((m) => ({ ...m })));
  const [envoiOrdo, setEnvoiOrdo] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cree, setCree] = useState<{ email: string; motDePasse: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () => {
    setForm({ ...VIDE });
    setJoursActifs([]);
    setMolecules(MOLECULES_INIT.map((m) => ({ ...m })));
    setMoleculesPerOs(MOLECULES_PER_OS_INIT.map((m) => ({ ...m })));
    setEnvoiOrdo([]);
  };

  const propres = (arr: Molecule[]) =>
    arr.filter((m) => m.coche && m.nom.trim()).map((m) => ({ nom: m.nom.trim(), posologie: m.posologie.trim() }));

  const toggleEnvoiOrdo = (cible: string) =>
    setEnvoiOrdo((prev) => (prev.includes(cible) ? prev.filter((c) => c !== cible) : [...prev, cible]));

  const estChirurgien = form.role === "chirurgien";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/soignants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          jours_suivi: joursActifs,
          molecules: propres(molecules),
          medicaments_per_os: propres(moleculesPerOs),
          envoi_ordo: envoiOrdo,
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
          <select className="select" value={form.role} onChange={set("role")}>
            <option value="chirurgien">Chirurgien / Médecin</option>
            <option value="coordinatrice">Infirmière coordinatrice</option>
            <option value="delegue">Délégué médical</option>
          </select>
        </div>
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
            <select className="select" value={form.prestataire_id} onChange={set("prestataire_id")} required>
              <option value="">— Choisir un prestataire —</option>
              {prestataires.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Spécialité</label>
                <input className="input" value={form.specialite} onChange={set("specialite")} placeholder="ex. Chirurgien orthopédique" />
              </div>
              <div>
                <label className="label">Téléphone (personnel)</label>
                <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" />
              </div>
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
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Consigne prescripteur</p>
            <div>
              <label className="label">Combien de jours de prise en charge ?</label>
              <input
                className="input"
                value={form.duree_prise_en_charge}
                onChange={(e) => {
                  set("duree_prise_en_charge")(e);
                  setJoursActifs([]);
                }}
                placeholder="ex. 30"
                inputMode="numeric"
              />
            </div>
            {(() => {
              const nb = parseInt(form.duree_prise_en_charge, 10);
              if (!nb || nb < 1) return null;
              const total = Math.min(nb, 60);
              return (
                <div>
                  <label className="label">Jours de suivi</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Array.from({ length: total }, (_, i) => i + 1).map((j) => {
                      const actif = joursActifs.includes(j);
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={() =>
                            setJoursActifs((prev) =>
                              actif ? prev.filter((x) => x !== j) : [...prev, j].sort((a, b) => a - b)
                            )
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
              );
            })()}
            <ListeMolecules
              titre="Molécules prescrites (IV)"
              items={molecules}
              onChange={setMolecules}
              posologiePlaceholder="Posologie IV (ex. 1 amp. IV x3/j)"
            />

            {/* Pansement */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="label mb-0">Pansement</label>
                <OuiNon valeur={form.pansement} onChange={(v) => setForm((f) => ({ ...f, pansement: v }))} nom="pansement" />
              </div>
              {form.pansement && (
                <textarea
                  className="input"
                  rows={3}
                  value={form.pansement_detail}
                  onChange={set("pansement_detail")}
                  placeholder="Type de pansement, fréquence de réfection, produits…"
                />
              )}
            </div>

            {/* Cryothérapie */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="label mb-0">Cryothérapie</label>
                <OuiNon valeur={form.cryotherapie} onChange={(v) => setForm((f) => ({ ...f, cryotherapie: v }))} nom="cryotherapie" />
              </div>
              {form.cryotherapie && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="input"
                    value={form.cryotherapie_machine}
                    onChange={set("cryotherapie_machine")}
                    placeholder="Quelle machine ?"
                  />
                  <input
                    className="input"
                    value={form.cryotherapie_duree}
                    onChange={set("cryotherapie_duree")}
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
                  const actif = envoiOrdo.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleEnvoiOrdo(v)}
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
                <OuiNon valeur={form.pharmacie_per_os} onChange={(v) => setForm((f) => ({ ...f, pharmacie_per_os: v }))} nom="pharmacie_per_os" />
              </div>
              {form.pharmacie_per_os && (
                <ListeMolecules
                  items={moleculesPerOs}
                  onChange={setMoleculesPerOs}
                  posologiePlaceholder="Posologie Per os (ex. 1 g x3/j)"
                />
              )}
            </div>

            {/* Matériel paramédical */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="label mb-0">Matériel paramédical à commander</label>
                <OuiNon valeur={form.materiel} onChange={(v) => setForm((f) => ({ ...f, materiel: v }))} nom="materiel" />
              </div>
              {form.materiel && (
                <textarea
                  className="input"
                  rows={3}
                  value={form.materiel_paramedical}
                  onChange={set("materiel_paramedical")}
                  placeholder="ex. Attelle de genou, bas de contention…"
                />
              )}
            </div>

            <div>
              <label className="label">Autres consignes</label>
              <textarea
                className="input"
                rows={5}
                value={form.protocole}
                onChange={set("protocole")}
                placeholder={"Allo docteur si urgence\nJour de consultation du médecin…"}
              />
            </div>
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
        <div key={i} className="grid gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3">
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
