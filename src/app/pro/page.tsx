"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import type { Patient } from "@/lib/types";

type AlerteInfo = { active: number; acquittees: number };

export default function Dashboard() {
  useProSession(); // préchauffe le cache session
  const [patients, setPatients] = useState<Patient[]>([]);
  const [parPatient, setParPatient] = useState<Map<string, AlerteInfo>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from("patient")
        .select("id,nom,statut,code_postal,prestataire_id,user_id")
        .order("nom"),
      supabase
        .from("alerte")
        .select("id,patient_id,statut")
        .in("statut", ["declenchee", "escaladee", "acquittee"]),
    ]).then(([{ data: pts }, { data: als }]) => {
      const map = new Map<string, AlerteInfo>();
      (als ?? []).forEach((a) => {
        const e = map.get(a.patient_id) ?? { active: 0, acquittees: 0 };
        if (a.statut === "declenchee" || a.statut === "escaladee") e.active += 1;
        if (a.statut === "acquittee") e.acquittees += 1;
        map.set(a.patient_id, e);
      });
      setParPatient(map);
      const score = (p: Patient) => {
        const e = map.get(p.id);
        return (e?.active ?? 0) * 100 + (e?.acquittees ?? 0);
      };
      setPatients([...(pts ?? [])].sort((a, b) => score(b as Patient) - score(a as Patient)) as Patient[]);
      setReady(true);
    });
  }, []);

  const totalActives = [...parPatient.values()].reduce((s, e) => s + e.active, 0);

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Tableau de bord</h1>
        {!ready ? (
          <div className="h-6 w-32 animate-pulse rounded-full bg-rose-100" />
        ) : totalActives > 0 ? (
          <Link href="/pro/alertes" className="badge bg-critique text-white animate-pulse">
            {totalActives} alerte(s) active(s)
          </Link>
        ) : (
          <span className="badge bg-green-100 text-ok">Aucune alerte active</span>
        )}
      </div>

      {!ready ? (
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
                  <div className="flex shrink-0 items-center gap-2">
                    {critique ? (
                      <span className="badge bg-critique text-white">{e?.active} alerte(s)</span>
                    ) : (e?.acquittees ?? 0) > 0 ? (
                      <span className="badge bg-amber-100 text-attention">{e?.acquittees} acquittée(s)</span>
                    ) : (
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Aucun patient. Créez-en un depuis « Nouveau patient ».
                    </td>
                  </tr>
                )}
                {patients.map((p) => {
                  const e = parPatient.get(p.id);
                  const critique = (e?.active ?? 0) > 0;
                  return (
                    <tr key={p.id} className={critique ? "bg-red-50/60" : "hover:bg-rose-50/40"}>
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
