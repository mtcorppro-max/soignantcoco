"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { genererPdfConsignes, type ProtocolePdf } from "@/lib/pdfConsignes";

// Recherche rapide de soignants externes (médecins/chirurgiens & infirmières
// libérales, avec ou sans compte). Réservée aux équipes internes (peutGerer).
type Resultat = {
  key: string;
  nom: string;
  categorie: "medecin" | "infirmiere";
  externe: boolean;
  detail: string | null; // spécialité (médecin) ou zone (infirmière)
  telephone: string | null;
  email: string | null;
  cabinets: string | null;
  secretariat_nom: string | null;
  secretariat_email: string | null;
  secretariat_tel: string | null;
  protocoles: ProtocolePdf[] | null;
};

const nomComplet = (p: { titre: string | null; prenom: string | null; nom: string }) =>
  [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");

export function RechercheSoignants() {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!ouvert || charge) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from("professionnel")
        .select("nom,prenom,titre,role,telephone,email,specialite,cabinets,secretariat_nom,secretariat_email,secretariat_tel,protocoles")
        .in("role", ["chirurgien", "infirmiere_liberale"]),
      supabase
        .from("soignant_externe")
        .select("id,type,nom,prenom,titre,telephone,email,specialite,zone_exercice,cabinets,secretariat_nom,secretariat_tel,protocoles"),
    ]).then(([{ data: pros }, { data: exts }]) => {
      const r1: Resultat[] = (pros ?? []).map((p, i) => ({
        key: `c${i}`,
        nom: nomComplet(p as never),
        categorie: (p as { role: string }).role === "chirurgien" ? "medecin" : "infirmiere",
        externe: false,
        detail: (p as { specialite: string | null }).specialite ?? null,
        telephone: (p as { telephone: string | null }).telephone ?? null,
        email: (p as { email: string | null }).email ?? null,
        cabinets: (p as { cabinets: string | null }).cabinets ?? null,
        secretariat_nom: (p as { secretariat_nom: string | null }).secretariat_nom ?? null,
        secretariat_email: (p as { secretariat_email: string | null }).secretariat_email ?? null,
        secretariat_tel: (p as { secretariat_tel: string | null }).secretariat_tel ?? null,
        protocoles: (p as { protocoles: ProtocolePdf[] | null }).protocoles ?? null,
      }));
      const r2: Resultat[] = (exts ?? []).map((e) => {
        const x = e as { id: string; type: "medecin" | "infirmiere"; specialite: string | null; zone_exercice: string | null; telephone: string | null; email: string | null; cabinets: string | null; secretariat_nom: string | null; secretariat_tel: string | null; protocoles: ProtocolePdf[] | null };
        return {
          key: `e${x.id}`,
          nom: nomComplet(e as never),
          categorie: x.type,
          externe: true,
          detail: x.type === "medecin" ? x.specialite : x.zone_exercice,
          telephone: x.telephone,
          email: x.email,
          cabinets: x.cabinets,
          secretariat_nom: x.secretariat_nom,
          secretariat_email: null,
          secretariat_tel: x.secretariat_tel,
          protocoles: x.protocoles,
        };
      });
      setResultats([...r1, ...r2].sort((a, b) => a.nom.localeCompare(b.nom)));
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
    if (!t) return resultats;
    return resultats.filter((r) => `${r.nom} ${r.detail ?? ""}`.toLowerCase().includes(t));
  }, [q, resultats]);

  const pdf = (r: Resultat) =>
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
        title="Rechercher un soignant"
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
                placeholder="Rechercher un médecin, une infirmière, une zone…"
                className="input flex-1 border-0 px-0 focus:ring-0"
              />
              <button onClick={() => setOuvert(false)} className="text-slate-400 hover:text-critique">✕</button>
            </div>

            <div className="grid gap-2 overflow-auto">
              {!charge ? (
                <p className="text-sm text-slate-400">Chargement…</p>
              ) : filtres.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun soignant trouvé.</p>
              ) : (
                filtres.map((r) => (
                  <div key={r.key} className="rounded-lg border border-rose-100 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{r.nom}</span>
                      <span className="badge bg-rose-100 text-brand">
                        {r.categorie === "medecin"
                          ? ((r.detail ?? "").toLowerCase().includes("chirurg") ? "Chirurgien" : "Médecin")
                          : "Infirmière libérale"}
                      </span>
                      {!r.externe && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white" title="Dispose d'un compte AS2CŒUR">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Compte
                        </span>
                      )}
                    </div>
                    {r.detail && <p className="mt-0.5 text-sm text-slate-500">{r.detail}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {r.telephone && <a href={`tel:${r.telephone}`} className="font-medium text-brand hover:underline">{r.telephone}</a>}
                      {r.email && <a href={`mailto:${r.email}`} className="font-medium text-brand hover:underline">{r.email}</a>}
                      {r.categorie === "medecin" && (
                        <button onClick={() => pdf(r)} className="font-medium text-slate-600 hover:text-brand hover:underline">📄 PDF consignes</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
