"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { ChampsOrdonnance } from "@/components/ChampsOrdonnance";
import { MODELES_ORDONNANCE } from "@/lib/ordonnances";
import type { OrdonnanceType } from "@/components/EditeurOrdonnancesTypes";

type ProtoLite = { intervention?: string; ordonnances_types?: OrdonnanceType[] };
type Medecin = { id: string; nom: string; prenom: string | null; titre: string | null; protocoles: ProtoLite[] | null };
const nomComplet = (m: Medecin) => [m.titre, m.prenom, m.nom].filter(Boolean).join(" ");

export function GenerateurOrdonnance({ patientId, patientChirurgien, onCreated }: { patientId: string; patientChirurgien: string | null; onCreated?: () => void }) {
  const pro = useProSession();
  const [ouvert, setOuvert] = useState(false);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [destinataire, setDestinataire] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [valeurs, setValeurs] = useState<Record<string, Record<string, unknown>>>({});
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    createClient().from("professionnel").select("id,nom,prenom,titre,protocoles").eq("role", "chirurgien").order("nom")
      .then(({ data }) => {
        const m = (data ?? []) as unknown as Medecin[];
        setMedecins(m);
        const def = m.find((x) => nomComplet(x) === patientChirurgien);
        if (def) setDestinataire(def.id);
      });
  }, [ouvert, patientChirurgien]);

  const toggleModele = (id: string) =>
    setSelection((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const maj = (mid: string, key: string, val: unknown) =>
    setValeurs((prev) => ({ ...prev, [mid]: { ...prev[mid], [key]: val } }));

  async function envoyer() {
    setErreur(null);
    if (selection.size === 0) { setErreur("Choisissez au moins une ordonnance."); return; }
    if (!destinataire) { setErreur("Choisissez le médecin signataire."); return; }
    if (!pro?.prestataire_id) { setErreur("Aucun prestataire associé."); return; }
    setBusy(true);
    const rows = [...selection].map((id) => {
      const modele = MODELES_ORDONNANCE.find((m) => m.id === id)!;
      return {
        patient_id: patientId,
        prestataire_id: pro.prestataire_id,
        type: id,
        titre: modele.label,
        contenu: valeurs[id] ?? {},
        destinataire_id: destinataire,
        cree_par: pro.id,
        statut: "a_signer",
      };
    });
    const { error } = await createClient().from("ordonnance").insert(rows);
    setBusy(false);
    if (error) { setErreur("Échec : " + error.message); return; }
    setOk(true);
    onCreated?.();
  }

  function reset() {
    setOuvert(false); setOk(false); setSelection(new Set()); setValeurs({}); setErreur(null);
  }

  // Pré-remplir depuis une ordonnance type du médecin choisi (issues de ses protocoles).
  const med = medecins.find((m) => m.id === destinataire);
  const types = (med?.protocoles ?? []).flatMap((p) =>
    (p.ordonnances_types ?? []).map((t) => ({ t, label: `${p.intervention ? p.intervention + " — " : ""}${t.nom || "Sans nom"}` }))
  );
  const appliquerType = (idType: string) => {
    const t = types.find((x) => x.t.id === idType)?.t;
    if (!t) return;
    setSelection((prev) => new Set(prev).add(t.type));
    setValeurs((prev) => ({ ...prev, [t.type]: { ...t.contenu } }));
  };

  return (
    <>
      <button onClick={() => setOuvert(true)} className="btn-secondary inline-flex items-center gap-2 text-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h6M9 8h2M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        </svg>
        Générer une ordonnance
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-12 overflow-auto" onClick={reset}>
          <div className="card grid w-full max-w-2xl gap-4" onClick={(e) => e.stopPropagation()}>
            {ok ? (
              <div className="grid gap-3 text-center">
                <p className="text-sm text-slate-600">Ordonnance(s) envoyée(s) au médecin pour signature ✓</p>
                <button onClick={reset} className="btn-primary justify-self-center px-4">Fermer</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">Générer une ordonnance</h2>
                  <button onClick={reset} className="text-slate-400 hover:text-critique">✕</button>
                </div>

                <div>
                  <label className="label">Médecin signataire</label>
                  <Select
                    value={destinataire}
                    onChange={setDestinataire}
                    placeholder={medecins.length ? "— Choisir un médecin —" : "Aucun compte médecin"}
                    options={medecins.map((m) => ({ value: m.id, label: nomComplet(m) }))}
                  />
                  <p className="mt-1 text-xs text-slate-400">Il recevra l&apos;ordonnance dans son onglet « À signer ».</p>
                </div>

                {types.length > 0 && (
                  <div>
                    <label className="label">Pré-remplir depuis une ordonnance type</label>
                    <Select
                      value=""
                      onChange={appliquerType}
                      placeholder="— Choisir une ordonnance type —"
                      options={types.map((x) => ({ value: x.t.id, label: x.label }))}
                    />
                  </div>
                )}

                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Ordonnances à générer</p>
                <div className="grid gap-3">
                  {MODELES_ORDONNANCE.map((m) => {
                    const choisi = selection.has(m.id);
                    return (
                      <div key={m.id} className={`rounded-xl border p-3 transition ${choisi ? "border-brand bg-rose-50/40" : "border-rose-100"}`}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="checkbox" checked={choisi} onChange={() => toggleModele(m.id)} className="mt-1 h-4 w-4 accent-brand" />
                          <span>
                            <span className="font-semibold text-slate-800">{m.label}</span>
                            {m.description && <span className="block text-xs text-slate-400">{m.description}</span>}
                          </span>
                        </label>
                        {choisi && (
                          <div className="mt-3 border-t border-rose-100 pt-3">
                            <ChampsOrdonnance champs={m.champs} valeurs={valeurs[m.id] ?? {}} set={(k, val) => maj(m.id, k, val)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{erreur}</p>}
                <button onClick={envoyer} disabled={busy} className="btn-primary py-3">
                  {busy ? "Envoi…" : "Envoyer au médecin pour signature"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
