"use client";

import { useState } from "react";
import Link from "next/link";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";

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
  chirurgien: "",
  pharmacie: "",
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setBusy(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
            <label className="label">Prénom du patient</label>
            <input className="input" value={form.prenom} onChange={set("prenom")} />
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
            <label className="label">Téléphone</label>
            <input className="input" value={form.telephone} onChange={set("telephone")} placeholder="06…" inputMode="tel" />
          </div>
          <div>
            <label className="label">Adresse mail</label>
            <input className="input" value={form.email} onChange={set("email")} placeholder="nom@email.fr" inputMode="email" />
          </div>
        </div>
        <AdresseAutocomplete
          adresse={form.adresse}
          codePostal={form.code_postal}
          ville={form.ville}
          onChange={(v) => setForm((f) => ({ ...f, adresse: v.adresse, code_postal: v.code_postal, ville: v.ville }))}
        />
      </div>

      {/* ── Environnement de soins ── */}
      <div className="grid gap-4 border-t border-rose-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Environnement de soins</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Opération subie</label>
            <input className="input" value={form.operation} onChange={set("operation")} placeholder="ex. appendicectomie" />
          </div>
          <div>
            <label className="label">Date de l&apos;opération</label>
            <input type="date" className="input" value={form.date_operation} onChange={set("date_operation")} />
          </div>
        </div>
        <div>
          <label className="label">Chirurgien (qui a opéré)</label>
          <input className="input" value={form.chirurgien} onChange={set("chirurgien")} placeholder="Dr…" />
        </div>
        <div>
          <label className="label">Pharmacie</label>
          <input className="input" value={form.pharmacie} onChange={set("pharmacie")} placeholder="Nom / ville de la pharmacie" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Infirmière libérale</label>
            <input className="input" value={form.infirmiere_nom} onChange={set("infirmiere_nom")} placeholder="Nom" />
          </div>
          <div>
            <label className="label">Tél. infirmière libérale</label>
            <input className="input" value={form.infirmiere_tel} onChange={set("infirmiere_tel")} placeholder="06…" inputMode="tel" />
          </div>
        </div>
      </div>

      {/* ── Contacts d'urgence ── */}
      <div className="grid gap-4 border-t border-rose-100 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Contacts d&apos;urgence</p>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Alerte 1 — nom</label>
            <input className="input" value={form.alerte_1_nom} onChange={set("alerte_1_nom")} placeholder="Nom du destinataire" />
          </div>
          <div>
            <label className="label">Alerte 1 — n°</label>
            <input className="input" value={form.tel_alerte_1} onChange={set("tel_alerte_1")} placeholder="+33…" inputMode="tel" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Alerte 2 (backup) — nom</label>
            <input className="input" value={form.alerte_2_nom} onChange={set("alerte_2_nom")} placeholder="Nom du destinataire" />
          </div>
          <div>
            <label className="label">Alerte 2 (backup) — n°</label>
            <input className="input" value={form.tel_alerte_2} onChange={set("tel_alerte_2")} placeholder="+33…" inputMode="tel" />
          </div>
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
