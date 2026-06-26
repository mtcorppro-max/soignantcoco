"use client";

// Éditeur de protocole partagé : compte soignant chirurgien/médecin (SoignantForm)
// et soignant externe (NouveauSoignantExterne). Un protocole = une intervention
// avec sa prise en charge propre (molécules, constantes à surveiller, soins…).

import { MESURES, TYPES_MESURE } from "@/lib/constants";

export type Molecule = { nom: string; predefini: boolean; coche: boolean; posologie: string };

const predef = (noms: string[]): Molecule[] =>
  noms.map((nom) => ({ nom, predefini: true, coche: false, posologie: "" }));

const MOLECULES_INIT = (): Molecule[] => predef(["Acupan", "Primperan", "Spasfon"]);
const MOLECULES_PER_OS_INIT = (): Molecule[] => predef(["Paracétamol", "Lovenox", "Topalgic"]);

// Constante à surveiller avec ses seuils d'alerte.
export type ConstanteSurv = { type: string; min: string; max: string };

// Bilan sanguin : voies d'abord possibles et analyses à doser.
const VOIES_BILAN = ["VVP", "PAC", "VVC", "PICCLINE"];
const ANALYSES_BILAN = [
  "NFS", "Plaquettes", "Ionogramme sanguin", "Calcémie", "Urée", "Créatinémie",
  "Albuminémie", "Pré-albumine", "VS", "CRP", "Transaminases SGOT/SGPT",
  "Gamma GT", "Phosphatases alcalines", "Bilirubine totale",
];

export type Protocole = {
  intervention: string;
  duree: string;
  jours: number[];
  molecules: Molecule[];
  pharmacie_per_os: boolean;
  medicaments_per_os: Molecule[];
  surveiller_constantes: boolean;
  constantes: ConstanteSurv[];
  bilan_sanguin: boolean;
  bilan_voie: string;
  bilan_analyses: string[];
  bilan_autres: string;
  pansement: boolean;
  pansement_detail: string;
  cryotherapie: boolean;
  cryotherapie_duree: string;
  cryotherapie_machine: string;
  materiel: boolean;
  materiel_paramedical: string;
  envoi_ordo: string[];
  autres: string;
};

export const protocoleVide = (): Protocole => ({
  intervention: "",
  duree: "",
  jours: [],
  molecules: MOLECULES_INIT(),
  pharmacie_per_os: false,
  medicaments_per_os: MOLECULES_PER_OS_INIT(),
  surveiller_constantes: false,
  constantes: [],
  bilan_sanguin: false,
  bilan_voie: "",
  bilan_analyses: [],
  bilan_autres: "",
  pansement: false,
  pansement_detail: "",
  cryotherapie: false,
  cryotherapie_duree: "",
  cryotherapie_machine: "",
  materiel: false,
  materiel_paramedical: "",
  envoi_ordo: [],
  autres: "",
});

const propres = (arr: Molecule[]) =>
  arr.filter((m) => m.coche && m.nom.trim()).map((m) => ({ nom: m.nom.trim(), posologie: m.posologie.trim() }));

// Nettoie un protocole pour l'envoi API / le PDF.
export const protocolePropre = (p: Protocole) => ({
  intervention: p.intervention.trim(),
  duree: p.duree,
  jours: p.jours,
  molecules: propres(p.molecules),
  pansement: p.pansement,
  pansement_detail: p.pansement ? p.pansement_detail.trim() : "",
  cryotherapie: p.cryotherapie,
  cryotherapie_duree: p.cryotherapie ? p.cryotherapie_duree.trim() : "",
  cryotherapie_machine: p.cryotherapie ? p.cryotherapie_machine.trim() : "",
  pharmacie_per_os: p.pharmacie_per_os,
  medicaments_per_os: p.pharmacie_per_os ? propres(p.medicaments_per_os) : [],
  surveiller_constantes: p.surveiller_constantes,
  constantes: p.surveiller_constantes
    ? p.constantes.map((c) => ({ type: c.type, min: c.min.trim(), max: c.max.trim() }))
    : [],
  bilan_sanguin: p.bilan_sanguin,
  bilan_voie: p.bilan_sanguin ? p.bilan_voie : "",
  bilan_analyses: p.bilan_sanguin ? p.bilan_analyses : [],
  bilan_autres: p.bilan_sanguin ? p.bilan_autres.trim() : "",
  materiel: p.materiel,
  materiel_paramedical: p.materiel ? p.materiel_paramedical.trim() : "",
  envoi_ordo: p.envoi_ordo,
  autres: p.autres.trim(),
});

export function ProtocoleEditor({
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

      {/* Médicaments Per os (juste après les molécules IV) */}
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

      {/* Constantes à surveiller (avec seuils d'alerte) */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">Constantes à surveiller ?</label>
          <OuiNon valeur={value.surveiller_constantes} onChange={(v) => onChange({ surveiller_constantes: v })} nom={`const-${index}`} />
        </div>
        {value.surveiller_constantes && (
          <div className="grid gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3">
            <p className="text-xs text-slate-500">
              Coche les constantes à surveiller, puis indique les seuils d&apos;alerte (min / max).
              Les graphiques du compte rendu de suivi seront générés pour ces constantes.
            </p>
            {TYPES_MESURE.map((t) => {
              const c = value.constantes.find((x) => x.type === t);
              const meta = MESURES[t];
              return (
                <div key={t} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!c}
                      onChange={(e) =>
                        onChange({
                          constantes: e.target.checked
                            ? [...value.constantes, { type: t, min: "", max: "" }]
                            : value.constantes.filter((x) => x.type !== t),
                        })
                      }
                      className="h-4 w-4 accent-brand"
                    />
                    {meta.label} <span className="text-slate-400">({meta.unite})</span>
                  </label>
                  {c && (
                    <div className="flex gap-2">
                      <input
                        className="input w-24"
                        inputMode="decimal"
                        placeholder="min"
                        value={c.min}
                        onChange={(e) => onChange({ constantes: value.constantes.map((x) => (x.type === t ? { ...x, min: e.target.value } : x)) })}
                      />
                      <input
                        className="input w-24"
                        inputMode="decimal"
                        placeholder="max"
                        value={c.max}
                        onChange={(e) => onChange({ constantes: value.constantes.map((x) => (x.type === t ? { ...x, max: e.target.value } : x)) })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bilan sanguin */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <label className="label mb-0">Besoin d&apos;un bilan sanguin ?</label>
          <OuiNon valeur={value.bilan_sanguin} onChange={(v) => onChange({ bilan_sanguin: v })} nom={`bilan-${index}`} />
        </div>
        {value.bilan_sanguin && (
          <div className="grid gap-3 rounded-xl border border-rose-100 bg-rose-50/40 p-3">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Voie d&apos;abord</p>
              <div className="flex flex-wrap gap-2">
                {VOIES_BILAN.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ bilan_voie: value.bilan_voie === v ? "" : v })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      value.bilan_voie === v ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">À doser dans le sang</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ANALYSES_BILAN.map((a) => {
                  const coche = value.bilan_analyses.includes(a);
                  return (
                    <label key={a} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={coche}
                        onChange={(e) => onChange({
                          bilan_analyses: e.target.checked
                            ? [...value.bilan_analyses, a]
                            : value.bilan_analyses.filter((x) => x !== a),
                        })}
                        className="h-4 w-4 accent-brand"
                      />
                      {a}
                    </label>
                  );
                })}
              </div>
            </div>
            <input
              className="input"
              value={value.bilan_autres}
              onChange={(e) => onChange({ bilan_autres: e.target.value })}
              placeholder="Autres dosages…"
            />
          </div>
        )}
      </div>

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

      {/* Matériel paramédical (juste après cryothérapie) */}
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

      {/* Envoi Ordo / CR (juste avant Autres consignes) */}
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
