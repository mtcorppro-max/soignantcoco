"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { peutMarketing } from "@/lib/roles";
import { Select } from "@/components/Select";
import { DateField } from "@/components/DateField";

type RubriqueId = "congres" | "supports" | "videos";

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">{children}</svg>
);
const ICongres = () => svg(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /></>);
const ISupports = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><line x1="8.5" y1="13" x2="15.5" y2="13" /><line x1="8.5" y1="16.5" x2="13" y2="16.5" /></>);
const IVideos = () => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3z" /></>);

const RUBRIQUES: { id: RubriqueId; label: string; icon: React.ReactNode; vide: string }[] = [
  { id: "congres", label: "Congrès et événements", icon: <ICongres />, vide: "" },
  { id: "supports", label: "Supports", icon: <ISupports />, vide: "Les supports marketing (brochures, affiches, documents…) seront disponibles ici." },
  { id: "videos", label: "Vidéos", icon: <IVideos />, vide: "Les vidéos seront disponibles ici." },
];

export default function MarketingPage() {
  const pro = useProSession();
  const [onglet, setOnglet] = useState<RubriqueId>("congres");

  // Réservé au dirigeant, RH, manager, délégué (+ administration).
  if (pro && !peutMarketing(pro.role, pro.niveau)) {
    return <div className="card text-sm text-slate-500">Cet espace est réservé à la direction, aux RH, managers et délégués.</div>;
  }

  const courante = RUBRIQUES.find((r) => r.id === onglet) ?? RUBRIQUES[0];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Marketing</h1>
      <p className="mb-5 text-sm text-slate-500">Congrès et événements, supports et vidéos.</p>

      {/* Rubriques */}
      <div className="mb-5 flex flex-wrap gap-2">
        {RUBRIQUES.map((r) => {
          const actif = r.id === onglet;
          return (
            <button
              key={r.id}
              onClick={() => setOnglet(r.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${actif ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`}
            >
              {r.icon}
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {onglet === "congres" ? (
        <CongresEvenements />
      ) : (
        <div className="card grid place-items-center gap-2 py-16 text-center">
          <span className="text-rose-300">{courante.icon}</span>
          <p className="text-sm font-medium text-slate-500">{courante.label}</p>
          <p className="max-w-sm text-xs text-slate-400">{courante.vide}</p>
        </div>
      )}
    </div>
  );
}

// ── Rubrique « Congrès & événements » ────────────────────────────────────────

type Evt = {
  id: string;
  nom: string;
  type: string;
  date_debut: string;
  date_fin: string | null;
  lieu: string | null;
  organisateur: string | null;
  description: string | null;
};

const TYPES_EVT: { value: string; label: string }[] = [
  { value: "congres", label: "Congrès" },
  { value: "soiree_scientifique", label: "Soirée scientifique" },
  { value: "atelier", label: "Atelier" },
  { value: "autre", label: "Autre" },
];
const libType = (t: string) => TYPES_EVT.find((x) => x.value === t)?.label ?? t;

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function periode(e: Evt): string {
  const a = fmtDate(e.date_debut);
  const b = e.date_fin ? fmtDate(e.date_fin) : "";
  return b && b !== a ? `${a} → ${b}` : a;
}

const VIDE = { nom: "", type: "congres", date_debut: "", date_fin: "", lieu: "", organisateur: "", description: "" };

function CongresEvenements() {
  const pro = useProSession();
  const [events, setEvents] = useState<Evt[]>([]);
  const [pret, setPret] = useState(false);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...VIDE });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const charger = () => {
    createClient()
      .from("evenement_marketing")
      .select("id,nom,type,date_debut,date_fin,lieu,organisateur,description")
      .order("date_debut", { ascending: false })
      .then(({ data }) => { setEvents((data ?? []) as Evt[]); setPret(true); });
  };
  useEffect(() => { charger(); }, []);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nom.trim() || !f.date_debut) { setErr("Le nom et la date de début sont requis."); return; }
    if (!pro?.prestataire_id) { setErr("Aucun prestataire associé à votre compte."); return; }
    setBusy(true); setErr(null);
    const { error } = await createClient().from("evenement_marketing").insert({
      prestataire_id: pro.prestataire_id,
      nom: f.nom.trim(),
      type: f.type,
      date_debut: f.date_debut,
      date_fin: f.date_fin || null,
      lieu: f.lieu.trim() || null,
      organisateur: f.organisateur.trim() || null,
      description: f.description.trim() || null,
      created_by: pro.id,
    });
    setBusy(false);
    if (error) { setErr("Échec : " + error.message); return; }
    setF({ ...VIDE }); setOpen(false); charger();
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer cet événement ?")) return;
    const { error } = await createClient().from("evenement_marketing").delete().eq("id", id);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-600">{events.length} événement{events.length > 1 ? "s" : ""}</h2>
        <button onClick={() => { setOpen((v) => !v); setErr(null); }} className="btn-primary px-4 py-2 text-sm">
          {open ? "Fermer" : "+ Ajouter un événement"}
        </button>
      </div>

      {open && (
        <form onSubmit={ajouter} className="card grid gap-4">
          <div><label className="label">Nom de l&apos;événement *</label><input className="input" value={f.nom} onChange={set("nom")} placeholder="Congrès SOFCOT 2026" required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Type</label><Select value={f.type} onChange={(v) => setF((s) => ({ ...s, type: v }))} options={TYPES_EVT} /></div>
            <div><label className="label">Organisateur</label><input className="input" value={f.organisateur} onChange={set("organisateur")} placeholder="SOFCOT…" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Date de début *</label><DateField value={f.date_debut} onChange={(v) => setF((s) => ({ ...s, date_debut: v }))} /></div>
            <div><label className="label">Date de fin <span className="text-slate-400">(facultatif)</span></label><DateField value={f.date_fin} onChange={(v) => setF((s) => ({ ...s, date_fin: v }))} /></div>
          </div>
          <div><label className="label">Lieu</label><input className="input" value={f.lieu} onChange={set("lieu")} placeholder="Paris, Palais des congrès…" /></div>
          <div><label className="label">Description <span className="text-slate-400">(facultatif)</span></label><textarea className="input min-h-20" value={f.description} onChange={set("description")} placeholder="Informations, programme, lien d'inscription…" /></div>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}
          <button className="btn-primary py-3" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer l'événement"}</button>
        </form>
      )}

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : events.length === 0 ? (
        <div className="card grid place-items-center gap-2 py-14 text-center">
          <span className="text-rose-300"><ICongres /></span>
          <p className="text-sm font-medium text-slate-500">Aucun événement</p>
          <p className="max-w-sm text-xs text-slate-400">Ajoutez un congrès, une soirée scientifique ou un atelier.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {events.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800">{e.nom}</span>
                  <span className="badge bg-rose-100 text-brand">{libType(e.type)}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {periode(e)}
                  {e.lieu ? ` · ${e.lieu}` : ""}
                  {e.organisateur ? ` · ${e.organisateur}` : ""}
                </p>
                {e.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{e.description}</p>}
              </div>
              <button onClick={() => supprimer(e.id)} className="shrink-0 text-sm font-medium text-critique hover:underline" title="Supprimer">Supprimer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
