"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { genererPdfConsignes, type ProtocolePdf } from "@/lib/pdfConsignes";
import { NIVEAU_LABEL, optionsNiveau } from "@/lib/niveaux";
import { Select } from "@/components/Select";

type Soignant = {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  role: "coordinatrice" | "chirurgien" | "delegue" | "manager";
  niveau: number;
  agence_id: string | null;
  region_id: string | null;
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
  "id,nom,prenom,titre,role,niveau,agence_id,region_id,email,telephone,specialite,cabinets,secretariat_nom,secretariat_email,secretariat_tel,protocoles";

export default function EquipePage() {
  const pro = useProSession();
  const [soignants, setSoignants] = useState<Soignant[]>([]);
  const [agences, setAgences] = useState<{ value: string; label: string }[]>([]);
  const [regions, setRegions] = useState<{ value: string; label: string }[]>([]);
  const [regionNom, setRegionNom] = useState<Map<string, string>>(new Map());
  const [agenceRegion, setAgenceRegion] = useState<Map<string, string>>(new Map());
  const [chargement, setChargement] = useState(true);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [edite, setEdite] = useState<Soignant | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pros }, { data: regs }, { data: ags }] = await Promise.all([
      supabase.from("professionnel").select(COLS).order("role").order("nom"),
      supabase.from("region").select("id,nom"),
      supabase.from("agence").select("id,nom,region_id"),
    ]);
    const nomRegion = new Map((regs ?? []).map((r) => [r.id as string, r.nom as string]));
    setRegionNom(nomRegion);
    setRegions((regs ?? []).map((r) => ({ value: r.id as string, label: r.nom as string })));
    setAgences((ags ?? []).map((a) => ({ value: a.id as string, label: `${nomRegion.get(a.region_id as string) ?? "?"} · ${a.nom}` })));
    setAgenceRegion(new Map((ags ?? []).map((a) => [a.id as string, a.region_id as string])));
    setSoignants((pros ?? []) as Soignant[]);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Niveau réel du compte connecté (lu en base, pas le cache de session).
  const moi = soignants.find((s) => s.id === pro?.id);
  const niveauMoi = moi?.niveau ?? pro?.niveau ?? 3;
  const maRegion = moi?.agence_id ? agenceRegion.get(moi.agence_id) : undefined;
  const regionDe = (s: Soignant) => (s.agence_id ? agenceRegion.get(s.agence_id) : undefined);

  // Cloisonnement : qui le compte connecté a-t-il le droit de voir ?
  const visible = (s: Soignant) => {
    if (niveauMoi === 0) return true;                 // plateforme : tout
    if (s.id === moi?.id) return true;                // soi-même
    if (s.niveau === 0) return true;                  // les super-admins plateforme
    if (niveauMoi === 1) return regionDe(s) === maRegion;          // toute ma région
    if (niveauMoi === 2) {                            // mon agence + le niveau 1 de ma région
      if (s.agence_id && s.agence_id === moi?.agence_id) return true;
      if (s.niveau === 1 && regionDe(s) === maRegion) return true;
      return false;
    }
    return false;
  };
  const soignantsVisibles = soignants.filter(visible);

  const labelAgence = (id: string | null) => agences.find((a) => a.value === id)?.label ?? null;
  // Un niveau 0/1 peut modifier les comptes de niveau 2 ou 3 (sauf le sien).
  const peutModifier = (s: Soignant) => niveauMoi <= 1 && s.niveau >= 2 && pro?.id !== s.id;
  // Un niveau 0/1 peut supprimer un compte qui n'est pas plus puissant que lui.
  const peutSupprimer = (s: Soignant) => niveauMoi <= 1 && pro?.id !== s.id && s.niveau >= niveauMoi;

  if (pro && (pro.niveau > 2 || pro.role === "chirurgien")) {
    return <div className="card text-sm text-slate-500">L&apos;équipe soignante n&apos;est pas accessible à ce compte.</div>;
  }

  async function supprimer(s: Soignant) {
    if (!confirm(`Supprimer définitivement le compte de ${s.prenom ? s.prenom + " " : ""}${s.nom} ? Cette action est irréversible.`)) return;
    setSuppression(s.id);
    const res = await fetch(`/api/soignants/${s.id}`, { method: "DELETE" });
    setSuppression(null);
    if (!res.ok) { alert((await res.json().catch(() => ({}))).message ?? "Échec de la suppression."); return; }
    setSoignants((arr) => arr.filter((x) => x.id !== s.id));
  }

  function pdf(s: Soignant) {
    genererPdfConsignes({
      titre: s.titre ?? "", prenom: s.prenom ?? "", nom: s.nom, specialite: s.specialite ?? "",
      telephone: s.telephone ?? "", cabinets: s.cabinets ?? "",
      secretariat_nom: s.secretariat_nom ?? "", secretariat_email: s.secretariat_email ?? "", secretariat_tel: s.secretariat_tel ?? "",
      protocoles: s.protocoles ?? [],
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Équipe soignante</h1>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : soignantsVisibles.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun soignant dans votre périmètre.</p>
      ) : (
        <div className="grid gap-4">
          {soignantsVisibles.map((s) => {
            const estChir = s.role === "chirurgien";
            const nomAffiche = [s.titre, s.prenom, s.nom].filter(Boolean).join(" ");
            const modifiable = peutModifier(s);
            return (
              <div
                key={s.id}
                onClick={() => modifiable && setEdite(s)}
                className={`card grid gap-3 ${modifiable ? "cursor-pointer transition hover:border-rose-200 hover:shadow-md" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{nomAffiche}</span>
                      <span className="badge bg-rose-100 text-brand">{LIBELLE_ROLE[s.role]}</span>
                      <span className={`badge ${s.niveau <= 1 ? "bg-green-100 text-ok" : s.niveau === 2 ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-attention"}`}>
                        {NIVEAU_LABEL[s.niveau] ?? `Niveau ${s.niveau}`}
                      </span>
                      {(labelAgence(s.agence_id) || (s.region_id && regionNom.get(s.region_id))) && (
                        <span className="badge bg-slate-100 text-slate-600">
                          {labelAgence(s.agence_id) ?? regionNom.get(s.region_id!)}
                        </span>
                      )}
                    </div>
                    {s.specialite && <p className="mt-0.5 text-sm text-slate-500">{s.specialite}</p>}
                  </div>
                  {peutSupprimer(s) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); supprimer(s); }}
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

                {modifiable && <p className="text-xs text-brand">Cliquer pour modifier le niveau / l&apos;agence</p>}

                {estChir && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-50 pt-3" onClick={(e) => e.stopPropagation()}>
                    <span className="text-sm text-slate-500">
                      {s.protocoles?.length
                        ? `${s.protocoles.length} protocole(s) : ${s.protocoles.map((p) => p.intervention || "Sans nom").join(", ")}`
                        : "Aucun protocole enregistré"}
                    </span>
                    <button onClick={() => pdf(s)} className="btn-secondary text-sm">📄 PDF des consignes</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {edite && (
        <EditeurSoignant
          soignant={edite}
          agences={agences}
          regions={regions}
          niveauMoi={niveauMoi}
          onClose={() => setEdite(null)}
          onSaved={() => { setEdite(null); charger(); }}
        />
      )}
    </div>
  );
}

function EditeurSoignant({
  soignant, agences, regions, niveauMoi, onClose, onSaved,
}: {
  soignant: Soignant;
  agences: { value: string; label: string }[];
  regions: { value: string; label: string }[];
  niveauMoi: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [niveau, setNiveau] = useState(String(soignant.niveau));
  const [agenceId, setAgenceId] = useState(soignant.agence_id ?? "");
  const [regionId, setRegionId] = useState(soignant.region_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nomAffiche = [soignant.titre, soignant.prenom, soignant.nom].filter(Boolean).join(" ");

  async function sauver() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/soignants/${soignant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        niveau: Number(niveau),
        agence_id: (niveau === "2" || niveau === "3") ? (agenceId || null) : null,
        region_id: niveau === "1" ? (regionId || null) : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setErr(j?.message ?? `Échec (HTTP ${res.status}).`);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-md grid gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-700">{nomAffiche}</h2>

        <div>
          <label className="label">Niveau d&apos;accès</label>
          <Select value={niveau} onChange={setNiveau} options={optionsNiveau(niveauMoi)} />
        </div>

        {niveau === "1" && (
          <div>
            <label className="label">Région de rattachement</label>
            <Select
              value={regionId}
              onChange={setRegionId}
              placeholder={regions.length ? "— Choisir une région —" : "Aucune région créée"}
              options={regions}
            />
          </div>
        )}
        {(niveau === "2" || niveau === "3") && (
          <div>
            <label className="label">Agence de rattachement</label>
            <Select
              value={agenceId}
              onChange={setAgenceId}
              placeholder={agences.length ? "— Choisir une agence —" : "Aucune agence créée"}
              options={agences}
            />
          </div>
        )}

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={busy}>Annuler</button>
          <button onClick={sauver} className="btn-primary flex-1" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-slate-400">{label} :</span>
      {href ? (
        <a href={href} onClick={(e) => e.stopPropagation()} className="font-medium text-brand hover:underline">{value}</a>
      ) : (
        <span className="font-medium text-slate-700">{value}</span>
      )}
    </div>
  );
}
