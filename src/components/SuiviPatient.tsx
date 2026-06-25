"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { genererPdfSuivi } from "@/lib/pdfSuivi";
import type { Patient, Suivi } from "@/lib/types";

type PhotoSuivi = { chemin: string; url?: string; legende: string | null };
type GalPhoto = { id: string; chemin: string; url?: string; legende: string | null; suivi_id: string | null };

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
  const [galerie, setGalerie] = useState<GalPhoto[]>([]);
  const [photosParSuivi, setPhotosParSuivi] = useState<Record<string, PhotoSuivi[]>>({});
  const [selection, setSelection] = useState<string[]>([]); // ids des photos choisies
  const [ready, setReady] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ ...VIDE });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function toggleSelection(id: string) {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function charger() {
    const supabase = createClient();
    const [{ data: sv }, { data: ph }] = await Promise.all([
      supabase.from("suivi").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabase.from("photo").select("id,suivi_id,chemin_stockage,legende").eq("patient_id", patient.id).order("horodatage", { ascending: false }),
    ]);
    setSuivis((sv ?? []) as Suivi[]);
    setReady(true);

    const photos = (ph ?? []) as { id: string; suivi_id: string | null; chemin_stockage: string; legende: string | null }[];
    if (photos.length === 0) {
      setGalerie([]);
      setPhotosParSuivi({});
      return;
    }
    // URLs signées pour toutes les photos du dossier (galerie + vignettes)
    const res = await fetch("/api/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chemins: photos.map((p) => p.chemin_stockage) }),
    });
    const urls: Record<string, string> = (await res.json().catch(() => ({ urls: {} }))).urls ?? {};
    const gal: GalPhoto[] = photos.map((p) => ({
      id: p.id,
      chemin: p.chemin_stockage,
      url: urls[p.chemin_stockage],
      legende: p.legende,
      suivi_id: p.suivi_id,
    }));
    setGalerie(gal);
    const map: Record<string, PhotoSuivi[]> = {};
    gal.forEach((p) => {
      if (p.suivi_id) (map[p.suivi_id] ??= []).push({ chemin: p.chemin, url: p.url, legende: p.legende });
    });
    setPhotosParSuivi(map);
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
    setSelection([]);
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
    if (error || !data) {
      setBusy(false);
      console.error("Suivi insert error:", error);
      alert(`Échec de l'enregistrement du suivi.\n\n${error?.message ?? ""}${error?.hint ? `\n${error.hint}` : ""}`);
      return;
    }
    const nouveau = data as Suivi;

    // Rattache les photos choisies (déjà dans le dossier) à ce suivi
    if (selection.length > 0) {
      const { error: errP } = await supabase
        .from("photo")
        .update({ suivi_id: nouveau.id })
        .in("id", selection);
      if (errP) {
        alert(`Le suivi est enregistré, mais le rattachement des photos a échoué.\n\n${errP.message ?? ""}`);
      }
    }

    setBusy(false);
    setOuvert(false);
    setSelection([]);
    setSuivis((prev) => [nouveau, ...prev]);
    charger(); // rafraîchit la liste + les vignettes photo
    // Génère le PDF dans la foulée
    genererPdfSuivi(patient, nouveau);
  }

  async function supprimer(id: string) {
    const { error } = await createClient().from("suivi").delete().eq("id", id);
    if (!error) {
      setSuivis((prev) => prev.filter((s) => s.id !== id));
      setPhotosParSuivi((prev) => {
        const { [id]: _, ...reste } = prev;
        return reste;
      });
    }
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

          <Bloc label="Photos de la cicatrice (choisir dans le dossier)">
            {galerie.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rose-200 bg-rose-50 px-3 py-4 text-sm text-slate-400">
                Aucune photo dans le dossier. Le patient peut en envoyer depuis son espace « Photos de cicatrice ».
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {galerie.map((p) => {
                  const choisie = selection.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSelection(p.id)}
                      className={`relative aspect-square overflow-hidden rounded-lg ring-2 transition ${choisie ? "ring-brand" : "ring-transparent hover:ring-rose-200"}`}
                    >
                      {p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt={p.legende ?? "Cicatrice"} className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-rose-50 text-xl">📷</span>
                      )}
                      {choisie && (
                        <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
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
          {suivis.map((s) => {
            const photos = photosParSuivi[s.id] ?? [];
            return (
              <div key={s.id} className="card flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {photos.map((p, i) =>
                    p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={i} href={p.url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img
                          src={p.url}
                          alt={p.legende ?? "Cicatrice"}
                          className="h-12 w-12 rounded-lg object-cover ring-1 ring-rose-100"
                        />
                      </a>
                    ) : null
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">
                      Suivi du {new Date(s.created_at).toLocaleDateString("fr-FR")}
                      <span className="text-slate-400"> · {new Date(s.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </p>
                    {s.auteur_nom && <p className="text-xs text-slate-400">par {s.auteur_nom}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button onClick={() => genererPdfSuivi(patient, s)} className="text-sm font-medium text-brand hover:underline">
                    PDF
                  </button>
                  <button onClick={() => supprimer(s.id)} className="text-xs text-slate-400 hover:text-critique">
                    Suppr.
                  </button>
                </div>
              </div>
            );
          })}
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
