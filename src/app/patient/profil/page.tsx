"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { ChangerMotDePasse } from "@/components/ChangerMotDePasse";
import { Select } from "@/components/Select";

type Form = { telephone: string; email: string; adresse: string; code_postal: string; ville: string; proche_nom: string; proche_tel: string; sexe: string };
const VIDE: Form = { telephone: "", email: "", adresse: "", code_postal: "", ville: "", proche_nom: "", proche_tel: "", sexe: "" };

export default function ProfilPatient() {
  const patient = usePatientSession();
  const [f, setF] = useState<Form>(VIDE);
  const [chemins, setChemins] = useState<{ carte_vitale_chemin: string | null; mutuelle_chemin: string | null }>({ carte_vitale_chemin: null, mutuelle_chemin: null });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function charger(id: string) {
    const { data } = await createClient()
      .from("patient")
      .select("telephone,email,adresse,code_postal,ville,proche_nom,proche_tel,sexe,carte_vitale_chemin,mutuelle_chemin")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      const d = data as Record<string, string | null>;
      setF({ ...VIDE, ...Object.fromEntries((Object.keys(VIDE) as (keyof Form)[]).map((k) => [k, d[k] ?? ""])) } as Form);
      setChemins({ carte_vitale_chemin: d.carte_vitale_chemin, mutuelle_chemin: d.mutuelle_chemin });
      const liste = [d.carte_vitale_chemin, d.mutuelle_chemin].filter(Boolean) as string[];
      if (liste.length) {
        const res = await fetch("/api/signed-urls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chemins: liste }) });
        setUrls((await res.json()).urls ?? {});
      }
    }
    setPret(true);
  }

  useEffect(() => { if (patient?.id) charger(patient.id); }, [patient?.id]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function sauver() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/patient/profil", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    setMsg(res.ok ? "Profil enregistré ✓" : "Échec de l'enregistrement.");
  }

  return (
    <div className="mx-auto max-w-lg grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mon profil</h1>
        <p className="mt-1 text-sm text-slate-500">Vos coordonnées et vos documents (carte Vitale, mutuelle).</p>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : (
        <>
          <div className="card grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Téléphone</label><input className="input" value={f.telephone} onChange={set("telephone")} inputMode="tel" /></div>
              <div><label className="label">Email</label><input className="input" value={f.email} onChange={set("email")} inputMode="email" /></div>
            </div>
            <AdresseAutocomplete
              adresse={f.adresse} codePostal={f.code_postal} ville={f.ville}
              onChange={(v) => setF((s) => ({ ...s, adresse: v.adresse, code_postal: v.code_postal, ville: v.ville }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Proche à prévenir</label><input className="input" value={f.proche_nom} onChange={set("proche_nom")} /></div>
              <div><label className="label">Tél. du proche</label><input className="input" value={f.proche_tel} onChange={set("proche_tel")} inputMode="tel" /></div>
            </div>
            <div>
              <label className="label">Sexe</label>
              <Select
                value={f.sexe}
                onChange={(v) => setF((s) => ({ ...s, sexe: v }))}
                placeholder="— Non renseigné —"
                options={[
                  { value: "feminin", label: "Féminin" },
                  { value: "masculin", label: "Masculin" },
                ]}
              />
              <p className="mt-1 text-xs text-slate-400">Permet d&apos;adapter votre personnage-guide dans l&apos;application.</p>
            </div>
            {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.includes("✓") ? "bg-green-50 text-ok" : "bg-red-50 text-critique"}`}>{msg}</p>}
            <button onClick={sauver} disabled={busy} className="btn-primary py-3">{busy ? "Enregistrement…" : "Enregistrer mes coordonnées"}</button>
          </div>

          <DocumentCarte titre="Carte Vitale" type="carte_vitale" url={chemins.carte_vitale_chemin ? urls[chemins.carte_vitale_chemin] : undefined} onUploaded={() => patient && charger(patient.id)} />
          <DocumentCarte titre="Mutuelle" type="mutuelle" url={chemins.mutuelle_chemin ? urls[chemins.mutuelle_chemin] : undefined} onUploaded={() => patient && charger(patient.id)} />

          <ChangerMotDePasse />
        </>
      )}
    </div>
  );
}

function DocumentCarte({ titre, type, url, onUploaded }: { titre: string; type: string; url?: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function envoyer(file: File) {
    setBusy(true); setErr(null);
    const data = new FormData();
    data.append("type", type);
    data.append("fichier", file);
    const res = await fetch("/api/patient/document", { method: "POST", body: data });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).message || "Échec de l'envoi."); return; }
    if (inputRef.current) inputRef.current.value = "";
    onUploaded();
  }

  return (
    <section className="card grid gap-3">
      <h2 className="text-sm font-semibold text-slate-700">{titre}</h2>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) envoyer(f); }} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={titre} className="max-h-56 w-full rounded-xl object-contain bg-rose-50" />
      ) : (
        <p className="text-sm text-slate-400">Aucun document enregistré.</p>
      )}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}
      <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-secondary inline-flex items-center justify-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" /><circle cx="12" cy="13" r="3.5" />
        </svg>
        {busy ? "Envoi…" : url ? "Remplacer la photo" : "Prendre / ajouter une photo"}
      </button>
    </section>
  );
}
