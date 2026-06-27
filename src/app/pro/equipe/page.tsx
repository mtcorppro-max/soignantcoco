"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";
import { genererPdfConsignes, type ProtocolePdf } from "@/lib/pdfConsignes";
import { NIVEAU_LABEL, optionsNiveau } from "@/lib/niveaux";
import { Select } from "@/components/Select";
import { ProtocoleEditor, protocoleVide, protocolePropre, protocoleDepuis, type Protocole } from "@/components/protocole";

type Soignant = {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  role: "coordinatrice" | "chirurgien" | "delegue" | "manager" | "infirmiere_liberale";
  niveau: number;
  agence_id: string | null;
  region_id: string | null;
  email: string | null;
  telephone: string | null;
  specialite: string | null;
  rpps: string | null;
  cabinets: string | null;
  secretariat_nom: string | null;
  secretariat_email: string | null;
  secretariat_tel: string | null;
  protocoles: ProtocolePdf[] | null;
};

const COLS =
  "id,nom,prenom,titre,role,niveau,agence_id,region_id,email,telephone,specialite,rpps,cabinets,secretariat_nom,secretariat_email,secretariat_tel,protocoles";

// Soignant externe (sans compte) — cf. migrations 0040 / 0041 / 0042.
type Externe = {
  id: string;
  type: "medecin" | "infirmiere";
  titre: string | null;
  prenom: string | null;
  nom: string;
  specialite: string | null;
  rpps: string | null;
  telephone: string | null;
  email: string | null;
  zone_exercice: string | null;
  cabinets: string | null;
  secretariat_nom: string | null;
  secretariat_tel: string | null;
  protocoles: ProtocolePdf[] | null;
};
const COLS_EXT =
  "id,type,titre,prenom,nom,specialite,rpps,telephone,email,zone_exercice,cabinets,secretariat_nom,secretariat_tel,protocoles";

const ROLES_INTERNES = ["coordinatrice", "manager", "delegue"] as const;

// Libellé médecin/chirurgien selon la spécialité.
const labelMedecin = (specialite: string | null) =>
  (specialite ?? "").toLowerCase().includes("chirurg") ? "Chirurgien" : "Médecin";

// Petit badge « Compte » (rose foncé) : la personne dispose d'un compte AS2CŒUR.
function BadgeCompte() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white" title="Dispose d'un compte AS2CŒUR">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

export default function EquipePage() {
  const pro = useProSession();
  const [vue, setVue] = useState<"internes" | "externes">("internes");
  const [soignants, setSoignants] = useState<Soignant[]>([]);
  const [externes, setExternes] = useState<Externe[]>([]);
  const [agences, setAgences] = useState<{ value: string; label: string }[]>([]);
  const [regions, setRegions] = useState<{ value: string; label: string }[]>([]);
  const [regionNom, setRegionNom] = useState<Map<string, string>>(new Map());
  const [agenceRegion, setAgenceRegion] = useState<Map<string, string>>(new Map());
  const [chargement, setChargement] = useState(true);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [edite, setEdite] = useState<Soignant | null>(null);
  const [editeExt, setEditeExt] = useState<Externe | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pros }, { data: regs }, { data: ags }, { data: exts }] = await Promise.all([
      supabase.from("professionnel").select(COLS).order("role").order("nom"),
      supabase.from("region").select("id,nom"),
      supabase.from("agence").select("id,nom,region_id"),
      supabase.from("soignant_externe").select(COLS_EXT).order("nom"),
    ]);
    setExternes((exts ?? []) as Externe[]);
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
  // Région d'un compte : sa région directe (managers) sinon celle de son agence.
  const regionDe = (s: { region_id: string | null; agence_id: string | null }) =>
    s.region_id ?? (s.agence_id ? agenceRegion.get(s.agence_id) : undefined);
  const maRegion = moi ? regionDe(moi) : undefined;

  // Cloisonnement : qui le compte connecté a-t-il le droit de voir ?
  const visible = (s: Soignant) => {
    if (s.id === moi?.id) return true;                // soi-même (toujours)
    if (s.niveau === 0) return false;                 // les niveau 0 sont invisibles pour tous
    if (niveauMoi === 0) return true;                 // plateforme : voit tout le reste
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
  // Édition du profil (coordonnées) : niveau 0/1/2. (Le niveau/agence reste géré dans l'éditeur, réservé 0/1.)
  const peutModifier = (s: Soignant) => niveauMoi <= 2 && pro?.id !== s.id;
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
      titre: s.titre ?? "", prenom: s.prenom ?? "", nom: s.nom, specialite: s.specialite ?? "", rpps: s.rpps ?? "",
      telephone: s.telephone ?? "", cabinets: s.cabinets ?? "",
      secretariat_nom: s.secretariat_nom ?? "", secretariat_email: s.secretariat_email ?? "", secretariat_tel: s.secretariat_tel ?? "",
      protocoles: s.protocoles ?? [],
    });
  }

  // ── Soignants externes (sans compte) ──
  const peutGererExterne = niveauMoi <= 1;          // suppression
  const peutEditerExterne = niveauMoi <= 2;         // édition du profil
  async function supprimerExterne(e: Externe) {
    if (!confirm(`Supprimer le soignant externe ${[e.prenom, e.nom].filter(Boolean).join(" ")} ?`)) return;
    setSuppression(e.id);
    const { error } = await createClient().from("soignant_externe").delete().eq("id", e.id);
    setSuppression(null);
    if (error) { alert("Échec de la suppression : " + error.message); return; }
    setExternes((arr) => arr.filter((x) => x.id !== e.id));
  }
  function pdfExterne(e: Externe) {
    genererPdfConsignes({
      titre: e.titre ?? "", prenom: e.prenom ?? "", nom: e.nom, specialite: e.specialite ?? "", rpps: e.rpps ?? "",
      telephone: e.telephone ?? "", cabinets: e.cabinets ?? "",
      secretariat_nom: e.secretariat_nom ?? "", secretariat_email: "", secretariat_tel: e.secretariat_tel ?? "",
      protocoles: e.protocoles ?? [],
    });
  }
  const carteExterne = (e: Externe) => {
    const nomAffiche = [e.titre, e.prenom, e.nom].filter(Boolean).join(" ");
    const estMed = e.type === "medecin";
    return (
      <div
        key={e.id}
        onClick={() => peutEditerExterne && setEditeExt(e)}
        className={`card grid gap-3 ${peutEditerExterne ? "cursor-pointer transition hover:border-rose-200 hover:shadow-md" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">{nomAffiche}</span>
              <span className="badge bg-rose-100 text-brand">{estMed ? labelMedecin(e.specialite) : "Infirmière libérale"}</span>
            </div>
            {estMed && e.specialite && <p className="mt-0.5 text-sm text-slate-500">{e.specialite}</p>}
            {!estMed && e.zone_exercice && <p className="mt-0.5 text-sm text-slate-500">{e.zone_exercice}</p>}
          </div>
          {peutGererExterne && (
            <button
              onClick={(ev) => { ev.stopPropagation(); supprimerExterne(e); }}
              disabled={suppression === e.id}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-critique hover:bg-red-50 disabled:opacity-50"
            >
              {suppression === e.id ? "Suppression…" : "Supprimer"}
            </button>
          )}
        </div>
        <div className="grid gap-1 text-sm sm:grid-cols-2">
          {e.email && <Info label="Email" value={e.email} href={`mailto:${e.email}`} />}
          {e.telephone && <Info label="Téléphone" value={e.telephone} href={`tel:${e.telephone}`} />}
          {e.cabinets && <Info label="Lieu d'exercice" value={e.cabinets} />}
          {e.secretariat_nom && <Info label="Secrétariat" value={e.secretariat_nom} />}
          {e.secretariat_tel && <Info label="Tél. secrétariat" value={e.secretariat_tel} href={`tel:${e.secretariat_tel}`} />}
        </div>
        {estMed && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-50 pt-3">
            <span className="text-sm text-slate-500">
              {e.protocoles?.length
                ? `${e.protocoles.length} protocole(s) : ${e.protocoles.map((p) => p.intervention || "Sans nom").join(", ")}`
                : "Aucun protocole enregistré"}
            </span>
            <button onClick={(ev) => { ev.stopPropagation(); pdfExterne(e); }} className="btn-secondary text-sm">📄 PDF des consignes</button>
          </div>
        )}
      </div>
    );
  };

  const carte = (s: Soignant, montrerCompte = false) => {
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
              <span className="badge bg-rose-100 text-brand">{estChir ? labelMedecin(s.specialite) : LIBELLE_ROLE[s.role]}</span>
              {montrerCompte ? (
                <BadgeCompte />
              ) : niveauMoi <= 1 ? (
                <span className={`badge ${s.niveau <= 1 ? "bg-green-100 text-ok" : s.niveau === 2 ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-attention"}`}>
                  {NIVEAU_LABEL[s.niveau] ?? `Niveau ${s.niveau}`}
                </span>
              ) : null}
              {s.region_id && regionNom.get(s.region_id) && (
                <span className="badge bg-slate-100 text-slate-600">{regionNom.get(s.region_id)}</span>
              )}
            </div>
            {s.specialite && <p className="mt-0.5 text-sm text-slate-500">{s.specialite}</p>}
          </div>
          <div className="flex items-center gap-2">
            {s.id !== pro?.id && (
              <Link
                href={`/pro/messagerie?to=${s.id}`}
                onClick={(e) => e.stopPropagation()}
                title="Envoyer un message"
                className="rounded-lg border border-rose-200 p-2 text-brand transition hover:bg-rose-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
                </svg>
              </Link>
            )}
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
        </div>

        <div className="grid gap-1 text-sm sm:grid-cols-2">
          {s.email && <Info label="Email" value={s.email} href={`mailto:${s.email}`} />}
          {s.telephone && <Info label="Téléphone" value={s.telephone} href={`tel:${s.telephone}`} />}
          {s.cabinets && <Info label="Cabinet(s)" value={s.cabinets} />}
          {s.secretariat_nom && <Info label="Secrétariat" value={s.secretariat_nom} />}
          {s.secretariat_tel && <Info label="Tél. secrétariat" value={s.secretariat_tel} href={`tel:${s.secretariat_tel}`} />}
        </div>

        {modifiable && <p className="text-xs text-brand">Cliquer pour modifier le profil</p>}

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
  };

  // ── INTERNES : délégué médical, manager, coordinatrice (groupés par agence) ──
  const internes = soignantsVisibles.filter((s) => (ROLES_INTERNES as readonly string[]).includes(s.role));
  const parAgence = new Map<string, Soignant[]>();
  const encadrement: Soignant[] = [];
  internes.forEach((s) => {
    if (s.agence_id) {
      const arr = parAgence.get(s.agence_id) ?? [];
      arr.push(s);
      parAgence.set(s.agence_id, arr);
    } else encadrement.push(s);
  });
  const groupesAgence = [...parAgence.entries()]
    .map(([id, items]) => ({ titre: labelAgence(id) ?? "Agence", items }))
    .sort((a, b) => a.titre.localeCompare(b.titre));

  // ── EXTERNES : médecins/chirurgiens & infirmières libérales (comptes + sans compte) ──
  // Ressources transverses aux agences : pas de cloisonnement par agence ici.
  const medecinsComptes = soignants.filter((s) => s.role === "chirurgien");
  const infirmieresComptes = soignants.filter((s) => s.role === "infirmiere_liberale");
  const externesMed = externes.filter((e) => e.type === "medecin");
  const externesInf = externes.filter((e) => e.type === "infirmiere");
  const aucunExterne = medecinsComptes.length + infirmieresComptes.length + externes.length === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-800">Équipe soignante</h1>

      {/* Sélecteur Internes / Externes */}
      <div className="mb-6 inline-flex rounded-xl border border-rose-200 bg-white p-1">
        {([["internes", "Interne à l'entreprise"], ["externes", "Externe à l'entreprise"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setVue(v)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${vue === v ? "bg-brand text-white" : "text-slate-600 hover:text-brand"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : vue === "internes" ? (
        internes.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun soignant interne dans votre périmètre.</p>
        ) : (
          <div className="grid gap-7">
            {encadrement.length > 0 && (
              <section className="grid gap-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Encadrement (région / plateforme)</h2>
                {encadrement.map((s) => carte(s))}
              </section>
            )}
            {groupesAgence.map((g) => (
              <section key={g.titre} className="grid gap-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">{g.titre}</h2>
                {g.items.map((s) => carte(s))}
              </section>
            ))}
          </div>
        )
      ) : aucunExterne ? (
        <p className="text-sm text-slate-400">Aucun soignant externe enregistré.</p>
      ) : (
        <div className="grid gap-7">
          <section className="grid gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Médecins / Chirurgiens</h2>
            {medecinsComptes.length + externesMed.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun médecin / chirurgien.</p>
            ) : (
              <>
                {medecinsComptes.map((s) => carte(s, true))}
                {externesMed.map(carteExterne)}
              </>
            )}
          </section>
          <section className="grid gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400">Infirmières libérales</h2>
            {infirmieresComptes.length + externesInf.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune infirmière libérale.</p>
            ) : (
              <>
                {infirmieresComptes.map((s) => carte(s, true))}
                {externesInf.map(carteExterne)}
              </>
            )}
          </section>
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

      {editeExt && (
        <EditeurExterne
          externe={editeExt}
          onClose={() => setEditeExt(null)}
          onSaved={() => { setEditeExt(null); charger(); }}
        />
      )}
    </div>
  );
}

function EditeurExterne({ externe, onClose, onSaved }: { externe: Externe; onClose: () => void; onSaved: () => void }) {
  const estMed = externe.type === "medecin";
  const [f, setF] = useState({
    titre: externe.titre ?? "", prenom: externe.prenom ?? "", nom: externe.nom,
    specialite: externe.specialite ?? "", rpps: externe.rpps ?? "",
    telephone: externe.telephone ?? "", email: externe.email ?? "",
    cabinets: externe.cabinets ?? "", secretariat_nom: externe.secretariat_nom ?? "", secretariat_tel: externe.secretariat_tel ?? "",
    zone_exercice: externe.zone_exercice ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [protocoles, setProtocoles] = useState<Protocole[]>(() => (externe.protocoles ?? []).map((p) => protocoleDepuis(p as unknown as Record<string, unknown>)));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const majProto = (i: number, patch: Partial<Protocole>) => setProtocoles((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const t = (v: string) => (v.trim() ? v.trim() : null);

  async function sauver() {
    if (!f.nom.trim()) { setErr("Le nom est requis."); return; }
    setBusy(true); setErr(null);
    const maj = estMed
      ? { titre: t(f.titre), prenom: t(f.prenom), nom: f.nom.trim(), specialite: t(f.specialite), rpps: t(f.rpps), telephone: t(f.telephone), email: t(f.email), cabinets: t(f.cabinets), secretariat_nom: t(f.secretariat_nom), secretariat_tel: t(f.secretariat_tel), protocoles: protocoles.map(protocolePropre) }
      : { prenom: t(f.prenom), nom: f.nom.trim(), telephone: t(f.telephone), email: t(f.email), zone_exercice: t(f.zone_exercice) };
    const { error } = await createClient().from("soignant_externe").update(maj).eq("id", externe.id);
    setBusy(false);
    if (error) { setErr("Échec : " + error.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4 pt-12" onClick={onClose}>
      <div className="card grid w-full max-w-2xl gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-700">Soignant externe</h2>
        {estMed && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Spécialité</label><input className="input" value={f.specialite} onChange={set("specialite")} /></div>
            <div><label className="label">N° RPPS</label><input className="input" value={f.rpps} onChange={set("rpps")} inputMode="numeric" /></div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Prénom</label><input className="input" value={f.prenom} onChange={set("prenom")} /></div>
          <div><label className="label">Nom *</label><input className="input" value={f.nom} onChange={set("nom")} /></div>
        </div>
        {!estMed && (
          <div><label className="label">Zone(s) d&apos;exercice</label><input className="input" value={f.zone_exercice} onChange={set("zone_exercice")} /></div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Téléphone</label><input className="input" value={f.telephone} onChange={set("telephone")} inputMode="tel" /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={set("email")} inputMode="email" /></div>
        </div>
        {estMed && (
          <>
            <div><label className="label">Lieu d&apos;exercice</label><input className="input" value={f.cabinets} onChange={set("cabinets")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Secrétariat</label><input className="input" value={f.secretariat_nom} onChange={set("secretariat_nom")} /></div>
              <div><label className="label">Tél. secr.</label><input className="input" value={f.secretariat_tel} onChange={set("secretariat_tel")} inputMode="tel" /></div>
            </div>

            <div className="grid gap-3 border-t border-rose-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Protocoles</p>
                <span className="text-xs text-slate-400">{protocoles.length}</span>
              </div>
              {protocoles.map((p, i) => (
                <ProtocoleEditor key={i} index={i} value={p} onChange={(patch) => majProto(i, patch)} onRemove={() => setProtocoles((arr) => arr.filter((_, idx) => idx !== i))} canRemove />
              ))}
              <button type="button" onClick={() => setProtocoles((arr) => [...arr, protocoleVide()])} className="justify-self-start rounded-lg border border-dashed border-rose-300 px-4 py-2 text-sm font-semibold text-brand hover:bg-rose-50">
                + Ajouter un protocole
              </button>
            </div>
          </>
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
  const [f, setF] = useState({
    telephone: soignant.telephone ?? "", email: soignant.email ?? "",
    rpps: soignant.rpps ?? "", specialite: soignant.specialite ?? "", cabinets: soignant.cabinets ?? "",
    secretariat_nom: soignant.secretariat_nom ?? "", secretariat_email: soignant.secretariat_email ?? "", secretariat_tel: soignant.secretariat_tel ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [protocoles, setProtocoles] = useState<Protocole[]>(() => (soignant.protocoles ?? []).map((p) => protocoleDepuis(p as unknown as Record<string, unknown>)));
  const nomAffiche = [soignant.titre, soignant.prenom, soignant.nom].filter(Boolean).join(" ");
  const estChir = soignant.role === "chirurgien";
  const peutAcces = niveauMoi <= 1 && soignant.niveau >= 2;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const majProto = (i: number, patch: Partial<Protocole>) => setProtocoles((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  async function sauver() {
    setBusy(true); setErr(null);
    const body: Record<string, unknown> = {
      telephone: f.telephone, email: f.email,
      ...(estChir ? { rpps: f.rpps, specialite: f.specialite, cabinets: f.cabinets, secretariat_nom: f.secretariat_nom, secretariat_email: f.secretariat_email, secretariat_tel: f.secretariat_tel, protocoles: protocoles.map(protocolePropre) } : {}),
      ...(peutAcces ? { niveau: Number(niveau), agence_id: (niveau === "2" || niveau === "3") ? (agenceId || null) : null, region_id: niveau === "1" ? (regionId || null) : null } : {}),
    };
    const res = await fetch(`/api/soignants/${soignant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => null); setErr(j?.message ?? `Échec (HTTP ${res.status}).`); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4 pt-12" onClick={onClose}>
      <div className="card grid w-full max-w-2xl gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-700">{nomAffiche}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Téléphone</label><input className="input" value={f.telephone} onChange={set("telephone")} inputMode="tel" /></div>
          <div><label className="label">Email</label><input className="input" value={f.email} onChange={set("email")} inputMode="email" /></div>
        </div>

        {estChir && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Spécialité</label><input className="input" value={f.specialite} onChange={set("specialite")} /></div>
              <div><label className="label">N° RPPS</label><input className="input" value={f.rpps} onChange={set("rpps")} inputMode="numeric" /></div>
            </div>
            <div><label className="label">Lieu d&apos;exercice</label><input className="input" value={f.cabinets} onChange={set("cabinets")} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label">Secrétariat</label><input className="input" value={f.secretariat_nom} onChange={set("secretariat_nom")} /></div>
              <div><label className="label">Email secr.</label><input className="input" value={f.secretariat_email} onChange={set("secretariat_email")} inputMode="email" /></div>
              <div><label className="label">Tél. secr.</label><input className="input" value={f.secretariat_tel} onChange={set("secretariat_tel")} inputMode="tel" /></div>
            </div>

            <div className="grid gap-3 border-t border-rose-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Protocoles</p>
                <span className="text-xs text-slate-400">{protocoles.length}</span>
              </div>
              {protocoles.map((p, i) => (
                <ProtocoleEditor key={i} index={i} value={p} onChange={(patch) => majProto(i, patch)} onRemove={() => setProtocoles((arr) => arr.filter((_, idx) => idx !== i))} canRemove />
              ))}
              <button type="button" onClick={() => setProtocoles((arr) => [...arr, protocoleVide()])} className="justify-self-start rounded-lg border border-dashed border-rose-300 px-4 py-2 text-sm font-semibold text-brand hover:bg-rose-50">
                + Ajouter un protocole
              </button>
            </div>
          </>
        )}

        {peutAcces && (
          <div className="grid gap-4 border-t border-rose-100 pt-4">
            <div>
              <label className="label">Niveau d&apos;accès</label>
              <Select value={niveau} onChange={setNiveau} options={optionsNiveau(niveauMoi)} />
            </div>
            {niveau === "1" && (
              <div>
                <label className="label">Région de rattachement</label>
                <Select value={regionId} onChange={setRegionId} placeholder={regions.length ? "— Choisir une région —" : "Aucune région créée"} options={regions} />
              </div>
            )}
            {(niveau === "2" || niveau === "3") && (
              <div>
                <label className="label">Agence de rattachement</label>
                <Select value={agenceId} onChange={setAgenceId} placeholder={agences.length ? "— Choisir une agence —" : "Aucune agence créée"} options={agences} />
              </div>
            )}
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
