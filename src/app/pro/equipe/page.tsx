"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { genererPdfConsignes, type ProtocolePdf } from "@/lib/pdfConsignes";

type Soignant = {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  role: "coordinatrice" | "chirurgien" | "delegue";
  niveau: number;
  email: string | null;
  telephone: string | null;
  specialite: string | null;
  cabinets: string | null;
  secretariat_nom: string | null;
  secretariat_email: string | null;
  secretariat_tel: string | null;
  protocoles: ProtocolePdf[] | null;
};

const COLS =
  "id,nom,prenom,titre,role,niveau,email,telephone,specialite,cabinets,secretariat_nom,secretariat_email,secretariat_tel,protocoles";

export default function EquipePage() {
  const pro = useProSession();
  const [soignants, setSoignants] = useState<Soignant[]>([]);
  const [chargement, setChargement] = useState(true);
  const [suppression, setSuppression] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("professionnel")
      .select(COLS)
      .order("role")
      .order("nom")
      .then(({ data }) => {
        setSoignants((data ?? []) as Soignant[]);
        setChargement(false);
      });
  }, []);

  if (pro && pro.niveau !== 1) {
    return (
      <div className="card text-sm text-slate-500">
        L&apos;équipe soignante est réservée aux comptes de niveau 1.
      </div>
    );
  }

  async function supprimer(s: Soignant) {
    if (!confirm(`Supprimer définitivement le compte de ${s.prenom ? s.prenom + " " : ""}${s.nom} ? Cette action est irréversible.`)) {
      return;
    }
    setSuppression(s.id);
    const res = await fetch(`/api/soignants/${s.id}`, { method: "DELETE" });
    setSuppression(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message ?? "Échec de la suppression.");
      return;
    }
    setSoignants((arr) => arr.filter((x) => x.id !== s.id));
  }

  function pdf(s: Soignant) {
    genererPdfConsignes({
      titre: s.titre ?? "",
      prenom: s.prenom ?? "",
      nom: s.nom,
      specialite: s.specialite ?? "",
      telephone: s.telephone ?? "",
      cabinets: s.cabinets ?? "",
      secretariat_nom: s.secretariat_nom ?? "",
      secretariat_email: s.secretariat_email ?? "",
      secretariat_tel: s.secretariat_tel ?? "",
      protocoles: s.protocoles ?? [],
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Équipe soignante</h1>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : soignants.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun soignant.</p>
      ) : (
        <div className="grid gap-4">
          {soignants.map((s) => {
            const estChir = s.role === "chirurgien";
            const nomAffiche = [s.titre, s.prenom, s.nom].filter(Boolean).join(" ");
            return (
              <div key={s.id} className="card grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{nomAffiche}</span>
                      <span className="badge bg-rose-100 text-brand">{LIBELLE_ROLE[s.role]}</span>
                      <span className={`badge ${s.niveau === 1 ? "bg-green-100 text-ok" : "bg-amber-100 text-attention"}`}>
                        Niveau {s.niveau}
                      </span>
                    </div>
                    {s.specialite && <p className="mt-0.5 text-sm text-slate-500">{s.specialite}</p>}
                  </div>
                  {pro && pro.id !== s.id && (
                    <button
                      onClick={() => supprimer(s)}
                      disabled={suppression === s.id}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-critique hover:bg-red-50 disabled:opacity-50"
                    >
                      {suppression === s.id ? "Suppression…" : "Supprimer"}
                    </button>
                  )}
                </div>

                <div className="grid gap-1 text-sm sm:grid-cols-2">
                  {s.email && <Info label="Email" value={s.email} href={`mailto:${s.email}`} />}
                  {s.telephone && <Info label="Téléphone" value={s.telephone} href={`tel:${s.telephone}`} />}
                  {s.cabinets && <Info label="Cabinet(s)" value={s.cabinets} />}
                  {s.secretariat_nom && <Info label="Secrétariat" value={s.secretariat_nom} />}
                  {s.secretariat_tel && <Info label="Tél. secrétariat" value={s.secretariat_tel} href={`tel:${s.secretariat_tel}`} />}
                </div>

                {estChir && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-50 pt-3">
                    <span className="text-sm text-slate-500">
                      {s.protocoles?.length
                        ? `${s.protocoles.length} protocole(s) : ${s.protocoles.map((p) => p.intervention || "Sans nom").join(", ")}`
                        : "Aucun protocole enregistré"}
                    </span>
                    <button onClick={() => pdf(s)} className="btn-secondary text-sm">
                      📄 PDF des consignes
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-slate-400">{label} :</span>
      {href ? (
        <a href={href} className="font-medium text-brand hover:underline">{value}</a>
      ) : (
        <span className="font-medium text-slate-700">{value}</span>
      )}
    </div>
  );
}
