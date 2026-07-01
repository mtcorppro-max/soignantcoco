"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/Select";

type Medecin = { id: string; nom: string; prenom: string | null; titre: string | null };
const nomComplet = (m: Medecin) => [m.titre, m.prenom, m.nom].filter(Boolean).join(" ");

// Bouton « Intégrer une ordonnance » : dépose une ordonnance déjà remplie
// (PDF ou photo). On demande si elle est déjà signée : oui → stockage direct ;
// non → envoi au médecin choisi pour signature.
export function IntegrerOrdonnance({ patientId, patientChirurgien, onCreated }: { patientId: string; patientChirurgien?: string | null; onCreated?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [signee, setSignee] = useState<null | boolean>(null);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [destinataire, setDestinataire] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    createClient().from("professionnel").select("id,nom,prenom,titre").eq("role", "chirurgien").order("nom")
      .then(({ data }) => {
        const m = (data ?? []) as Medecin[];
        setMedecins(m);
        const def = m.find((x) => nomComplet(x) === patientChirurgien);
        if (def) setDestinataire(def.id);
      });
  }, [ouvert, patientChirurgien]);

  function reset() {
    setOuvert(false); setFichier(null); setSignee(null); setDestinataire(""); setErreur(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function importer() {
    setErreur(null);
    if (!fichier) { setErreur("Choisissez un fichier (PDF ou photo)."); return; }
    if (signee === null) { setErreur("Indiquez si l'ordonnance est déjà signée."); return; }
    if (!signee && !destinataire) { setErreur("Choisissez le médecin signataire."); return; }
    setBusy(true);
    const data = new FormData();
    data.append("fichier", fichier);
    data.append("patient_id", patientId);
    data.append("signee", signee ? "oui" : "non");
    if (!signee) data.append("destinataire_id", destinataire);
    const res = await fetch("/api/ordonnance-import", { method: "POST", body: data });
    setBusy(false);
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "" }));
      setErreur(message || "Échec de l'import. Réessayez.");
      return;
    }
    onCreated?.();
    reset();
  }

  return (
    <>
      <button onClick={() => setOuvert(true)} className="btn-secondary inline-flex items-center gap-2 text-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        Intégrer une ordonnance
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4 pt-12" onClick={reset}>
          <div className="card grid w-full max-w-md gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Intégrer une ordonnance</h2>
              <button onClick={reset} className="text-slate-400 hover:text-critique">✕</button>
            </div>

            <div>
              <label className="label">Fichier (PDF ou photo)</label>
              <button onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-rose-300 px-3 py-3 text-left text-sm text-slate-600 hover:bg-rose-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-brand">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <span className="min-w-0 truncate">{fichier ? fichier.name : "Choisir un fichier…"}</span>
              </button>
              <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <label className="label">Cette ordonnance est-elle déjà signée ?</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSignee(true)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${signee === true ? "border-brand bg-rose-50 text-brand" : "border-rose-100 text-slate-600 hover:bg-rose-50"}`}>
                  Oui, déjà signée
                </button>
                <button onClick={() => setSignee(false)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${signee === false ? "border-brand bg-rose-50 text-brand" : "border-rose-100 text-slate-600 hover:bg-rose-50"}`}>
                  Non, à faire signer
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {signee === true ? "Elle sera simplement enregistrée dans le dossier."
                  : signee === false ? "Elle sera envoyée au médecin choisi pour signature."
                    : "Oui : stockage direct. Non : envoi au médecin pour signature."}
              </p>
            </div>

            {signee === false && (
              <div>
                <label className="label">Médecin signataire</label>
                <Select
                  value={destinataire}
                  onChange={setDestinataire}
                  placeholder={medecins.length ? "— Choisir un médecin —" : "Aucun compte médecin"}
                  options={medecins.map((m) => ({ value: m.id, label: nomComplet(m) }))}
                />
                <p className="mt-1 text-xs text-slate-400">Il la recevra dans son onglet « À signer ».</p>
              </div>
            )}

            {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{erreur}</p>}
            <button onClick={importer} disabled={busy} className="btn-primary py-3">
              {busy ? "Import…" : "Importer l'ordonnance"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
