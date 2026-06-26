"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { genererPdfConsignes, type ProtocolePdf } from "@/lib/pdfConsignes";
import { LIBELLE_ROLE } from "@/lib/roles";

// Recherche globale : patients, soignants (comptes + externes), interventions / PDF.
// Réservée aux équipes internes (peutGerer).

type ResPatient = { kind: "patient"; key: string; id: string; nom: string; sous: string | null; texte: string };
type ResSoignant = {
  kind: "soignant"; key: string; nom: string; role: string; compte: boolean;
  detail: string | null; telephone: string | null; email: string | null;
  cabinets: string | null; secretariat_nom: string | null; secretariat_email: string | null; secretariat_tel: string | null;
  protocoles: ProtocolePdf[] | null; texte: string;
};
type Resultat = ResPatient | ResSoignant;

const nomComplet = (p: { titre: string | null; prenom: string | null; nom: string }) =>
  [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");
const labelMedecin = (s: string | null) => ((s ?? "").toLowerCase().includes("chirurg") ? "Chirurgien" : "Médecin");
const interventions = (ps: ProtocolePdf[] | null) => (ps ?? []).map((p) => p.intervention || "").join(" ");

export function RechercheSoignants() {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Resultat[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!ouvert || charge) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("patient").select("id,nom,operation,chirurgien,traitement,ville,date_operation"),
      supabase.from("professionnel").select("nom,prenom,titre,role,telephone,email,specialite,cabinets,secretariat_nom,secretariat_email,secretariat_tel,protocoles"),
      supabase.from("soignant_externe").select("id,type,nom,prenom,titre,telephone,email,specialite,zone_exercice,cabinets,secretariat_nom,secretariat_tel,protocoles"),
    ]).then(([{ data: pts }, { data: pros }, { data: exts }]) => {
      const rP: Resultat[] = (pts ?? []).map((p) => {
        const x = p as { id: string; nom: string; operation: string | null; chirurgien: string | null; traitement: string | null; ville: string | null };
        const sous = [x.operation, x.chirurgien].filter(Boolean).join(" · ") || x.traitement || null;
        return { kind: "patient", key: `p${x.id}`, id: x.id, nom: x.nom, sous, texte: `${x.nom} ${x.operation ?? ""} ${x.chirurgien ?? ""} ${x.traitement ?? ""} ${x.ville ?? ""}`.toLowerCase() };
      });
      const rS: Resultat[] = (pros ?? []).map((p, i) => {
        const x = p as { role: string; specialite: string | null; telephone: string | null; email: string | null; cabinets: string | null; secretariat_nom: string | null; secretariat_email: string | null; secretariat_tel: string | null; protocoles: ProtocolePdf[] | null };
        const role = x.role === "chirurgien" ? labelMedecin(x.specialite) : LIBELLE_ROLE[x.role as keyof typeof LIBELLE_ROLE];
        const nom = nomComplet(p as never);
        return { kind: "soignant", key: `c${i}`, nom, role, compte: true, detail: x.specialite, telephone: x.telephone, email: x.email, cabinets: x.cabinets, secretariat_nom: x.secretariat_nom, secretariat_email: x.secretariat_email, secretariat_tel: x.secretariat_tel, protocoles: x.protocoles, texte: `${nom} ${role} ${x.specialite ?? ""} ${interventions(x.protocoles)}`.toLowerCase() };
      });
      const rE: Resultat[] = (exts ?? []).map((e) => {
        const x = e as { id: string; type: "medecin" | "infirmiere"; specialite: string | null; zone_exercice: string | null; telephone: string | null; email: string | null; cabinets: string | null; secretariat_nom: string | null; secretariat_tel: string | null; protocoles: ProtocolePdf[] | null };
        const role = x.type === "medecin" ? labelMedecin(x.specialite) : "Infirmière libérale";
        const nom = nomComplet(e as never);
        const detail = x.type === "medecin" ? x.specialite : x.zone_exercice;
        return { kind: "soignant", key: `e${x.id}`, nom, role, compte: false, detail, telephone: x.telephone, email: x.email, cabinets: x.cabinets, secretariat_nom: x.secretariat_nom, secretariat_email: null, secretariat_tel: x.secretariat_tel, protocoles: x.protocoles, texte: `${nom} ${role} ${detail ?? ""} ${interventions(x.protocoles)}`.toLowerCase() };
      });
      setItems([...rP, ...rS, ...rE]);
      setCharge(true);
    });
  }, [ouvert, charge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    if (ouvert) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert]);

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return items.filter((r) => r.texte.includes(t)).slice(0, 40);
  }, [q, items]);

  const patients = filtres.filter((r): r is ResPatient => r.kind === "patient");
  const soignants = filtres.filter((r): r is ResSoignant => r.kind === "soignant");

  const pdf = (r: ResSoignant) =>
    genererPdfConsignes({
      titre: "", prenom: "", nom: r.nom, specialite: r.detail ?? "",
      telephone: r.telephone ?? "", cabinets: r.cabinets ?? "",
      secretariat_nom: r.secretariat_nom ?? "", secretariat_email: r.secretariat_email ?? "", secretariat_tel: r.secretariat_tel ?? "",
      protocoles: r.protocoles ?? [],
    });

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        title="Rechercher"
        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-brand"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.2-3.2" />
        </svg>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={() => setOuvert(false)}>
          <div className="card w-full max-w-lg grid max-h-[75vh] gap-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 shrink-0 text-slate-400">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.2-3.2" />
              </svg>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher : patient, médecin, intervention, mot-clé…"
                className="input flex-1 border-0 px-0 focus:ring-0"
              />
              <button onClick={() => setOuvert(false)} className="text-slate-400 hover:text-critique">✕</button>
            </div>

            <div className="grid gap-3 overflow-auto">
              {!charge ? (
                <p className="text-sm text-slate-400">Chargement…</p>
              ) : !q.trim() ? (
                <p className="text-sm text-slate-400">Tapez un nom de patient, un médecin, une intervention…</p>
              ) : filtres.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun résultat.</p>
              ) : (
                <>
                  {patients.length > 0 && (
                    <div className="grid gap-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Patients</p>
                      {patients.map((r) => (
                        <Link
                          key={r.key}
                          href={`/pro/patients/${r.id}`}
                          onClick={() => setOuvert(false)}
                          className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 px-3 py-2 transition hover:border-rose-200 hover:bg-rose-50"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{r.nom}</span>
                            {r.sous && <p className="text-xs text-slate-500">{r.sous}</p>}
                          </div>
                          <span className="badge bg-rose-100 text-brand">Patient</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {soignants.length > 0 && (
                    <div className="grid gap-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Soignants</p>
                      {soignants.map((r) => (
                        <div key={r.key} className="rounded-lg border border-rose-100 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">{r.nom}</span>
                            <span className="badge bg-rose-100 text-brand">{r.role}</span>
                            {r.compte && (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white" title="Dispose d'un compte AS2CŒUR">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                          </div>
                          {r.detail && <p className="mt-0.5 text-sm text-slate-500">{r.detail}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            {r.telephone && <a href={`tel:${r.telephone}`} className="font-medium text-brand hover:underline">{r.telephone}</a>}
                            {r.email && <a href={`mailto:${r.email}`} className="font-medium text-brand hover:underline">{r.email}</a>}
                            {(r.protocoles?.length ?? 0) > 0 && (
                              <button onClick={() => pdf(r)} className="font-medium text-slate-600 hover:text-brand hover:underline">📄 PDF consignes</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
