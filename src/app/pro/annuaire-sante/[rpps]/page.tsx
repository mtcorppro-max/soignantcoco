"use client";

// Fiche annuaire santé (Open Data RPPS) : consultation, complément /
// correction des coordonnées, rattachement en soignant externe (pour les
// dossiers patient) et création de compte pré-remplie (bouton « + »).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { estRoleService } from "@/lib/roles";

type Site = { rs: string | null; adresse: string | null; cp: string | null; commune: string | null; tel: string | null };
type Fiche = {
  rpps: string; type: "medecin" | "infirmiere" | "pharmacie";
  civilite: string | null; nom: string; prenom: string | null;
  profession: string | null; specialite: string | null; mode_exercice: string | null;
  sites: Site[];
  telephone: string | null; email: string | null;
  secretariat_nom: string | null; secretariat_email: string | null; secretariat_tel: string | null;
  notes: string | null;
};

const LIBELLE_TYPE = { medecin: "Médecin", infirmiere: "Infirmier(ère)", pharmacie: "Pharmacien(ne)" } as const;
const adresseSite = (s: Site) => [s.adresse, [s.cp, s.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export default function FicheAnnuaire() {
  const { rpps } = useParams<{ rpps: string }>();
  const pro = useProSession();
  const router = useRouter();

  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [absente, setAbsente] = useState(false);
  const [dejaExterne, setDejaExterne] = useState(false);
  const [compteActif, setCompteActif] = useState(false);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ telephone: "", email: "", secretariat_nom: "", secretariat_email: "", secretariat_tel: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!rpps) return;
    const supabase = createClient();
    supabase.from("annuaire_sante").select("*").eq("rpps", rpps).maybeSingle().then(({ data }) => {
      if (!data) { setAbsente(true); return; }
      const x = data as Fiche;
      setFiche(x);
      setF({
        telephone: x.telephone ?? "", email: x.email ?? "",
        secretariat_nom: x.secretariat_nom ?? "", secretariat_email: x.secretariat_email ?? "",
        secretariat_tel: x.secretariat_tel ?? "", notes: x.notes ?? "",
      });
    });
    // Statut : déjà rattaché (soignant externe) / compte actif AS2CŒUR ?
    supabase.from("soignant_externe").select("id").eq("rpps", rpps).limit(1).then(({ data }) => setDejaExterne((data ?? []).length > 0));
    supabase.from("professionnel").select("id").eq("rpps", rpps).limit(1).then(({ data }) => setCompteActif((data ?? []).length > 0));
  }, [rpps]);

  const nomComplet = useMemo(
    () => (fiche ? [fiche.civilite, fiche.prenom, fiche.nom].filter(Boolean).join(" ") : ""),
    [fiche]
  );
  const telPrincipal = fiche?.telephone || fiche?.sites?.find((s) => s.tel)?.tel || "";

  // Création de compte réservée aux gestionnaires (même règle que « Créer… »).
  const peutCreerCompte = !!pro && (pro.niveau === 0 || (pro.niveau <= 2 && pro.role !== "chirurgien" && !estRoleService(pro.role)));

  async function enregistrer() {
    if (!fiche) return;
    setBusy(true); setMsg(null);
    const { error } = await createClient().from("annuaire_sante").update({
      telephone: f.telephone.trim() || null,
      email: f.email.trim() || null,
      secretariat_nom: f.secretariat_nom.trim() || null,
      secretariat_email: f.secretariat_email.trim() || null,
      secretariat_tel: f.secretariat_tel.trim() || null,
      notes: f.notes.trim() || null,
      modifie_le: new Date().toISOString(),
    }).eq("rpps", fiche.rpps);
    setBusy(false);
    if (error) { setMsg("Échec : " + error.message); return; }
    setFiche((x) => (x ? { ...x, ...f } as Fiche : x));
    setEdit(false);
    setMsg("Fiche mise à jour ✓");
  }

  // Rattachement : la fiche devient un soignant externe du prestataire,
  // sélectionnable dans les dossiers patient (même sans compte).
  async function ajouterExterne() {
    if (!fiche || !pro?.prestataire_id) return;
    setBusy(true); setMsg(null);
    const s0 = fiche.sites?.[0];
    const estMed = fiche.type === "medecin";
    const estPha = fiche.type === "pharmacie";
    const { error } = await createClient().from("soignant_externe").insert({
      prestataire_id: pro.prestataire_id,
      type: fiche.type,
      titre: estMed ? (fiche.civilite || "Docteur") : null,
      prenom: estPha ? null : fiche.prenom,
      nom: estPha ? (s0?.rs || `Pharmacie ${fiche.nom}`) : fiche.nom,
      specialite: estMed ? fiche.specialite : null,
      rpps: fiche.rpps,
      telephone: telPrincipal || null,
      email: fiche.email,
      zone_exercice: fiche.type === "infirmiere"
        ? [...new Set((fiche.sites ?? []).map((s) => s.commune).filter(Boolean))].join(" / ") || null
        : null,
      cabinets: (estMed || estPha) && s0 ? adresseSite(s0) || null : null,
      secretariat_nom: estMed ? fiche.secretariat_nom : null,
      secretariat_email: estMed ? fiche.secretariat_email : null,
      secretariat_tel: estMed ? fiche.secretariat_tel : null,
      protocoles: [],
    });
    setBusy(false);
    if (error) { setMsg("Échec : " + error.message); return; }
    setDejaExterne(true);
    setMsg("Ajouté aux soignants externes ✓ — sélectionnable dans les dossiers patient.");
  }

  // Bouton « + » : création de compte pré-remplie depuis la fiche.
  function creerCompte() {
    if (!fiche) return;
    const s0 = fiche.sites?.[0];
    const q = new URLSearchParams();
    q.set("role", fiche.type === "medecin" ? "chirurgien" : fiche.type === "infirmiere" ? "infirmiere_liberale" : "pharmacie");
    q.set("rpps", fiche.rpps);
    if (fiche.type === "pharmacie") q.set("nom", s0?.rs || `Pharmacie ${fiche.nom}`);
    else { q.set("nom", fiche.nom); if (fiche.prenom) q.set("prenom", fiche.prenom); }
    if (fiche.type === "medecin") {
      if (fiche.civilite === "Docteur" || fiche.civilite === "Professeur") q.set("titre", fiche.civilite);
      if (fiche.specialite) q.set("specialite", fiche.specialite);
      if (s0) q.set("cabinets", adresseSite(s0));
    }
    if (fiche.type === "infirmiere") {
      const zone = [...new Set((fiche.sites ?? []).map((s) => s.commune).filter(Boolean))].join(" / ");
      if (zone) q.set("zone_exercice", zone);
    }
    if (fiche.type === "pharmacie" && s0) q.set("cabinets", adresseSite(s0));
    if (telPrincipal) q.set("telephone", telPrincipal);
    if (fiche.email) q.set("email", fiche.email);
    router.push(`/pro/nouveau-soignant?${q.toString()}`);
  }

  if (absente) {
    return <div className="card text-sm text-slate-500">Fiche introuvable dans l&apos;annuaire santé.</div>;
  }
  if (!fiche) {
    return <div className="card text-sm text-slate-400">Chargement de la fiche…</div>;
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <Link href="/pro" className="text-sm font-medium text-brand hover:underline">← Retour</Link>
      </div>

      {/* ── Identité ── */}
      <div className="card grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-slate-800">{nomComplet}</h1>
          <span className="badge bg-rose-100 text-brand">{LIBELLE_TYPE[fiche.type]}</span>
          {fiche.mode_exercice && <span className="badge bg-slate-100 text-slate-600">{fiche.mode_exercice}</span>}
          {compteActif ? (
            <span className="badge bg-green-100 text-green-700">Compte actif</span>
          ) : (
            <span className="badge bg-slate-100 text-slate-500">Fiche annuaire</span>
          )}
        </div>
        {fiche.specialite && <p className="text-sm text-slate-600">{fiche.specialite}</p>}
        <p className="text-xs text-slate-400">
          RPPS : <span className="font-mono">{fiche.rpps}</span> · Source : annuaire santé officiel (Open Data)
        </p>

        <div className="flex flex-wrap gap-2 border-t border-rose-100 pt-3">
          {dejaExterne ? (
            <span className="badge bg-green-100 text-green-700">Déjà dans vos soignants externes ✓</span>
          ) : (
            <button onClick={ajouterExterne} disabled={busy} className="btn-primary">
              Rattacher (soignant externe)
            </button>
          )}
          {peutCreerCompte && !compteActif && (
            <button onClick={creerCompte} disabled={busy} className="btn-secondary inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
              Créer un compte
            </button>
          )}
        </div>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith("Échec") ? "bg-red-50 text-critique" : "bg-green-50 text-green-700"}`}>{msg}</p>}
      </div>

      {/* ── Lieux d'exercice (multi-sites) ── */}
      <div className="card grid gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
          Lieu{(fiche.sites?.length ?? 0) > 1 ? "x" : ""} d&apos;exercice ({fiche.sites?.length ?? 0})
        </p>
        {(fiche.sites ?? []).length === 0 && <p className="text-sm text-slate-400">Aucun lieu renseigné dans l&apos;annuaire.</p>}
        {(fiche.sites ?? []).map((s, i) => (
          <div key={i} className="rounded-xl border border-rose-100 p-3">
            {s.rs && <p className="text-sm font-semibold text-slate-700">{s.rs}</p>}
            {adresseSite(s) && <p className="text-sm text-slate-600">{adresseSite(s)}</p>}
            {s.tel && <a href={`tel:${s.tel}`} className="text-sm font-medium text-brand hover:underline">{s.tel}</a>}
          </div>
        ))}
      </div>

      {/* ── Coordonnées complémentaires (éditables) ── */}
      <div className="card grid gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Coordonnées complémentaires</p>
          {!edit && (
            <button onClick={() => setEdit(true)} className="text-sm font-medium text-brand hover:underline">Modifier</button>
          )}
        </div>
        {!edit ? (
          <div className="grid gap-1.5 text-sm">
            <p><span className="text-slate-400">Téléphone : </span>{fiche.telephone || <span className="text-slate-300">—</span>}</p>
            <p><span className="text-slate-400">Email : </span>{fiche.email || <span className="text-slate-300">—</span>}</p>
            <p><span className="text-slate-400">Secrétariat : </span>
              {[fiche.secretariat_nom, fiche.secretariat_tel, fiche.secretariat_email].filter(Boolean).join(" · ") || <span className="text-slate-300">—</span>}
            </p>
            {fiche.notes && <p className="whitespace-pre-wrap text-slate-600"><span className="text-slate-400">Notes : </span>{fiche.notes}</p>}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={f.telephone} onChange={(e) => setF((x) => ({ ...x, telephone: e.target.value }))} placeholder="0…" inputMode="tel" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} placeholder="nom@email.fr" inputMode="email" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Secrétariat — nom</label>
                <input className="input" value={f.secretariat_nom} onChange={(e) => setF((x) => ({ ...x, secretariat_nom: e.target.value }))} />
              </div>
              <div>
                <label className="label">Secrétariat — email</label>
                <input className="input" value={f.secretariat_email} onChange={(e) => setF((x) => ({ ...x, secretariat_email: e.target.value }))} inputMode="email" />
              </div>
              <div>
                <label className="label">Secrétariat — téléphone</label>
                <input className="input" value={f.secretariat_tel} onChange={(e) => setF((x) => ({ ...x, secretariat_tel: e.target.value }))} inputMode="tel" />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input min-h-20" value={f.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} placeholder="Informations utiles (horaires, consignes…)" />
            </div>
            <div className="flex gap-2">
              <button onClick={enregistrer} disabled={busy} className="btn-primary">{busy ? "Enregistrement…" : "Enregistrer"}</button>
              <button onClick={() => setEdit(false)} disabled={busy} className="btn-secondary">Annuler</button>
            </div>
          </>
        )}
        <p className="text-xs text-slate-400">
          Les données d&apos;identité et de lieux proviennent de l&apos;annuaire officiel. Chaque professionnel peut demander la rectification ou la suppression de sa fiche (RGPD).
        </p>
      </div>
    </div>
  );
}
