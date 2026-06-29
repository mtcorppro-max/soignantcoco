"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Select } from "@/components/Select";

type Forfait = { id: string; lpp_code: string; date_debut: string; date_fin: string; actif: boolean; lpp: { libelle: string; prix_ttc: number | null; periodicite: string } | { libelle: string; prix_ttc: number | null; periodicite: string }[] | null };
type LppF = { code: string; libelle: string; prix_ttc: number | null; periodicite: string; famille: string | null };
const FAMILLES = [
  { value: "perfusion", label: "Perfusion (PERFADOM)" },
  { value: "nead", label: "Nutrition entérale (NEAD)" },
  { value: "npad", label: "Nutrition parentérale (NPAD)" },
];

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] : v) ?? null;
const PER: Record<string, string> = { installation: "installation", journalier: "/ jour", hebdomadaire: "/ semaine", mensuel: "/ mois", unitaire: "" };

// Nb de périodes restantes (après aujourd'hui) jusqu'à la fin de PEC.
function periodesRestantes(periodicite: string, dDebut: string, dFin: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fin = new Date(dFin); fin.setHours(0, 0, 0, 0);
  if (periodicite === "installation") return new Date(dDebut) > today ? 1 : 0;
  const incr = periodicite === "journalier" ? 1 : periodicite === "hebdomadaire" ? 7 : 0;
  let count = 0;
  for (let k = 0; k < 6000; k++) {
    const d = new Date(dDebut); d.setHours(0, 0, 0, 0);
    if (periodicite === "mensuel") d.setMonth(d.getMonth() + k); else d.setDate(d.getDate() + k * incr);
    if (d > fin) break;
    if (d > today) count++;
    if (incr === 0 && periodicite !== "mensuel") break;
  }
  return count;
}

export function FacturationPatient({ patientId }: { patientId: string }) {
  const pro = useProSession();
  const [genere, setGenere] = useState(0);
  const [forfaits, setForfaits] = useState<Forfait[]>([]);
  const [lppF, setLppF] = useState<LppF[]>([]);
  const [pec, setPec] = useState<{ debut: string | null; fin: string | null }>({ debut: null, fin: null });
  const [fam, setFam] = useState("");
  const [ajout, setAjout] = useState("");
  const [pret, setPret] = useState(false);
  const peut = !!pro && (pro.niveau <= 1 || ["dirigeant", "coordinatrice"].includes(pro.role));
  const peutGerer = !!pro && (pro.niveau <= 1 || ["dirigeant", "coordinatrice"].includes(pro.role));

  const charger = useCallback(async () => {
    const supabase = createClient();
    await supabase.rpc("generer_factures_previsionnelles");
    const [{ data: facts }, { data: ff }, { data: pat }] = await Promise.all([
      supabase.from("facture_previsionnelle").select("montant_base,statut").eq("patient_id", patientId),
      supabase.from("patient_forfait").select("id,lpp_code,date_debut,date_fin,actif,lpp:lpp_code(libelle,prix_ttc,periodicite)").eq("patient_id", patientId).eq("actif", true),
      supabase.from("patient").select("date_operation,duree_prise_en_charge").eq("id", patientId).maybeSingle(),
    ]);
    setGenere(((facts ?? []) as { montant_base: number; statut: string }[]).filter((f) => f.statut !== "annulee").reduce((a, f) => a + Number(f.montant_base), 0));
    setForfaits((ff ?? []) as unknown as Forfait[]);
    const p = pat as { date_operation?: string | null; duree_prise_en_charge?: number | null } | null;
    const debut = p?.date_operation ?? null;
    const fin = debut && p?.duree_prise_en_charge ? new Date(new Date(debut).getTime() + p.duree_prise_en_charge * 86_400_000).toISOString().slice(0, 10) : null;
    setPec({ debut, fin });
    setPret(true);
  }, [patientId]);

  useEffect(() => { if (peut) { loadLpp(); charger(); } }, [peut, charger]);
  async function loadLpp() {
    const { data } = await createClient().from("lpp").select("code,libelle,prix_ttc,periodicite,famille").neq("periodicite", "unitaire").not("famille", "is", null).order("libelle");
    setLppF((data ?? []) as LppF[]);
  }

  async function ajouter() {
    if (!ajout) return;
    const debut = pec.debut ?? new Date().toISOString().slice(0, 10);
    const fin = pec.fin ?? new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await createClient().from("patient_forfait").insert({ patient_id: patientId, lpp_code: ajout, date_debut: debut, date_fin: fin, actif: true });
    if (error) { alert("Échec : " + error.message); return; }
    setAjout(""); setFam(""); charger();
  }
  async function retirer(id: string) {
    if (!confirm("Retirer ce forfait de la prise en charge ?")) return;
    const { error } = await createClient().from("patient_forfait").delete().eq("id", id);
    if (error) { alert("Échec : " + error.message); return; }
    charger();
  }

  if (!peut || !pret) return null;

  const futur = forfaits.reduce((a, f) => {
    const lp = un(f.lpp); if (!lp?.prix_ttc) return a;
    return a + lp.prix_ttc * periodesRestantes(lp.periodicite, f.date_debut, f.date_fin);
  }, 0);
  const previsionnel = genere + futur;

  return (
    <section className="card grid gap-3">
      <h2 className="text-sm font-semibold text-slate-600">Facturation prévisionnelle Sécu</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-rose-100 p-3">
          <p className="text-xs text-slate-400">CA déjà généré</p>
          <p className="mt-0.5 text-xl font-bold text-brand">{eur(genere)}</p>
        </div>
        <div className="rounded-xl border border-rose-100 p-3">
          <p className="text-xs text-slate-400">CA prévisionnel fin de PEC</p>
          <p className="mt-0.5 text-xl font-bold text-slate-800">{eur(previsionnel)}</p>
          {futur > 0 && <p className="text-[11px] text-slate-400">dont {eur(futur)} de forfaits à venir</p>}
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-xs font-semibold text-slate-500">Forfaits de prise en charge</p>
        {forfaits.length === 0 ? (
          <p className="text-xs text-slate-400">Aucun forfait attaché.</p>
        ) : forfaits.map((f) => {
          const lp = un(f.lpp);
          return (
            <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-rose-100 px-3 py-1.5 text-xs">
              <span className="min-w-0">
                <span className="truncate text-slate-700">{lp?.libelle ?? f.lpp_code}</span>
                <span className="ml-1 text-slate-400">· {lp?.prix_ttc ? eur(lp.prix_ttc) : "—"} {PER[lp?.periodicite ?? ""]}</span>
              </span>
              {peutGerer && <button onClick={() => retirer(f.id)} className="shrink-0 px-1 text-critique" title="Retirer">✕</button>}
            </div>
          );
        })}
        {peutGerer && (
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <div className="w-52"><Select value={fam} onChange={(v) => { setFam(v); setAjout(""); }} placeholder="Type de forfait…" options={[{ value: "", label: "Type de forfait…" }, ...FAMILLES]} /></div>
            {fam && (
              <div className="w-72"><Select value={ajout} onChange={setAjout} placeholder="Choisir le forfait…" options={[{ value: "", label: "Choisir le forfait…" }, ...lppF.filter((l) => l.famille === fam).map((l) => ({ value: l.code, label: `${l.libelle.replace(/^[^—]*— /, "").slice(0, 55)} — ${l.prix_ttc ? eur(l.prix_ttc) : "?"} ${PER[l.periodicite]}` }))]} /></div>
            )}
            {fam && <button onClick={ajouter} disabled={!ajout} className="btn-primary px-3 py-2 text-sm disabled:opacity-50">Ajouter</button>}
          </div>
        )}
      </div>
    </section>
  );
}
