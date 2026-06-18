"use client";

import { useState } from "react";
import Link from "next/link";

export function NouveauPatientForm() {
  const [form, setForm] = useState({
    nom: "",
    code_postal: "",
    tel_alerte_1: "",
    tel_alerte_2: "",
  });
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
              setForm({ nom: "", code_postal: "", tel_alerte_1: "", tel_alerte_2: "" });
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
    <form onSubmit={onSubmit} className="card grid gap-4">
      <div>
        <label className="label">Nom du patient *</label>
        <input className="input" value={form.nom} onChange={set("nom")} required />
      </div>
      <div>
        <label className="label">Code postal (conseils météo)</label>
        <input className="input" value={form.code_postal} onChange={set("code_postal")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">N° alerte 1</label>
          <input
            className="input"
            value={form.tel_alerte_1}
            onChange={set("tel_alerte_1")}
            placeholder="+33…"
          />
        </div>
        <div>
          <label className="label">N° alerte 2 (backup)</label>
          <input
            className="input"
            value={form.tel_alerte_2}
            onChange={set("tel_alerte_2")}
            placeholder="+33…"
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
