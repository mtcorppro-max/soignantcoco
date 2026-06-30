"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { peutNotesFrais } from "@/lib/notesFrais";
import { formatTaille, type CoffreDocument } from "@/lib/coffre";

export default function CoffreFortPage() {
  const pro = useProSession();
  const interne = peutNotesFrais(pro?.role);

  // Verrou : a-t-on un code ? code saisi en mémoire (session) pour ouvrir les fichiers.
  const [aUnCode, setAUnCode] = useState<boolean | null>(null);
  const [deverrouille, setDeverrouille] = useState(false);
  const [code, setCode] = useState("");        // code courant (en mémoire après déverrouillage)
  const [saisie, setSaisie] = useState("");     // champ de saisie
  const [saisie2, setSaisie2] = useState("");    // confirmation (création)
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const [docs, setDocs] = useState<CoffreDocument[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Le coffre a-t-il déjà un code ?
  useEffect(() => {
    if (!pro?.id || !interne) return;
    createClient().rpc("coffre_a_un_code").then(({ data }) => setAUnCode(!!data));
  }, [pro?.id, interne]);

  const charger = useCallback(async () => {
    const { data } = await createClient().from("coffre_document").select("id,libelle,chemin_stockage,mime,taille,created_at,depose_par,professionnel_id").order("created_at", { ascending: false });
    setDocs((data ?? []) as CoffreDocument[]);
    setPret(true);
  }, []);

  // Charge les documents une fois déverrouillé.
  useEffect(() => { if (deverrouille) charger(); }, [deverrouille, charger]);

  async function creerCode() {
    if (saisie.length < 4) { setCodeErr("Choisissez un code d'au moins 4 caractères."); return; }
    if (saisie !== saisie2) { setCodeErr("Les deux codes ne correspondent pas."); return; }
    setCodeBusy(true); setCodeErr(null);
    const { data, error } = await createClient().rpc("coffre_definir_code", { p_code: saisie });
    setCodeBusy(false);
    if (error || !data) { setCodeErr("Impossible de définir le code."); return; }
    setCode(saisie); setSaisie(""); setSaisie2(""); setAUnCode(true); setDeverrouille(true);
  }

  async function ouvrirCoffre() {
    if (!saisie) return;
    setCodeBusy(true); setCodeErr(null);
    const { data } = await createClient().rpc("coffre_verifier_code", { p_code: saisie });
    setCodeBusy(false);
    if (!data) { setCodeErr("Code incorrect."); return; }
    setCode(saisie); setSaisie(""); setDeverrouille(true);
  }

  async function envoyer(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true); setErr(null);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("fichier", f);
      const res = await fetch("/api/coffre", { method: "POST", body: fd });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).message ?? "Échec de l'envoi."); break; }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    charger();
  }

  async function ouvrir(d: CoffreDocument) {
    const res = await fetch(`/api/coffre?chemins=${encodeURIComponent(d.chemin_stockage)}&code=${encodeURIComponent(code)}`);
    const url = (await res.json().catch(() => ({}))).urls?.[d.chemin_stockage];
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("Impossible d'ouvrir le document.");
  }

  async function supprimer(d: CoffreDocument) {
    if (!confirm(`Supprimer « ${d.libelle} » ?`)) return;
    const res = await fetch("/api/coffre", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id }) });
    if (!res.ok) { alert("Échec de la suppression."); return; }
    setDocs((arr) => arr.filter((x) => x.id !== d.id));
  }

  if (pro && !interne) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/pro/profil" prefetch className="text-sm text-slate-400 hover:text-brand">← Mon profil</Link>
        <p className="card mt-3 text-sm text-slate-500">Le coffre-fort est réservé au personnel interne de l&apos;entreprise.</p>
      </div>
    );
  }

  const entete = (
    <>
      <Link href="/pro/profil" prefetch className="text-sm text-slate-400 hover:text-brand">← Mon profil</Link>
      <h1 className="mb-1 mt-1 flex items-center gap-2 text-2xl font-bold text-slate-800">
        <IconeCadenas className="h-6 w-6 text-brand" /> Coffre-fort
      </h1>
    </>
  );

  // Écran de verrouillage : création du code, ou saisie pour ouvrir.
  if (!deverrouille) {
    return (
      <div className="mx-auto max-w-sm">
        {entete}
        <div className="card mt-4 grid gap-3">
          <div className="grid place-items-center gap-2 py-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-brand"><IconeCadenas className="h-7 w-7" /></span>
            {aUnCode === null ? (
              <p className="text-sm text-slate-400">Chargement…</p>
            ) : aUnCode ? (
              <>
                <p className="font-semibold text-slate-800">Entrez votre code</p>
                <p className="text-xs text-slate-400">Le code qui ouvre votre coffre-fort.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-slate-800">Créez votre code</p>
                <p className="text-xs text-slate-400">Il sera demandé à chaque ouverture du coffre. Conservez-le bien, il n&apos;est pas récupérable.</p>
              </>
            )}
          </div>

          {aUnCode && (
            <>
              <input type="password" inputMode="numeric" autoFocus className="input text-center tracking-widest" placeholder="Code" value={saisie} onChange={(e) => setSaisie(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ouvrirCoffre(); }} />
              {codeErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{codeErr}</p>}
              <button onClick={ouvrirCoffre} disabled={codeBusy || !saisie} className="btn-primary py-2.5 disabled:opacity-50">{codeBusy ? "Vérification…" : "Ouvrir le coffre"}</button>
            </>
          )}

          {aUnCode === false && (
            <>
              <input type="password" inputMode="numeric" autoFocus className="input text-center tracking-widest" placeholder="Nouveau code (4 caractères min.)" value={saisie} onChange={(e) => setSaisie(e.target.value)} />
              <input type="password" inputMode="numeric" className="input text-center tracking-widest" placeholder="Confirmez le code" value={saisie2} onChange={(e) => setSaisie2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") creerCode(); }} />
              {codeErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{codeErr}</p>}
              <button onClick={creerCode} disabled={codeBusy} className="btn-primary py-2.5 disabled:opacity-50">{codeBusy ? "Création…" : "Créer mon code"}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {entete}
      <p className="mb-5 text-sm text-slate-500">Vos documents personnels sécurisés (fiche de paie, contrat, attestations…). Visibles uniquement par vous.</p>

      {/* Dépôt */}
      <label className={`mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 px-4 py-8 text-center transition hover:bg-rose-50 ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        <span className="text-sm font-semibold text-slate-700">{busy ? "Envoi en cours…" : "Déposer un document"}</span>
        <span className="text-xs text-slate-400">Image ou PDF · 20 Mo max</span>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple className="hidden" onChange={(e) => envoyer(e.target.files)} disabled={busy} />
      </label>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}

      {/* Liste */}
      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : docs.length === 0 ? (
        <p className="card text-sm text-slate-400">Aucun document. Déposez votre premier fichier ci-dessus.</p>
      ) : (
        <div className="grid gap-2">
          {docs.map((d) => (
            <div key={d.id} className="card flex items-center justify-between gap-3 py-3">
              <button onClick={() => ouvrir(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-brand">
                  {d.mime === "application/pdf" ? "PDF" : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 3v5h5" /></svg>}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-700">{d.libelle}</span>
                    {d.depose_par && d.depose_par !== d.professionnel_id && <span className="badge shrink-0 bg-sky-100 text-sky-700">Déposé par RH</span>}
                  </span>
                  <span className="block text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString("fr-FR")}{d.taille ? ` · ${formatTaille(d.taille)}` : ""}</span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => ouvrir(d)} className="btn-secondary px-3 py-1.5 text-sm">Voir</button>
                <button onClick={() => supprimer(d)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-sm text-critique hover:bg-red-50">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IconeCadenas({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.2" r="1.2" />
    </svg>
  );
}
