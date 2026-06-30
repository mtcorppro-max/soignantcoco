"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { Select } from "@/components/Select";
import { DateField } from "@/components/DateField";
import { TRAITEMENTS } from "@/components/NouveauPatientForm";
import type { Patient, RolePro, ProtocoleConsigne } from "@/lib/types";

type Soignant = { id: string; nom: string; prenom: string | null; titre: string | null; role: RolePro; agence_id: string | null; telephone: string | null; specialite: string | null; protocoles: ProtocoleConsigne[] | null };
// Soignant externe (sans compte) — cf. migrations 0040 / 0041.
type Externe = { id: string; type: "medecin" | "infirmiere" | "pharmacie"; titre: string | null; prenom: string | null; nom: string; telephone: string | null; specialite: string | null; protocoles: ProtocoleConsigne[] | null };

// Nom complet affiché et stocké : « [Titre] Prénom Nom ».
const nomComplet = (s: { titre: string | null; prenom: string | null; nom: string }) => [s.titre, s.prenom, s.nom].filter(Boolean).join(" ");

// Champs administratifs éditables de la fiche patient.
const CHAMPS = [
  "date_naissance", "telephone", "email", "adresse", "code_postal", "ville",
  "operation", "date_operation", "duree_prise_en_charge", "traitement", "chirurgien", "delegue_nom", "pharmacie", "pharmacie_tel", "pharmacie_compte_nom", "infirmiere_nom", "infirmiere_tel",
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
  const [ouvert, setOuvert] = useState(false); // section rétractable (repliée par défaut)
  const [form, setForm] = useState<Form>(() => depuisPatient(patient));
  const [vue, setVue] = useState<Form>(() => depuisPatient(patient));
  const [busy, setBusy] = useState(false);
  const [soignants, setSoignants] = useState<Soignant[]>([]);
  const [externes, setExternes] = useState<Externe[]>([]);
  const [joursSuivi, setJoursSuivi] = useState<number[]>(patient.jours_suivi ?? []);
  const [agenceId, setAgenceId] = useState(patient.agence_id ?? "");
  const [autreTrait, setAutreTrait] = useState(!!patient.traitement && !TRAITEMENTS.includes(patient.traitement as typeof TRAITEMENTS[number]));
  const [agences, setAgences] = useState<{ value: string; label: string }[]>([]);
  const [ajoutInf, setAjoutInf] = useState(false);
  const [infNew, setInfNew] = useState({ prenom: "", nom: "", tel: "" });
  const [busyInf, setBusyInf] = useState(false);
  const [erreurInf, setErreurInf] = useState<string | null>(null);
  const pro = useProSession();

  useEffect(() => {
    // Chargé dès l'affichage (et plus seulement en édition) : la vue lecture en a
    // besoin pour retrouver le téléphone de la pharmacie rattachée.
    if (soignants.length) return;
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
  const pharmacies = soignants.filter((s) => s.role === "pharmacie");
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

  // Options du sélecteur infirmière : comptes rattachés + soignants externes
  // (+ la valeur actuelle si elle n'est plus dans la liste).
  const optionsInfirmiere = [
    ...infirmieres.map((s) => ({ value: nomComplet(s), label: `${nomComplet(s)} (${LIBELLE_ROLE[s.role]})` })),
    ...externesInf.map((e) => ({ value: nomComplet(e), label: `${nomComplet(e)} · externe` })),
    ...(form.infirmiere_nom
      && !infirmieres.some((s) => nomComplet(s) === form.infirmiere_nom)
      && !externesInf.some((e) => nomComplet(e) === form.infirmiere_nom)
      ? [{ value: form.infirmiere_nom, label: form.infirmiere_nom }]
      : []),
  ];

  const choisirInfirmiere = (v: string) => {
    const inf = infirmieres.find((s) => nomComplet(s) === v);
    const ext = externesInf.find((e) => nomComplet(e) === v);
    setForm((f) => ({ ...f, infirmiere_nom: v, infirmiere_tel: inf?.telephone ?? ext?.telephone ?? f.infirmiere_tel }));
  };

  // Crée une infirmière libérale externe (ajoutée au site) et la rattache au patient.
  async function ajouterInfirmiere() {
    if (!infNew.nom.trim()) return;
    if (!pro?.prestataire_id) { setErreurInf("Aucun prestataire associé à votre compte."); return; }
    setBusyInf(true);
    setErreurInf(null);
    const { data, error } = await createClient().from("soignant_externe").insert({
      prestataire_id: pro.prestataire_id,
      type: "infirmiere",
      prenom: infNew.prenom.trim() || null,
      nom: infNew.nom.trim(),
      telephone: infNew.tel.trim() || null,
    }).select("id,type,titre,prenom,nom,telephone,specialite,protocoles").single();
    setBusyInf(false);
    if (error) { setErreurInf("Échec ajout infirmière : " + error.message); return; }
    const ext = data as Externe;
    setExternes((arr) => [...arr, ext]);
    setForm((f) => ({ ...f, infirmiere_nom: nomComplet(ext), infirmiere_tel: ext.telephone ?? "" }));
    setAjoutInf(false); setInfNew({ prenom: "", nom: "", tel: "" });
  }

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

    // Rattachement déduit du chirurgien + des coordinatrices d'alerte + de
    // l'infirmière, du délégué et du livreur choisis.
    const noms = [form.chirurgien, form.alerte_1_nom, form.alerte_2_nom, form.infirmiere_nom, form.delegue_nom, form.pharmacie_compte_nom].filter(Boolean);
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
              onChange={(v) => { setForm((f) => ({ ...f, chirurgien: v, traitement: "", operation: "" })); setAutreTrait(false); setJoursSuivi([]); }}
              placeholder="— Choisir un chirurgien / médecin —"
              options={optionsChirurgien}
            />
          </div>
          {form.chirurgien && (
            <div>
              <label className="label">Type de traitement</label>
              <Select
                value={autreTrait ? "Autre traitement" : form.traitement}
                onChange={(v) => {
                  if (v === "Autre traitement") { setAutreTrait(true); setVal("traitement", ""); }
                  else { setAutreTrait(false); setVal("traitement", v); }
                }}
                placeholder="— Choisir un type de traitement —"
                options={TRAITEMENTS.map((t) => ({ value: t, label: t }))}
              />
              {autreTrait && (
                <input className="input mt-2" placeholder="Préciser le traitement" value={form.traitement} onChange={(e) => setVal("traitement", e.target.value)} />
              )}
            </div>
          )}
          {((estChirurgical && form.traitement === "Post op") || form.traitement === "Sevrage Alcoolique") && protocolesChir.length > 0 && (
            <div>
              <label className="label">Protocole à suivre</label>
              <Select
                value=""
                onChange={appliquerProtocole}
                placeholder="— Choisir un protocole —"
                options={protocolesChir.map((p, i) => ({
                  value: String(i),
                  label: `${p.intervention || `Protocole ${i + 1}`}${p.duree ? ` — ${p.duree} j` : ""}`,
                }))}
              />
              <p className="mt-1 text-xs text-slate-400">Remplit automatiquement l&apos;opération, la durée et les jours de suivi.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label={estChirurgical ? "Date de l'opération" : "Date de début de prise en charge"} type="date" value={form.date_operation} onChange={set("date_operation")} />
            <Champ label="Jours de prise en charge" value={form.duree_prise_en_charge} onChange={set("duree_prise_en_charge")} />
          </div>
          {joursSuivi.length > 0 && (
            <p className="text-xs text-brand">Jours de suivi : {joursSuivi.map((j) => `J${j}`).join(", ")}</p>
          )}
          <div>
            <label className="label">Infirmière libérale</label>
            <Select
              value={form.infirmiere_nom}
              onChange={choisirInfirmiere}
              placeholder={optionsInfirmiere.length ? "— Choisir une infirmière libérale —" : "Aucune infirmière libérale"}
              options={optionsInfirmiere}
            />
            <p className="mt-1 text-xs text-slate-400">Un compte rattaché pourra voir ce patient et saisir ses constantes ; une infirmière externe est indiquée à titre de référence.</p>
            {!ajoutInf ? (
              <button type="button" onClick={() => setAjoutInf(true)} className="mt-2 text-sm font-medium text-brand hover:underline">+ Nouvelle infirmière libérale</button>
            ) : (
              <div className="mt-2 grid gap-2 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                <p className="text-xs font-semibold text-slate-600">Nouvelle infirmière libérale (ajoutée au site)</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input className="input" placeholder="Prénom" value={infNew.prenom} onChange={(e) => setInfNew((s) => ({ ...s, prenom: e.target.value }))} />
                  <input className="input" placeholder="Nom" value={infNew.nom} onChange={(e) => setInfNew((s) => ({ ...s, nom: e.target.value }))} />
                  <input className="input" placeholder="Téléphone" inputMode="tel" value={infNew.tel} onChange={(e) => setInfNew((s) => ({ ...s, tel: e.target.value }))} />
                </div>
                {erreurInf && <p className="text-xs text-critique">{erreurInf}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={ajouterInfirmiere} disabled={busyInf || !infNew.nom.trim()} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">{busyInf ? "Ajout…" : "Ajouter au site"}</button>
                  <button type="button" onClick={() => { setAjoutInf(false); setInfNew({ prenom: "", nom: "", tel: "" }); setErreurInf(null); }} className="btn-secondary px-3 py-1.5 text-sm">Annuler</button>
                </div>
              </div>
            )}
          </div>
          <SelectSoignant label="Délégué médical (rattaché)" value={form.delegue_nom} soignants={delegues} onChange={(v) => setVal("delegue_nom", v)} />
          <SelectSoignant label="Pharmacie — accès au portail (compte)" value={form.pharmacie_compte_nom} soignants={pharmacies} onChange={(v) => setVal("pharmacie_compte_nom", v)} />
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
  // Tél. de la pharmacie rattachée (compte portail ou soignant externe) — auto.
  const telPharmacie = vue.pharmacie_compte_nom
    ? (pharmacies.find((s) => nomComplet(s) === vue.pharmacie_compte_nom)?.telephone
      ?? externes.find((e) => e.type === "pharmacie" && nomComplet(e) === vue.pharmacie_compte_nom)?.telephone
      ?? null)
    : null;

  return (
    <section className="card grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOuvert((v) => !v)} className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition hover:bg-rose-50/60" aria-expanded={ouvert}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 shrink-0 text-brand transition-transform ${ouvert ? "rotate-90" : ""}`} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>
          <h2 className="text-sm font-semibold text-slate-600">Informations patient</h2>
        </button>
        {modifiable && ouvert && (
          <button onClick={() => { setForm({ ...vue }); setEdition(true); }} className="shrink-0 text-sm font-medium text-brand hover:underline">
            {aucune ? "Compléter" : "Modifier"}
          </button>
        )}
      </div>

      {!ouvert ? null : aucune ? (
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
            {vue.operation ? (
              <Ligne
                label="Opération"
                value={vue.operation}
                extra={vue.date_operation ? formatDate(vue.date_operation) : undefined}
              />
            ) : vue.date_operation ? (
              <Ligne label="Début de prise en charge" value={formatDate(vue.date_operation)} />
            ) : null}
            <Ligne label="Prise en charge" value={duree ? `${duree} jours` : ""} />
            <Ligne label="Type de traitement" value={vue.traitement} />
            <Ligne label={vue.operation ? "Chirurgien" : "Médecin"} value={vue.chirurgien} />
            <Ligne
              label="Infirmière libérale"
              value={vue.infirmiere_nom}
              extra={vue.infirmiere_tel}
              href={vue.infirmiere_tel ? `tel:${vue.infirmiere_tel}` : undefined}
            />
            <Ligne
              label="Pharmacie (portail)"
              value={vue.pharmacie_compte_nom}
              extra={telPharmacie ?? undefined}
              href={telPharmacie ? `tel:${telPharmacie}` : undefined}
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
      <span className="min-w-0 break-words text-right font-medium text-slate-700">
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
      {type === "date" ? (
        <DateField
          value={value}
          onChange={(v) => onChange({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>)}
        />
      ) : (
        <input type={type} className="input" value={value} onChange={onChange} />
      )}
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
