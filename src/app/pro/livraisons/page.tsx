"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { DateField } from "@/components/DateField";
import { CarteLivraisons, type PointLivraison } from "@/components/CarteLivraisons";
import { geocodeAdresse, type LatLng } from "@/lib/geocode";
import type { Livraison } from "@/lib/types";

type PatientLite = {
  id: string;
  nom: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  statut: string;
};

type Item = { patient: PatientLite; livraison: Livraison | null };

// "YYYY-MM-DD" local du jour
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
// URL Google Maps itinéraire (origine = position de l'appareil) avec étapes ordonnées.
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

export default function LivraisonsPage() {
  const pro = useProSession();
  const [items, setItems] = useState<Item[]>([]);
  const [pret, setPret] = useState(false);
  const [jour, setJour] = useState(todayIso());
  const [coords, setCoords] = useState<Record<string, LatLng | null>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const estLivreur = pro?.role === "livreur";

  // Chargement : patients rattachés (RLS) + livraisons du livreur.
  useEffect(() => {
    if (!pro?.id || !estLivreur) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("patient").select("id,nom,adresse,code_postal,ville,telephone,statut").neq("statut", "terminee").order("nom"),
      supabase.from("livraison").select("*").eq("livreur_id", pro.id),
    ]).then(([{ data: pts }, { data: livs }]) => {
      const parPatient = new Map((livs ?? []).map((l) => [l.patient_id as string, l as Livraison]));
      setItems((pts ?? []).map((p) => ({ patient: p as PatientLite, livraison: parPatient.get((p as PatientLite).id) ?? null })));
      setPret(true);
    });
  }, [pro?.id, estLivreur]);

  const statutDe = (it: Item) => it.livraison?.statut ?? "a_planifier";
  const aPlanifier = items.filter((it) => statutDe(it) === "a_planifier");
  const planifiees = items.filter((it) => statutDe(it) === "planifiee");
  const livrees = items.filter((it) => statutDe(it) === "livree");

  // Étapes du jour sélectionné (planifiées, non livrées) — pour la carte.
  const etapesJour = useMemo(
    () => planifiees.filter((it) => it.livraison?.date_prevue === jour),
    [planifiees, jour]
  );

  // Géocodage des adresses du jour (mises en cache).
  useEffect(() => {
    const aGeocoder = etapesJour.filter((it) => coords[it.patient.id] === undefined);
    if (aGeocoder.length === 0) return;
    let annule = false;
    (async () => {
      for (const it of aGeocoder) {
        const r = await geocodeAdresse(adresseComplete(it.patient));
        if (annule) return;
        setCoords((c) => ({ ...c, [it.patient.id]: r }));
      }
    })();
    return () => { annule = true; };
  }, [etapesJour, coords]);

  const points: PointLivraison[] = etapesJour
    .map((it, i): PointLivraison | null => {
      const c = coords[it.patient.id];
      return c ? { id: it.patient.id, nom: it.patient.nom, adresse: adresseComplete(it.patient), lat: c.lat, lon: c.lon, ordre: i + 1 } : null;
    })
    .filter((p): p is PointLivraison => p !== null);

  const urlMaps = lienGoogleMaps(points);

  async function maj(patientId: string, patch: Partial<Livraison>) {
    if (!pro?.id || !pro.prestataire_id) return;
    setBusy(patientId);
    const supabase = createClient();
    const row = {
      patient_id: patientId,
      livreur_id: pro.id,
      prestataire_id: pro.prestataire_id,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("livraison")
      .upsert(row, { onConflict: "patient_id,livreur_id" })
      .select()
      .single();
    setBusy(null);
    if (error) { alert("Échec : " + error.message); return; }
    setItems((arr) => arr.map((it) => (it.patient.id === patientId ? { ...it, livraison: data as Livraison } : it)));
  }

  if (pro && !estLivreur) {
    return <div className="card text-sm text-slate-500">La tournée de livraison est réservée aux comptes livreur.</div>;
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ma tournée</h1>
        <p className="mt-1 text-sm text-slate-500">
          Planifiez vos livraisons pour vos patients rattachés et organisez votre itinéraire.
        </p>
      </div>

      {/* ── Carte de la tournée du jour ── */}
      <section className="card grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="label">Jour de tournée</label>
            <div className="w-48"><DateField value={jour} onChange={setJour} /></div>
          </div>
          {urlMaps && (
            <a href={urlMaps} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex items-center gap-2">
              🧭 Itinéraire Google Maps
            </a>
          )}
        </div>

        <CarteLivraisons points={points} />

        {etapesJour.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune livraison planifiée le {formatDate(jour)}.</p>
        ) : (
          <ol className="grid gap-2">
            {etapesJour.map((it, i) => {
              const c = coords[it.patient.id];
              return (
                <li key={it.patient.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-700">{it.patient.nom}</p>
                      <p className="truncate text-xs text-slate-400">
                        {adresseComplete(it.patient) || "Adresse non renseignée"}
                        {c === null && " · introuvable sur la carte"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {it.patient.telephone && (
                      <a href={`tel:${it.patient.telephone}`} className="rounded-lg border border-rose-200 px-2 py-1.5 text-sm text-brand hover:bg-rose-50">Appeler</a>
                    )}
                    <button onClick={() => maj(it.patient.id, { statut: "livree" })} disabled={busy === it.patient.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
                      {busy === it.patient.id ? "…" : "Livrée"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ── À planifier ── */}
      <section className="grid gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">À planifier ({aPlanifier.length})</h2>
        {!pret ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : aPlanifier.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune livraison à planifier.</p>
        ) : (
          aPlanifier.map((it) => (
            <div key={it.patient.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-700">{it.patient.nom}</p>
                <p className="text-xs text-slate-400">{adresseComplete(it.patient) || "Adresse non renseignée"}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-40"><DateField value={it.livraison?.date_prevue ?? ""} onChange={(v) => v && maj(it.patient.id, { date_prevue: v, statut: "planifiee" })} placeholder="Date de livraison" /></div>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Planifiées (toutes dates) ── */}
      {planifiees.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Planifiées ({planifiees.length})</h2>
          {[...planifiees]
            .sort((a, b) => (a.livraison?.date_prevue ?? "").localeCompare(b.livraison?.date_prevue ?? ""))
            .map((it) => (
              <div key={it.patient.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{it.patient.nom}</p>
                  <p className="text-xs text-slate-400">{adresseComplete(it.patient) || "Adresse non renseignée"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-rose-100 text-brand">{formatDate(it.livraison?.date_prevue ?? null) || "Sans date"}</span>
                  <div className="w-36"><DateField value={it.livraison?.date_prevue ?? ""} onChange={(v) => v && maj(it.patient.id, { date_prevue: v, statut: "planifiee" })} placeholder="Replanifier" /></div>
                  <button onClick={() => maj(it.patient.id, { statut: "livree" })} disabled={busy === it.patient.id} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">Livrée</button>
                </div>
              </div>
            ))}
        </section>
      )}

      {/* ── Livrées ── */}
      {livrees.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Livrées ({livrees.length})</h2>
          {livrees.map((it) => (
            <div key={it.patient.id} className="card flex flex-wrap items-center justify-between gap-3 opacity-75">
              <div className="min-w-0">
                <p className="font-semibold text-slate-700">{it.patient.nom}</p>
                <p className="text-xs text-slate-400">{adresseComplete(it.patient) || "Adresse non renseignée"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge bg-green-100 text-ok">Livrée ✓</span>
                <button onClick={() => maj(it.patient.id, { statut: "planifiee" })} disabled={busy === it.patient.id} className="text-sm font-medium text-brand hover:underline">Annuler</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
