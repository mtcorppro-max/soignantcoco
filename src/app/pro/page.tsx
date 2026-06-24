"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { useData } from "@/lib/hooks/useData";
import { AstreinteAlerte } from "@/components/AstreinteAlerte";
import type { Patient } from "@/lib/types";

type AlerteInfo = { active: number; acquittees: number };
type DashData = {
  patients: Patient[];
  parPatient: Map<string, AlerteInfo>;
  totalActives: number;
  messages: Map<string, number>; // patient_id -> nb de messages patient en attente de réponse
};

async function fetchDashboard(): Promise<DashData> {
  const supabase = createClient();
  const [{ data: pts }, { data: als }, { data: msgs }] = await Promise.all([
    supabase.from("patient").select("id,nom,statut,code_postal,prestataire_id,user_id").order("nom"),
    supabase.from("alerte").select("id,patient_id,statut").in("statut", ["declenchee", "escaladee", "acquittee"]),
    supabase.from("message").select("patient_id,auteur_user_id,horodatage").order("horodatage", { ascending: true }).limit(2000),
  ]);
  const parPatient = new Map<string, AlerteInfo>();
  (als ?? []).forEach((a) => {
    const e = parPatient.get(a.patient_id) ?? { active: 0, acquittees: 0 };
    if (a.statut === "declenchee" || a.statut === "escaladee") e.active += 1;
    if (a.statut === "acquittee") e.acquittees += 1;
    parPatient.set(a.patient_id, e);
  });

  const patientsRaw = (pts ?? []) as Patient[];

  // Messages en attente : nb de messages consécutifs envoyés par le patient
  // après la dernière réponse d'un soignant.
  const msgsParPatient = new Map<string, string[]>();
  (msgs ?? []).forEach((m) => {
    const arr = msgsParPatient.get(m.patient_id) ?? [];
    arr.push(m.auteur_user_id);
    msgsParPatient.set(m.patient_id, arr);
  });
  const messages = new Map<string, number>();
  patientsRaw.forEach((p) => {
    const arr = msgsParPatient.get(p.id);
    if (!arr || !p.user_id) return;
    let c = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === p.user_id) c++;
      else break;
    }
    if (c > 0) messages.set(p.id, c);
  });

  const score = (p: Patient) =>
    (parPatient.get(p.id)?.active ?? 0) * 100 +
    (messages.get(p.id) ?? 0) * 10 +
    (parPatient.get(p.id)?.acquittees ?? 0);
  const patients = [...patientsRaw].sort((a, b) => score(b) - score(a));
  const totalActives = [...parPatient.values()].reduce((s, e) => s + e.active, 0);
  return { patients, parPatient, totalActives, messages };
}

export default function Dashboard() {
  useProSession();
  const router = useRouter();
  const data = useData<DashData>("pro:dashboard", fetchDashboard);

  const { patients, parPatient, totalActives, messages } = useMemo(() => (
    data ?? { patients: [], parPatient: new Map(), totalActives: 0, messages: new Map() }
  ), [data]);

  return (
    <div className="grid gap-5">
      <AstreinteAlerte />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Tableau de bord</h1>
        {!data ? (
          <div className="h-6 w-32 animate-pulse rounded-full bg-rose-100" />
        ) : totalActives > 0 ? (
          <Link href="/pro/alertes" className="badge bg-critique text-white animate-pulse">
            {totalActives} alerte(s) active(s)
          </Link>
        ) : (
          <span className="badge bg-green-100 text-ok">Aucune alerte active</span>
        )}
      </div>

      {!data ? (
        <div className="grid gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl border border-rose-100 bg-white" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Cartes mobile ── */}
          <div className="grid gap-3 md:hidden">
            {patients.length === 0 && (
              <p className="rounded-2xl border border-rose-100 bg-white px-4 py-8 text-center text-slate-400">
                Aucun patient. Créez-en un depuis « Nouveau patient ».
              </p>
            )}
            {patients.map((p) => {
              const e = parPatient.get(p.id);
              const critique = (e?.active ?? 0) > 0;
              return (
                <Link
                  key={p.id}
                  href={`/pro/patients/${p.id}`}
                  className={`flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-4 transition hover:shadow-md ${critique ? "border-red-200 bg-red-50/40" : "border-rose-100"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-brand">
                      {p.nom.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-700">{p.nom}</p>
                      <StatutSuivi statut={p.statut} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {critique ? (
                      <span className="badge bg-critique text-white">{e?.active} alerte(s)</span>
                    ) : (e?.acquittees ?? 0) > 0 ? (
                      <span className="badge bg-amber-100 text-attention">{e?.acquittees} acquittée(s)</span>
                    ) : null}
                    {(messages.get(p.id) ?? 0) > 0 && (
                      <span className="badge bg-rose-800 text-white">
                        {messages.get(p.id)} message{(messages.get(p.id) ?? 0) > 1 ? "s" : ""}
                      </span>
                    )}
                    {!critique && (e?.acquittees ?? 0) === 0 && (messages.get(p.id) ?? 0) === 0 && (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                    <span className="text-brand">→</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Tableau desktop ── */}
          <div className="hidden overflow-hidden rounded-2xl border border-rose-100 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-rose-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Statut suivi</th>
                  <th className="px-4 py-3">Alertes</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Aucun patient. Créez-en un depuis « Nouveau patient ».
                    </td>
                  </tr>
                )}
                {patients.map((p) => {
                  const e = parPatient.get(p.id);
                  const critique = (e?.active ?? 0) > 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/pro/patients/${p.id}`)}
                      className={`cursor-pointer ${critique ? "bg-red-50/60 hover:bg-red-100/60" : "hover:bg-rose-50/40"}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-700">{p.nom}</td>
                      <td className="px-4 py-3"><StatutSuivi statut={p.statut} /></td>
                      <td className="px-4 py-3">
                        {critique ? (
                          <span className="badge bg-critique text-white">{e?.active} active(s)</span>
                        ) : (e?.acquittees ?? 0) > 0 ? (
                          <span className="badge bg-amber-100 text-attention">{e?.acquittees} acquittée(s)</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(messages.get(p.id) ?? 0) > 0 ? (
                          <span className="badge bg-rose-800 text-white">
                            {messages.get(p.id)} message{(messages.get(p.id) ?? 0) > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/pro/patients/${p.id}`} className="text-sm font-medium text-brand hover:underline">
                          Ouvrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatutSuivi({ statut }: { statut: Patient["statut"] }) {
  const map = {
    active: { c: "bg-green-100 text-ok", l: "Actif" },
    suspendue: { c: "bg-amber-100 text-attention", l: "Suspendu" },
    terminee: { c: "bg-slate-100 text-slate-500", l: "Terminé" },
  } as const;
  const s = map[statut];
  return <span className={`badge ${s.c}`}>{s.l}</span>;
}
