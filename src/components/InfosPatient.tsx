"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LIBELLE_ROLE } from "@/lib/roles";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { Select } from "@/components/Select";
import type { Patient, RolePro, ProtocoleConsigne } from "@/lib/types";

type Soignant = { id: string; nom: string; prenom: string | null; titre: string | null; role: RolePro; agence_id: string | null; telephone: string | null; specialite: string | null; protocoles: ProtocoleConsigne[] | null };
// Soignant externe (sans compte) — cf. migrations 0040 / 0041.
type Externe = { id: string; type: "medecin" | "infirmiere"; titre: string | null; prenom: string | null; nom: string; telephone: string | null; specialite: string | null; protocoles: ProtocoleConsigne[] | null };

// Nom complet affiché et stocké : « [Titre] Prénom Nom ».
const nomComplet = (s: { titre: string | null; prenom: string | null; nom: string }) => [s.titre, s.prenom, s.nom].filter(Boolean).join(" ");

// Champs administratifs éditables de la fiche patient.
const CHAMPS = [
  "date_naissance", "telephone", "email", "adresse", "code_postal", "ville",
  "operation", "date_operation", "duree_prise_en_charge", "chirurgien", "delegue_nom", "pharmacie", "pharmacie_tel", "infirmiere_nom", "infirmiere_tel",
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
  const [externes, setExternes] = useState<Externe[]>([]);
  const [joursSuivi, setJoursSuivi] = useState<number[]>(patient.jours_suivi ?? []);
  const [agenceId, setAgenceId] = useState(patient.agence_id ?? "");
  const [agences, setAgences] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!edition || soignants.length) return;
    createClient()
      .from("professionnel")
      .select("id,nom,prenom,titre,role,agence_id,telephone,specialite,protocoles")
      .order("nom")
      .then(({ data }) => setSoignants((data ?? []) as Soignant[]));
    createClient()
      .from("soignant_externe")
      .select("id,type,titre,prenom,nom,telephone,specialite,protocoles")
      .order("nom")
      .then(({ data }) => setExternes((data ?? []) as Externe[]));
    Promise.all([
      createClient().from("region").select("id,nom"),
      createClient().from("agence").select("id,nom,region_id"),
    ]).then(([{ data: regs }, { data: ags }]) => {
      const nomRegion = new Map((regs ?? []).map((r) => [r.id as string, r.nom as string]));
      setAgences((ags ?? []).map((a) => ({ value: a.id as string, label: `${nomRegion.get(a.region_id as string) ?? "?"} · ${a.nom}` })));
    });
  }, [edition, soignants.length]);

  const set = (k: Champ) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k: Champ, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Coordinatrices d'alerte : uniquement celles de l'agence du patient.
  const coordinatrices = soignants.filter(
    (s) => s.role === "coordinatrice" && (!agenceId || s.agence_id === agenceId)
  );
  const delegues = soignants.filter((s) => s.role === "delegue");
  const chirurgiens = soignants.filter((s) => s.role === "chirurgien");
  const infirmieres = soignants.filter((s) => s.role === "infirmiere_liberale");
  const externesMed = externes.filter((e) => e.type === "medecin");
  const externesInf = externes.filter((e) => e.type === "infirmiere");

  // Options du sélecteur chirurgien/médecin : comptes + soignants externes.
  const optionsChirurgien = [
    ...chirurgiens.map((s) => ({ value: nomComplet(s), label: nomComplet(s) })),
    ...externesMed.map((e) => ({ value: nomComplet(e), label: `${nomComplet(e)} · externe` })),
    ...(form.chirurgien && !chirurgiens.some((s) => nomComplet(s) === form.chirurgien) && !externesMed.some((e) => nomComplet(e) === form.chirurgien)
      ? [{ value: form.chirurgien, label: form.chirurgien }]
      : []),
  ];

  const choisirInfirmiere = (v: string) => {
    const inf = infirmieres.find((s) => nomComplet(s) === v);
    const ext = externesInf.find((e) => nomComplet(e) === v);
    setForm((f) => ({ ...f, infirmiere_nom: v, infirmiere_tel: inf?.telephone ?? ext?.telephone ?? f.infirmiere_tel }));
  };

  // Choix d'une coordinatrice pour une alerte : enregistre nom + téléphone du compte.
  const choisirAlerte = (champNom: Champ, champTel: Champ) => (v: string) => {
    const c = coordinatrices.find((s) => nomComplet(s) === v);
    setForm((f) => ({ ...f, [champNom]: v, [champTel]: c?.telephone ?? "" }));
  };

  // Protocoles du chirurgien/médecin choisi (compte ou externe) + classification.
  const selChir = chirurgiens.find((s) => nomComplet(s) === form.chirurgien);
  const selExterneMed = externesMed.find((e) => nomComplet(e) === form.chirurgien);
  const estChirurgical = ((selChir?.specialite ?? selExterneMed?.specialite) ?? "").toLowerCase().includes("chirurg");
  const protocolesChir = selChir?.protocoles ?? selExterneMed?.protocoles ?? [];
  const appliquerProtocole = (v: string) => {
    const p = protocolesChir[Number(v)];
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
    (payload as Record<string, unknown>).agence_id = agenceId || null;

    const { error } = await supabase.from("patient").update(payload).eq("id", patient.id);
    if (error) {
      setBusy(false);
      alert("Enregistrement refusé (droits ou réseau).");
      return;
    }

    // Rattachement déduit du chirurgien + des coordinatrices d'alerte choisis.
    const noms = [form.chirurgien, form.alerte_1_nom, form.alerte_2_nom, form.infirmiere_nom].filter(Boolean);
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
          {agences.length > 0 && (
            <div>
              <label className="label">Agence</label>
              <Select value={agenceId} onChange={setAgenceId} placeholder="— Choisir une agence —" options={agences} />
            </div>
          )}
          <div>
            <label className="label">Chirurgien / Médecin</label>
            <Select
              value={form.chirurgien}
              onChange={(v) => setVal("chirurgien", v)}
              placeholder="— Choisir un chirurgien / médecin —"
              options={optionsChirurgien}
            />
          </div>
          {protocolesChir.length > 0 && (
            <div>
              <label className="label">Protocole / intervention appliqué</label>
              <Select
                value=""
                onChange={appliquerProtocole}
                placeholder="— Choisir un protocole —"
                options={protocolesChir.map((p, i) => ({
                  value: String(i),
                  label: `${p.intervention || `Protocole ${i + 1}`}${p.duree ? ` — ${p.duree} j` : ""}`,
                }))}
              />
              <p className="mt-1 text-xs text-slate-400">Remplit l&apos;opération, la durée et les jours de suivi.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label={estChirurgical ? "Date de l'opération" : "Date de début de prise en charge"} type="date" value={form.date_operation} onChange={set("date_operation")} />
            <Champ label="Jours de prise en charge" value={form.duree_prise_en_charge} onChange={set("duree_prise_en_charge")} />
          </div>
          {joursSuivi.length > 0 && (
            <p className="text-xs text-brand">Jours de suivi : {joursSuivi.map((j) => `J${j}`).join(", ")}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Pharmacie" value={form.pharmacie} onChange={set("pharmacie")} />
            <Champ label="Tél. pharmacie" value={form.pharmacie_tel} onChange={set("pharmacie_tel")} />
          </div>
          <SelectSoignant label="Infirmière libérale (compte rattaché)" value={form.infirmiere_nom} soignants={infirmieres} onChange={choisirInfirmiere} />
          <SelectSoignant label="Délégué médical (rattaché)" value={form.delegue_nom} soignants={delegues} onChange={(v) => setVal("delegue_nom", v)} />
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
      <Select
        value={value}
        onChange={onChange}
        placeholder="— Choisir un compte —"
        options={[
          ...soignants.map((s) => ({ value: nomComplet(s), label: `${nomComplet(s)} (${LIBELLE_ROLE[s.role]})` })),
          ...(horsListe ? [{ value, label: value }] : []),
        ]}
      />
    </div>
  );
}
