"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type Patient = {
  id: string;
  nom: string;
  date_operation: string | null;
  duree_prise_en_charge: number | null;
  chirurgien: string | null;
  agence_id: string | null;
  statut: string;
};
type Coord = { id: string; nom: string; prenom: string | null; titre: string | null; agence_id: string | null };
type Liaison = { patient_id: string; professionnel_id: string };

const nomComplet = (p: { titre?: string | null; prenom?: string | null; nom: string }) =>
  [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");

function jour(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addJours(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PecPage() {
  const pro = useProSession();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [liaisons, setLiaisons] = useState<Liaison[]>([]);
  const [agenceNom, setAgenceNom] = useState<Map<string, string>>(new Map());
  const [pret, setPret] = useState(false);
  const [detail, setDetail] = useState<{ titre: string; patients: Patient[] } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("patient").select("id,nom,date_operation,duree_prise_en_charge,chirurgien,agence_id,statut"),
      supabase.from("professionnel").select("id,nom,prenom,titre,agence_id").eq("role", "coordinatrice"),
      supabase.from("patient_soignant").select("patient_id,professionnel_id"),
      supabase.from("agence").select("id,nom"),
    ]).then(([{ data: pts }, { data: cs }, { data: ls }, { data: ags }]) => {
      setPatients((pts ?? []) as Patient[]);
      setCoords((cs ?? []) as Coord[]);
      setLiaisons((ls ?? []) as Liaison[]);
      setAgenceNom(new Map((ags ?? []).map((a) => [a.id as string, a.nom as string])));
      setPret(true);
    });
  }, []);

  const stats = useMemo(() => {
    const today = jour(new Date());
    const lundi = addJours(today, -((today.getDay() + 6) % 7));
    const moisDebut = new Date(today.getFullYear(), today.getMonth(), 1);
    const anneeDebut = new Date(today.getFullYear(), 0, 1);

    const avecDate = patients.filter((p) => p.date_operation);
    const dOp = (p: Patient) => jour(new Date(p.date_operation!));
    const finPec = (p: Patient) => addJours(dOp(p), p.duree_prise_en_charge ?? 0);
    const periode = (debut: Date) => avecDate.filter((p) => dOp(p) >= debut && dOp(p) <= today);

    const enCours = avecDate.filter((p) => p.statut !== "terminee" && dOp(p) <= today && finPec(p) >= today);
    const aVenir = avecDate.filter((p) => dOp(p) > today).sort((a, b) => dOp(a).getTime() - dOp(b).getTime());

    const grouper = (cle: (p: Patient) => string) => {
      const m = new Map<string, Patient[]>();
      patients.forEach((p) => { const k = cle(p); (m.get(k) ?? m.set(k, []).get(k)!).push(p); });
      return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    };

    const parMedecin = grouper((p) => p.chirurgien?.trim() || "Non renseigné");
    const parAgence = grouper((p) => (p.agence_id ? (agenceNom.get(p.agence_id) ?? "Agence ?") : "Non rattaché"));

    const patientsParId = new Map(patients.map((p) => [p.id, p]));
    const parCoord = coords.map((c) => {
      const ids = liaisons.filter((l) => l.professionnel_id === c.id).map((l) => l.patient_id);
      const pts = ids.map((id) => patientsParId.get(id)).filter((p): p is Patient => !!p);
      return { c, pts };
    }).sort((a, b) => b.pts.length - a.pts.length);

    return {
      total: patients,
      enCours,
      aVenir,
      semaine: periode(lundi),
      mois: periode(moisDebut),
      annee: periode(anneeDebut),
      parMedecin,
      parAgence,
      parCoord,
    };
  }, [patients, coords, liaisons, agenceNom]);

  if (pro && pro.niveau > 1) {
    return <div className="card text-sm text-slate-500">La page PEC est réservée aux managers (niveau 1) et à l&apos;administration (niveau 0).</div>;
  }
  if (!pret) return <p className="text-sm text-slate-400">Chargement…</p>;

  const ouvrir = (titre: string, pts: Patient[]) => setDetail({ titre, patients: pts });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold text-slate-800">Prises en charge (PEC)</h1>

      {/* Chiffres clés — cliquables */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={stats.total.length} onClick={() => ouvrir("Toutes les PEC", stats.total)} />
        <Stat label="En cours" value={stats.enCours.length} accent onClick={() => ouvrir("PEC en cours", stats.enCours)} />
        <Stat label="À venir" value={stats.aVenir.length} onClick={() => ouvrir("PEC à venir", stats.aVenir)} />
        <Stat label="Cette semaine" value={stats.semaine.length} onClick={() => ouvrir("PEC cette semaine", stats.semaine)} />
        <Stat label="Ce mois" value={stats.mois.length} onClick={() => ouvrir("PEC ce mois", stats.mois)} />
        <Stat label="Cette année" value={stats.annee.length} onClick={() => ouvrir("PEC cette année", stats.annee)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloc titre="PEC par agence" lignes={stats.parAgence} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} />
        <Bloc titre="PEC par médecin" lignes={stats.parMedecin} onLigne={(nom, pts) => ouvrir(`PEC — ${nom}`, pts)} />
      </div>

      <section className="card grid gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Patients gérés par coordinatrice</h2>
        {stats.parCoord.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune coordinatrice.</p>
        ) : (
          <div className="grid gap-1.5">
            {stats.parCoord.map(({ c, pts }) => (
              <button
                key={c.id}
                onClick={() => ouvrir(`Patients de ${nomComplet(c)}`, pts)}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-rose-50"
              >
                <span className="text-slate-700">
                  {nomComplet(c)}
                  {c.agence_id && <span className="text-slate-400"> · {agenceNom.get(c.agence_id)}</span>}
                </span>
                <span className="badge bg-rose-100 text-brand">{pts.length} patient(s)</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setDetail(null)}>
          <div className="card grid max-h-[80vh] w-full max-w-lg gap-3 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{detail.titre} · {detail.patients.length}</h2>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-critique">✕</button>
            </div>
            {detail.patients.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun patient.</p>
            ) : (
              <div className="grid gap-1.5">
                {[...detail.patients].sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => (
                  <Link
                    key={p.id}
                    href={`/pro/patients/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 px-3 py-2 text-sm transition hover:border-rose-200 hover:bg-rose-50"
                  >
                    <span className="font-medium text-slate-700">{p.nom}</span>
                    <span className="text-right text-xs text-slate-500">
                      {p.chirurgien ? `${p.chirurgien} · ` : ""}{fmtDate(p.date_operation)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 text-left transition hover:border-rose-200 hover:shadow-md">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : "text-slate-800"}`}>{value}</p>
    </button>
  );
}

function Bloc({ titre, lignes, onLigne }: { titre: string; lignes: [string, Patient[]][]; onLigne: (nom: string, pts: Patient[]) => void }) {
  return (
    <section className="card grid gap-3">
      <h2 className="text-sm font-semibold text-slate-700">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune donnée.</p>
      ) : (
        <div className="grid gap-1.5">
          {lignes.map(([nom, pts]) => (
            <button
              key={nom}
              onClick={() => onLigne(nom, pts)}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-rose-50"
            >
              <span className="text-slate-700">{nom}</span>
              <span className="badge bg-rose-100 text-brand">{pts.length}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
