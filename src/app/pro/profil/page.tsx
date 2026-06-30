"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession, patchProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { peutNotesFrais } from "@/lib/notesFrais";
import { Avatar } from "@/components/Avatar";

type Form = {
  prenom: string; nom: string;
  telephone: string; email: string;
  specialite: string; rpps: string; cabinets: string;
  secretariat_nom: string; secretariat_email: string; secretariat_tel: string;
  zone_exercice: string;
};
const VIDE: Form = { prenom: "", nom: "", telephone: "", email: "", specialite: "", rpps: "", cabinets: "", secretariat_nom: "", secretariat_email: "", secretariat_tel: "", zone_exercice: "" };

export default function MonProfil() {
  const pro = useProSession();
  const [f, setF] = useState<Form>(VIDE);
  const [role, setRole] = useState("");
  const [recevoirAlertes, setRecevoirAlertes] = useState(false);
  const [agencesList, setAgencesList] = useState<{ value: string; label: string }[]>([]);
  const [agencesDelegue, setAgencesDelegue] = useState<string[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!pro?.id) return;
    createClient()
      .from("professionnel")
      .select("prenom,nom,telephone,email,specialite,rpps,cabinets,secretariat_nom,secretariat_email,secretariat_tel,zone_exercice,role")
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

  // Opt-in alertes : valeur issue de la session (pas de colonne dans le select
  // ci-dessus, pour rester robuste si la migration 0051 n'est pas encore appliquée).
  useEffect(() => { setRecevoirAlertes(!!pro?.recevoir_alertes); }, [pro?.recevoir_alertes]);

  // Photo de profil : valeur issue de la session.
  useEffect(() => { setPhotoUrl(pro?.photo_url ?? null); }, [pro?.photo_url]);

  async function changerPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier
    if (!file) return;
    setPhotoBusy(true); setErr(null); setMsg(null);
    const fd = new FormData();
    fd.append("fichier", file);
    const res = await fetch("/api/profil/photo", { method: "POST", body: fd });
    setPhotoBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => null); setErr(j?.message ?? "Échec de l'envoi de la photo."); return; }
    const j = await res.json();
    setPhotoUrl(j.photo_url);
    patchProSession({ photo_url: j.photo_url });
    setMsg("Photo de profil mise à jour ✓");
  }

  async function supprimerPhoto() {
    setPhotoBusy(true); setErr(null); setMsg(null);
    const res = await fetch("/api/profil/photo", { method: "DELETE" });
    setPhotoBusy(false);
    if (!res.ok) { setErr("Échec de la suppression."); return; }
    setPhotoUrl(null);
    patchProSession({ photo_url: null });
    setMsg("Photo supprimée ✓");
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const estChir = role === "chirurgien";
  const estInfLib = role === "infirmiere_liberale";
  const estDelegue = role === "delegue";

  // Délégué : liste des agences + agences actuellement rattachées.
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

  const toggleAgence = (id: string) =>
    setAgencesDelegue((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  async function sauver() {
    if (!pro?.id) return;
    setBusy(true); setErr(null); setMsg(null);
    const body: Record<string, unknown> = {
      prenom: f.prenom, nom: f.nom, telephone: f.telephone, email: f.email,
      ...(estChir ? { specialite: f.specialite, rpps: f.rpps, cabinets: f.cabinets, secretariat_nom: f.secretariat_nom, secretariat_email: f.secretariat_email, secretariat_tel: f.secretariat_tel, recevoir_alertes: recevoirAlertes } : {}),
      ...(estInfLib ? { zone_exercice: f.zone_exercice } : {}),
      ...(estDelegue ? { agences: agencesDelegue } : {}),
    };
    const res = await fetch(`/api/soignants/${pro.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => null); setErr(j?.message ?? `Échec (HTTP ${res.status}).`); return; }
    if (estChir) patchProSession({ recevoir_alertes: recevoirAlertes });
    setMsg("Profil mis à jour ✓");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Mon profil</h1>
      <p className="mb-5 text-sm text-slate-500">{role ? LIBELLE_ROLE[role as keyof typeof LIBELLE_ROLE] : ""}</p>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : (
        <>
        {peutNotesFrais(role) && (
          <Link href="/pro/notes-frais" prefetch className="card mb-4 flex items-center justify-between gap-3 transition hover:bg-rose-50/40">
            <div>
              <p className="font-semibold text-slate-800">Mes notes de frais</p>
              <p className="text-sm text-slate-500">Déposer et suivre mes frais professionnels.</p>
            </div>
            <span className="text-xl text-brand">→</span>
          </Link>
        )}
        <div className="card grid gap-4">
          {/* Photo de profil */}
          <div className="flex items-center gap-4">
            <Avatar url={photoUrl} prenom={f.prenom} nom={f.nom} taille="lg" />
            <div className="flex flex-wrap items-center gap-2">
              <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-sm ${photoBusy ? "pointer-events-none opacity-50" : ""}`}>
                {photoBusy ? "Envoi…" : photoUrl ? "Changer la photo" : "Ajouter une photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={changerPhoto} disabled={photoBusy} />
              </label>
              {photoUrl && (
                <button onClick={supprimerPhoto} disabled={photoBusy} className="text-sm font-medium text-critique hover:underline disabled:opacity-50">Supprimer</button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Prénom</label><input className="input" value={f.prenom} onChange={set("prenom")} /></div>
            <div><label className="label">Nom</label><input className="input" value={f.nom} onChange={set("nom")} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Téléphone</label><input className="input" value={f.telephone} onChange={set("telephone")} inputMode="tel" /></div>
            <div><label className="label">Email</label><input className="input" value={f.email} onChange={set("email")} inputMode="email" /></div>
          </div>

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
                <span className="text-sm text-slate-700">
                  Recevoir les alertes patients
                  <span className="block text-xs text-slate-400">Décoché, vous ne recevez pas les alertes patients ni les messages d&apos;organisation interne (astreintes). Cochez pour afficher le centre d&apos;alertes sur votre tableau de bord.</span>
                </span>
              </label>
            </>
          )}
          {estInfLib && (
            <div><label className="label">Zone(s) d&apos;exercice</label><input className="input" value={f.zone_exercice} onChange={set("zone_exercice")} /></div>
          )}
          {estDelegue && (
            <div>
              <label className="label">Mes agences de rattachement</label>
              {agencesList.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune agence disponible.</p>
              ) : (
                <div className="grid gap-1.5 rounded-xl border border-rose-100 p-3">
                  {agencesList.map((a) => (
                    <label key={a.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={agencesDelegue.includes(a.value)} onChange={() => toggleAgence(a.value)} className="accent-brand" />
                      {a.label}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-slate-400">Vous pouvez être rattaché à plusieurs agences.</p>
            </div>
          )}

          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}
          {msg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-ok">{msg}</p>}
          <button onClick={sauver} disabled={busy} className="btn-primary py-3">{busy ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
        </>
      )}
    </div>
  );
}
