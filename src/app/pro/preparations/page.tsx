"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { SignaturePad } from "@/components/SignaturePad";
import { Scanner } from "@/components/Scanner";
import { Select } from "@/components/Select";
import { genererBonCommande, genererBonLivraison, type BonLigne, type BonPatient } from "@/lib/genererBons";

type Patient = { nom: string; adresse: string | null; code_postal: string | null; ville: string | null; telephone: string | null; agence_id: string | null };
type ArtEmbed = { designation: string; est_location: boolean };
type Ligne = {
  id: string; article_code: string; quantite: number; prepare: boolean; equipement_id: string | null;
  article: ArtEmbed | ArtEmbed[] | null;
  equipement: { numero_serie: string } | { numero_serie: string }[] | null;
};
type Dispo = { id: string; numero_serie: string; article_code: string };
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

type EquipRecup = { id: string; numero_serie: string; article: { designation: string } | { designation: string }[] | null; patient: { nom: string } | { nom: string }[] | null };
const nomDe = (v: { nom: string } | { nom: string }[] | null) => (Array.isArray(v) ? v[0]?.nom : v?.nom) ?? "";
const estLoc = (a: ArtEmbed | ArtEmbed[] | null) => !!(Array.isArray(a) ? a[0]?.est_location : a?.est_location);
const serie = (v: { numero_serie: string } | { numero_serie: string }[] | null) => (Array.isArray(v) ? v[0]?.numero_serie : v?.numero_serie) ?? "";

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
  const [aRecup, setARecup] = useState<EquipRecup[]>([]);
  const [dispos, setDispos] = useState<Dispo[]>([]);
  const peutRecup = pro?.role === "livreur" || pro?.role === "magasinier" || pro?.niveau === 0;
  const [feedback, setFeedback] = useState<{ type: "ok" | "info" | "erreur"; msg: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const peutAcceder = pro?.role === "magasinier" || pro?.role === "coordinatrice" || pro?.role === "livreur" || pro?.niveau === 0;
  // Seul le magasinier prépare (picking + validation) ; les autres consultent / livrent.
  const estMag = pro?.role === "magasinier" || pro?.niveau === 0;

  const charger = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("livraison")
      .select("id,patient_id,statut,date_prevue,signataire,livree_le,patient:patient_id(nom,adresse,code_postal,ville,telephone,agence_id),lignes:livraison_ligne(id,article_code,quantite,prepare,equipement_id,article:article_code(designation,est_location),equipement:equipement_id(numero_serie))")
      .in("statut", ["planifiee", "preparee", "livree"])
      .order("date_prevue", { ascending: true });
    let arr = (data ?? []) as unknown as Liv[];
    // Cloisonnement agence (la coordinatrice voit le prestataire ; on filtre).
    if (pro?.agence_id) arr = arr.filter((l) => patientDe(l)?.agence_id === pro.agence_id);
    setLivs(arr.filter((l) => l.lignes.length > 0)); // livraisons avec panier
    // Matériel de location chez les patients (à récupérer).
    const { data: eq } = await supabase
      .from("equipement")
      .select("id,numero_serie,article:article_code(designation),patient:patient_actuel_id(nom)")
      .eq("statut", "chez_patient");
    setARecup((eq ?? []) as unknown as EquipRecup[]);
    // Appareils disponibles (affectation par le magasinier).
    if (pro?.role === "magasinier" || pro?.niveau === 0) {
      const { data: d } = await supabase.from("equipement").select("id,numero_serie,article_code").eq("statut", "disponible");
      setDispos((d ?? []) as Dispo[]);
    }
    setPret(true);
  }, [pro?.agence_id, pro?.role, pro?.niveau]);
  useEffect(() => { if (pro && peutAcceder) charger(); else if (pro) setPret(true); }, [pro, peutAcceder, charger]);

  async function togglePrepare(ligneId: string, v: boolean) {
    await createClient().from("livraison_ligne").update({ prepare: v }).eq("id", ligneId);
    setLivs((arr) => arr.map((l) => ({ ...l, lignes: l.lignes.map((x) => (x.id === ligneId ? { ...x, prepare: v } : x)) })));
  }
  // Affecte un appareil (n° de série) à une ligne de location.
  async function affecterSerie(livId: string, ligne: Ligne, equipementId: string) {
    const supabase = createClient();
    const auteur = [pro?.prenom, pro?.nom].filter(Boolean).join(" ") || null;
    const r = await supabase.from("livraison_ligne").update({ equipement_id: equipementId }).eq("id", ligne.id);
    if (r.error) { alert("Échec : " + r.error.message); return; }
    await supabase.from("equipement").update({ statut: "affecte", livraison_id: livId, updated_at: new Date().toISOString() }).eq("id", equipementId);
    await supabase.from("equipement_mouvement").insert({ equipement_id: equipementId, type_mouvement: "affectation", livraison_id: livId, auteur_id: pro?.id ?? null, auteur_nom: auteur });
    setDispos((arr) => arr.filter((d) => d.id !== equipementId));
    charger();
  }
  async function desaffecterSerie(ligne: Ligne) {
    const supabase = createClient();
    if (ligne.equipement_id) await supabase.from("equipement").update({ statut: "disponible", livraison_id: null }).eq("id", ligne.equipement_id);
    await supabase.from("livraison_ligne").update({ equipement_id: null }).eq("id", ligne.id);
    charger();
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
    const restants = l.lignes.filter((x) => (estLoc(x.article) ? !x.equipement_id : !x.prepare)).length;
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
  // Scan du panier en cours : code article → coche un consommable ; n° de série → affecte un appareil de location.
  function scanArticleScan(texte: string) {
    const liv = livs.find((x) => x.id === scanArticle?.id);
    if (!liv) return;
    const code = texte.trim();
    // Consommable : QR = code article.
    const ligne = liv.lignes.find((x) => x.article_code === code && !estLoc(x.article));
    if (ligne) {
      if (ligne.prepare) { retour("info", `Déjà coché : ${desig(ligne.article)}`); return; }
      togglePrepare(ligne.id, true);
      retour("ok", `✓ ${desig(ligne.article)}`);
      return;
    }
    // Location : QR = n° de série d'un appareil disponible.
    const eq = dispos.find((d) => d.numero_serie === code);
    if (eq) {
      const cible = liv.lignes.find((x) => estLoc(x.article) && x.article_code === eq.article_code && !x.equipement_id);
      if (!cible) { retour("erreur", `Aucune ligne location pour ${code}`); return; }
      affecterSerie(liv.id, cible, eq.id);
      retour("ok", `✓ N° ${code} affecté`);
      return;
    }
    retour("erreur", `Hors panier : ${code}`);
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

  // Récupération chez le patient (livreur/magasinier) → en_transit.
  async function recuperer(eq: EquipRecup) {
    const etat = window.prompt("État au retour (ex. bon / à vérifier) :", "bon");
    if (etat === null) return;
    const { error } = await createClient().rpc("equipement_recuperer", { p_equipement: eq.id, p_etat: etat || null });
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }

  if (pro && !peutAcceder) {
    return <div className="card text-sm text-slate-500">La préparation de commande est réservée au magasinier, aux coordinatrices et aux livreurs.</div>;
  }

  const aPreparer = livs.filter((l) => l.statut === "planifiee");
  const pretes = livs.filter((l) => l.statut === "preparee");
  const livrees = livs.filter((l) => l.statut === "livree");

  const carte = (l: Liv) => {
    const p = patientDe(l);
    const nbPrep = l.lignes.filter((x) => (estLoc(x.article) ? !!x.equipement_id : x.prepare)).length;
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

        {/* Panier / picking (consommables = cocher ; location = affecter un n° de série) */}
        <div className="grid grid-cols-1 gap-1.5">
          {l.lignes.map((x) => {
            const loc = estLoc(x.article);
            const ok = loc ? !!x.equipement_id : x.prepare;
            return (
              <div key={x.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-sm ${ok ? "border-green-200 bg-green-50/50" : loc ? "border-sky-100" : "border-rose-100"}`}>
                <span className="flex min-w-0 items-center gap-2">
                  {!loc && <input type="checkbox" checked={x.prepare} disabled={!editable} onChange={(e) => togglePrepare(x.id, e.target.checked)} className="h-4 w-4 accent-brand" />}
                  <span className="min-w-0">
                    <span className="block truncate text-slate-700">{desig(x.article)}{loc && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] font-medium text-sky-700">location</span>}</span>
                    <span className="block text-xs text-slate-400">Réf. {x.article_code}{loc && x.equipement_id ? ` · N° ${serie(x.equipement)}` : ""}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {loc ? (
                    !editable ? (
                      <span className="text-xs text-slate-500">{x.equipement_id ? `N° ${serie(x.equipement)}` : "à affecter"}</span>
                    ) : x.equipement_id ? (
                      <button onClick={() => desaffecterSerie(x)} className="text-xs text-critique hover:underline">retirer</button>
                    ) : (
                      <div className="w-40"><Select value="" onChange={(v) => v && affecterSerie(l.id, x, v)} placeholder="Affecter n° série" options={dispos.filter((d) => d.article_code === x.article_code).map((d) => ({ value: d.id, label: d.numero_serie }))} /></div>
                    )
                  ) : (
                    <span className="font-semibold text-slate-700">×{x.quantite}</span>
                  )}
                </span>
              </div>
            );
          })}
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

      {pret && aRecup.length > 0 && (
        <section className="grid grid-cols-1 gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Matériel à récupérer ({aRecup.length})</h2>
          {aRecup.map((eq) => (
            <div key={eq.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-700">{(Array.isArray(eq.article) ? eq.article[0]?.designation : eq.article?.designation) ?? "Équipement"} · <span className="font-mono text-sm text-slate-500">{eq.numero_serie}</span></p>
                <p className="text-xs text-slate-400">Chez {nomDe(eq.patient) || "—"}</p>
              </div>
              {peutRecup && (
                <button onClick={() => recuperer(eq)} className="btn-primary px-3 py-1.5 text-sm">Récupérer</button>
              )}
            </div>
          ))}
        </section>
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
