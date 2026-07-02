"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { modeleOrdo, valeurLisible } from "@/lib/ordonnances";
import { genererPdfOrdo } from "@/lib/genererPdfOrdo";
import { GenerateurOrdonnance } from "@/components/GenerateurOrdonnance";
import { IntegrerOrdonnance } from "@/components/IntegrerOrdonnance";
import { ChampsOrdonnance } from "@/components/ChampsOrdonnance";
import { Select } from "@/components/Select";

type Pro = { nom: string; prenom: string | null; titre: string | null; rpps: string | null; cabinets: string | null };
export type Ordo = {
  id: string;
  type: string;
  titre: string;
  contenu: Record<string, unknown>;
  destinataire_id: string | null;
  destinataire: Pro | Pro[] | null;
  statut: "a_signer" | "signee" | "refusee";
  signature: string | null;
  signataire_nom: string | null;
  signee_le: string | null;
  created_at: string;
};
export function OrdonnancesPatient({ patientId, patientNom, patientNaissance, patientChirurgien }: { patientId: string; patientNom: string; patientNaissance: string | null; patientChirurgien: string | null }) {
  const pro = useProSession();
  // Médecin (chirurgien) : consulte et signe les ordonnances, mais n'en génère
  // pas et ne les modifie/supprime pas.
  const lectureSeule = pro?.role === "chirurgien";
  const [ordos, setOrdos] = useState<Ordo[]>([]);
  const [signer, setSigner] = useState<Ordo | null>(null);
  const [editer, setEditer] = useState<Ordo | null>(null);

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("ordonnance")
      .select("id,type,titre,contenu,destinataire_id,statut,signature,signataire_nom,signee_le,created_at,destinataire:destinataire_id(nom,prenom,titre,rpps,cabinets)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    setOrdos((data ?? []) as Ordo[]);
  }, [patientId]);

  useEffect(() => { charger(); }, [charger]);

  async function genererPdf(o: Ordo, mode: "download" | "bloburl") {
    return genererPdfOrdo(o, patientNom, patientNaissance, mode);
  }

  // Ordonnance importée : URL signée du fichier stocké (bucket privé).
  async function urlImporte(o: Ordo): Promise<string | null> {
    const res = await fetch(`/api/ordonnance-import?id=${o.id}`);
    if (!res.ok) return null;
    const { url } = await res.json().catch(() => ({ url: null }));
    return typeof url === "string" ? url : null;
  }

  async function telecharger(o: Ordo) {
    if (o.type === "importee") {
      try {
        const url = await urlImporte(o);
        if (!url) { alert("Fichier introuvable."); return; }
        const blob = await (await fetch(url)).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = o.titre || "ordonnance"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      } catch { alert("Impossible de télécharger le fichier."); }
      return;
    }
    try { await genererPdf(o, "download"); }
    catch (e) { alert("Impossible de générer le PDF.\n" + (e instanceof Error ? e.message : "")); }
  }
  async function voir(o: Ordo) {
    // iOS : on ouvre l'onglet dans le geste de clic (sinon bloqué). Android /
    // Samsung : si la pop-up est bloquée, on bascule sur l'onglet courant.
    const win = window.open("", "_blank");
    try {
      const url = o.type === "importee" ? await urlImporte(o) : await genererPdf(o, "bloburl");
      if (typeof url !== "string") { win?.close(); if (o.type === "importee") alert("Fichier introuvable."); return; }
      if (win && !win.closed) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      win?.close();
      alert("Impossible d'ouvrir le PDF.\n" + (e instanceof Error ? e.message : ""));
    }
  }

  async function supprimer(o: Ordo) {
    if (!confirm(`Supprimer l'ordonnance « ${o.titre} » ?`)) return;
    if (o.type === "importee") {
      const res = await fetch("/api/ordonnance-import", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id }) });
      if (!res.ok) { const { message } = await res.json().catch(() => ({ message: "" })); alert(message || "Échec de la suppression."); return; }
      setOrdos((arr) => arr.filter((x) => x.id !== o.id));
      return;
    }
    const { error } = await createClient().from("ordonnance").delete().eq("id", o.id);
    if (error) { alert("Échec : " + error.message); return; }
    setOrdos((arr) => arr.filter((x) => x.id !== o.id));
  }

  const monId = pro?.id ?? "";

  return (
    <section className="card grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Ordonnances</h2>
        {!lectureSeule && (
          <div className="flex flex-wrap items-center gap-2">
            <GenerateurOrdonnance patientId={patientId} patientChirurgien={patientChirurgien} onCreated={charger} />
            <IntegrerOrdonnance patientId={patientId} patientChirurgien={patientChirurgien} onCreated={charger} />
          </div>
        )}
      </div>

      {ordos.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune ordonnance pour ce patient.</p>
      ) : (
        <div className="grid gap-2">
          {ordos.map((o) => {
            const aSigner = o.statut === "a_signer" && o.destinataire_id === monId;
            return (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{o.titre}</span>
                    {o.type === "importee" && <span className="badge bg-sky-100 text-sky-700">Importée</span>}
                    {o.statut === "signee"
                      ? <span className="badge bg-green-100 text-ok">Signée</span>
                      : o.statut === "refusee"
                        ? <span className="badge bg-red-100 text-critique">Refusée</span>
                        : <span className="badge bg-amber-100 text-attention">En attente de signature</span>}
                  </div>
                  <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {aSigner && <button onClick={() => setSigner(o)} className="btn-primary px-3 py-1.5 text-sm">Lire et signer</button>}
                  {!lectureSeule && o.statut !== "signee" && (
                    <button onClick={() => setEditer(o)} className="btn-secondary px-3 py-1.5 text-sm">Modifier</button>
                  )}
                  <button onClick={() => voir(o)} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Voir
                  </button>
                  <button onClick={() => telecharger(o)} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                    </svg>
                    PDF
                  </button>
                  {!lectureSeule && <button onClick={() => supprimer(o)} className="rounded-lg border border-rose-200 px-2 py-1.5 text-sm text-critique hover:bg-red-50">✕</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {signer && (
        <SignatureModal
          ordo={signer}
          patientNom={patientNom}
          signataire={[pro?.titre, pro?.prenom, pro?.nom].filter(Boolean).join(" ")}
          onClose={() => setSigner(null)}
          onSigned={() => { setSigner(null); charger(); }}
        />
      )}

      {editer && (
        <EditeurOrdonnance
          ordo={editer}
          onClose={() => setEditer(null)}
          onSaved={() => { setEditer(null); charger(); }}
        />
      )}
    </section>
  );
}

function EditeurOrdonnance({ ordo, onClose, onSaved }: { ordo: Ordo; onClose: () => void; onSaved: () => void }) {
  const modele = modeleOrdo(ordo.type);
  const [valeurs, setValeurs] = useState<Record<string, unknown>>({ ...ordo.contenu });
  const [medecins, setMedecins] = useState<{ id: string; nom: string; prenom: string | null; titre: string | null }[]>([]);
  const [destinataire, setDestinataire] = useState(ordo.destinataire_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    createClient().from("professionnel").select("id,nom,prenom,titre").eq("role", "chirurgien").order("nom")
      .then(({ data }) => setMedecins((data ?? []) as { id: string; nom: string; prenom: string | null; titre: string | null }[]));
  }, []);

  async function sauver() {
    setBusy(true); setErr(null);
    const { error } = await createClient().from("ordonnance").update({ contenu: valeurs, destinataire_id: destinataire || null, statut: "a_signer" }).eq("id", ordo.id).neq("statut", "signee");
    setBusy(false);
    if (error) { setErr("Échec : " + error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4 pt-12" onClick={onClose}>
      <div className="card grid w-full max-w-2xl gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Modifier — {ordo.titre}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-critique">✕</button>
        </div>
        <div>
          <label className="label">Médecin signataire</label>
          <Select value={destinataire} onChange={setDestinataire} placeholder="— Choisir un médecin —"
            options={medecins.map((m) => ({ value: m.id, label: [m.titre, m.prenom, m.nom].filter(Boolean).join(" ") }))} />
        </div>
        {modele && <ChampsOrdonnance champs={modele.champs} valeurs={valeurs} set={(k, v) => setValeurs((s) => ({ ...s, [k]: v }))} />}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}
        <button onClick={sauver} disabled={busy} className="btn-primary py-3">{busy ? "Enregistrement…" : "Enregistrer les modifications"}</button>
      </div>
    </div>
  );
}

export function SignatureModal({ ordo, patientNom, signataire, onClose, onSigned }: { ordo: Ordo; patientNom: string; signataire: string; onClose: () => void; onSigned: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessine = useRef(false);
  const [vide, setVide] = useState(true);
  const [busy, setBusy] = useState(false);
  const modele = modeleOrdo(ordo.type);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#1e293b";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const down = (e: React.PointerEvent) => { dessine.current = true; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e: React.PointerEvent) => { if (!dessine.current) return; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setVide(false); };
  const up = () => { dessine.current = false; };
  const effacer = () => { const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setVide(true); };

  // Ordonnance importée : ouvre le fichier déposé (URL signée) pour le relire.
  async function voirDocument() {
    const win = window.open("", "_blank");
    const res = await fetch(`/api/ordonnance-import?id=${ordo.id}`);
    const { url } = await res.json().catch(() => ({ url: null }));
    if (typeof url !== "string") { win?.close(); alert("Document introuvable."); return; }
    if (win && !win.closed) win.location.href = url; else window.location.href = url;
  }

  async function signerOrdo() {
    if (vide) return;
    setBusy(true);
    const signature = canvasRef.current!.toDataURL("image/png");
    // Ordonnance importée : on incruste la signature sur le fichier puis on le ré-enregistre.
    if (ordo.type === "importee") {
      try {
        const rep = await fetch(`/api/ordonnance-import?id=${ordo.id}`);
        const { url } = await rep.json().catch(() => ({ url: null }));
        if (typeof url !== "string") throw new Error("Fichier introuvable.");
        const src = await fetch(url);
        const bytes = await src.arrayBuffer();
        const mime = (ordo.contenu as { mime?: string })?.mime || src.headers.get("content-type") || "";
        const { signerFichierImporte } = await import("@/lib/signerImporte");
        const signe = await signerFichierImporte(bytes, mime, signature, signataire, new Date().toLocaleDateString("fr-FR"));
        const fd = new FormData();
        fd.append("id", ordo.id);
        fd.append("signataire", signataire);
        fd.append("fichier", new Blob([signe as unknown as BlobPart], { type: "application/pdf" }), "ordonnance-signee.pdf");
        const put = await fetch("/api/ordonnance-import", { method: "PUT", body: fd });
        setBusy(false);
        if (!put.ok) { const { message } = await put.json().catch(() => ({ message: "" })); alert(message || "Échec de la signature."); return; }
        onSigned();
      } catch (e) { setBusy(false); alert("Échec de la signature.\n" + (e instanceof Error ? e.message : "")); }
      return;
    }
    const { error } = await createClient().from("ordonnance").update({
      statut: "signee", signature, signataire_nom: signataire, signee_le: new Date().toISOString(),
    }).eq("id", ordo.id);
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    onSigned();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4 pt-12" onClick={onClose}>
      <div className="card grid w-full max-w-lg gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{ordo.titre}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-critique">✕</button>
        </div>
        <p className="text-xs text-slate-400">Patient : {patientNom}</p>

        {ordo.type === "importee" ? (
          <button onClick={voirDocument} className="btn-secondary inline-flex items-center justify-center gap-2 py-2.5 text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
            </svg>
            Voir le document à signer
          </button>
        ) : (
          <div className="grid gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-sm">
            {(modele?.champs ?? []).map((c) => {
              const v = valeurLisible(c, ordo.contenu);
              if (!v.trim()) return null;
              return <p key={c.key}><span className="font-semibold text-slate-600">{c.label} : </span><span className="text-slate-800">{v}</span></p>;
            })}
          </div>
        )}

        <div>
          <label className="label">Votre signature</label>
          <canvas
            ref={canvasRef}
            width={500}
            height={180}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            className="w-full touch-none rounded-xl border border-dashed border-rose-300 bg-white"
          />
          <button onClick={effacer} className="mt-1 text-xs text-slate-400 hover:text-brand">Effacer</button>
        </div>

        <button onClick={signerOrdo} disabled={busy || vide} className="btn-primary py-3 disabled:opacity-50">
          {busy ? "Signature…" : "Signer l'ordonnance"}
        </button>
      </div>
    </div>
  );
}
