"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { SignaturePad } from "@/components/SignaturePad";
import { Scanner } from "@/components/Scanner";
import { genererBonCommande, genererBonLivraison, type BonLigne, type BonPatient } from "@/lib/genererBons";

type Patient = { nom: string; adresse: string | null; code_postal: string | null; ville: string | null; telephone: string | null; agence_id: string | null };
type Ligne = { id: string; article_code: string; quantite: number; prepare: boolean; article: { designation: string } | { designation: string }[] | null };
type Liv = {
  id: string; patient_id: string; statut: string; date_prevue: string | null;
  signataire: string | null; livree_le: string | null;
  patient: Patient | Patient[] | null;
  lignes: Ligne[];
};

// Petit bip (Web Audio) — aigu si OK, grave si erreur. Sans fichier audio.
let audioCtx: AudioContext | null = null;
function bip(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = "sine"; o.frequency.value = ok ? 880 : 300;
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.13 : 0.25));
    o.start(t); o.stop(t + (ok ? 0.14 : 0.26));
  } catch { /* audio non dispo */ }
}

const patientDe = (l: Liv) => (Array.isArray(l.patient) ? l.patient[0] : l.patient) ?? null;
const desig = (a: Ligne["article"]) => (Array.isArray(a) ? a[0]?.designation : a?.designation) ?? "";
const ref = (l: Liv) => l.id.slice(0, 8).toUpperCase();

function bonLignes(l: Liv): BonLigne[] {
  return l.lignes.map((x) => ({ code: x.article_code, designation: desig(x.article), quantite: x.quantite }));
}
function bonPatient(p: Patient | null): BonPatient {
  return { nom: p?.nom ?? "Patient", adresse: p?.adresse, code_postal: p?.code_postal, ville: p?.ville, telephone: p?.telephone };
}

export default function PreparationsPage() {
  const pro = useProSession();
  const [livs, setLivs] = useState<Liv[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [signer, setSigner] = useState<Liv | null>(null);
  const [scanArticle, setScanArticle] = useState<Liv | null>(null);
  const [scanBon, setScanBon] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "info" | "erreur"; msg: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const peutAcceder = pro?.role === "magasinier" || pro?.role === "coordinatrice" || pro?.role === "livreur" || pro?.niveau === 0;
  // Seul le magasinier prépare (picking + validation) ; les autres consultent / livrent.
  const estMag = pro?.role === "magasinier" || pro?.niveau === 0;

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("livraison")
      .select("id,patient_id,statut,date_prevue,signataire,livree_le,patient:patient_id(nom,adresse,code_postal,ville,telephone,agence_id),lignes:livraison_ligne(id,article_code,quantite,prepare,article:article_code(designation))")
      .in("statut", ["planifiee", "preparee", "livree"])
      .order("date_prevue", { ascending: true });
    let arr = (data ?? []) as unknown as Liv[];
    // Cloisonnement agence (la coordinatrice voit le prestataire ; on filtre).
    if (pro?.agence_id) arr = arr.filter((l) => patientDe(l)?.agence_id === pro.agence_id);
    arr = arr.filter((l) => l.lignes.length > 0); // seules les livraisons avec panier
    setLivs(arr);
    setPret(true);
  }, [pro?.agence_id]);
  useEffect(() => { if (pro && peutAcceder) charger(); else if (pro) setPret(true); }, [pro, peutAcceder, charger]);

  async function togglePrepare(ligneId: string, v: boolean) {
    await createClient().from("livraison_ligne").update({ prepare: v }).eq("id", ligneId);
    setLivs((arr) => arr.map((l) => ({ ...l, lignes: l.lignes.map((x) => (x.id === ligneId ? { ...x, prepare: v } : x)) })));
  }

  const urlQR = (l: Liv) => `${typeof window !== "undefined" ? window.location.origin : ""}/pro/preparations?l=${l.id}`;

  // Aperçu d'un PDF dans un onglet (sans téléchargement). Onglet ouvert sur le
  // clic pour éviter le blocage popup, puis chargé une fois le PDF prêt.
  async function apercu(gen: () => string | void | Promise<string | void>) {
    const win = window.open("", "_blank");
    const url = await gen();
    if (typeof url === "string" && win) win.location.href = url;
    else win?.close();
  }

  async function validerPrep(l: Liv) {
    const restants = l.lignes.filter((x) => !x.prepare).length;
    if (restants > 0 && !confirm(`${restants} article(s) non coché(s). Valider la préparation quand même ?`)) return;
    setBusy(l.id);
    const { error } = await createClient().from("livraison").update({ statut: "preparee", updated_at: new Date().toISOString() }).eq("id", l.id);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    await genererBonLivraison({ reference: ref(l) }, bonPatient(patientDe(l)), bonLignes(l), urlQR(l));
    charger();
  }

  async function confirmerLivraison(image: string, nom: string) {
    const l = signer; if (!l) return;
    setBusy(l.id);
    const now = new Date();
    const { error } = await createClient().from("livraison")
      .update({ statut: "livree", signature: image, signataire: nom || null, livree_le: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", l.id);
    setBusy(null); setSigner(null);
    if (error) { alert("Échec : " + error.message); return; }
    await genererBonLivraison({ reference: ref(l) }, bonPatient(patientDe(l)), bonLignes(l), urlQR(l), { image, nom: nom || "—", date: now });
    charger();
  }

  // Retour visuel + sonore + vibration après un scan.
  function retour(type: "ok" | "info" | "erreur", msg: string) {
    setFeedback({ type, msg });
    bip(type === "ok");
    try { if (navigator.vibrate) navigator.vibrate(type === "ok" ? 50 : [40, 30, 40]); } catch { /* */ }
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1400);
  }
  // Scan d'un article → coche la ligne correspondante du panier en cours.
  function scanArticleScan(texte: string) {
    const liv = livs.find((x) => x.id === scanArticle?.id);
    if (!liv) return;
    const code = texte.trim();
    const ligne = liv.lignes.find((x) => x.article_code === code);
    if (!ligne) { retour("erreur", `Hors panier : ${code}`); return; }
    if (ligne.prepare) { retour("info", `Déjà coché : ${desig(ligne.article)}`); return; }
    togglePrepare(ligne.id, true);
    retour("ok", `✓ ${desig(ligne.article)}`);
  }
  // Scan d'un bon de livraison (QR = URL avec ?l=) → met en évidence la livraison.
  function scanBonScan(texte: string) {
    let l = "";
    try { l = new URL(texte).searchParams.get("l") ?? ""; } catch { l = ""; }
    setScanBon(false);
    if (l) setOpenId(l); else alert("QR non reconnu.");
  }
  // Ouverture via ?l= (depuis un QR scanné par l'appareil photo natif).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const l = new URLSearchParams(window.location.search).get("l");
    if (l) setOpenId(l);
  }, []);
  useEffect(() => {
    if (!openId || !pret) return;
    const el = document.getElementById("liv-" + openId);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  }, [openId, pret]);

  if (pro && !peutAcceder) {
    return <div className="card text-sm text-slate-500">La préparation de commande est réservée au magasinier, aux coordinatrices et aux livreurs.</div>;
  }

  const aPreparer = livs.filter((l) => l.statut === "planifiee");
  const pretes = livs.filter((l) => l.statut === "preparee");
  const livrees = livs.filter((l) => l.statut === "livree");

  const carte = (l: Liv) => {
    const p = patientDe(l);
    const nbPrep = l.lignes.filter((x) => x.prepare).length;
    const editable = l.statut === "planifiee" && estMag;
    return (
      <div key={l.id} id={`liv-${l.id}`} className={`card grid grid-cols-1 gap-3 ${openId === l.id ? "ring-2 ring-brand ring-offset-2" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-700">{p?.nom ?? "Patient"}</p>
            <p className="text-xs text-slate-400">Bon n° {ref(l)} · {l.lignes.length} article(s) · préparés {nbPrep}/{l.lignes.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && <button onClick={() => setScanArticle(l)} className="btn-secondary px-3 py-1.5 text-sm"><IconeCam /> Scanner</button>}
            <button onClick={() => apercu(() => genererBonCommande({ reference: ref(l) }, bonPatient(p), bonLignes(l), "bloburl"))} className="btn-secondary px-2.5 py-1.5 text-sm" title="Aperçu (sans télécharger)"><Oeil /></button>
            <button onClick={() => genererBonCommande({ reference: ref(l) }, bonPatient(p), bonLignes(l))} className="btn-secondary px-3 py-1.5 text-sm"><IconeDoc /> Bon de commande</button>
          </div>
        </div>

        {/* Panier / picking */}
        <div className="grid grid-cols-1 gap-1.5">
          {l.lignes.map((x) => (
            <label key={x.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm ${x.prepare ? "border-green-200 bg-green-50/50" : "border-rose-100"}`}>
              <span className="flex min-w-0 items-center gap-2">
                <input type="checkbox" checked={x.prepare} disabled={!editable} onChange={(e) => togglePrepare(x.id, e.target.checked)} className="h-4 w-4 accent-brand" />
                <span className="min-w-0">
                  <span className="block truncate text-slate-700">{desig(x.article)}</span>
                  <span className="block text-xs text-slate-400">Réf. {x.article_code}</span>
                </span>
              </span>
              <span className="shrink-0 font-semibold text-slate-700">×{x.quantite}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {l.statut === "planifiee" && estMag && (
            <button onClick={() => validerPrep(l)} disabled={busy === l.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Valider la préparation</button>
          )}
          {l.statut === "planifiee" && !estMag && (
            <span className="text-xs text-slate-400">En attente de préparation par le magasinier</span>
          )}
          {l.statut === "preparee" && (
            <>
              <button onClick={() => apercu(() => genererBonLivraison({ reference: ref(l) }, bonPatient(p), bonLignes(l), urlQR(l), null, "bloburl"))} className="btn-secondary px-2.5 py-1.5 text-sm" title="Aperçu (sans télécharger)"><Oeil /></button>
              <button onClick={() => genererBonLivraison({ reference: ref(l) }, bonPatient(p), bonLignes(l), urlQR(l))} className="btn-secondary px-3 py-1.5 text-sm"><IconeDoc /> Bon de livraison</button>
              <button onClick={() => setSigner(l)} disabled={busy === l.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Livrer (signature)</button>
            </>
          )}
          {l.statut === "livree" && (
            <span className="text-xs text-slate-500">Livré{l.signataire ? ` — signé par ${l.signataire}` : ""}{l.livree_le ? ` le ${new Date(l.livree_le).toLocaleDateString("fr-FR")}` : ""}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Préparation de commande</h1>
          <p className="mt-1 text-sm text-slate-500">Préparez le panier, validez (bon de livraison), livrez avec signature.</p>
        </div>
        <button onClick={() => setScanBon(true)} className="btn-secondary text-sm"><IconeCam /> Scanner un bon</button>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : livs.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune commande à préparer. Les livraisons avec un panier d&apos;articles apparaissent ici.</p>
      ) : (
        <>
          <Section titre={`À préparer (${aPreparer.length})`} vide="Aucune commande à préparer.">{aPreparer.map(carte)}</Section>
          <Section titre={`Prêtes à livrer (${pretes.length})`} vide="">{pretes.map(carte)}</Section>
          {livrees.length > 0 && <Section titre={`Livrées (${livrees.length})`} vide="">{livrees.map(carte)}</Section>}
        </>
      )}

      {signer && <SignaturePad onValider={confirmerLivraison} onAnnuler={() => setSigner(null)} />}
      {scanArticle && <Scanner continu titre="Scanner les articles" onScan={scanArticleScan} onClose={() => setScanArticle(null)} />}
      {feedback && (
        <div
          className={`fixed left-1/2 top-6 z-[60] max-w-[90vw] -translate-x-1/2 truncate rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${
            feedback.type === "ok" ? "bg-green-600 text-white"
              : feedback.type === "info" ? "bg-amber-100 text-attention"
                : "bg-critique text-white"
          }`}
        >
          {feedback.msg}
        </div>
      )}
      {scanBon && <Scanner titre="Scanner un bon de livraison" onScan={scanBonScan} onClose={() => setScanBon(false)} />}
    </div>
  );
}

function Oeil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconeCam() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7.5h3L8.5 5h7L17 7.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.3" />
    </svg>
  );
}
function IconeDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function Section({ titre, vide, children }: { titre: string; vide: string; children: React.ReactNode[] }) {
  if (children.length === 0 && !vide) return null;
  return (
    <section className="grid grid-cols-1 gap-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">{titre}</h2>
      {children.length === 0 ? <p className="text-sm text-slate-400">{vide}</p> : children}
    </section>
  );
}
