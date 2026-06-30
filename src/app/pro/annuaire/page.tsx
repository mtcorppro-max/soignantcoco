"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Avatar } from "@/components/Avatar";
import { Select } from "@/components/Select";
import { LIBELLE_ROLE, peutGererPersonnel, SERVICES, libService } from "@/lib/roles";
import { peutNotesFrais } from "@/lib/notesFrais";

type Pro = {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  role: string;
  poste: string | null;
  service: string | null;
  email: string | null;
  telephone: string | null;
  photo_url: string | null;
  agence_id: string | null;
  region_id: string | null;
};
type Region = { id: string; nom: string };
type Agence = { id: string; nom: string; region_id: string };

const COLS = "id,nom,prenom,titre,role,poste,service,email,telephone,photo_url,agence_id,region_id";
const nomComplet = (p: Pro) => [p.titre, p.prenom, p.nom].filter(Boolean).join(" ") || p.nom;
const libRole = (r: string) => LIBELLE_ROLE[r as keyof typeof LIBELLE_ROLE] ?? r;

type Groupe = { cle: string; titre: string; sousTitre?: string; membres: Pro[] };

export default function AnnuairePage() {
  const pro = useProSession();
  const [pros, setPros] = useState<Pro[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [agences, setAgences] = useState<Agence[]>([]);
  const [pret, setPret] = useState(false);
  const [q, setQ] = useState("");

  // Édition inline du poste.
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Création d'un compte « personnel ».
  const [formOuvert, setFormOuvert] = useState(false);
  const VIDE = { nom: "", prenom: "", service: "", poste: "", email: "", telephone: "", motDePasse: "" };
  const [cForm, setCForm] = useState({ ...VIDE });
  const [cBusy, setCBusy] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);
  const [cCree, setCCree] = useState<{ email: string; motDePasse: string } | null>(null);

  const gestion = !!pro && peutGererPersonnel(pro.role, pro.niveau);
  // RH / dirigeant peuvent déposer des documents dans le coffre d'un salarié interne.
  const peutDeposerCoffre = !!pro && (pro.niveau === 0 || pro.role === "rh" || pro.role === "dirigeant");
  const [coffreBusy, setCoffreBusy] = useState<string | null>(null);

  async function deposerCoffre(memberId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setCoffreBusy(memberId);
    let ok = true;
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("fichier", f);
      fd.append("professionnel_id", memberId);
      const res = await fetch("/api/coffre", { method: "POST", body: fd });
      if (!res.ok) { ok = false; alert((await res.json().catch(() => ({}))).message ?? "Échec du dépôt."); break; }
    }
    setCoffreBusy(null);
    if (ok) alert("Document(s) déposé(s) dans le coffre-fort du salarié.");
  }

  const recharger = () => {
    createClient().from("professionnel").select(COLS).order("nom").then(({ data }) => {
      setPros((data ?? []) as Pro[]);
      setPret(true);
    });
  };

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("professionnel").select(COLS).order("nom"),
      supabase.from("region").select("id,nom").order("nom"),
      supabase.from("agence").select("id,nom,region_id").order("nom"),
    ]).then(([{ data: ps }, { data: rs }, { data: ags }]) => {
      setPros((ps ?? []) as Pro[]);
      setRegions((rs ?? []) as Region[]);
      setAgences((ags ?? []) as Agence[]);
      setPret(true);
    });
  }, []);

  const groupes = useMemo<Groupe[]>(() => {
    const f = q.trim().toLowerCase();
    const visibles = f
      ? pros.filter((p) => nomComplet(p).toLowerCase().includes(f) || libRole(p.role).toLowerCase().includes(f) || (p.poste ?? "").toLowerCase().includes(f) || (p.email ?? "").toLowerCase().includes(f))
      : pros;
    const out: Groupe[] = [];
    for (const r of regions) {
      const regionaux = visibles.filter((p) => p.region_id === r.id && !p.agence_id);
      if (regionaux.length) out.push({ cle: `r-${r.id}`, titre: r.nom, sousTitre: "Équipe régionale", membres: regionaux });
      for (const a of agences.filter((a) => a.region_id === r.id)) {
        const m = visibles.filter((p) => p.agence_id === a.id);
        if (m.length) out.push({ cle: `a-${a.id}`, titre: a.nom, sousTitre: r.nom, membres: m });
      }
    }
    const support = visibles.filter((p) => !p.agence_id && !p.region_id);
    if (support.length) out.push({ cle: "support", titre: "Direction & support", sousTitre: "Hors agence", membres: support });
    const idsClasses = new Set(out.flatMap((g) => g.membres.map((m) => m.id)));
    const autres = visibles.filter((p) => !idsClasses.has(p.id));
    if (autres.length) out.push({ cle: "autres", titre: "Autres", membres: autres });
    return out;
  }, [pros, regions, agences, q]);

  async function enregistrerPoste(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/soignants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poste: editVal }),
    });
    setBusyId(null);
    if (res.ok) {
      setPros((prev) => prev.map((p) => (p.id === id ? { ...p, poste: editVal.trim() || null } : p)));
      setEditId(null);
    } else {
      const j = await res.json().catch(() => ({}));
      alert("Échec : " + (j.message ?? "erreur"));
    }
  }

  async function creerPersonnel(e: React.FormEvent) {
    e.preventDefault();
    if (!cForm.service) { setCErr("Choisissez le service."); return; }
    setCErr(null); setCBusy(true);
    try {
      const res = await fetch("/api/soignants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "personnel", niveau: "5", ...cForm }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? "Erreur.");
      setCCree({ email: j.email, motDePasse: j.motDePasse });
      setCForm({ ...VIDE });
      recharger();
    } catch (err) {
      setCErr(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setCBusy(false);
    }
  }

  // Réservé à RH / dirigeant / manager / administration (niveau 0).
  if (pro && !peutGererPersonnel(pro.role, pro.niveau)) {
    return <div className="card text-sm text-slate-500">Cette page est réservée aux ressources humaines et à l&apos;encadrement.</div>;
  }

  const total = pros.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Annuaire des équipes</h1>
        {gestion && (
          <button onClick={() => { setFormOuvert((v) => !v); setCCree(null); }} className="btn-primary px-4 py-2 text-sm">
            {formOuvert ? "Fermer" : "+ Membre du personnel"}
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">Tout le personnel interne de la société — {total} compte{total > 1 ? "s" : ""}.</p>

      {/* ── Création d'un compte « personnel » ── */}
      {gestion && formOuvert && (
        <div className="card mb-5 grid gap-4">
          {cCree ? (
            <div className="grid gap-3 text-center">
              <p className="text-sm text-slate-500">Compte personnel créé ✓ — identifiants de connexion :</p>
              <div className="grid gap-2 rounded-xl bg-rose-50 p-4 text-left">
                <p className="text-sm"><span className="text-slate-400">Email : </span><span className="font-mono font-semibold text-brand">{cCree.email}</span></p>
                <p className="text-sm"><span className="text-slate-400">Mot de passe : </span><span className="font-mono font-semibold text-brand">{cCree.motDePasse}</span></p>
              </div>
              <p className="text-xs text-slate-400">À transmettre au membre du personnel.</p>
              <button onClick={() => setCCree(null)} className="btn-secondary">Créer un autre compte</button>
            </div>
          ) : (
            <form onSubmit={creerPersonnel} className="grid gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Nouveau membre du personnel</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Prénom *</label><input className="input" value={cForm.prenom} onChange={(e) => setCForm((f) => ({ ...f, prenom: e.target.value }))} placeholder="Marie" required /></div>
                <div><label className="label">Nom *</label><input className="input" value={cForm.nom} onChange={(e) => setCForm((f) => ({ ...f, nom: e.target.value }))} placeholder="DUPONT" required /></div>
              </div>
              <div><label className="label">Service *</label><Select value={cForm.service} onChange={(v) => setCForm((f) => ({ ...f, service: v }))} placeholder="— Choisir un service —" options={SERVICES} /></div>
              <div><label className="label">Poste / fonction</label><input className="input" value={cForm.poste} onChange={(e) => setCForm((f) => ({ ...f, poste: e.target.value }))} placeholder="Secrétaire, Comptable, Technicien…" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Email de connexion *</label><input className="input" type="email" value={cForm.email} onChange={(e) => setCForm((f) => ({ ...f, email: e.target.value }))} placeholder="nom@email.fr" inputMode="email" required /></div>
                <div><label className="label">Téléphone</label><input className="input" value={cForm.telephone} onChange={(e) => setCForm((f) => ({ ...f, telephone: e.target.value }))} placeholder="0…" inputMode="tel" /></div>
              </div>
              <div><label className="label">Mot de passe</label><input className="input" value={cForm.motDePasse} onChange={(e) => setCForm((f) => ({ ...f, motDePasse: e.target.value }))} placeholder="Laisser vide pour générer" /></div>
              {cErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{cErr}</p>}
              <button className="btn-primary py-3" disabled={cBusy}>{cBusy ? "Création…" : "Créer le compte personnel"}</button>
            </form>
          )}
        </div>
      )}

      <input className="input mb-5" placeholder="Rechercher un nom, un poste, un rôle…" value={q} onChange={(e) => setQ(e.target.value)} />

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="card text-sm text-slate-400">Aucun résultat.</p>
      ) : (
        <div className="grid gap-5">
          {groupes.map((g) => (
            <section key={g.cle} className="grid gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-800">{g.titre}</h2>
                <span className="text-xs text-slate-400">{g.sousTitre ? `${g.sousTitre} · ` : ""}{g.membres.length} membre{g.membres.length > 1 ? "s" : ""}</span>
              </div>
              <div className="grid gap-2">
                {g.membres.map((m) => (
                  <div key={m.id} className="card flex flex-wrap items-center gap-3 py-3">
                    <Avatar url={m.photo_url} prenom={m.prenom} nom={m.nom} taille="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{nomComplet(m)}</span>
                        <span className="badge bg-rose-100 text-brand">{libRole(m.role)}</span>
                        {m.service && <span className="badge bg-sky-100 text-sky-700">{libService(m.service)}</span>}
                        {m.id === pro?.id && <span className="badge bg-slate-100 text-slate-500">Vous</span>}
                      </div>
                      {/* Poste (dénomination) */}
                      {editId === m.id ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <input
                            className="input h-8 w-56 py-1 text-sm"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            placeholder="Poste / fonction"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") enregistrerPoste(m.id); if (e.key === "Escape") setEditId(null); }}
                          />
                          <button onClick={() => enregistrerPoste(m.id)} disabled={busyId === m.id} className="btn-primary px-3 py-1 text-xs">{busyId === m.id ? "…" : "Enregistrer"}</button>
                          <button onClick={() => setEditId(null)} className="btn-secondary px-3 py-1 text-xs">Annuler</button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {m.poste ? <span className="italic">{m.poste}</span> : <span className="text-slate-300">Poste non renseigné</span>}
                          {gestion && (
                            <button onClick={() => { setEditId(m.id); setEditVal(m.poste ?? ""); }} className="ml-2 font-medium text-brand hover:underline">modifier</button>
                          )}
                        </p>
                      )}
                      <p className="truncate text-xs text-slate-400">{[m.email, m.telephone].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {m.email && <a href={`mailto:${m.email}`} className="btn-secondary px-3 py-1.5 text-xs" title="Envoyer un email">Email</a>}
                      {m.telephone && <a href={`tel:${m.telephone}`} className="btn-secondary px-3 py-1.5 text-xs" title="Appeler">Tél.</a>}
                      {peutDeposerCoffre && m.id !== pro?.id && peutNotesFrais(m.role) && (
                        <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-xs ${coffreBusy === m.id ? "pointer-events-none opacity-50" : ""}`} title="Déposer un document dans le coffre-fort de ce salarié">
                          {coffreBusy === m.id ? "Dépôt…" : "🔒 Coffre"}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple className="hidden" onChange={(e) => deposerCoffre(m.id, e.target.files)} disabled={coffreBusy === m.id} />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
