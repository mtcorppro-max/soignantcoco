"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { Select } from "@/components/Select";
import type { RolePro, ProtocoleConsigne } from "@/lib/types";

type Soignant = {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  role: RolePro;
  niveau: number;
  telephone: string | null;
  specialite: string | null;
  protocoles: ProtocoleConsigne[] | null;
};

// Soignant externe (sans compte) — cf. migrations 0040 / 0041.
type Externe = {
  id: string;
  type: "medecin" | "infirmiere";
  titre: string | null;
  prenom: string | null;
  nom: string;
  specialite: string | null;
  telephone: string | null;
  protocoles: ProtocoleConsigne[] | null;
};

// Nom complet affiché et stocké : « [Titre] Prénom Nom ».
const nomComplet = (s: Soignant) => [s.titre, s.prenom, s.nom].filter(Boolean).join(" ");

// Traitements à suivre proposés (Post op en tête).
const TRAITEMENTS = [
  "Post op",
  "Antalgie générale",
  "Anti-douleur ALR Aiguë",
  "Anti-douleur ALR Chronique",
  "Anti-douleur PCA",
  "Antibiothérapie",
  "Hydratation",
  "Immunothérapie IV",
  "Immunothérapie SC",
  "NEAD",
  "NPAD",
  "Pansements",
  "Autre traitement",
];

const VIDE = {
  prenom: "",
  nom: "",
  date_naissance: "",
  code_postal: "",
  ville: "",
  telephone: "",
  email: "",
  adresse: "",
  operation: "",
  date_operation: "",
  date_sortie: "",
  duree_prise_en_charge: "",
  chirurgien: "",
  traitement: "",
  traitement_autre: "",
  pharmacie: "",
  pharmacie_tel: "",
  infirmiere_nom: "",
  infirmiere_tel: "",
  proche_nom: "",
  proche_tel: "",
  alerte_1_nom: "",
  tel_alerte_1: "",
  alerte_2_nom: "",
  tel_alerte_2: "",
};

export function NouveauPatientForm() {
  const [form, setForm] = useState({ ...VIDE });
  const [code, setCode] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [soignants, setSoignants] = useState<Soignant[]>([]);
  const [joursSuivi, setJoursSuivi] = useState<number[]>([]);
  const [seuilsProto, setSeuilsProto] = useState<{ type: string; min: string; max: string }[]>([]);
  const [externes, setExternes] = useState<Externe[]>([]);
  const pro = useProSession();
  const [agenceId, setAgenceId] = useState("");
  const [agences, setAgences] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    createClient()
      .from("professionnel")
      .select("id,nom,prenom,titre,role,niveau,telephone,specialite,protocoles")
      .order("nom")
      .then(({ data }) => setSoignants((data ?? []) as Soignant[]));
    createClient()
      .from("soignant_externe")
      .select("id,type,titre,prenom,nom,specialite,telephone,protocoles")
      .order("nom")
      .then(({ data }) => setExternes((data ?? []) as Externe[]));
    Promise.all([
      createClient().from("region").select("id,nom"),
      createClient().from("agence").select("id,nom,region_id"),
    ]).then(([{ data: regs }, { data: ags }]) => {
      const nomRegion = new Map((regs ?? []).map((r) => [r.id as string, r.nom as string]));
      setAgences((ags ?? []).map((a) => ({ value: a.id as string, label: `${nomRegion.get(a.region_id as string) ?? "?"} · ${a.nom}` })));
    });
  }, []);

  // Par défaut, le patient est rattaché à l'agence du créateur.
  useEffect(() => { if (pro?.agence_id) setAgenceId((v) => v || pro.agence_id!); }, [pro?.agence_id]);

  const coordinatrices = soignants.filter((s) => s.role === "coordinatrice");
  const chirurgiens = soignants.filter((s) => s.role === "chirurgien");
  const infirmieres = soignants.filter((s) => s.role === "infirmiere_liberale");
  const externesMed = externes.filter((e) => e.type === "medecin");
  const externesInf = externes.filter((e) => e.type === "infirmiere");
  const nomExterne = (e: Externe) => [e.titre, e.prenom, e.nom].filter(Boolean).join(" ");

  // Options du sélecteur chirurgien/médecin : comptes + soignants externes.
  const optionsChirurgien = [
    ...chirurgiens.map((s) => ({ value: nomComplet(s), label: nomComplet(s) })),
    ...externesMed.map((e) => ({ value: nomExterne(e), label: `${nomExterne(e)} · externe` })),
  ];
  const optionsInfirmiere = [
    ...infirmieres.map((s) => ({ value: nomComplet(s), label: nomComplet(s) })),
    ...externesInf.map((e) => ({ value: nomExterne(e), label: `${nomExterne(e)} · externe` })),
  ];

  // Choix de l'infirmière libérale : enregistre son nom + tél (et rattachement auto si compte).
  const choisirInfirmiere = (v: string) => {
    const inf = infirmieres.find((s) => nomComplet(s) === v);
    const ext = externesInf.find((e) => nomExterne(e) === v);
    setForm((f) => ({ ...f, infirmiere_nom: v, infirmiere_tel: inf?.telephone ?? ext?.telephone ?? f.infirmiere_tel }));
  };

  // Compte chirurgien/médecin sélectionné + classification (chirurgien vs médecin).
  const selChirurgien = chirurgiens.find((s) => nomComplet(s) === form.chirurgien);
  const selExterneMed = externesMed.find((e) => nomExterne(e) === form.chirurgien);
  const specialiteSel = selChirurgien?.specialite ?? selExterneMed?.specialite ?? "";
  const estChirurgical = specialiteSel.toLowerCase().includes("chirurg");
  const protocolesChir = selChirurgien?.protocoles ?? selExterneMed?.protocoles ?? [];

  // Applique un protocole : remplit opération, durée et jours de suivi.
  const appliquerProtocole = (v: string) => {
    const p = protocolesChir[Number(v)];
    if (!p) return;
    setForm((f) => ({ ...f, operation: p.intervention || f.operation, duree_prise_en_charge: p.duree || "" }));
    setJoursSuivi(p.jours ?? []);
    setSeuilsProto(p.surveiller_constantes ? (p.constantes ?? []) : []);
  };

  // Le rattachement est déduit du chirurgien + des coordinatrices d'alerte choisis.
  const rattachementsAuto = () => {
    const noms = [form.chirurgien, form.alerte_1_nom, form.alerte_2_nom, form.infirmiere_nom].filter(Boolean);
    const ids = soignants.filter((s) => noms.includes(nomComplet(s))).map((s) => s.id);
    return [...new Set(ids)];
  };

  // Choix d'une coordinatrice pour une alerte : on enregistre son nom + son
  // téléphone (déjà saisi à la création de son compte).
  const choisirAlerte = (champNom: "alerte_1_nom" | "alerte_2_nom", champTel: "tel_alerte_1" | "tel_alerte_2") =>
    (v: string) => {
      const c = coordinatrices.find((s) => nomComplet(s) === v);
      setForm((f) => ({ ...f, [champNom]: v, [champTel]: c?.telephone ?? "" }));
    };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const traitement = form.traitement === "Autre traitement" ? form.traitement_autre.trim() : form.traitement;
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, traitement, jours_suivi: joursSuivi, seuils: seuilsProto, agence_id: agenceId || null, rattachements: rattachementsAuto() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? "Erreur.");
      setCode(j.code);
      setPatientId(j.patientId);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  if (code) {
    return (
      <div className="card grid gap-4 text-center">
        <p className="text-sm text-slate-500">Patient créé ✓ — code d&apos;accès :</p>
        <p className="rounded-xl bg-rose-50 py-4 font-mono text-3xl font-bold tracking-[0.2em] text-brand">
          {code}
        </p>
        <p className="text-xs text-slate-400">
          À remettre au patient. Connexion sur l&apos;écran « Je suis patient ».
        </p>
        <div className="flex gap-2">
          <Link href={`/pro/patients/${patientId}`} className="btn-primary flex-1">
            Ouvrir la fiche
          </Link>
          <button
            onClick={() => {
              setCode(null);
              setForm({ ...VIDE });
              setJoursSuivi([]);
              setSeuilsProto([]);
            }}
            className="btn-secondary flex-1"
          >
            Créer un autre
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-5">
      {/* ── Identité ── */}
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Prénom du patient *</label>
            <input className="input" value={form.prenom} onChange={set("prenom")} required />
          </div>
          <div>
            <label className="label">Nom du patient *</label>
            <input className="input" value={form.nom} onChange={set("nom")} required />
          </div>
        </div>
        <div>
          <label className="label">Date de naissance</label>
          <input type="date" className="input" value={form.date_naissance} onChange={set("date_naissance")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Téléphone *</label>
            <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" required />
          </div>
          <div>
            <label className="label">Adresse mail</label>
            <input className="input" value={form.email} onChange={set("email")} placeholder="nom@email.fr" inputMode="email" />
          </div>
        </div>
        <AdresseAutocomplete
          required
          adresse={form.adresse}
          codePostal={form.code_postal}
          ville={form.ville}
          onChange={(v) => setForm((f) => ({ ...f, adresse: v.adresse, code_postal: v.code_postal, ville: v.ville }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Personne proche à appeler</label>
            <input className="input" value={form.proche_nom} onChange={set("proche_nom")} placeholder="Nom (conjoint, enfant…)" />
          </div>
          <div>
            <label className="label">Tél. personne proche</label>
            <input className="input" value={form.proche_tel} onChange={set("proche_tel")} placeholder="06…" inputMode="tel" />
          </div>
        </div>
      </div>

      {/* ── Environnement de soins ── */}
      <div className="grid gap-4 border-t border-rose-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Environnement de soins</p>
        {agences.length > 0 && (
          <div>
            <label className="label">Agence</label>
            <Select
              value={agenceId}
              onChange={setAgenceId}
              placeholder="— Choisir une agence —"
              options={agences}
            />
          </div>
        )}
        {/* Rattachement au chirurgien / médecin */}
        <div>
          <label className="label">Chirurgien / Médecin</label>
          <Select
            value={form.chirurgien}
            onChange={(v) => setForm((f) => ({ ...f, chirurgien: v, traitement: "", traitement_autre: "" }))}
            placeholder="— Choisir un chirurgien / médecin —"
            options={optionsChirurgien}
          />
        </div>

        {/* Traitement à suivre (dès qu'un chirurgien/médecin est choisi) */}
        {form.chirurgien && (
          <div>
            <label className="label">Traitement à suivre</label>
            <Select
              value={form.traitement}
              onChange={(v) => setForm((f) => ({ ...f, traitement: v }))}
              placeholder="— Choisir un traitement —"
              options={TRAITEMENTS.map((t) => ({ value: t, label: t }))}
            />
          </div>
        )}
        {form.traitement === "Autre traitement" && (
          <div>
            <label className="label">Préciser le traitement</label>
            <input className="input" value={form.traitement_autre} onChange={set("traitement_autre")} placeholder="Traitement à suivre" />
          </div>
        )}

        {/* Chirurgien + Post op → protocole à suivre */}
        {estChirurgical && form.traitement === "Post op" && protocolesChir.length > 0 && (
          <div>
            <label className="label">Protocole à suivre</label>
            <Select
              value=""
              onChange={appliquerProtocole}
              placeholder="— Choisir un protocole du chirurgien —"
              options={protocolesChir.map((p, i) => ({
                value: String(i),
                label: `${p.intervention || `Protocole ${i + 1}`}${p.duree ? ` — ${p.duree} j` : ""}`,
              }))}
            />
            <p className="mt-1 text-xs text-slate-400">
              Remplit automatiquement l&apos;opération, la durée, les jours de suivi et les seuils.
            </p>
          </div>
        )}

        {/* Jour de la chirurgie + jour de sortie (chirurgien à compte, ou Post op) */}
        {(estChirurgical || form.traitement === "Post op") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Jour de la chirurgie</label>
              <input type="date" className="input" value={form.date_operation} onChange={set("date_operation")} />
            </div>
            <div>
              <label className="label">Jour de sortie</label>
              <input type="date" className="input" value={form.date_sortie} onChange={set("date_sortie")} />
            </div>
          </div>
        )}
        {joursSuivi.length > 0 && (
          <p className="text-xs text-brand">
            Jours de suivi programmés : {joursSuivi.map((j) => `J${j}`).join(", ")}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Pharmacie</label>
            <input className="input" value={form.pharmacie} onChange={set("pharmacie")} placeholder="Nom / ville de la pharmacie" />
          </div>
          <div>
            <label className="label">Tél. pharmacie</label>
            <input className="input" value={form.pharmacie_tel} onChange={set("pharmacie_tel")} placeholder="0…" inputMode="tel" />
          </div>
        </div>
        <div>
          <label className="label">Infirmière libérale</label>
          <Select
            value={form.infirmiere_nom}
            onChange={choisirInfirmiere}
            placeholder={optionsInfirmiere.length ? "— Choisir une infirmière libérale —" : "Aucune infirmière libérale"}
            options={[
              ...optionsInfirmiere,
              ...(form.infirmiere_nom && !optionsInfirmiere.some((o) => o.value === form.infirmiere_nom)
                ? [{ value: form.infirmiere_nom, label: form.infirmiere_nom }]
                : []),
            ]}
          />
          <p className="mt-1 text-xs text-slate-400">Un compte rattaché pourra voir ce patient et saisir ses constantes ; une infirmière externe est indiquée à titre de référence.</p>
        </div>
        <div>
          <label className="label">Alerte 1 — infirmière coordinatrice</label>
          <Select
            value={form.alerte_1_nom}
            onChange={choisirAlerte("alerte_1_nom", "tel_alerte_1")}
            placeholder="— Choisir une infirmière coordinatrice —"
            options={[
              ...coordinatrices.map((s) => ({ value: nomComplet(s), label: nomComplet(s) })),
              ...(form.alerte_1_nom && !coordinatrices.some((s) => nomComplet(s) === form.alerte_1_nom)
                ? [{ value: form.alerte_1_nom, label: form.alerte_1_nom }]
                : []),
            ]}
          />
        </div>
        <div>
          <label className="label">Alerte 2 (backup) — infirmière coordinatrice</label>
          <Select
            value={form.alerte_2_nom}
            onChange={choisirAlerte("alerte_2_nom", "tel_alerte_2")}
            placeholder="— Choisir une infirmière coordinatrice —"
            options={[
              ...coordinatrices.map((s) => ({ value: nomComplet(s), label: nomComplet(s) })),
              ...(form.alerte_2_nom && !coordinatrices.some((s) => nomComplet(s) === form.alerte_2_nom)
                ? [{ value: form.alerte_2_nom, label: form.alerte_2_nom }]
                : []),
            ]}
          />
        </div>
      </div>

      {erreur && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{erreur}</p>
      )}
      <button className="btn-primary py-3" disabled={busy}>
        {busy ? "Création…" : "Créer le patient & générer le code"}
      </button>
    </form>
  );
}
