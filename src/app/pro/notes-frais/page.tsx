"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { peutNotesFrais, STATUTS_NDF, eurNdf } from "@/lib/notesFrais";

type Note = {
  id: string;
  titre: string;
  statut: string;
  total_ttc: number;
  periode_debut: string | null;
  periode_fin: string | null;
  created_at: string;
  emetteur?: { nom: string; prenom: string | null; titre: string | null } | null;
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "");
const nom = (e?: Note["emetteur"]) => (e ? [e.titre, e.prenom, e.nom].filter(Boolean).join(" ") : "");

export default function NotesFraisPage() {
  const pro = useProSession();
  const router = useRouter();
  const [tab, setTab] = useState<"mes" | "valider">("mes");
  const [mes, setMes] = useState<Note[]>([]);
  const [aValider, setAValider] = useState<Note[]>([]);
  const [pret, setPret] = useState(false);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    if (!pro) return;
    const supabase = createClient();
    const [{ data: m }, { data: v }] = await Promise.all([
      supabase.from("note_de_frais").select("id,titre,statut,total_ttc,periode_debut,periode_fin,created_at").eq("emetteur_id", pro.id).order("created_at", { ascending: false }),
      supabase.from("note_de_frais").select("id,titre,statut,total_ttc,periode_debut,periode_fin,created_at,emetteur:emetteur_id(nom,prenom,titre)").eq("statut", "soumise").neq("emetteur_id", pro.id).order("created_at", { ascending: true }),
    ]);
    setMes((m ?? []) as Note[]);
    setAValider((v ?? []) as unknown as Note[]);
    setPret(true);
  }, [pro]);

  useEffect(() => { charger(); }, [charger]);

  async function nouvelle() {
    if (!pro?.prestataire_id) { alert("Aucun prestataire associé à votre compte."); return; }
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await createClient().from("note_de_frais")
      .insert({ prestataire_id: pro.prestataire_id, emetteur_id: pro.id, titre: "Note de frais", periode_debut: today })
      .select("id").single();
    setBusy(false);
    if (error || !data) { alert("Échec : " + (error?.message ?? "")); return; }
    router.push(`/pro/notes-frais/${data.id}`);
  }

  if (pro && !peutNotesFrais(pro.role)) {
    return <div className="card text-sm text-slate-500">Les notes de frais sont réservées au personnel interne.</div>;
  }

  const liste = tab === "mes" ? mes : aValider;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/pro/profil" prefetch className="text-sm text-slate-400 hover:text-brand">← Mon profil</Link>
      <div className="mb-1 mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Notes de frais</h1>
        <div className="flex items-center gap-3">
          {pro && (pro.niveau === 0 || pro.role === "dirigeant" || pro.role === "manager") && (
            <Link href="/pro/notes-frais/dmos" prefetch className="text-sm font-medium text-brand hover:underline">Suivi DMOS</Link>
          )}
          <button onClick={nouvelle} disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">+ Nouvelle note</button>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-500">Déposez vos frais professionnels ; ils sont validés selon votre rattachement.</p>

      <Link href="/pro/financement" prefetch className="card mb-4 flex items-center justify-between gap-3 transition hover:bg-rose-50/40">
        <div>
          <p className="font-semibold text-slate-800">Demande de financement</p>
          <p className="text-sm text-slate-500">Salon, congrès, formation…</p>
        </div>
        <span className="text-xl text-brand">→</span>
      </Link>

      <div className="mb-5 flex gap-2">
        <button onClick={() => setTab("mes")} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${tab === "mes" ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`}>Mes notes</button>
        <button onClick={() => setTab("valider")} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${tab === "valider" ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`}>
          À valider
          {aValider.length > 0 && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${tab === "valider" ? "bg-white/25" : "bg-brand text-white"}`}>{aValider.length}</span>}
        </button>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="card text-sm text-slate-400">{tab === "mes" ? "Aucune note de frais. Cliquez sur « + Nouvelle note »." : "Aucune note à valider."}</p>
      ) : (
        <div className="grid gap-2">
          {liste.map((n) => {
            const s = STATUTS_NDF[n.statut] ?? STATUTS_NDF.brouillon;
            return (
              <Link key={n.id} href={`/pro/notes-frais/${n.id}`} prefetch className="card flex flex-wrap items-center justify-between gap-3 py-3 transition hover:bg-rose-50/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{n.titre}</span>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {tab === "valider" && nom(n.emetteur) ? `${nom(n.emetteur)} · ` : ""}
                    {n.periode_debut ? fmt(n.periode_debut) : fmt(n.created_at)}
                    {n.periode_fin ? ` → ${fmt(n.periode_fin)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-brand">{eurNdf(n.total_ttc)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
