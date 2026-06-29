"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { estCoordOuManager } from "@/lib/roles";
import { DateField } from "@/components/DateField";
import { CarteLivraisons, type PointLivraison } from "@/components/CarteLivraisons";
import { geocodeAdresse, type LatLng } from "@/lib/geocode";

type PatientLite = {
  id: string;
  nom: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  agence_id: string | null;
  telephone: string | null;
  date_naissance: string | null;
  email: string | null;
  proche_nom: string | null;
  proche_tel: string | null;
  operation: string | null;
  date_operation: string | null;
  chirurgien: string | null;
  traitement: string | null;
  pharmacie: string | null;
  pharmacie_tel: string | null;
  infirmiere_nom: string | null;
  infirmiere_tel: string | null;
  duree_prise_en_charge: number | null;
};
type Liv = {
  id: string;
  patient_id: string;
  livreur_id: string | null;
  statut: "a_programmer" | "a_planifier" | "planifiee" | "livree";
  date_prevue: string | null;
  patient: PatientLite | PatientLite[] | null;
};

const patientDe = (l: Liv): PatientLite | null => (Array.isArray(l.patient) ? l.patient[0] : l.patient) ?? null;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}
function adresseComplete(p: PatientLite): string {
  return [p.adresse, [p.code_postal, p.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
function lienGoogleMaps(pts: PointLivraison[]): string | null {
  if (!pts.length) return null;
  const coords = pts.map((p) => `${p.lat},${p.lon}`);
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("travelmode", "driving");
  u.searchParams.set("destination", coords[coords.length - 1]);
  const wp = coords.slice(0, -1).join("|");
  if (wp) u.searchParams.set("waypoints", wp);
  return u.toString();
}

const PATIENT_COLS =
  "id,nom,adresse,code_postal,ville,agence_id,telephone,date_naissance,email,proche_nom,proche_tel,operation,date_operation,chirurgien,traitement,pharmacie,pharmacie_tel,infirmiere_nom,infirmiere_tel,duree_prise_en_charge";

export default function LivraisonsPage() {
  const pro = useProSession();
  const router = useRouter();
  const [livs, setLivs] = useState<Liv[]>([]);
  const [pret, setPret] = useState(false);
  const [jour, setJour] = useState(todayIso());
  const [coords, setCoords] = useState<Record<string, LatLng | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const toggleDetails = (id: string) =>
    setOuverts((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const estLivreur = pro?.role === "livreur";
  const estCoord = estCoordOuManager(pro?.role);
  // Livreurs ET coordinatrices/managers peuvent effectuer des livraisons.
  const peutLivrer = estLivreur || estCoord;

  const charger = useCallback(async () => {
    if (!pro?.id || !peutLivrer) return;
    const { data } = await createClient()
      .from("livraison")
      .select(`id,patient_id,livreur_id,statut,date_prevue,patient:patient_id(${PATIENT_COLS})`)
      .order("date_prevue", { ascending: true });
    setLivs((data ?? []) as unknown as Liv[]);
    setPret(true);
  }, [pro?.id, peutLivrer]);
  useEffect(() => { charger(); }, [charger]);

  // Pool : livraisons à programmer non prises. Cloisonné à l'agence du compte
  // (coordinatrice/livreur niveau 2) ; un manager (sans agence) voit son périmètre.
  const dansMonAgence = (l: Liv) => !pro?.agence_id || patientDe(l)?.agence_id === pro.agence_id;
  const pool = livs.filter((l) => l.statut === "a_programmer" && !l.livreur_id && dansMonAgence(l));
  const miennes = livs.filter((l) => l.livreur_id === pro?.id && l.statut !== "a_programmer");
  const planifiees = miennes.filter((l) => l.statut === "planifiee" || l.statut === "a_planifier");
  const livrees = miennes.filter((l) => l.statut === "livree");

  // Étapes du jour (mes livraisons planifiées datées ce jour) — pour la carte.
  const etapesJour = useMemo(
    () => planifiees.filter((l) => l.date_prevue === jour),
    [planifiees, jour]
  );

  useEffect(() => {
    const aGeocoder = etapesJour.filter((l) => { const p = patientDe(l); return p && coords[p.id] === undefined; });
    if (aGeocoder.length === 0) return;
    let annule = false;
    (async () => {
      for (const l of aGeocoder) {
        const p = patientDe(l);
        if (!p) continue;
        const r = await geocodeAdresse(adresseComplete(p));
        if (annule) return;
        setCoords((c) => ({ ...c, [p.id]: r }));
      }
    })();
    return () => { annule = true; };
  }, [etapesJour, coords]);

  const points: PointLivraison[] = etapesJour
    .map((l, i): PointLivraison | null => {
      const p = patientDe(l);
      const c = p ? coords[p.id] : undefined;
      return p && c ? { id: p.id, nom: p.nom, adresse: adresseComplete(p), lat: c.lat, lon: c.lon, ordre: i + 1 } : null;
    })
    .filter((p): p is PointLivraison => p !== null);
  const urlMaps = lienGoogleMaps(points);

  async function maj(id: string, patch: Partial<Liv>) {
    setBusy(id);
    const { error } = await createClient()
      .from("livraison")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }
  // Prendre en charge une livraison du pool.
  const prendre = (id: string) => maj(id, { livreur_id: pro?.id ?? null, statut: "planifiee" });

  // Coordinatrice : valide la livraison PUIS ouvre un suivi à remplir en direct.
  async function livrerEtSuivre(l: Liv) {
    setBusy(l.id);
    const { error } = await createClient()
      .from("livraison")
      .update({ statut: "livree", updated_at: new Date().toISOString() })
      .eq("id", l.id);
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    router.push(`/pro/patients/${l.patient_id}?suivi=1`);
  }

  // Boutons de clôture : « Livré » + « Livré + suivi » pour la coordinatrice,
  // « Livrée » seul pour le livreur.
  const boutonsFin = (l: Liv) =>
    estCoord ? (
      <>
        <button onClick={() => maj(l.id, { statut: "livree" })} disabled={busy === l.id} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Livré</button>
        <button onClick={() => livrerEtSuivre(l)} disabled={busy === l.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">{busy === l.id ? "…" : "Livré + suivi"}</button>
      </>
    ) : (
      <button onClick={() => maj(l.id, { statut: "livree" })} disabled={busy === l.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">{busy === l.id ? "…" : "Livrée"}</button>
    );

  if (pro && !peutLivrer) {
    return <div className="card text-sm text-slate-500">La tournée de livraison est réservée aux livreurs et aux coordinatrices.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ma tournée</h1>
        <p className="mt-1 text-sm text-slate-500">
          Prenez en charge les livraisons à programmer de votre agence, planifiez-les et organisez votre itinéraire.
        </p>
      </div>

      {/* ── Carte de la tournée du jour ── */}
      <section className="card grid grid-cols-1 gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="w-full sm:w-auto">
            <label className="label">Jour de tournée</label>
            <div className="w-full sm:w-48"><DateField value={jour} onChange={setJour} /></div>
          </div>
          {urlMaps && (
            <a href={urlMaps} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto">🧭 Itinéraire Google Maps</a>
          )}
        </div>

        <CarteLivraisons points={points} />

        {etapesJour.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune livraison planifiée le {formatDate(jour)}.</p>
        ) : (
          <ol className="grid grid-cols-1 gap-2">
            {etapesJour.map((l, i) => {
              const p = patientDe(l); if (!p) return null;
              const c = coords[p.id];
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-700">{p.nom}</p>
                      <p className="truncate text-xs text-slate-400">{adresseComplete(p) || "Adresse non renseignée"}{c === null && " · introuvable sur la carte"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {p.telephone && <a href={`tel:${p.telephone}`} className="rounded-lg border border-rose-200 px-2 py-1.5 text-sm text-brand hover:bg-rose-50">Appeler</a>}
                    {boutonsFin(l)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ── À programmer (pool de l'agence) ── */}
      <section className="grid grid-cols-1 gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">À programmer ({pool.length})</h2>
        {!pret ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : pool.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune livraison à programmer.</p>
        ) : (
          pool.map((l) => {
            const p = patientDe(l); if (!p) return null;
            return (
              <div key={l.id} className="card grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-700">{p.nom}</p>
                    <p className="break-words text-xs text-slate-400">{adresseComplete(p) || "Adresse non renseignée"}</p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <button onClick={() => prendre(l.id)} disabled={busy === l.id} className="btn-primary flex-1 px-3 py-1.5 text-sm disabled:opacity-50 sm:flex-none">{busy === l.id ? "…" : "J'effectue cette livraison"}</button>
                    <button onClick={() => toggleDetails(p.id)} className="btn-secondary px-3 py-1.5 text-sm">{ouverts.has(p.id) ? "Masquer" : "Détails"}</button>
                  </div>
                </div>
                {ouverts.has(p.id) && <DetailsPatient p={p} />}
              </div>
            );
          })
        )}
      </section>

      {/* ── Mes livraisons (prises en charge) ── */}
      {planifiees.length > 0 && (
        <section className="grid grid-cols-1 gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Mes livraisons ({planifiees.length})</h2>
          {[...planifiees]
            .sort((a, b) => (a.date_prevue ?? "").localeCompare(b.date_prevue ?? ""))
            .map((l) => {
              const p = patientDe(l); if (!p) return null;
              return (
                <div key={l.id} className="card grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-700">{p.nom}</p>
                      <p className="break-words text-xs text-slate-400">{adresseComplete(p) || "Adresse non renseignée"}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                      <span className="badge w-fit bg-rose-100 text-brand">{formatDate(l.date_prevue) || "Sans date"}</span>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <div className="w-full sm:w-36"><DateField value={l.date_prevue ?? ""} onChange={(v) => v && maj(l.id, { date_prevue: v, statut: "planifiee" })} placeholder="Date" /></div>
                        {boutonsFin(l)}
                        <button onClick={() => toggleDetails(p.id)} className="btn-secondary flex-1 px-3 py-1.5 text-sm sm:flex-none">{ouverts.has(p.id) ? "Masquer" : "Détails"}</button>
                      </div>
                    </div>
                  </div>
                  {ouverts.has(p.id) && <DetailsPatient p={p} />}
                </div>
              );
            })}
        </section>
      )}

      {/* ── Livrées ── */}
      {livrees.length > 0 && (
        <section className="grid grid-cols-1 gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Livrées ({livrees.length})</h2>
          {livrees.map((l) => {
            const p = patientDe(l); if (!p) return null;
            return (
              <div key={l.id} className="card flex flex-col gap-3 opacity-75 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-700">{p.nom}</p>
                  <p className="break-words text-xs text-slate-400">{adresseComplete(p) || "Adresse non renseignée"}{l.date_prevue ? ` · ${formatDate(l.date_prevue)}` : ""}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="badge bg-green-100 text-ok">Livrée ✓</span>
                  <button onClick={() => maj(l.id, { statut: "planifiee" })} disabled={busy === l.id} className="text-sm font-medium text-brand hover:underline">Annuler</button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">{titre}</p>
      <div className="grid grid-cols-1 gap-1.5">{children}</div>
    </div>
  );
}
function Ligne({ label, value, extra, href }: { label: string; value: string | null; extra?: string | null; href?: string }) {
  if (!value && !extra) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-slate-700">
        {href ? <a href={href} className="text-brand hover:underline">{value || extra}</a> : value}
        {extra && value && <span className="text-slate-400"> · {extra}</span>}
      </span>
    </div>
  );
}
// Coordonnées patient + environnement de soins (accès livreur).
function DetailsPatient({ p }: { p: PatientLite }) {
  const ville = [p.code_postal, p.ville].filter(Boolean).join(" ");
  const duree = p.duree_prise_en_charge ? `${p.duree_prise_en_charge} jours` : "";
  return (
    <div className="grid grid-cols-1 gap-5 rounded-xl border border-rose-100 bg-rose-50/30 p-3 sm:grid-cols-2">
      <Bloc titre="Coordonnées">
        <Ligne label="Naissance" value={formatDate(p.date_naissance)} />
        <Ligne label="Téléphone" value={p.telephone} href={p.telephone ? `tel:${p.telephone}` : undefined} />
        <Ligne label="Email" value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
        <Ligne label="Adresse" value={p.adresse} />
        <Ligne label="Ville" value={ville} />
        <Ligne label="Proche" value={p.proche_nom} extra={p.proche_tel} href={p.proche_tel ? `tel:${p.proche_tel}` : undefined} />
      </Bloc>
      <Bloc titre="Environnement de soins">
        {p.operation && <Ligne label="Opération" value={p.operation} extra={formatDate(p.date_operation)} />}
        <Ligne label="Prise en charge" value={duree} />
        <Ligne label="Type de traitement" value={p.traitement} />
        <Ligne label={p.operation ? "Chirurgien" : "Médecin"} value={p.chirurgien} />
        <Ligne label="Pharmacie" value={p.pharmacie} extra={p.pharmacie_tel} href={p.pharmacie_tel ? `tel:${p.pharmacie_tel}` : undefined} />
        <Ligne label="Infirmière libérale" value={p.infirmiere_nom} extra={p.infirmiere_tel} href={p.infirmiere_tel ? `tel:${p.infirmiere_tel}` : undefined} />
      </Bloc>
    </div>
  );
}
