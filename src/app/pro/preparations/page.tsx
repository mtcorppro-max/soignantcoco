"use client";

import { useCallback, useEffect, useState } from "react";
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

  const peutAcceder = pro?.role === "coordinatrice" || pro?.role === "livreur" || pro?.niveau === 0;

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

  // Scan d'un article → coche la ligne correspondante du panier en cours.
  function scanArticleScan(texte: string) {
    const liv = livs.find((x) => x.id === scanArticle?.id);
    if (!liv) return;
    const code = texte.trim();
    const ligne = liv.lignes.find((x) => x.article_code === code);
    if (ligne && !ligne.prepare) togglePrepare(ligne.id, true);
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
    return <div className="card text-sm text-slate-500">La préparation de commande est réservée aux coordinatrices et aux livreurs.</div>;
  }

  const aPreparer = livs.filter((l) => l.statut === "planifiee");
  const pretes = livs.filter((l) => l.statut === "preparee");
  const livrees = livs.filter((l) => l.statut === "livree");

  const carte = (l: Liv) => {
    const p = patientDe(l);
    const nbPrep = l.lignes.filter((x) => x.prepare).length;
    const editable = l.statut === "planifiee";
    return (
      <div key={l.id} id={`liv-${l.id}`} className={`card grid grid-cols-1 gap-3 ${openId === l.id ? "ring-2 ring-brand ring-offset-2" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-700">{p?.nom ?? "Patient"}</p>
            <p className="text-xs text-slate-400">Bon n° {ref(l)} · {l.lignes.length} article(s) · préparés {nbPrep}/{l.lignes.length}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && <button onClick={() => setScanArticle(l)} className="btn-secondary px-3 py-1.5 text-sm">📷 Scanner</button>}
            <button onClick={() => genererBonCommande({ reference: ref(l) }, bonPatient(p), bonLignes(l))} className="btn-secondary px-3 py-1.5 text-sm">📄 Bon de commande</button>
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
          {l.statut === "planifiee" && (
            <button onClick={() => validerPrep(l)} disabled={busy === l.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Valider la préparation</button>
          )}
          {l.statut === "preparee" && (
            <>
              <button onClick={() => genererBonLivraison({ reference: ref(l) }, bonPatient(p), bonLignes(l), urlQR(l))} className="btn-secondary px-3 py-1.5 text-sm">📄 Bon de livraison</button>
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
        <button onClick={() => setScanBon(true)} className="btn-secondary text-sm">📷 Scanner un bon</button>
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
      {scanBon && <Scanner titre="Scanner un bon de livraison" onScan={scanBonScan} onClose={() => setScanBon(false)} />}
    </div>
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
