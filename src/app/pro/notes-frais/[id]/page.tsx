"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { DateField } from "@/components/DateField";
import { TYPES_DEPENSE, libDepense, STATUTS_NDF, eurNdf } from "@/lib/notesFrais";
import { genererPdfNoteFrais } from "@/lib/pdfNoteFrais";
import { imageEnPdf } from "@/lib/imageToPdf";

type Note = {
  id: string; emetteur_id: string; titre: string; periode_debut: string | null; periode_fin: string | null;
  statut: string; valide_le: string | null; motif_rejet: string | null; total_ttc: number; total_ht: number;
  rembourse_le: string | null; emetteur?: { nom: string; prenom: string | null; titre: string | null } | null;
};
type Ligne = {
  id: string; type: string; montant_ttc: number; montant_ht: number | null; date_depense: string | null;
  description: string | null; evenement_id: string | null;
  est_avantage_ps: boolean; beneficiaire_pro_id: string | null; beneficiaire_externe_id: string | null;
  beneficiaire_nom: string | null; beneficiaire_rpps: string | null; beneficiaire_specialite: string | null;
  dmos_regime: string | null; decision: string | null; usage_pedagogique: boolean;
  convives: Convive[]; montant_dmos: number | null;
};
type Convive = { nom: string; dmos: boolean; pro_id?: string | null; externe_id?: string | null; rpps?: string | null; specialite?: string | null };
type Benef = { value: string; label: string; nom: string; rpps: string | null; specialite: string | null };
type BaremeRow = { type_avantage: string; seuil_declaration: number | null; seuil_autorisation: number | null; seuil_max: number | null; limite_an_nb: number | null; limite_an_montant: number | null; date_effet: string };
const REGIME_DMOS: Record<string, { label: string; cls: string }> = {
  declaration: { label: "À déclarer", cls: "bg-sky-100 text-sky-700" },
  autorisation: { label: "Autorisation requise", cls: "bg-amber-100 text-attention" },
};
type Justif = { id: string; ligne_id: string | null; chemin_stockage: string; libelle: string | null; mime: string | null };
type Evt = { id: string; nom: string };

const nomDe = (e?: Note["emetteur"]) => (e ? [e.titre, e.prenom, e.nom].filter(Boolean).join(" ") : "");

export default function NoteFraisDetail() {
  const pro = useProSession();
  const router = useRouter();
  const id = (useParams().id as string) ?? "";
  const [note, setNote] = useState<Note | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [justifs, setJustifs] = useState<Justif[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Evt[]>([]);
  const [benefs, setBenefs] = useState<Benef[]>([]);
  const [emailCompta, setEmailCompta] = useState<string>("");
  const [realProId, setRealProId] = useState<string | null>(null);
  const [realNom, setRealNom] = useState<string>("");
  const [baremes, setBaremes] = useState<Map<string, BaremeRow>>(new Map());
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  const charger = useCallback(async () => {
    const { data: n } = await supabase.from("note_de_frais")
      .select("id,emetteur_id,titre,periode_debut,periode_fin,statut,valide_le,motif_rejet,total_ttc,total_ht,rembourse_le,emetteur:emetteur_id(nom,prenom,titre)")
      .eq("id", id).maybeSingle();
    if (!n) { setNote(null); setPret(true); return; }
    setNote(n as unknown as Note);
    const [{ data: l }, { data: j }, { data: ev }] = await Promise.all([
      supabase.from("note_de_frais_ligne").select("id,type,montant_ttc,montant_ht,date_depense,description,evenement_id,est_avantage_ps,beneficiaire_pro_id,beneficiaire_externe_id,beneficiaire_nom,beneficiaire_rpps,beneficiaire_specialite,dmos_regime,decision,usage_pedagogique,convives,montant_dmos").eq("note_id", id).order("created_at"),
      supabase.from("note_de_frais_justificatif").select("id,ligne_id,chemin_stockage,libelle,mime").eq("note_id", id),
      supabase.from("evenement_marketing").select("id,nom").order("date_debut", { ascending: false }),
    ]);
    setLignes((l ?? []) as Ligne[]);
    setJustifs((j ?? []) as Justif[]);
    setEvents((ev ?? []) as Evt[]);
    // Bénéficiaires possibles d'un avantage : PS externes (comptes) + soignants externes.
    const [{ data: ps }, { data: ext }] = await Promise.all([
      supabase.from("professionnel").select("id,nom,prenom,titre,role,rpps,specialite").in("role", ["chirurgien", "infirmiere_liberale", "pharmacie"]).order("nom"),
      supabase.from("soignant_externe").select("id,nom,prenom,titre,specialite,rpps").order("nom"),
    ]);
    const opts: Benef[] = [
      ...((ps ?? []) as { id: string; nom: string; prenom: string | null; titre: string | null; rpps: string | null; specialite: string | null }[]).map((p) => {
        const nom = [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");
        return { value: `pro:${p.id}`, label: nom, nom, rpps: p.rpps, specialite: p.specialite };
      }),
      ...((ext ?? []) as { id: string; nom: string; prenom: string | null; titre: string | null; rpps: string | null; specialite: string | null }[]).map((e) => {
        const nom = [e.titre, e.prenom, e.nom].filter(Boolean).join(" ");
        return { value: `ext:${e.id}`, label: `${nom} · externe`, nom, rpps: e.rpps, specialite: e.specialite };
      }),
    ];
    setBenefs(opts);
    const chemins = (j ?? []).map((x) => x.chemin_stockage);
    if (chemins.length) {
      const res = await fetch(`/api/notes-frais/justificatif?chemins=${encodeURIComponent(chemins.join(","))}`);
      const data = await res.json().catch(() => ({ urls: {} }));
      setUrls(data.urls ?? {});
    } else setUrls({});
    setPret(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { charger(); }, [charger]);
  // Identité réelle du compte connecté (autorité = serveur, pas le cache session).
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("professionnel").select("id,nom,prenom,titre").eq("user_id", user.id).maybeSingle();
      if (data) { setRealProId(data.id as string); setRealNom([data.titre, data.prenom, data.nom].filter(Boolean).join(" ")); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!pro?.prestataire_id) return;
    supabase.from("parametre_notes_frais").select("email_comptabilite").eq("prestataire_id", pro.prestataire_id).maybeSingle()
      .then(({ data }) => setEmailCompta((data?.email_comptabilite as string) ?? ""));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pro?.prestataire_id]);
  // Barème DMOS (dernière version active par type) → seuils & plafonds affichés.
  useEffect(() => {
    supabase.from("dmos_bareme").select("type_avantage,seuil_declaration,seuil_autorisation,seuil_max,limite_an_nb,limite_an_montant,actif,date_effet").eq("actif", true)
      .then(({ data }) => {
        const m = new Map<string, BaremeRow>();
        ((data ?? []) as BaremeRow[]).forEach((b) => { const cur = m.get(b.type_avantage); if (!cur || b.date_effet > cur.date_effet) m.set(b.type_avantage, b); });
        setBaremes(m);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pret && !note) return <div className="card text-sm text-slate-500">Note introuvable ou inaccessible.</div>;
  if (!note || !pro) return <p className="text-sm text-slate-400">Chargement…</p>;

  const proId = realProId ?? pro.id;
  const mien = note.emetteur_id === proId;
  const editable = mien && note.statut === "brouillon";
  const peutValider = !mien && note.statut === "soumise";
  const peutRembourser = !mien && note.statut === "validee";
  const s = STATUTS_NDF[note.statut] ?? STATUTS_NDF.brouillon;
  // Avantage dépassant le seuil DMOS (régime « autorisation ») non encore autorisé → bloque la validation.
  const bloqueDmos = lignes.some((l) => l.est_avantage_ps && l.dmos_regime === "autorisation" && !["autorise", "tacite"].includes(l.decision ?? ""));
  // Plafond (seuil_max) dépassé → bloque (et empêche la soumission).
  const plafondDe = (type: string) => baremes.get(type)?.seuil_max ?? null;
  const depasseCap = (l: Ligne) => { const m = l.est_avantage_ps && !l.usage_pedagogique ? plafondDe(l.type) : null; const v = l.montant_dmos ?? l.montant_ttc; return m != null && Number(v) > m; };
  // Repas : persistance de la liste des convives (recalcul DMOS côté serveur).
  async function persistConvives(lid: string, conv: Convive[]) {
    setLignes((a) => a.map((l) => (l.id === lid ? { ...l, convives: conv } : l)));
    await supabase.from("note_de_frais_ligne").update({ convives: conv }).eq("id", lid);
    charger();
  }
  const setConviveLocal = (lid: string, conv: Convive[]) => setLignes((a) => a.map((l) => (l.id === lid ? { ...l, convives: conv } : l)));
  const bloqueCap = lignes.some(depasseCap);

  // ── Actions note ──
  const majNote = async (patch: Partial<Note>) => { setNote((n) => (n ? { ...n, ...patch } : n)); await supabase.from("note_de_frais").update(patch).eq("id", id); };

  async function ajouterLigne() {
    const { data } = await supabase.from("note_de_frais_ligne").insert({ note_id: id, type: "repas", montant_ttc: 0 }).select("id,type,montant_ttc,montant_ht,date_depense,description,evenement_id,est_avantage_ps,beneficiaire_pro_id,beneficiaire_externe_id,beneficiaire_nom,beneficiaire_rpps,beneficiaire_specialite,dmos_regime,decision,usage_pedagogique,convives,montant_dmos").single();
    if (data) setLignes((a) => [...a, data as Ligne]);
  }
  const majLigne = (lid: string, patch: Partial<Ligne>) => setLignes((a) => a.map((l) => (l.id === lid ? { ...l, ...patch } : l)));
  const persistLigne = async (lid: string, patch: Partial<Ligne>) => { await supabase.from("note_de_frais_ligne").update(patch).eq("id", lid); charger(); };
  async function supprimerLigne(lid: string) {
    await supabase.from("note_de_frais_ligne").delete().eq("id", lid);
    setLignes((a) => a.filter((l) => l.id !== lid));
    setJustifs((a) => a.filter((j) => j.ligne_id !== lid));
    recalcTotal();
  }
  const recalcTotal = () => setNote((n) => (n ? { ...n, total_ttc: lignes.reduce((s2, l) => s2 + Number(l.montant_ttc || 0), 0) } : n));

  // DMOS : marquer la ligne comme avantage à un PS + choix du bénéficiaire.
  const benefValue = (l: Ligne) => (l.beneficiaire_pro_id ? `pro:${l.beneficiaire_pro_id}` : l.beneficiaire_externe_id ? `ext:${l.beneficiaire_externe_id}` : "");
  async function setAvantage(lid: string, on: boolean) {
    majLigne(lid, { est_avantage_ps: on });
    await supabase.from("note_de_frais_ligne").update({ est_avantage_ps: on }).eq("id", lid);
    charger();
  }
  async function setPedago(lid: string, on: boolean) {
    majLigne(lid, { usage_pedagogique: on });
    await supabase.from("note_de_frais_ligne").update({ usage_pedagogique: on }).eq("id", lid);
    charger();
  }
  async function setBenef(lid: string, v: string) {
    const b = benefs.find((x) => x.value === v);
    const patch: Partial<Ligne> = {
      beneficiaire_pro_id: v.startsWith("pro:") ? v.slice(4) : null,
      beneficiaire_externe_id: v.startsWith("ext:") ? v.slice(4) : null,
      beneficiaire_nom: b?.nom ?? null, beneficiaire_rpps: b?.rpps ?? null, beneficiaire_specialite: b?.specialite ?? null,
    };
    majLigne(lid, patch);
    await supabase.from("note_de_frais_ligne").update(patch).eq("id", lid);
  }

  async function uploadJustif(lid: string, file: File) {
    setBusy(true);
    // Photo → PDF (façon scan) ; les PDF restent inchangés.
    let envoi = file;
    if (file.type.startsWith("image/")) {
      try { envoi = await imageEnPdf(file); } catch { envoi = file; }
    }
    const fd = new FormData(); fd.append("fichier", envoi); fd.append("ligne_id", lid);
    const res = await fetch("/api/notes-frais/justificatif", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert("Échec : " + (j.message ?? "")); return; }
    charger();
  }
  async function suppJustif(jid: string) {
    if (!confirm("Supprimer ce justificatif ?")) return;
    const res = await fetch("/api/notes-frais/justificatif", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: jid }) });
    if (!res.ok) { alert("Échec."); return; }
    charger();
  }

  async function soumettre() {
    if (!lignes.length || lignes.every((l) => Number(l.montant_ttc) <= 0)) { alert("Ajoutez au moins une ligne avec un montant."); return; }
    if (!note?.titre.trim()) { alert("Donnez un titre à la note."); return; }
    if (bloqueCap) { alert("Soumission impossible : un montant dépasse le plafond autorisé pour ce type de dépense (DMOS). Corrigez la ligne concernée."); return; }
    setBusy(true);
    await supabase.from("note_de_frais").update({ statut: "soumise" }).eq("id", id);
    setBusy(false);
    router.push("/pro/notes-frais");
  }
  async function supprimerNote() {
    if (!confirm("Supprimer définitivement cette note de frais ?")) return;
    const { data, error } = await supabase.from("note_de_frais").delete().eq("id", id).select("id");
    if (error) { alert("Échec : " + error.message); return; }
    if (!data || data.length === 0) { alert("Suppression refusée (droits, ou note déjà validée/remboursée). Vérifiez que la migration 0103 est appliquée."); return; }
    router.push("/pro/notes-frais");
  }
  async function rouvrir() { await supabase.from("note_de_frais").update({ statut: "brouillon", motif_rejet: null }).eq("id", id); charger(); }
  async function rappeler() {
    const { data, error } = await supabase.rpc("ndf_recall", { p_note: id });
    if (error) { alert("Échec : " + error.message); return; }
    if (data !== true) {
      alert(`Modification refusée.\nConnecté en tant que : ${realNom || "compte inconnu"}\nÉmetteur de la note : ${nomDe(note?.emetteur) || "autre compte"}\n\nSeul l'émetteur (ou un administrateur) peut modifier cette note.`);
      return;
    }
    charger();
  }

  async function valider() {
    if (bloqueCap) { alert("Validation impossible : un montant dépasse le plafond autorisé pour ce type de dépense (DMOS)."); return; }
    if (bloqueDmos) { alert("Validation impossible : un avantage dépasse le seuil DMOS et nécessite une autorisation préalable (voir Suivi DMOS)."); return; }
    setBusy(true);
    const { error } = await supabase.from("note_de_frais").update({ statut: "validee", valide_par: proId, valide_le: new Date().toISOString() }).eq("id", id).select("id");
    setBusy(false);
    if (error) { alert("Validation refusée : " + error.message); return; }
    router.push("/pro/notes-frais");
  }
  async function rejeter() {
    const motif = prompt("Motif du rejet (visible par l'émetteur) :")?.trim();
    if (motif === undefined) return;
    setBusy(true);
    await supabase.from("note_de_frais").update({ statut: "rejetee", motif_rejet: motif || null, valide_par: proId, valide_le: new Date().toISOString() }).eq("id", id);
    setBusy(false); router.push("/pro/notes-frais");
  }
  async function rembourser() {
    setBusy(true);
    const { error } = await supabase.from("note_de_frais").update({ statut: "remboursee", rembourse_le: new Date().toISOString() }).eq("id", id).select("id");
    setBusy(false);
    if (error) { alert("Échec : " + error.message); return; }
    router.push("/pro/notes-frais");
  }

  function telechargerPdf() {
    if (!note) return;
    genererPdfNoteFrais({
      titre: note.titre, emetteur: nomDe(note.emetteur) || "", statut: (STATUTS_NDF[note.statut] ?? STATUTS_NDF.brouillon).label,
      periode_debut: note.periode_debut, periode_fin: note.periode_fin, total_ttc: note.total_ttc, total_ht: note.total_ht,
      lignes: lignes.map((l) => ({ type: l.type, description: l.description, date_depense: l.date_depense, montant_ttc: l.montant_ttc, montant_ht: l.montant_ht, est_avantage_ps: l.est_avantage_ps, beneficiaire_nom: l.beneficiaire_nom })),
    });
  }
  function envoyerCompta() {
    if (!note) return;
    const periode = [note.periode_debut, note.periode_fin].filter(Boolean).map((x) => new Date(x as string).toLocaleDateString("fr-FR")).join(" → ");
    const corps =
      `Note de frais : ${note.titre}\n` +
      `Émetteur : ${nomDe(note.emetteur) || "—"}\n` +
      (periode ? `Période : ${periode}\n` : "") +
      `Statut : ${(STATUTS_NDF[note.statut] ?? STATUTS_NDF.brouillon).label}\n\n` +
      `Dépenses :\n` +
      lignes.map((l) => `- ${l.date_depense ? new Date(l.date_depense).toLocaleDateString("fr-FR") : ""} ${libDepense(l.type)}${l.description ? ` (${l.description})` : ""} : ${eurNdf(l.montant_ttc)}`).join("\n") +
      `\n\nTotal HT : ${eurNdf(note.total_ht)}\nTotal TTC : ${eurNdf(note.total_ttc)}\n\n` +
      `(Récapitulatif PDF joint ; justificatifs à récupérer dans l'application.)`;
    const sujet = `Note de frais — ${note.titre} — ${eurNdf(note.total_ttc)}`;
    window.location.href = `mailto:${encodeURIComponent(emailCompta)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    setTimeout(telechargerPdf, 400);
  }

  const justifsDe = (lid: string) => justifs.filter((j) => j.ligne_id === lid);
  const total = lignes.reduce((sum, l) => sum + Number(l.montant_ttc || 0), 0);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/pro/notes-frais" className="text-sm text-slate-400 hover:text-brand" prefetch>← Notes de frais</Link>

      {/* En-tête */}
      <div className="mt-1 mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editable ? (
            <input className="input text-lg font-bold" value={note.titre} onChange={(e) => setNote({ ...note, titre: e.target.value })} onBlur={(e) => majNote({ titre: e.target.value })} />
          ) : (
            <h1 className="text-2xl font-bold text-slate-800">{note.titre}</h1>
          )}
          {!mien && nomDe(note.emetteur) && <p className="mt-1 text-sm text-slate-500">{nomDe(note.emetteur)}</p>}
        </div>
        <span className={`badge ${s.cls}`}>{s.label}</span>
      </div>

      {note.statut === "rejetee" && note.motif_rejet && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-critique"><b>Rejetée :</b> {note.motif_rejet}</p>
      )}
      {realProId && !mien && !peutValider && !peutRembourser && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-attention">
          Vous êtes connecté en tant que <b>{realNom || "—"}</b>. Cette note appartient à <b>{nomDe(note.emetteur) || "un autre compte"}</b> : seul son émetteur (ou un administrateur) peut la modifier ou la supprimer.
        </p>
      )}
      {bloqueCap && note.statut !== "remboursee" && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-critique"><b>Plafond dépassé :</b> un montant dépasse le <b>plafond autorisé</b> pour ce type de dépense. La note ne peut pas être soumise ni validée — corrigez la ligne en rouge.</p>
      )}
      {bloqueDmos && !bloqueCap && note.statut !== "remboursee" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-attention"><b>DMOS :</b> un avantage dépasse le seuil et nécessite une <b>autorisation préalable</b>. La validation est bloquée tant que l&apos;autorisation n&apos;est pas enregistrée (Suivi DMOS).</p>
      )}


      {/* Lignes */}
      <div className="grid gap-3">
        {lignes.length === 0 && !editable && <p className="card text-sm text-slate-400">Aucune ligne.</p>}
        {lignes.map((l) => (
          <div key={l.id} className="card grid gap-3">
            {editable ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Type</label><Select value={l.type} onChange={(v) => { majLigne(l.id, { type: v }); persistLigne(l.id, { type: v }); }} options={TYPES_DEPENSE} /></div>
                  <div><label className="label">Date</label><DateField value={l.date_depense ?? ""} onChange={(v) => { majLigne(l.id, { date_depense: v || null }); persistLigne(l.id, { date_depense: v || null }); }} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Montant TTC (€)</label><input className="input" type="number" step="0.01" inputMode="decimal" value={l.montant_ttc} onChange={(e) => majLigne(l.id, { montant_ttc: Number(e.target.value) })} onBlur={(e) => persistLigne(l.id, { montant_ttc: Number(e.target.value) || 0 })} /></div>
                  <div><label className="label">Montant HT (€) <span className="text-slate-400">(facultatif)</span></label><input className="input" type="number" step="0.01" inputMode="decimal" value={l.montant_ht ?? ""} onChange={(e) => majLigne(l.id, { montant_ht: e.target.value === "" ? null : Number(e.target.value) })} onBlur={(e) => persistLigne(l.id, { montant_ht: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                </div>
                <div><label className="label">Description</label><input className="input" value={l.description ?? ""} onChange={(e) => majLigne(l.id, { description: e.target.value })} onBlur={(e) => persistLigne(l.id, { description: e.target.value || null })} placeholder="Détail de la dépense" /></div>
                {events.length > 0 && (
                  <div><label className="label">Événement lié <span className="text-slate-400">(facultatif)</span></label>
                    <Select value={l.evenement_id ?? ""} onChange={(v) => { majLigne(l.id, { evenement_id: v || null }); persistLigne(l.id, { evenement_id: v || null }); }} placeholder="— Aucun —" options={[{ value: "", label: "— Aucun —" }, ...events.map((e) => ({ value: e.id, label: e.nom }))]} />
                  </div>
                )}
                {l.type === "repas" ? (
                  <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700">Convives ({1 + l.convives.length})</p>
                      {Number(l.montant_ttc) > 0 && <p className="text-xs text-slate-500">{eurNdf(Number(l.montant_ttc) / (1 + l.convives.length))} / pers.</p>}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Vous (auteur de la note) · compté d&apos;office</p>
                    <div className="mt-2 grid gap-1.5">
                      {l.convives.map((c, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <input className="input h-8 w-40 py-1 text-sm" value={c.nom} placeholder="Nom de l'invité"
                            onChange={(e) => setConviveLocal(l.id, l.convives.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))}
                            onBlur={() => persistConvives(l.id, l.convives)} />
                          <label className="flex items-center gap-1 text-xs text-slate-600">
                            <input type="checkbox" checked={c.dmos} className="accent-brand"
                              onChange={(e) => persistConvives(l.id, l.convives.map((x, j) => (j === i ? { ...x, dmos: e.target.checked } : x)))} /> PS
                          </label>
                          {c.dmos && (
                            <div className="w-44"><Select value={c.pro_id ? `pro:${c.pro_id}` : c.externe_id ? `ext:${c.externe_id}` : ""}
                              onChange={(v) => { const b = benefs.find((x) => x.value === v); persistConvives(l.id, l.convives.map((x, j) => (j === i ? { ...x, nom: b?.nom ?? x.nom, rpps: b?.rpps ?? null, specialite: b?.specialite ?? null, pro_id: v.startsWith("pro:") ? v.slice(4) : null, externe_id: v.startsWith("ext:") ? v.slice(4) : null } : x))); }}
                              placeholder="(lier un PS enregistré)" options={[{ value: "", label: "(lier un PS enregistré)" }, ...benefs]} /></div>
                          )}
                          <button onClick={() => persistConvives(l.id, l.convives.filter((_, j) => j !== i))} className="text-xs font-medium text-critique" title="Retirer">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => persistConvives(l.id, [...l.convives, { nom: "", dmos: false }])} className="mt-2 text-xs font-semibold text-brand hover:underline">+ Ajouter un invité</button>
                    {l.est_avantage_ps && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {(() => { const b = baremes.get("repas"); return b?.seuil_max != null ? <span className="text-[11px] text-slate-400">Plafond {eurNdf(b.seuil_max)}/pers.</span> : null; })()}
                        {l.dmos_regime && <span className={`badge ${REGIME_DMOS[l.dmos_regime].cls}`}>{REGIME_DMOS[l.dmos_regime].label}</span>}
                        {depasseCap(l) && <span className="badge bg-red-100 text-critique">Plafond/pers. dépassé</span>}
                      </div>
                    )}
                  </div>
                ) : (
                <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={l.est_avantage_ps} onChange={(e) => setAvantage(l.id, e.target.checked)} className="accent-brand" />
                    Avantage à un professionnel de santé (DMOS)
                  </label>
                  {l.est_avantage_ps && (
                    <div className="mt-2 grid gap-2">
                      <Select value={benefValue(l)} onChange={(v) => setBenef(l.id, v)} placeholder="— Bénéficiaire (PS) —" options={[{ value: "", label: "— Bénéficiaire (PS) —" }, ...benefs]} />
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" checked={l.usage_pedagogique} onChange={(e) => setPedago(l.id, e.target.checked)} className="accent-brand" />
                        Usage pédagogique / formation (sans limite)
                      </label>
                      {!l.usage_pedagogique && (() => { const b = baremes.get(l.type); if (!b) return null; return (
                        <p className="text-[11px] text-slate-400">
                          {b.seuil_max != null ? <>Plafond&nbsp;: <b className="text-slate-500">{eurNdf(b.seuil_max)}</b></> : "Aucun plafond"}
                          {b.seuil_autorisation != null ? ` · autorisation ≥ ${eurNdf(b.seuil_autorisation)}` : ""}
                          {b.limite_an_nb != null ? ` · max ${b.limite_an_nb}/an/bénéf.` : ""}
                          {b.limite_an_montant != null ? ` · max ${eurNdf(b.limite_an_montant)}/an/bénéf.` : ""}
                        </p>
                      ); })()}
                      <div className="flex flex-wrap items-center gap-2">
                        {l.usage_pedagogique ? <span className="badge bg-green-100 text-ok">Pédagogique · sans limite</span> : (
                          <>
                            {l.dmos_regime && <span className={`badge ${REGIME_DMOS[l.dmos_regime].cls}`}>{REGIME_DMOS[l.dmos_regime].label}</span>}
                            {depasseCap(l) && <span className="badge bg-red-100 text-critique">Plafond dépassé</span>}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-700">{libDepense(l.type)}{l.description ? ` — ${l.description}` : ""}</p>
                  <p className="text-xs text-slate-400">{l.date_depense ? new Date(l.date_depense).toLocaleDateString("fr-FR") : ""}</p>
                  {l.est_avantage_ps && (
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-medium text-brand">Avantage PS{l.beneficiaire_nom ? ` · ${l.beneficiaire_nom}` : ""}</span>
                      {l.dmos_regime && <span className={`badge ${REGIME_DMOS[l.dmos_regime].cls}`}>{REGIME_DMOS[l.dmos_regime].label}</span>}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-bold text-brand">{eurNdf(l.montant_ttc)}</span>
              </div>
            )}

            {/* Justificatifs de la ligne */}
            <div className="flex flex-wrap items-center gap-2 border-t border-rose-100 pt-2">
              {justifsDe(l.id).map((j) => (
                <span key={j.id} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs">
                  <a href={urls[j.chemin_stockage] ?? "#"} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">{j.libelle ?? "Justificatif"}</a>
                  {editable && <button onClick={() => suppJustif(j.id)} className="text-critique" title="Supprimer">✕</button>}
                </span>
              ))}
              {editable && (
                <label className="cursor-pointer rounded-lg border border-dashed border-rose-300 px-2.5 py-1 text-xs font-medium text-brand hover:bg-rose-50">
                  + Justificatif
                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadJustif(l.id, f); e.target.value = ""; }} />
                </label>
              )}
              {!editable && justifsDe(l.id).length === 0 && <span className="text-xs text-slate-300">Aucun justificatif</span>}
              {editable && <button onClick={() => supprimerLigne(l.id)} className="ml-auto text-xs font-medium text-critique hover:underline">Supprimer la ligne</button>}
            </div>
          </div>
        ))}

        {editable && (
          <button onClick={ajouterLigne} className="justify-self-start rounded-lg border border-dashed border-rose-300 px-4 py-2 text-sm font-semibold text-brand hover:bg-rose-50">+ Ajouter une ligne</button>
        )}
      </div>

      {/* Total */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3">
        <span className="text-sm font-semibold text-slate-600">Total TTC</span>
        <span className="text-lg font-bold text-brand">{eurNdf(editable ? total : note.total_ttc)}</span>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        {editable && (<>
          <button onClick={soumettre} disabled={busy} className="btn-primary flex-1">Soumettre pour validation</button>
          <button onClick={supprimerNote} className="btn-secondary">Supprimer</button>
        </>)}
        {mien && note.statut === "soumise" && (<>
          <p className="self-center text-sm text-slate-500">En attente de validation.</p>
          <button onClick={rappeler} className="btn-secondary">Modifier</button>
          <button onClick={supprimerNote} className="btn-secondary text-critique">Supprimer</button>
        </>)}
        {mien && note.statut === "rejetee" && (<>
          <button onClick={rouvrir} className="btn-primary">Corriger (repasser en brouillon)</button>
          <button onClick={supprimerNote} className="btn-secondary text-critique">Supprimer</button>
        </>)}
        {peutValider && (<>
          <button onClick={valider} disabled={busy || bloqueDmos || bloqueCap} className="btn-primary flex-1 disabled:opacity-50">Valider</button>
          <button onClick={rejeter} disabled={busy} className="btn-secondary">Rejeter</button>
        </>)}
        {peutRembourser && <button onClick={rembourser} disabled={busy} className="btn-primary flex-1">Marquer remboursée</button>}
      </div>

      {/* Récap PDF + envoi comptabilité */}
      {lignes.length > 0 && (note.statut === "validee" || note.statut === "remboursee") && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rose-100 pt-3">
          <button onClick={telechargerPdf} className="btn-secondary px-3 py-2 text-sm">📄 Récap PDF</button>
          <button onClick={envoyerCompta} className="btn-secondary px-3 py-2 text-sm">✉️ Envoyer à la comptabilité</button>
          {!emailCompta && <span className="text-xs text-slate-400">Adresse comptabilité non renseignée (Barème DMOS → Paramètres).</span>}
        </div>
      )}
    </div>
  );
}
