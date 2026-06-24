"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { isoDate, semainesAVenir, astreintesIncompletes } from "@/lib/astreinte";
import type { RolePro } from "@/lib/types";

type ProLite = { id: string; nom: string; role: RolePro };
type AbsenceLigne = {
  id: string;
  professionnel_id: string;
  remplacant_id: string | null;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  professionnel: { nom: string; role: RolePro } | null;
  remplacant: { nom: string; role: RolePro } | null;
};

// Palette : une couleur stable par soignant (selon son id).
const PALETTE = [
  "bg-rose-400", "bg-sky-400", "bg-emerald-400", "bg-amber-400",
  "bg-violet-400", "bg-teal-500", "bg-orange-400", "bg-fuchsia-400",
  "bg-indigo-400", "bg-lime-500",
];
function couleurPour(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}
function statutPeriode(debut: string, fin: string): "en_cours" | "a_venir" | "passe" {
  const today = new Date().toISOString().slice(0, 10);
  if (today < debut) return "a_venir";
  if (today > fin) return "passe";
  return "en_cours";
}

export default function CalendrierSoignant() {
  const pro = useProSession();
  const [absences, setAbsences] = useState<AbsenceLigne[]>([]);
  const [equipe, setEquipe] = useState<ProLite[]>([]);
  const [ready, setReady] = useState(false);
  // Astreintes : clé "YYYY-MM-DD|semaine" / "YYYY-MM-DD|weekend" -> professionnel_id
  const [astreintes, setAstreintes] = useState<Map<string, string>>(new Map());

  // Mois affiché dans le calendrier
  const [mois, setMois] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  // Formulaire
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [remplacant, setRemplacant] = useState("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function charger() {
    const supabase = createClient();
    const [{ data: abs }, { data: pros }, { data: astr }] = await Promise.all([
      supabase
        .from("absence")
        .select("*, professionnel:professionnel_id(nom,role), remplacant:remplacant_id(nom,role)")
        .order("date_debut", { ascending: true }),
      supabase.from("professionnel").select("id,nom,role").order("nom"),
      supabase.from("astreinte").select("semaine_debut,type,professionnel_id"),
    ]);
    setAbsences((abs ?? []) as unknown as AbsenceLigne[]);
    setEquipe((pros ?? []) as ProLite[]);
    const m = new Map<string, string>();
    (astr ?? []).forEach((a) => m.set(`${a.semaine_debut}|${a.type}`, a.professionnel_id));
    setAstreintes(m);
    setReady(true);
  }

  useEffect(() => {
    charger();
  }, []);

  async function declarer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!pro) return;
    if (fin < debut) {
      setErreur("La date de fin doit être après la date de début.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("absence").insert({
      professionnel_id: pro.id,
      remplacant_id: remplacant || null,
      date_debut: debut,
      date_fin: fin,
      motif: motif.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErreur("Enregistrement refusé. Réessayez.");
      return;
    }
    setDebut(""); setFin(""); setRemplacant(""); setMotif("");
    charger();
  }

  async function supprimer(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("absence").delete().eq("id", id);
    if (!error) setAbsences((prev) => prev.filter((a) => a.id !== id));
  }

  async function definirAstreinte(semaineISO: string, type: "semaine" | "weekend", proId: string) {
    if (!pro) return;
    const supabase = createClient();
    const cle = `${semaineISO}|${type}`;
    // Optimiste
    setAstreintes((prev) => {
      const m = new Map(prev);
      if (proId) m.set(cle, proId);
      else m.delete(cle);
      return m;
    });
    if (!proId) {
      await supabase
        .from("astreinte")
        .delete()
        .eq("prestataire_id", pro.prestataire_id)
        .eq("semaine_debut", semaineISO)
        .eq("type", type);
    } else {
      await supabase.from("astreinte").upsert(
        {
          prestataire_id: pro.prestataire_id,
          semaine_debut: semaineISO,
          type,
          professionnel_id: proId,
        },
        { onConflict: "prestataire_id,semaine_debut,type" }
      );
    }
  }

  // ── Calcul des barres du calendrier pour le mois affiché ──────────
  const annee = mois.getFullYear();
  const moisIdx = mois.getMonth();
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate();
  const moisDebut = new Date(annee, moisIdx, 1);
  const moisFin = new Date(annee, moisIdx, nbJours);

  const lignes = useMemo(() => {
    // Regroupe par soignant les absences qui chevauchent le mois affiché.
    const parPersonne = new Map<
      string,
      { nom: string; couleur: string; barres: { start: number; end: number; abs: AbsenceLigne }[] }
    >();
    absences.forEach((a) => {
      const d1 = parseISO(a.date_debut);
      const d2 = parseISO(a.date_fin);
      if (d2 < moisDebut || d1 > moisFin) return; // hors mois
      const start = d1 < moisDebut ? 1 : d1.getDate();
      const end = d2 > moisFin ? nbJours : d2.getDate();
      const entry = parPersonne.get(a.professionnel_id) ?? {
        nom: a.professionnel?.nom ?? "Soignant",
        couleur: couleurPour(a.professionnel_id),
        barres: [],
      };
      entry.barres.push({ start, end, abs: a });
      parPersonne.set(a.professionnel_id, entry);
    });
    return [...parPersonne.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  }, [absences, annee, moisIdx, nbJours]);

  const jours = Array.from({ length: nbJours }, (_, i) => i + 1);
  const today = new Date();
  const jourAujourdhui =
    today.getFullYear() === annee && today.getMonth() === moisIdx ? today.getDate() : null;
  const largeurMin = 110 + nbJours * 26;

  const autresPros = equipe.filter((p) => p.id !== pro?.id);
  const aVenirEtEnCours = absences.filter((a) => statutPeriode(a.date_debut, a.date_fin) !== "passe");

  function changerMois(delta: number) {
    setMois(new Date(annee, moisIdx + delta, 1));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ── Colonne principale ── */}
      <div className="grid min-w-0 gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Organisation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Calendrier des congés de l&apos;équipe. Une couleur par soignant.
          </p>
        </div>

        {ready && astreintesIncompletes(new Set(astreintes.keys())) && (
          <p className="rounded-xl bg-rose-800 px-4 py-3 text-sm font-medium text-white">
            ⚠️ Astreintes non renseignées pour les 15 prochains jours. Merci de désigner les soignants d&apos;astreinte ci-dessous.
          </p>
        )}

        {/* ── Calendrier mensuel ── */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => changerMois(-1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-brand">
              ←
            </button>
            <h2 className="text-sm font-semibold capitalize text-slate-700">
              {mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </h2>
            <button onClick={() => changerMois(1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-brand">
              →
            </button>
          </div>

          {!ready ? (
            <div className="h-40 animate-pulse rounded-xl bg-rose-50" />
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: largeurMin }}>
                {/* En-tête : numéros des jours */}
                <div className="flex items-end">
                  <div className="w-[110px] shrink-0" />
                  <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${nbJours}, minmax(0,1fr))` }}>
                    {jours.map((j) => (
                      <div
                        key={j}
                        className={`py-1 text-center text-[10px] ${j === jourAujourdhui ? "font-bold text-brand" : "text-slate-400"}`}
                      >
                        {j}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lignes par soignant */}
                {lignes.length === 0 ? (
                  <p className="border-t border-rose-50 py-8 text-center text-sm text-slate-400">
                    Aucun congé ce mois-ci.
                  </p>
                ) : (
                  lignes.map((l) => (
                    <div key={l.nom} className="flex items-center border-t border-rose-50">
                      <div className="flex w-[110px] shrink-0 items-center gap-1.5 pr-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.couleur}`} />
                        <span className="truncate text-xs font-medium text-slate-600">{l.nom}</span>
                      </div>
                      <div
                        className="relative grid flex-1 py-1.5"
                        style={{ gridTemplateColumns: `repeat(${nbJours}, minmax(0,1fr))` }}
                      >
                        {/* repère "aujourd'hui" */}
                        {jourAujourdhui && (
                          <div
                            className="pointer-events-none row-start-1 self-stretch border-l-2 border-brand/30"
                            style={{ gridColumn: `${jourAujourdhui} / ${jourAujourdhui + 1}` }}
                          />
                        )}
                        {l.barres.map((b, i) => (
                          <div
                            key={i}
                            style={{ gridColumn: `${b.start} / ${b.end + 1}` }}
                            title={`${formatDate(b.abs.date_debut)} → ${formatDate(b.abs.date_fin)}${b.abs.motif ? ` · ${b.abs.motif}` : ""}`}
                            className={`h-5 rounded-full ${l.couleur} opacity-90`}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Astreintes ── */}
        <section className="card grid gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Astreintes</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Désignez l&apos;astreinte semaine (lun–ven) et week-end (sam–dim), au moins 15 jours à l&apos;avance.
            </p>
          </div>
          {!ready ? (
            <div className="h-32 animate-pulse rounded-xl bg-rose-50" />
          ) : (
            <div className="grid gap-3">
              {semainesAVenir(6).map((lundi) => {
                const k = isoDate(lundi);
                const dimanche = new Date(lundi);
                dimanche.setDate(dimanche.getDate() + 6);
                const label = `${lundi.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${dimanche.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}`;
                const semaineVide = !astreintes.has(`${k}|semaine`);
                const weekendVide = !astreintes.has(`${k}|weekend`);
                return (
                  <div key={k} className="grid gap-2 border-t border-rose-50 pt-3 sm:grid-cols-[120px_1fr_1fr] sm:items-center">
                    <span className="text-sm font-medium text-slate-600">Sem. {label}</span>
                    <label className="grid gap-1">
                      <span className="text-[11px] text-slate-400">Semaine (lun–ven)</span>
                      <select
                        className={`input ${semaineVide ? "border-rose-300" : ""}`}
                        value={astreintes.get(`${k}|semaine`) ?? ""}
                        onChange={(e) => definirAstreinte(k, "semaine", e.target.value)}
                      >
                        <option value="">— À désigner —</option>
                        {equipe.map((p) => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] text-slate-400">Week-end (sam–dim)</span>
                      <select
                        className={`input ${weekendVide ? "border-rose-300" : ""}`}
                        value={astreintes.get(`${k}|weekend`) ?? ""}
                        onChange={(e) => definirAstreinte(k, "weekend", e.target.value)}
                      >
                        <option value="">— À désigner —</option>
                        {equipe.map((p) => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Liste détaillée ── */}
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-slate-600">Absences à venir & en cours</h2>
          {!ready ? (
            <div className="h-20 animate-pulse rounded-2xl bg-white" />
          ) : aVenirEtEnCours.length === 0 ? (
            <p className="card p-4 text-sm text-slate-400">Aucune absence prévue. 🌿</p>
          ) : (
            aVenirEtEnCours.map((a) => {
              const periode = statutPeriode(a.date_debut, a.date_fin);
              const estMienne = a.professionnel_id === pro?.id;
              return (
                <div key={a.id} className={`card border-l-4 ${periode === "en_cours" ? "border-l-attention" : "border-l-rose-300"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${couleurPour(a.professionnel_id)}`} />
                        <span className="font-semibold text-slate-800">{a.professionnel?.nom ?? "Soignant"}</span>
                        {periode === "en_cours" ? (
                          <span className="badge bg-amber-100 text-attention">En congé</span>
                        ) : (
                          <span className="badge bg-rose-50 text-rose-400">À venir</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">Du {formatDate(a.date_debut)} au {formatDate(a.date_fin)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Remplacé(e) par :{" "}
                        {a.remplacant ? (
                          <span className="font-medium text-brand">{a.remplacant.nom}</span>
                        ) : (
                          <span className="text-slate-400">non précisé</span>
                        )}
                      </p>
                      {a.motif && <p className="mt-0.5 text-xs text-slate-400">« {a.motif} »</p>}
                    </div>
                    {estMienne && (
                      <button onClick={() => supprimer(a.id)} className="text-xs font-medium text-slate-400 hover:text-critique">
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* ── Formulaire ── */}
      <aside>
        <form onSubmit={declarer} className="card grid gap-4">
          <h2 className="text-sm font-semibold text-slate-700">Déclarer une absence</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Du *</label>
              <input type="date" className="input" value={debut} onChange={(e) => setDebut(e.target.value)} required />
            </div>
            <div>
              <label className="label">Au *</label>
              <input type="date" className="input" value={fin} onChange={(e) => setFin(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Remplacé(e) par</label>
            <select className="input" value={remplacant} onChange={(e) => setRemplacant(e.target.value)}>
              <option value="">— Choisir un soignant —</option>
              {autresPros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} ({LIBELLE_ROLE[p.role]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Motif (optionnel)</label>
            <input className="input" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Congés, astreinte…" />
          </div>
          {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{erreur}</p>}
          <button className="btn-primary py-2.5" disabled={busy || !pro}>
            {busy ? "Enregistrement…" : "Déclarer l'absence"}
          </button>
        </form>
      </aside>
    </div>
  );
}
