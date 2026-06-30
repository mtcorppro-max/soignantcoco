"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";
import { genererPdfFactures, type FactureExport } from "@/lib/pdfFactures";

type Facture = {
  id: string; patient_id: string; agence_id: string | null; medecin_id: string | null; medecin_nom: string | null;
  montant_base: number; montant_ht: number; part_secu: number; part_mutuelle: number; part_patient: number;
  statut: string; source: string; ref_externe: string | null; periode_debut: string | null; envoyee_le: string | null; payee_le: string | null;
  patient: { nom: string } | { nom: string }[] | null;
  agence: { nom: string } | { nom: string }[] | null;
};

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur2 = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moisCourt = (d: Date) => d.toLocaleDateString("fr-FR", { month: "short" });
const mkey = (s: string | null) => (s ? s.slice(0, 7) : "");
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("fr-FR") : "—");
const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const nomP = (f: Facture) => un(f.patient)?.nom ?? "Patient";
const STATUTS: Record<string, { label: string; cls: string }> = {
  a_facturer: { label: "À facturer", cls: "bg-amber-100 text-attention" },
  envoyee: { label: "Envoyée", cls: "bg-sky-100 text-sky-700" },
  payee: { label: "Payée", cls: "bg-green-100 text-ok" },
  annulee: { label: "Annulée", cls: "bg-slate-200 text-slate-500" },
};

type ProjF = { patient_id: string; date_debut: string; date_fin: string; lpp: { prix_ttc: number | null; periodicite: string; taux_tva: number } | { prix_ttc: number | null; periodicite: string; taux_tva: number }[] | null };

// Dates de début de chaque période d'un forfait, jusqu'à la fin de PEC.
function periodStarts(periodicite: string, dDebut: string, dFin: string): Date[] {
  const fin = new Date(dFin); fin.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  if (periodicite === "installation" || periodicite === "unitaire") {
    const d = new Date(dDebut); d.setHours(0, 0, 0, 0);
    if (d <= fin) out.push(d);
    return out;
  }
  const incr = periodicite === "journalier" ? 1 : periodicite === "hebdomadaire" ? 7 : 0;
  for (let k = 0; k < 4000; k++) {
    const d = new Date(dDebut); d.setHours(0, 0, 0, 0);
    if (periodicite === "mensuel") d.setMonth(d.getMonth() + k); else d.setDate(d.getDate() + k * incr);
    if (d > fin) break;
    out.push(d);
    if (incr === 0 && periodicite !== "mensuel") break;
  }
  return out;
}

function telechargerCSV(nomFichier: string, contenu: string) {
  const blob = new Blob(["﻿" + contenu], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export default function FacturationPage() {
  const pro = useProSession();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [forfaits, setForfaits] = useState<ProjF[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [fStatut, setFStatut] = useState("");
  const [fAgence, setFAgence] = useState("");
  const [fMedecin, setFMedecin] = useState("");
  const [fMois, setFMois] = useState("");
  const peut = !!pro && (pro.niveau <= 1 || pro.role === "dirigeant");

  const charger = useCallback(async () => {
    const supabase = createClient();
    await supabase.rpc("generer_factures_previsionnelles"); // génération auto (idempotente)
    const { data } = await supabase
      .from("facture_previsionnelle")
      .select("id,patient_id,agence_id,medecin_id,medecin_nom,montant_base,montant_ht,part_secu,part_mutuelle,part_patient,statut,source,ref_externe,periode_debut,envoyee_le,payee_le,patient:patient_id(nom),agence:agence_id(nom)")
      .order("periode_debut", { ascending: false });
    setFactures((data ?? []) as unknown as Facture[]);
    // Forfaits actifs → projection du CA prévisionnel (périodes à venir).
    const { data: ff } = await supabase
      .from("patient_forfait")
      .select("patient_id,date_debut,date_fin,lpp:lpp_code(prix_ttc,periodicite,taux_tva)")
      .eq("actif", true);
    setForfaits((ff ?? []) as unknown as ProjF[]);
    setPret(true);
  }, []);
  useEffect(() => { if (pro && peut) charger(); else if (pro) setPret(true); }, [pro, peut, charger]);

  // ── Agrégats dashboard (global) ──
  const s = useMemo(() => {
    const now = new Date();
    const moisCle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let aFacturerMois = 0, dejaFacture = 0, paye = 0, attenteSecu = 0, aFacturerTotal = 0, unitCeMois = 0, genereForfait = 0;
    let aFacturerMoisHt = 0, dejaFactureHt = 0, payeHt = 0, attenteSecuHt = 0, aFacturerTotalHt = 0, unitCeMoisHt = 0, genereForfaitHt = 0;
    const patientsMois = new Set<string>();
    let delaiSum = 0, delaiN = 0;
    for (const f of factures) {
      const m = mkey(f.periode_debut);
      if (f.statut === "a_facturer") { aFacturerTotal += f.montant_base; aFacturerTotalHt += f.montant_ht; if (m === moisCle) { aFacturerMois += f.montant_base; aFacturerMoisHt += f.montant_ht; patientsMois.add(f.patient_id); } }
      if (f.statut === "envoyee" || f.statut === "payee") { dejaFacture += f.montant_base; dejaFactureHt += f.montant_ht; }
      if (f.statut === "payee") { paye += f.montant_base; payeHt += f.montant_ht; }
      if (f.statut === "envoyee") { attenteSecu += f.montant_base; attenteSecuHt += f.montant_ht; }
      if (f.statut !== "annulee" && f.source === "forfait") { genereForfait += f.montant_base; genereForfaitHt += f.montant_ht; }
      if (f.statut !== "annulee" && f.source !== "forfait" && m === moisCle) { unitCeMois += f.montant_base; unitCeMoisHt += f.montant_ht; patientsMois.add(f.patient_id); }
      if (f.envoyee_le && f.periode_debut) { const j = (new Date(f.envoyee_le).getTime() - new Date(f.periode_debut).getTime()) / 86_400_000; if (j >= 0) { delaiSum += j; delaiN += 1; } }
    }
    const serie: { label: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      serie.push({ label: moisCourt(d), total: factures.filter((f) => mkey(f.periode_debut) === k && f.statut !== "annulee").reduce((a, f) => a + f.montant_base, 0) });
    }
    return { aFacturerMois, dejaFacture, paye, attenteSecu, aFacturerTotal, unitCeMois, genereForfait,
             aFacturerMoisHt, dejaFactureHt, payeHt, attenteSecuHt, aFacturerTotalHt, unitCeMoisHt, genereForfaitHt,
             patientsMoisSet: patientsMois, delaiMoyen: delaiN ? Math.round(delaiSum / delaiN) : null, serie };
  }, [factures]);

  // ── Projection des forfaits (sur toute la PEC, indépendante du jour) ──
  const proj = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let total = 0, totalHt = 0, ceMois = 0, ceMoisHt = 0;
    const pats = new Set<string>();
    for (const f of forfaits) {
      const lp = un(f.lpp); if (!lp?.prix_ttc) continue;
      const ht = lp.prix_ttc / (1 + (lp.taux_tva ?? 0.2));
      const starts = periodStarts(lp.periodicite, f.date_debut, f.date_fin);
      if (starts.length) pats.add(f.patient_id);
      total += lp.prix_ttc * starts.length;
      totalHt += ht * starts.length;
      const nMois = starts.filter((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === ym).length;
      ceMois += lp.prix_ttc * nMois;
      ceMoisHt += ht * nMois;
    }
    return { total, totalHt, ceMois, ceMoisHt, patients: pats };
  }, [forfaits]);

  const patientsActifs = useMemo(() => new Set([...s.patientsMoisSet, ...proj.patients]).size, [s.patientsMoisSet, proj.patients]);
  const genereCeMois = s.unitCeMois + proj.ceMois;
  const genereCeMoisHt = s.unitCeMoisHt + proj.ceMoisHt;
  const aVenir = Math.max(0, proj.total - s.genereForfait);
  const aVenirHt = Math.max(0, proj.totalHt - s.genereForfaitHt);

  // ── Options de filtres ──
  const agences = useMemo(() => [...new Map(factures.map((f) => [f.agence_id, un(f.agence)?.nom]).filter(([id]) => id) as [string, string][]).entries()].map(([value, label]) => ({ value, label })), [factures]);
  const medecins = useMemo(() => [...new Set(factures.map((f) => f.medecin_nom).filter(Boolean) as string[])].sort().map((m) => ({ value: m, label: m })), [factures]);
  const mois = useMemo(() => [...new Set(factures.map((f) => mkey(f.periode_debut)).filter(Boolean))].sort().reverse().map((m) => ({ value: m, label: new Date(m + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) })), [factures]);

  const filtrees = useMemo(() => factures.filter((f) =>
    (!fStatut || f.statut === fStatut) &&
    (!fAgence || f.agence_id === fAgence) &&
    (!fMedecin || f.medecin_nom === fMedecin) &&
    (!fMois || mkey(f.periode_debut) === fMois)
  ), [factures, fStatut, fAgence, fMedecin, fMois]);

  const totFiltre = useMemo(() => filtrees.reduce((a, f) => ({ base: a.base + f.montant_base, secu: a.secu + f.part_secu, mut: a.mut + f.part_mutuelle, pat: a.pat + f.part_patient }), { base: 0, secu: 0, mut: 0, pat: 0 }), [filtrees]);

  async function marquerEnvoyee(f: Facture) {
    const ref = window.prompt("N° de référence Sécu (externe) :", f.ref_externe ?? "");
    if (ref === null) return;
    setBusy(f.id);
    const { error } = await createClient().from("facture_previsionnelle").update({ statut: "envoyee", ref_externe: ref || null, envoyee_le: new Date().toISOString() }).eq("id", f.id);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }
  async function marquerPayee(f: Facture) {
    setBusy(f.id);
    const { error } = await createClient().from("facture_previsionnelle").update({ statut: "payee", payee_le: new Date().toISOString() }).eq("id", f.id);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }
  async function rouvrir(f: Facture) {
    setBusy(f.id);
    const patch = f.statut === "payee" ? { statut: "envoyee", payee_le: null } : { statut: "a_facturer", ref_externe: null, envoyee_le: null };
    const { error } = await createClient().from("facture_previsionnelle").update(patch).eq("id", f.id);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }

  function exportCSV() {
    const sep = ";";
    const head = ["Date", "Patient", "Médecin", "Base", "Part Sécu", "Part Mutuelle", "Part Patient", "Statut", "N° réf Sécu"];
    const lignes = filtrees.map((f) => [fmtDate(f.periode_debut), nomP(f), f.medecin_nom ?? "", eur2(f.montant_base), eur2(f.part_secu), eur2(f.part_mutuelle), eur2(f.part_patient), STATUTS[f.statut]?.label ?? f.statut, f.ref_externe ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep));
    telechargerCSV("factures-previsionnelles.csv", [head.join(sep), ...lignes].join("\r\n"));
  }
  function exportPDF() {
    const rows: FactureExport[] = filtrees.map((f) => ({ date: fmtDate(f.periode_debut), patient: nomP(f), medecin: f.medecin_nom ?? "", base: f.montant_base, secu: f.part_secu, mutuelle: f.part_mutuelle, patient_part: f.part_patient, statut: f.statut, ref: f.ref_externe ?? "" }));
    const label = [fMois && mois.find((m) => m.value === fMois)?.label, fAgence && agences.find((a) => a.value === fAgence)?.label].filter(Boolean).join(" · ") || "Toutes factures";
    genererPdfFactures(rows, label);
  }

  if (pro && !peut) return <div className="card text-sm text-slate-500">La facturation prévisionnelle est réservée aux managers et dirigeants.</div>;

  const maxSerie = Math.max(1, ...s.serie.map((x) => x.total));

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Facturation prévisionnelle Sécu</h1>
          <p className="mt-1 text-sm text-slate-500">Estimation du chiffre d&apos;affaires. <span className="font-medium text-attention">Outil prévisionnel</span> — n&apos;envoie rien à la Sécu.</p>
        </div>
        <div className="flex items-center gap-2">
          {(pro?.niveau === 0 || pro?.role === "dirigeant") && <Link href="/pro/pec/facturation/tarifs" className="btn-secondary text-sm">Tarifs LPP ⚙</Link>}
          <Link href="/pro/pec" className="btn-secondary text-sm">← PEC</Link>
        </div>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Calcul en cours…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4">
              <p className="text-sm text-slate-500">Ce mois-ci</p>
              <p className="mt-1 text-xl font-bold text-brand">Vous générerez {eur(genereCeMois)}</p>
              <p className="text-xs text-slate-400">soit {eur(genereCeMoisHt)} HT · {patientsActifs} patient(s) actif(s)</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm text-slate-500">CA prévisionnel à venir</p>
              <p className="mt-1 text-xl font-bold text-brand">{eur(aVenir)}</p>
              <p className="text-xs text-slate-400">soit {eur(aVenirHt)} HT · forfaits non facturés</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-slate-500">En attente d&apos;envoi à la Sécu</p>
              <p className="mt-1 text-xl font-bold text-attention">{eur(s.aFacturerTotal)}</p>
              <p className="text-xs text-slate-400">soit {eur(s.aFacturerTotalHt)} HT · à transmettre</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm text-slate-500">Délai moyen livraison → facturation</p>
              <p className="mt-1 text-xl font-bold text-sky-700">{s.delaiMoyen === null ? "—" : `${s.delaiMoyen} j`}</p>
              <p className="text-sm text-slate-500">sur les factures envoyées</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="CA à facturer ce mois" value={eur(s.aFacturerMois)} ht={eur(s.aFacturerMoisHt)} accent />
            <Kpi label="CA déjà facturé" value={eur(s.dejaFacture)} ht={eur(s.dejaFactureHt)} />
            <Kpi label="CA payé" value={eur(s.paye)} ht={eur(s.payeHt)} />
            <Kpi label="CA en attente Sécu" value={eur(s.attenteSecu)} ht={eur(s.attenteSecuHt)} />
          </div>

          <section className="card grid gap-4 overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-sm font-semibold text-slate-700">Chiffre d&apos;affaires généré — 12 derniers mois</h2>
              {maxSerie > 0 && <span className="text-xs text-slate-400">max {eur(maxSerie)}</span>}
            </div>
            <div className="flex items-end justify-between gap-1 sm:gap-1.5" style={{ height: 180 }}>
              {s.serie.map((m, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  {/* Montant par barre : masqué sur mobile (12 colonnes étroites → débordement) */}
                  <span className="hidden w-full truncate text-center text-[10px] font-medium text-slate-500 sm:block">{m.total > 0 ? eur(m.total) : ""}</span>
                  <div className="w-full rounded-t-md bg-brand/80" style={{ height: `${Math.max(2, (m.total / maxSerie) * 140)}px` }} title={`${m.label} : ${eur(m.total)}`} />
                  <span className="w-full truncate text-center text-[10px] text-slate-400">{m.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Liste détaillée ── */}
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Factures prévisionnelles ({filtrees.length})</h2>
              <div className="flex items-center gap-2">
                <button onClick={exportCSV} disabled={!filtrees.length} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Export CSV</button>
                <button onClick={exportPDF} disabled={!filtrees.length} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Export PDF</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40"><Select value={fStatut} onChange={setFStatut} placeholder="Tous statuts" options={[{ value: "", label: "Tous statuts" }, ...Object.entries(STATUTS).map(([v, x]) => ({ value: v, label: x.label }))]} /></div>
              {agences.length > 1 && <div className="w-44"><Select value={fAgence} onChange={setFAgence} placeholder="Toutes agences" options={[{ value: "", label: "Toutes agences" }, ...agences]} /></div>}
              {medecins.length > 0 && <div className="w-48"><Select value={fMedecin} onChange={setFMedecin} placeholder="Tous médecins" options={[{ value: "", label: "Tous médecins" }, ...medecins]} /></div>}
              {mois.length > 0 && <div className="w-44"><Select value={fMois} onChange={setFMois} placeholder="Toutes périodes" options={[{ value: "", label: "Toutes périodes" }, ...mois]} /></div>}
              {(fStatut || fAgence || fMedecin || fMois) && <button onClick={() => { setFStatut(""); setFAgence(""); setFMedecin(""); setFMois(""); }} className="text-sm text-brand hover:underline">Réinitialiser</button>}
            </div>

            {filtrees.length === 0 ? (
              <p className="text-sm text-slate-400">{factures.length === 0 ? "Aucune facture générée pour l'instant (il faut des livraisons livrées de patients à ordonnance signée, avec des articles à code LPP)." : "Aucune facture ne correspond aux filtres."}</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filtrees.map((f) => {
                  const st = STATUTS[f.statut] ?? STATUTS.a_facturer;
                  return (
                    <div key={f.id} className="card grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700">{nomP(f)} <span className="font-normal text-slate-400">· {fmtDate(f.periode_debut)}{un(f.agence) ? ` · ${un(f.agence)?.nom}` : ""}</span></p>
                        <p className="text-xs text-slate-400">
                          {f.medecin_nom ? `Dr ${f.medecin_nom} · ` : ""}Base {eur2(f.montant_base)} € · Sécu {eur2(f.part_secu)} € · Mut. {eur2(f.part_mutuelle)} € · Patient {eur2(f.part_patient)} €
                          {f.ref_externe ? ` · réf ${f.ref_externe}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                        {f.statut === "a_facturer" && <button onClick={() => marquerEnvoyee(f)} disabled={busy === f.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Envoyée à la Sécu</button>}
                        {f.statut === "envoyee" && <button onClick={() => marquerPayee(f)} disabled={busy === f.id} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Marquer payée</button>}
                        {(f.statut === "envoyee" || f.statut === "payee") && <button onClick={() => rouvrir(f)} disabled={busy === f.id} className="text-xs text-slate-400 hover:text-critique" title="Revenir au statut précédent">↩</button>}
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap justify-end gap-4 px-1 pt-1 text-sm font-semibold text-slate-600">
                  <span>Total base {eur2(totFiltre.base)} €</span>
                  <span className="text-sky-700">Sécu {eur2(totFiltre.secu)} €</span>
                  <span>Mut. {eur2(totFiltre.mut)} €</span>
                  <span>Patient {eur2(totFiltre.pat)} €</span>
                </div>
              </div>
            )}
          </section>

          <p className="text-xs text-slate-400">Calcul à l&apos;unité (codes LPP des articles livrés). Les forfaits récurrents PERFADOM/NEAD seront ajoutés ensuite (Lot 5).</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, ht, accent }: { label: string; value: string; ht?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : "text-slate-800"}`}>{value}</p>
      {ht && <p className="text-xs text-slate-400">{ht} HT</p>}
    </div>
  );
}
