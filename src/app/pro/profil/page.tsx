"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession, patchProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { peutNotesFrais } from "@/lib/notesFrais";
import { Avatar } from "@/components/Avatar";
import { DateField } from "@/components/DateField";

type Form = {
  prenom: string; nom: string; date_naissance: string;
  telephone: string; email: string;
  specialite: string; rpps: string; cabinets: string;
  secretariat_nom: string; secretariat_email: string; secretariat_tel: string;
  zone_exercice: string;
};
const VIDE: Form = { prenom: "", nom: "", date_naissance: "", telephone: "", email: "", specialite: "", rpps: "", cabinets: "", secretariat_nom: "", secretariat_email: "", secretariat_tel: "", zone_exercice: "" };

const fmtDate = (iso: string) => { if (!iso) return ""; const [a, m, j] = iso.split("-"); return j && m && a ? `${j}/${m}/${a}` : iso; };

const ESPACES = [
  { href: "/pro/notes-frais", titre: "Notes de frais", sous: "Frais & financements", icon: "recu" },
  { href: "/pro/espace-rh", titre: "Espace RH", sous: "Mes démarches RH", icon: "rh" },
  { href: "/pro/voiture", titre: "Espace voiture", sous: "Véhicule & parc auto", icon: "voiture" },
  { href: "/pro/formation", titre: "Espace formation", sous: "Mes formations", icon: "formation" },
];

export default function MonProfil() {
  const pro = useProSession();
  const [f, setF] = useState<Form>(VIDE);
  const [role, setRole] = useState("");
  const [recevoirAlertes, setRecevoirAlertes] = useState(false);
  const [agencesList, setAgencesList] = useState<{ value: string; label: string }[]>([]);
  const [agencesDelegue, setAgencesDelegue] = useState<string[]>([]);
  const [pret, setPret] = useState(false);
  const [edition, setEdition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!pro?.id) return;
    createClient()
      .from("professionnel")
      .select("prenom,nom,date_naissance,telephone,email,specialite,rpps,cabinets,secretariat_nom,secretariat_email,secretariat_tel,zone_exercice,role")
      .eq("id", pro.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as Partial<Form> & { role: string };
          setF({ ...VIDE, ...Object.fromEntries(Object.keys(VIDE).map((k) => [k, (d as Record<string, unknown>)[k] ?? ""])) } as Form);
          setRole(d.role);
        }
        setPret(true);
      });
  }, [pro?.id]);

  useEffect(() => { setRecevoirAlertes(!!pro?.recevoir_alertes); }, [pro?.recevoir_alertes]);
  useEffect(() => { setPhotoUrl(pro?.photo_url ?? null); }, [pro?.photo_url]);

  async function changerPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true); setErr(null); setMsg(null);
    const fd = new FormData(); fd.append("fichier", file);
    const res = await fetch("/api/profil/photo", { method: "POST", body: fd });
    setPhotoBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => null); setErr(j?.message ?? "Échec de l'envoi de la photo."); return; }
    const j = await res.json();
    setPhotoUrl(j.photo_url); patchProSession({ photo_url: j.photo_url }); setMsg("Photo mise à jour ✓");
  }
  async function supprimerPhoto() {
    setPhotoBusy(true); setErr(null); setMsg(null);
    const res = await fetch("/api/profil/photo", { method: "DELETE" });
    setPhotoBusy(false);
    if (!res.ok) { setErr("Échec de la suppression."); return; }
    setPhotoUrl(null); patchProSession({ photo_url: null }); setMsg("Photo supprimée ✓");
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const estChir = role === "chirurgien";
  const estInfLib = role === "infirmiere_liberale";
  const estDelegue = role === "delegue";

  useEffect(() => {
    if (role !== "delegue" || !pro?.id) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("region").select("id,nom"),
      supabase.from("agence").select("id,nom,region_id"),
      supabase.from("professionnel").select("agences").eq("id", pro.id).maybeSingle(),
    ]).then(([{ data: regs }, { data: ags }, { data: me }]) => {
      const nomRegion = new Map((regs ?? []).map((r) => [r.id as string, r.nom as string]));
      setAgencesList((ags ?? []).map((a) => ({ value: a.id as string, label: `${nomRegion.get(a.region_id as string) ?? "?"} · ${a.nom}` })));
      setAgencesDelegue(((me as { agences?: string[] } | null)?.agences) ?? []);
    });
  }, [role, pro?.id]);

  const toggleAgence = (id: string) => setAgencesDelegue((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  async function sauver() {
    if (!pro?.id) return;
    setBusy(true); setErr(null); setMsg(null);
    const body: Record<string, unknown> = {
      prenom: f.prenom, nom: f.nom, telephone: f.telephone, email: f.email, date_naissance: f.date_naissance,
      ...(estChir ? { specialite: f.specialite, rpps: f.rpps, cabinets: f.cabinets, secretariat_nom: f.secretariat_nom, secretariat_email: f.secretariat_email, secretariat_tel: f.secretariat_tel, recevoir_alertes: recevoirAlertes } : {}),
      ...(estInfLib ? { zone_exercice: f.zone_exercice } : {}),
      ...(estDelegue ? { agences: agencesDelegue } : {}),
    };
    const res = await fetch(`/api/soignants/${pro.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => null); setErr(j?.message ?? `Échec (HTTP ${res.status}).`); return; }
    if (estChir) patchProSession({ recevoir_alertes: recevoirAlertes });
    setMsg("Profil mis à jour ✓"); setEdition(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : (
        <div className="grid gap-5">
          {/* ── Hero profil ── */}
          <div className="grid gap-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-100/70 via-rose-50 to-white p-5">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar url={photoUrl} prenom={f.prenom} nom={f.nom} taille="lg" />
                {!edition && (
                  <button onClick={() => { setEdition(true); setMsg(null); }} title="Modifier mon profil" aria-label="Modifier" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-brand text-white shadow ring-2 ring-white transition hover:bg-brand-dark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-800">Bonjour, {f.prenom || f.nom || "vous"} 👋</p>
                {f.email && <p className="truncate text-sm text-slate-500">{f.email}</p>}
                <span className="badge mt-1 bg-white/70 text-brand">{role ? LIBELLE_ROLE[role as keyof typeof LIBELLE_ROLE] : ""}</span>
              </div>
            </div>

            {edition ? (
              <div className="grid gap-4 border-t border-rose-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-sm ${photoBusy ? "pointer-events-none opacity-50" : ""}`}>
                    {photoBusy ? "Envoi…" : photoUrl ? "Changer la photo" : "Ajouter une photo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={changerPhoto} disabled={photoBusy} />
                  </label>
                  {photoUrl && <button onClick={supprimerPhoto} disabled={photoBusy} className="text-sm font-medium text-critique hover:underline disabled:opacity-50">Supprimer la photo</button>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Prénom</label><input className="input" value={f.prenom} onChange={set("prenom")} /></div>
                  <div><label className="label">Nom</label><input className="input" value={f.nom} onChange={set("nom")} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Téléphone</label><input className="input" value={f.telephone} onChange={set("telephone")} inputMode="tel" /></div>
                  <div><label className="label">Email</label><input className="input" value={f.email} onChange={set("email")} inputMode="email" /></div>
                </div>
                <div><label className="label">Date de naissance</label><DateField value={f.date_naissance} onChange={(v) => setF((s) => ({ ...s, date_naissance: v }))} /></div>

                {estChir && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className="label">Spécialité</label><input className="input" value={f.specialite} onChange={set("specialite")} /></div>
                      <div><label className="label">N° RPPS</label><input className="input" value={f.rpps} onChange={set("rpps")} inputMode="numeric" /></div>
                    </div>
                    <div><label className="label">Lieu d&apos;exercice</label><input className="input" value={f.cabinets} onChange={set("cabinets")} /></div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div><label className="label">Secrétariat</label><input className="input" value={f.secretariat_nom} onChange={set("secretariat_nom")} /></div>
                      <div><label className="label">Email secr.</label><input className="input" value={f.secretariat_email} onChange={set("secretariat_email")} inputMode="email" /></div>
                      <div><label className="label">Tél. secr.</label><input className="input" value={f.secretariat_tel} onChange={set("secretariat_tel")} inputMode="tel" /></div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                      <input type="checkbox" checked={recevoirAlertes} onChange={(e) => setRecevoirAlertes(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
                      <span className="text-sm text-slate-700">Recevoir les alertes patients
                        <span className="block text-xs text-slate-400">Décoché, vous ne recevez pas les alertes patients ni les messages d&apos;organisation interne.</span>
                      </span>
                    </label>
                  </>
                )}
                {estInfLib && <div><label className="label">Zone(s) d&apos;exercice</label><input className="input" value={f.zone_exercice} onChange={set("zone_exercice")} /></div>}
                {estDelegue && (
                  <div>
                    <label className="label">Mes agences de rattachement</label>
                    {agencesList.length === 0 ? <p className="text-sm text-slate-400">Aucune agence.</p> : (
                      <div className="grid gap-1.5 rounded-xl border border-rose-100 p-3">
                        {agencesList.map((a) => (
                          <label key={a.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={agencesDelegue.includes(a.value)} onChange={() => toggleAgence(a.value)} className="accent-brand" />{a.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setEdition(false); setErr(null); }} className="btn-secondary flex-1" disabled={busy}>Annuler</button>
                  <button onClick={sauver} disabled={busy} className="btn-primary flex-1">{busy ? "Enregistrement…" : "Enregistrer"}</button>
                </div>
              </div>
            ) : (
              <div className="grid gap-1.5 border-t border-rose-100 pt-3">
                <Ligne label="Téléphone" value={f.telephone} />
                <Ligne label="Email" value={f.email} />
                <Ligne label="Date de naissance" value={fmtDate(f.date_naissance)} />
                {estChir && (<>
                  <Ligne label="Spécialité" value={f.specialite} />
                  <Ligne label="N° RPPS" value={f.rpps} />
                  <Ligne label="Lieu d'exercice" value={f.cabinets} />
                  <Ligne label="Alertes patients" value={recevoirAlertes ? "Activées" : "Désactivées"} />
                </>)}
                {estInfLib && <Ligne label="Zone d'exercice" value={f.zone_exercice} />}
                {msg && <p className="mt-1 rounded-lg bg-green-50 px-3 py-2 text-sm text-ok">{msg}</p>}
              </div>
            )}
          </div>

          {/* ── Mes espaces (menu vertical) ── */}
          {peutNotesFrais(role) && (
            <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm">
              {ESPACES.map((e) => (
                <Link key={e.href} href={e.href} prefetch className="flex items-center gap-3 border-b border-rose-50 px-4 py-3.5 transition last:border-0 hover:bg-rose-50">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-brand"><IconeEspace name={e.icon} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">{e.titre}</span>
                    <span className="block text-xs text-slate-500">{e.sous}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconeEspace({ name }: { name: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    recu: (<><path d="M6 3h12v18l-2.3-1.4L13.5 21 12 19.6 10.5 21 8.3 19.6 6 21z" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="15" y2="12" /></>),
    rh: (<><path d="M16 21v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21" /><circle cx="9" cy="7" r="3.5" /><path d="M22 21v-1.5a4 4 0 0 0-3-3.85" /><path d="M16 3.6a3.5 3.5 0 0 1 0 6.8" /></>),
    voiture: (<><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M3.5 13h17v4a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" /></>),
    formation: (<><path d="M12 4 2 9l10 5 10-5z" /><path d="M6 11v4c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-4" /></>),
  };
  return <svg viewBox="0 0 24 24" className="h-6 w-6" {...p} aria-hidden="true">{paths[name] ?? paths.recu}</svg>;
}

function Ligne({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}
