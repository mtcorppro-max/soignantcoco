"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { genererPdfSuivi } from "@/lib/pdfSuivi";
import type { Patient, Suivi } from "@/lib/types";

type ConstantesInit = { ta?: string; pouls?: string; temperature?: string; spo2?: string };

const VIDE = {
  etat_general: "",
  ta: "",
  pouls: "",
  temperature: "",
  spo2: "",
  douleur_en: "",
  alimentation: "",
  hydratation: "",
  transit: "",
  cicatrisation: "",
  mobilisation: "",
  bilan_sanguin: "",
};

export function SuiviPatient({
  patient,
  constantes,
}: {
  patient: Patient;
  constantes?: ConstantesInit;
}) {
  const pro = useProSession();
  const [suivis, setSuivis] = useState<Suivi[]>([]);
  const [ready, setReady] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ ...VIDE });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function charger() {
    const { data } = await createClient()
      .from("suivi")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false });
    setSuivis((data ?? []) as Suivi[]);
    setReady(true);
  }

  useEffect(() => {
    charger();
  }, [patient.id]);

  function ouvrir() {
    // Préremplit les constantes avec les dernières valeurs connues
    setForm({
      ...VIDE,
      ta: constantes?.ta ?? "",
      pouls: constantes?.pouls ?? "",
      temperature: constantes?.temperature ?? "",
      spo2: constantes?.spo2 ?? "",
    });
    setOuvert(true);
  }

  async function enregistrer() {
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("suivi")
      .insert({
        patient_id: patient.id,
        auteur_user_id: pro?.user_id ?? null,
        auteur_nom: pro?.nom ?? null,
        ...form,
      })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      console.error("Suivi insert error:", error);
      alert(`Échec de l'enregistrement du suivi.\n\n${error?.message ?? ""}${error?.hint ? `\n${error.hint}` : ""}`);
      return;
    }
    const nouveau = data as Suivi;
    setSuivis((prev) => [nouveau, ...prev]);
    setOuvert(false);
    // Génère le PDF dans la foulée
    genererPdfSuivi(patient, nouveau);
  }

  async function supprimer(id: string) {
    const { error } = await createClient().from("suivi").delete().eq("id", id);
    if (!error) setSuivis((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">Suivis</h2>
        {!ouvert && (
          <button onClick={ouvrir} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark">
            <span className="text-base leading-none">＋</span> Nouveau suivi
          </button>
        )}
      </div>

      {/* ── Formulaire ── */}
      {ouvert && (
        <div className="card grid gap-4">
          <p className="text-xs text-slate-500">
            Compte rendu du {new Date().toLocaleDateString("fr-FR")}. Une fois enregistré, le PDF est généré automatiquement.
          </p>

          <Bloc label="État général">
            <textarea className="input" rows={2} value={form.etat_general} onChange={set("etat_general")} />
          </Bloc>

          <div>
            <p className="label mb-1">Constantes</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Mini label="TA" value={form.ta} onChange={set("ta")} placeholder="12/8" />
              <Mini label="Pouls" value={form.pouls} onChange={set("pouls")} placeholder="bpm" />
              <Mini label="T°" value={form.temperature} onChange={set("temperature")} placeholder="°C" />
              <Mini label="SpO2" value={form.spo2} onChange={set("spo2")} placeholder="%" />
            </div>
          </div>

          <Bloc label="Douleur (EN, 0–10)">
            <input className="input" value={form.douleur_en} onChange={set("douleur_en")} placeholder="EN = …" inputMode="numeric" />
          </Bloc>
          <Bloc label="Alimentation (quantification prise alimentaire — bariatrique)">
            <textarea className="input" rows={2} value={form.alimentation} onChange={set("alimentation")} />
          </Bloc>
          <Bloc label="Hydratation (quantification hydrique — bariatrique)">
            <textarea className="input" rows={2} value={form.hydratation} onChange={set("hydratation")} />
          </Bloc>
          <Bloc label="Transit">
            <input className="input" value={form.transit} onChange={set("transit")} />
          </Bloc>
          <Bloc label="Cicatrisation">
            <textarea className="input" rows={2} value={form.cicatrisation} onChange={set("cicatrisation")} />
          </Bloc>
          <Bloc label="Mobilisation">
            <input className="input" value={form.mobilisation} onChange={set("mobilisation")} />
          </Bloc>
          <Bloc label="Bilan sanguin">
            <textarea className="input" rows={2} value={form.bilan_sanguin} onChange={set("bilan_sanguin")} />
          </Bloc>

          <div className="flex gap-2">
            <button onClick={() => setOuvert(false)} className="btn-secondary flex-1" disabled={busy}>
              Annuler
            </button>
            <button onClick={enregistrer} className="btn-primary flex-1" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer & générer le PDF"}
            </button>
          </div>
        </div>
      )}

      {/* ── Historique ── */}
      {!ready ? (
        <div className="h-12 animate-pulse rounded-2xl bg-white" />
      ) : suivis.length === 0 ? (
        !ouvert && <p className="card p-4 text-sm text-slate-400">Aucun suivi enregistré.</p>
      ) : (
        <div className="grid gap-2">
          {suivis.map((s) => (
            <div key={s.id} className="card flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Suivi du {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  <span className="text-slate-400"> · {new Date(s.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </p>
                {s.auteur_nom && <p className="text-xs text-slate-400">par {s.auteur_nom}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => genererPdfSuivi(patient, s)} className="text-sm font-medium text-brand hover:underline">
                  PDF
                </button>
                <button onClick={() => supprimer(s.id)} className="text-xs text-slate-400 hover:text-critique">
                  Suppr.
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Bloc({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label mb-1">{label}</label>
      {children}
    </div>
  );
}

function Mini({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <span className="text-[11px] text-slate-400">{label}</span>
      <input className="input mt-0.5" value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}
