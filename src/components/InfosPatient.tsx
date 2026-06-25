"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LIBELLE_ROLE } from "@/lib/roles";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import type { Patient, RolePro, ProtocoleConsigne } from "@/lib/types";

type Soignant = { id: string; nom: string; prenom: string | null; titre: string | null; role: RolePro; telephone: string | null; protocoles: ProtocoleConsigne[] | null };

// Nom complet affiché et stocké : « [Titre] Prénom Nom ».
const nomComplet = (s: Soignant) => [s.titre, s.prenom, s.nom].filter(Boolean).join(" ");

// Champs administratifs éditables de la fiche patient.
const CHAMPS = [
  "date_naissance", "telephone", "email", "adresse", "code_postal", "ville",
  "operation", "date_operation", "duree_prise_en_charge", "chirurgien", "pharmacie", "pharmacie_tel", "infirmiere_nom", "infirmiere_tel",
  "proche_nom", "proche_tel",
  "alerte_1_nom", "tel_alerte_1", "alerte_2_nom", "tel_alerte_2",
] as const;

type Champ = (typeof CHAMPS)[number];
type Form = Record<Champ, string>;

function depuisPatient(p: Patient): Form {
  return CHAMPS.reduce((acc, c) => {
    const v = p[c] as string | number | null;
    acc[c] = v == null ? "" : String(v);
    return acc;
  }, {} as Form);
}

// "YYYY-MM-DD" -> "JJ/MM/AAAA"
function formatDate(iso: string): string {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

// Ajoute n jours à une date "YYYY-MM-DD" et renvoie "JJ/MM/AAAA".
function ajouterJours(iso: string, n: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function age(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let ans = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) ans--;
  return ans;
}

export function InfosPatient({
  patient,
  modifiable,
}: {
  patient: Patient;
  modifiable: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [form, setForm] = useState<Form>(() => depuisPatient(patient));
  const [vue, setVue] = useState<Form>(() => depuisPatient(patient));
  const [busy, setBusy] = useState(false);
  const [soignants, setSoignants] = useState<Soignant[]>([]);
  const [joursSuivi, setJoursSuivi] = useState<number[]>(patient.jours_suivi ?? []);

  useEffect(() => {
    if (!edition || soignants.length) return;
    createClient()
      .from("professionnel")
      .select("id,nom,prenom,titre,role,telephone,protocoles")
      .order("nom")
      .then(({ data }) => setSoignants((data ?? []) as Soignant[]));
  }, [edition, soignants.length]);

  const set = (k: Champ) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k: Champ, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const coordinatrices = soignants.filter((s) => s.role === "coordinatrice");
  const chirurgiens = soignants.filter((s) => s.role === "chirurgien");

  // Choix d'une coordinatrice pour une alerte : enregistre nom + téléphone du compte.
  const choisirAlerte = (champNom: Champ, champTel: Champ) => (v: string) => {
    const c = coordinatrices.find((s) => nomComplet(s) === v);
    setForm((f) => ({ ...f, [champNom]: v, [champTel]: c?.telephone ?? "" }));
  };

  // Protocoles du chirurgien choisi + application d'une intervention.
  const protocolesChir = chirurgiens.find((s) => nomComplet(s) === form.chirurgien)?.protocoles ?? [];
  const appliquerProtocole = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = protocolesChir[Number(e.target.value)];
    if (!p) return;
    setForm((f) => ({ ...f, operation: p.intervention || f.operation, duree_prise_en_charge: p.duree || "" }));
    setJoursSuivi(p.jours ?? []);
  };

  async function enregistrer() {
    setBusy(true);
    const supabase = createClient();
    const payload = CHAMPS.reduce((acc, c) => {
      acc[c] = form[c].trim() || null;
      return acc;
    }, {} as Record<Champ, string | number | null>);
    // La durée de prise en charge est un entier (colonne int).
    payload.duree_prise_en_charge = form.duree_prise_en_charge.trim()
      ? Number(form.duree_prise_en_charge) || null
      : null;
    (payload as Record<string, unknown>).jours_suivi = joursSuivi.length ? joursSuivi : null;

    const { error } = await supabase.from("patient").update(payload).eq("id", patient.id);
    if (error) {
      setBusy(false);
      alert("Enregistrement refusé (droits ou réseau).");
      return;
    }

    // Rattachement déduit du chirurgien + des coordinatrices d'alerte choisis.
    const noms = [form.chirurgien, form.alerte_1_nom, form.alerte_2_nom].filter(Boolean);
    const ids = [...new Set(soignants.filter((s) => noms.includes(nomComplet(s))).map((s) => s.id))];
    // On resynchronise : suppression puis réinsertion (droits coordinatrice/niveau 1).
    await supabase.from("patient_soignant").delete().eq("patient_id", patient.id);
    if (ids.length) {
      await supabase
        .from("patient_soignant")
        .insert(ids.map((professionnel_id) => ({ patient_id: patient.id, professionnel_id })));
    }

    setBusy(false);
    setVue({ ...form });
    setEdition(false);
  }

  function annuler() {
    setForm({ ...vue });
    setEdition(false);
  }

  // ── Mode édition ──────────────────────────────────────────────────
  if (edition) {
    return (
      <section className="card grid gap-5">
        <div className="grid gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Coordonnées</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Date de naissance" type="date" value={form.date_naissance} onChange={set("date_naissance")} />
            <Champ label="Téléphone" value={form.telephone} onChange={set("telephone")} />
          </div>
          <Champ label="Adresse mail" value={form.email} onChange={set("email")} />
          <AdresseAutocomplete
            adresse={form.adresse}
            codePostal={form.code_postal}
            ville={form.ville}
            onChange={(v) => setForm((f) => ({ ...f, adresse: v.adresse, code_postal: v.code_postal, ville: v.ville }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Personne proche" value={form.proche_nom} onChange={set("proche_nom")} />
            <Champ label="Tél. personne proche" value={form.proche_tel} onChange={set("proche_tel")} />
          </div>
        </div>

        <div className="grid gap-4 border-t border-rose-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Environnement de soins</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Opération subie" value={form.operation} onChange={set("operation")} />
            <Champ label="Date de l'opération" type="date" value={form.date_operation} onChange={set("date_operation")} />
          </div>
          <Champ label="Jours de prise en charge" value={form.duree_prise_en_charge} onChange={set("duree_prise_en_charge")} />
          <SelectSoignant label="Chirurgien (compte existant)" value={form.chirurgien} soignants={chirurgiens} onChange={(v) => setVal("chirurgien", v)} />
          {protocolesChir.length > 0 && (
            <div>
              <label className="label">Protocole / intervention appliqué</label>
              <select className="select" onChange={appliquerProtocole} defaultValue="">
                <option value="">— Choisir un protocole du chirurgien —</option>
                {protocolesChir.map((p, i) => (
                  <option key={i} value={i}>
                    {p.intervention || `Protocole ${i + 1}`}{p.duree ? ` — ${p.duree} j` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {joursSuivi.length > 0 && (
            <p className="text-xs text-brand">Jours de suivi : {joursSuivi.map((j) => `J${j}`).join(", ")}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Pharmacie" value={form.pharmacie} onChange={set("pharmacie")} />
            <Champ label="Tél. pharmacie" value={form.pharmacie_tel} onChange={set("pharmacie_tel")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Infirmière libérale" value={form.infirmiere_nom} onChange={set("infirmiere_nom")} />
            <Champ label="Tél. infirmière" value={form.infirmiere_tel} onChange={set("infirmiere_tel")} />
          </div>
          <SelectSoignant label="Alerte 1 — infirmière coordinatrice" value={form.alerte_1_nom} soignants={coordinatrices} onChange={choisirAlerte("alerte_1_nom", "tel_alerte_1")} />
          <SelectSoignant label="Alerte 2 — infirmière coordinatrice" value={form.alerte_2_nom} soignants={coordinatrices} onChange={choisirAlerte("alerte_2_nom", "tel_alerte_2")} />
        </div>

        <div className="flex gap-2">
          <button onClick={annuler} className="btn-secondary flex-1" disabled={busy}>
            Annuler
          </button>
          <button onClick={enregistrer} className="btn-primary flex-1" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </section>
    );
  }

  // ── Mode lecture ──────────────────────────────────────────────────
  const aucune = CHAMPS.every((c) => !vue[c]);
  const ageAns = age(vue.date_naissance);
  const villeLigne = [vue.code_postal, vue.ville].filter(Boolean).join(" ");
  const duree = vue.duree_prise_en_charge ? Number(vue.duree_prise_en_charge) : null;
  const j1 = vue.date_operation ? ajouterJours(vue.date_operation, 1) : "";
  const dernierJour = vue.date_operation && duree ? ajouterJours(vue.date_operation, duree) : "";

  return (
    <section className="card grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">Informations patient</h2>
        {modifiable && (
          <button onClick={() => { setForm({ ...vue }); setEdition(true); }} className="text-sm font-medium text-brand hover:underline">
            {aucune ? "Compléter" : "Modifier"}
          </button>
        )}
      </div>

      {aucune ? (
        <p className="text-sm text-slate-400">
          Aucune information renseignée.{modifiable ? " Cliquez sur « Compléter »." : ""}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Bloc titre="Coordonnées">
            <Ligne
              label="Naissance"
              value={vue.date_naissance ? `${formatDate(vue.date_naissance)}${ageAns != null ? ` (${ageAns} ans)` : ""}` : ""}
            />
            <Ligne label="Téléphone" value={vue.telephone} href={vue.telephone ? `tel:${vue.telephone}` : undefined} />
            <Ligne label="Email" value={vue.email} href={vue.email ? `mailto:${vue.email}` : undefined} />
            <Ligne label="Adresse" value={vue.adresse} />
            <Ligne label="Ville" value={villeLigne} />
            <Ligne
              label="Personne proche"
              value={vue.proche_nom || vue.proche_tel}
              extra={vue.proche_nom ? vue.proche_tel : undefined}
              href={vue.proche_tel ? `tel:${vue.proche_tel}` : undefined}
            />
          </Bloc>

          <Bloc titre="Environnement de soins">
            <Ligne
              label="Opération"
              value={vue.operation}
              extra={vue.date_operation ? formatDate(vue.date_operation) : undefined}
            />
            <Ligne label="Prise en charge" value={duree ? `${duree} jours` : ""} />
            {j1 && <Ligne label="Suivi J1" value={j1} />}
            {dernierJour && <Ligne label="Suivi dernier jour" value={dernierJour} />}
            <Ligne label="Chirurgien" value={vue.chirurgien} />
            <Ligne
              label="Pharmacie"
              value={vue.pharmacie}
              extra={vue.pharmacie_tel}
              href={vue.pharmacie_tel ? `tel:${vue.pharmacie_tel}` : undefined}
            />
            <Ligne
              label="Infirmière libérale"
              value={vue.infirmiere_nom}
              extra={vue.infirmiere_tel}
              href={vue.infirmiere_tel ? `tel:${vue.infirmiere_tel}` : undefined}
            />
            <Ligne
              label={vue.alerte_1_nom ? `Alerte 1 · ${vue.alerte_1_nom}` : "N° alerte 1"}
              value={vue.tel_alerte_1}
              href={vue.tel_alerte_1 ? `tel:${vue.tel_alerte_1}` : undefined}
            />
            <Ligne
              label={vue.alerte_2_nom ? `Alerte 2 · ${vue.alerte_2_nom}` : "N° alerte 2"}
              value={vue.tel_alerte_2}
              href={vue.tel_alerte_2 ? `tel:${vue.tel_alerte_2}` : undefined}
            />
          </Bloc>
        </div>
      )}
    </section>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">{titre}</p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

function Ligne({
  label,
  value,
  extra,
  href,
}: {
  label: string;
  value: string;
  extra?: string;
  href?: string;
}) {
  if (!value && !extra) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">
        {href ? (
          <a href={href} className="text-brand hover:underline">{value || extra}</a>
        ) : (
          value
        )}
        {extra && value && (
          <>
            {" · "}
            {href ? (
              <a href={href} className="text-brand hover:underline">{extra}</a>
            ) : (
              <span>{extra}</span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

function Champ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={value} onChange={onChange} />
    </div>
  );
}

function SelectSoignant({
  label,
  value,
  soignants,
  onChange,
}: {
  label: string;
  value: string;
  soignants: Soignant[];
  onChange: (v: string) => void;
}) {
  const horsListe = value && !soignants.some((s) => nomComplet(s) === value);
  return (
    <div>
      <label className="label">{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Choisir un compte —</option>
        {soignants.map((s) => (
          <option key={s.id} value={nomComplet(s)}>
            {nomComplet(s)} ({LIBELLE_ROLE[s.role]})
          </option>
        ))}
        {horsListe && <option value={value}>{value}</option>}
      </select>
    </div>
  );
}
