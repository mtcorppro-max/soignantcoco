"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { estRoleService, estCoordOuManager } from "@/lib/roles";
import { STATUT_PATIENT, estActifPatient } from "@/lib/statutPatient";
import { useData, invalidate } from "@/lib/hooks/useData";
import { AstreinteAlerte } from "@/components/AstreinteAlerte";
import { CentreAlertes } from "@/components/CentreAlertes";
import type { Patient } from "@/lib/types";

type AlerteInfo = { active: number; acquittees: number };
type ActionItem = { jour: number; echeance: string; retard: boolean };
type DashData = {
  patients: Patient[];
  parPatient: Map<string, AlerteInfo>;
  totalActives: number;
  messages: Map<string, number>; // patient_id -> nb de messages patient en attente de réponse
  actions: Map<string, ActionItem[]>; // patient_id -> suivis J1/dernier jour à réaliser
  livraisons: Map<string, number>; // patient_id -> nb de livraisons à attribuer (sans livreur)
};

// "YYYY-MM-DD" (heure locale) du jour
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Ajoute n jours à une date "YYYY-MM-DD" → "YYYY-MM-DD"
function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// timestamptz → "YYYY-MM-DD" local
function jourLocal(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function libelleAction(a: ActionItem): string {
  return `Suivi J${a.jour}${a.retard ? " (en retard)" : " (aujourd'hui)"}`;
}

async function fetchDashboard(): Promise<DashData> {
  const supabase = createClient();
  const [{ data: pts }, { data: als }, { data: msgs }, { data: svs }, { data: rps }, { data: livs }] = await Promise.all([
    supabase.from("patient").select("id,nom,statut,code_postal,prestataire_id,user_id,date_operation,duree_prise_en_charge,jours_suivi,infirmiere_nom,infirmiere_tel").order("nom"),
    supabase.from("alerte").select("id,patient_id,statut").in("statut", ["declenchee", "escaladee", "acquittee"]),
    supabase.from("message").select("patient_id,auteur_user_id,horodatage").order("horodatage", { ascending: true }).limit(2000),
    supabase.from("suivi").select("patient_id,created_at"),
    supabase.from("rappel_suivi_valide").select("patient_id,type,echeance"),
    supabase.from("livraison").select("patient_id,statut,livreur_id").eq("statut", "a_programmer").is("livreur_id", null),
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

  // Actions : suivis J1 / dernier jour dont l'échéance est arrivée et qui ne
  // sont ni faits (suivi ce jour-là) ni validés manuellement.
  const today = todayIso();
  const suivisJours = new Set((svs ?? []).map((s) => `${s.patient_id}|${jourLocal(s.created_at)}`));
  const valides = new Set((rps ?? []).map((r) => `${r.patient_id}|${r.echeance}`));
  const actions = new Map<string, ActionItem[]>();
  patientsRaw.forEach((p) => {
    if (!p.date_operation || !estActifPatient(p.statut)) return;
    const items: ActionItem[] = [];
    // Tous les jours de suivi programmés échus et non réalisés.
    (p.jours_suivi ?? []).forEach((j) => {
      const echeance = addDays(p.date_operation!, j);
      if (!echeance || echeance > today) return;
      if (suivisJours.has(`${p.id}|${echeance}`) || valides.has(`${p.id}|${echeance}`)) return;
      items.push({ jour: j, echeance, retard: echeance < today });
    });
    if (items.length) actions.set(p.id, items);
  });

  // Livraisons à attribuer (programmées sans livreur) — par patient.
  const livraisons = new Map<string, number>();
  (livs ?? []).forEach((l) => {
    const id = (l as { patient_id: string }).patient_id;
    livraisons.set(id, (livraisons.get(id) ?? 0) + 1);
  });

  const score = (p: Patient) =>
    (parPatient.get(p.id)?.active ?? 0) * 100 +
    (actions.get(p.id)?.length ?? 0) * 20 +
    (messages.get(p.id) ?? 0) * 10 +
    (livraisons.get(p.id) ?? 0) * 15 +
    (parPatient.get(p.id)?.acquittees ?? 0);
  const patients = [...patientsRaw].sort((a, b) => score(b) - score(a));
  const totalActives = [...parPatient.values()].reduce((s, e) => s + e.active, 0);
  return { patients, parPatient, totalActives, messages, actions, livraisons };
}

export default function Dashboard() {
  const pro = useProSession();
  const router = useRouter();
  const data = useData<DashData>("pro:dashboard", fetchDashboard);
  const [validesLocal, setValidesLocal] = useState<Set<string>>(new Set());
  // Un médecin / chirurgien ne reçoit les alertes patients que s'il l'a demandé.
  // Les comptes service (livreur/pharmacie) ne reçoivent pas d'alertes.
  const estMedecin = pro?.role === "chirurgien";
  const voitAlertes = !estRoleService(pro?.role) && (!estMedecin || !!pro?.recevoir_alertes);
  // Le suivi des livraisons à attribuer est réservé aux coordinatrices/managers.
  const peutVoirLivraisons = estCoordOuManager(pro?.role);

  // Médecin : ordonnances en attente de sa signature, par patient.
  const ordoData = useData<Map<string, number>>(
    estMedecin && pro?.id ? `pro:dash-ordo:${pro.id}` : "pro:dash-ordo:none",
    async () => {
      if (!estMedecin || !pro?.id) return new Map<string, number>();
      const { data } = await createClient().from("ordonnance").select("patient_id").eq("destinataire_id", pro.id).eq("statut", "a_signer");
      const m = new Map<string, number>();
      (data ?? []).forEach((o) => { const id = (o as { patient_id: string }).patient_id; m.set(id, (m.get(id) ?? 0) + 1); });
      return m;
    },
    [estMedecin, pro?.id]
  );
  const ordoParPatient = ordoData ?? new Map<string, number>();

  // Pharmacie, livreur et dirigeant n'ont pas de tableau de bord : on les renvoie vers leur espace.
  useEffect(() => {
    if (pro?.role === "pharmacie") router.replace("/pro/pharmacie");
    else if (pro?.role === "livreur") router.replace("/pro/livraisons");
    else if (pro?.role === "dirigeant") router.replace("/pro/pec");
    else if (pro?.role === "magasinier") router.replace("/pro/magasin");
    else if (pro?.role === "rh") router.replace("/pro/annuaire");
    else if (pro?.role === "personnel") router.replace("/pro/messagerie");
  }, [pro?.role, router]);

  const { patients, parPatient, totalActives, messages, actions, livraisons } = useMemo<DashData>(() => (
    data ?? {
      patients: [],
      parPatient: new Map<string, AlerteInfo>(),
      totalActives: 0,
      messages: new Map<string, number>(),
      actions: new Map<string, ActionItem[]>(),
      livraisons: new Map<string, number>(),
    }
  ), [data]);

  // Actions encore en attente (en retirant celles validées localement à l'instant).
  function actionsDe(patientId: string): ActionItem[] {
    return (actions.get(patientId) ?? []).filter(
      (it) => !validesLocal.has(`${patientId}|${it.echeance}`)
    );
  }

  async function validerActions(patientId: string, items: ActionItem[]) {
    if (items.length === 0) return;
    setValidesLocal((prev) => {
      const n = new Set(prev);
      items.forEach((it) => n.add(`${patientId}|${it.echeance}`));
      return n;
    });
    const supabase = createClient();
    await supabase.from("rappel_suivi_valide").insert(
      items.map((it) => ({ patient_id: patientId, type: `J${it.jour}`, echeance: it.echeance, validee_par: pro?.nom ?? null }))
    );
    invalidate("pro:dashboard");
  }

  if (pro?.role === "pharmacie" || pro?.role === "livreur" || pro?.role === "dirigeant" || pro?.role === "magasinier" || pro?.role === "rh" || pro?.role === "personnel") return null; // redirigés vers leur espace

  return (
    <div className="grid grid-cols-1 gap-5">
      <AstreinteAlerte />
      {voitAlertes && <CentreAlertes />}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-100 pt-5">
        <h1 className="text-2xl font-bold text-slate-800">Liste de patients</h1>
        {!voitAlertes ? null : !data ? (
          <div className="h-6 w-32 animate-pulse rounded-full bg-rose-100" />
        ) : totalActives > 0 ? (
          <a href="#centre-alertes" className="badge shrink-0 bg-critique text-white animate-pulse">
            {totalActives} alerte(s) active(s)
          </a>
        ) : (
          <span className="badge shrink-0 bg-green-100 text-ok">Aucune alerte active</span>
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
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {patients.length === 0 && (
              <p className="rounded-2xl border border-rose-100 bg-white px-4 py-8 text-center text-slate-400">
                Aucun patient. Créez-en un depuis « Nouveau patient ».
              </p>
            )}
            {patients.map((p) => {
              const e = parPatient.get(p.id);
              const critique = (e?.active ?? 0) > 0;
              const acts = actionsDe(p.id);
              const nbLiv = peutVoirLivraisons ? (livraisons.get(p.id) ?? 0) : 0;
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
                      {estMedecin && (p.infirmiere_nom || p.infirmiere_tel) && (
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          IDE : {p.infirmiere_nom || "—"}
                          {p.infirmiere_tel && <> · <a href={`tel:${p.infirmiere_tel}`} onClick={(ev) => ev.stopPropagation()} className="text-brand hover:underline">{p.infirmiere_tel}</a></>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {critique ? (
                      <span className="badge bg-critique text-white">{e?.active} alerte(s)</span>
                    ) : (e?.acquittees ?? 0) > 0 ? (
                      <span className="badge bg-amber-100 text-attention">{e?.acquittees} traitée(s)</span>
                    ) : null}
                    {estMedecin ? (
                      (ordoParPatient.get(p.id) ?? 0) > 0 ? (
                        <span className="badge bg-amber-100 text-attention" title="Ordonnance(s) en attente de votre signature">
                          {ordoParPatient.get(p.id)} ordo · à signer
                        </span>
                      ) : !critique && (e?.acquittees ?? 0) === 0 ? (
                        <span className="text-slate-300 text-sm">—</span>
                      ) : null
                    ) : (
                      <>
                        {(messages.get(p.id) ?? 0) > 0 && (
                          <span className="badge bg-rose-800 text-white">
                            {messages.get(p.id)} message{(messages.get(p.id) ?? 0) > 1 ? "s" : ""}
                          </span>
                        )}
                        {acts.length > 0 && (
                          <button
                            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); validerActions(p.id, acts); }}
                            className="badge bg-rose-800 text-white"
                            title={`${acts.map(libelleAction).join(", ")} — appuyer pour valider`}
                          >
                            {acts.length} action · valider
                          </button>
                        )}
                        {nbLiv > 0 && (
                          <span className="badge bg-amber-100 text-attention" title="Livraison programmée sans livreur — indiquez qui livre">
                            {nbLiv} livraison · attribuer
                          </span>
                        )}
                        {!critique && (e?.acquittees ?? 0) === 0 && (messages.get(p.id) ?? 0) === 0 && acts.length === 0 && nbLiv === 0 && (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </>
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
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Alertes</th>
                  {estMedecin ? (
                    <>
                      <th className="px-4 py-3">Infirmière</th>
                      <th className="px-4 py-3">Ordonnances</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">Action</th>
                    </>
                  )}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Aucun patient. Créez-en un depuis « Nouveau patient ».
                    </td>
                  </tr>
                )}
                {patients.map((p) => {
                  const e = parPatient.get(p.id);
                  const critique = (e?.active ?? 0) > 0;
                  const acts = actionsDe(p.id);
                  const nbLiv = peutVoirLivraisons ? (livraisons.get(p.id) ?? 0) : 0;
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
                          <span className="badge bg-amber-100 text-attention">{e?.acquittees} traitée(s)</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      {estMedecin ? (
                        <>
                          <td className="px-4 py-3">
                            {p.infirmiere_nom || p.infirmiere_tel ? (
                              <span className="flex flex-col leading-tight">
                                <span className="font-medium text-slate-700">{p.infirmiere_nom || "—"}</span>
                                {p.infirmiere_tel && <a href={`tel:${p.infirmiere_tel}`} onClick={(ev) => ev.stopPropagation()} className="text-xs text-brand hover:underline">{p.infirmiere_tel}</a>}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {(ordoParPatient.get(p.id) ?? 0) > 0 ? (
                              <span className="badge bg-amber-100 text-attention" title="Ordonnance(s) en attente de votre signature">
                                {ordoParPatient.get(p.id)} à signer
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            {(messages.get(p.id) ?? 0) > 0 ? (
                              <span className="badge bg-rose-800 text-white">
                                {messages.get(p.id)} message{(messages.get(p.id) ?? 0) > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex flex-wrap items-center gap-2">
                              {acts.length > 0 && (
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="badge bg-rose-800 text-white"
                                    title={acts.map(libelleAction).join(", ")}
                                  >
                                    {acts.length}
                                  </span>
                                  <button
                                    onClick={(ev) => { ev.stopPropagation(); validerActions(p.id, acts); }}
                                    className="text-xs font-medium text-brand hover:underline"
                                  >
                                    Valider
                                  </button>
                                </span>
                              )}
                              {nbLiv > 0 && (
                                <span className="badge bg-amber-100 text-attention" title="Livraison programmée sans livreur — indiquez qui livre">
                                  {nbLiv} livraison · attribuer
                                </span>
                              )}
                              {acts.length === 0 && nbLiv === 0 && (
                                <span className="text-slate-300">—</span>
                              )}
                            </span>
                          </td>
                        </>
                      )}
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
  const s = STATUT_PATIENT[statut] ?? STATUT_PATIENT.active;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
