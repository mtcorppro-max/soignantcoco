"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { TYPES_ORDO_PHARMACIE, clePharmaVu } from "@/lib/ordonnances";
import { genererPdfOrdo, type OrdoPdf } from "@/lib/genererPdfOrdo";

type PatientPharma = {
  id: string;
  nom: string;
  date_naissance: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  proche_nom: string | null;
  proche_tel: string | null;
  operation: string | null;
  date_operation: string | null;
  chirurgien: string | null;
  traitement: string | null;
  pharmacie: string | null;
  pharmacie_tel: string | null;
  infirmiere_nom: string | null;
  infirmiere_tel: string | null;
  duree_prise_en_charge: number | null;
  statut: string;
};

type Ordo = OrdoPdf & { id: string; patient_id: string };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

export default function PharmaciePage() {
  const pro = useProSession();
  const [patients, setPatients] = useState<PatientPharma[]>([]);
  const [ordos, setOrdos] = useState<Ordo[]>([]);
  const [pret, setPret] = useState(false);
  const [vuLe, setVuLe] = useState(0); // repère epoch lu à l'ouverture (pour marquer « Nouveau »)

  const estPharmacie = pro?.role === "pharmacie";

  const charger = useCallback(async () => {
    if (!pro?.id || !estPharmacie) return;
    const supabase = createClient();
    const { data: pts } = await supabase
      .from("patient")
      .select("id,nom,date_naissance,telephone,email,adresse,code_postal,ville,proche_nom,proche_tel,operation,date_operation,chirurgien,traitement,pharmacie,pharmacie_tel,infirmiere_nom,infirmiere_tel,duree_prise_en_charge,statut")
      .order("nom");
    const liste = (pts ?? []) as PatientPharma[];
    setPatients(liste);
    const ids = liste.map((p) => p.id);
    if (ids.length) {
      const { data: ords } = await supabase
        .from("ordonnance")
        .select("id,patient_id,type,titre,contenu,statut,signature,signataire_nom,signee_le,created_at,destinataire:destinataire_id(nom,prenom,titre,rpps,cabinets)")
        .in("patient_id", ids)
        .in("type", TYPES_ORDO_PHARMACIE as readonly string[])
        .eq("statut", "signee")
        .order("created_at", { ascending: false });
      setOrdos((ords ?? []) as unknown as Ordo[]);
    } else {
      setOrdos([]);
    }
    setPret(true);
  }, [pro?.id, estPharmacie]);

  useEffect(() => { charger(); }, [charger]);

  // Lit le repère « vu le » à l'ouverture (pour marquer les nouvelles ordonnances).
  useEffect(() => {
    if (!estPharmacie || !pro?.id) return;
    let v = 0;
    try { v = Number(localStorage.getItem(clePharmaVu(pro.id))) || 0; } catch { /* */ }
    setVuLe(v);
  }, [estPharmacie, pro?.id]);

  // Une fois le contenu chargé, marque tout comme vu (efface le badge).
  useEffect(() => {
    if (!estPharmacie || !pro?.id || !pret) return;
    try { localStorage.setItem(clePharmaVu(pro.id), String(Date.now())); } catch { /* */ }
  }, [estPharmacie, pro?.id, pret]);

  const estNouvelle = (o: Ordo) => !!o.signee_le && new Date(o.signee_le).getTime() > vuLe;

  async function voir(o: Ordo, patientNom: string, naissance: string | null) {
    const win = window.open("", "_blank");
    try {
      const url = await genererPdfOrdo(o, patientNom, naissance, "bloburl");
      if (typeof url === "string") { if (win) win.location.href = url; else window.open(url, "_blank"); }
      else if (win) win.close();
    } catch (e) {
      if (win) win.close();
      alert("Impossible d'ouvrir le PDF.\n" + (e instanceof Error ? e.message : ""));
    }
  }
  async function telecharger(o: Ordo, patientNom: string, naissance: string | null) {
    try { await genererPdfOrdo(o, patientNom, naissance, "download"); }
    catch (e) { alert("Impossible de générer le PDF.\n" + (e instanceof Error ? e.message : "")); }
  }

  if (pro && !estPharmacie) {
    return <div className="card text-sm text-slate-500">Cet espace est réservé aux comptes pharmacie.</div>;
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mes patients</h1>
        <p className="mt-1 text-sm text-slate-500">
          Patients qui vous sont rattachés. Les ordonnances pharmacie signées par le médecin apparaissent automatiquement.
        </p>
      </div>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : patients.length === 0 ? (
        <p className="card text-sm text-slate-400">Aucun patient rattaché pour le moment.</p>
      ) : (
        patients.map((p) => {
          const ordsP = ordos.filter((o) => o.patient_id === p.id);
          const ville = [p.code_postal, p.ville].filter(Boolean).join(" ");
          const duree = p.duree_prise_en_charge ? `${p.duree_prise_en_charge} jours` : "";
          return (
            <section key={p.id} className="card grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">{p.nom}</h2>
                {p.statut !== "active" && <span className="badge bg-slate-100 text-slate-500">{p.statut === "terminee" ? "Terminé" : "Suspendu"}</span>}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Bloc titre="Coordonnées">
                  <Ligne label="Naissance" value={formatDate(p.date_naissance)} />
                  <Ligne label="Téléphone" value={p.telephone} href={p.telephone ? `tel:${p.telephone}` : undefined} />
                  <Ligne label="Email" value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
                  <Ligne label="Adresse" value={p.adresse} />
                  <Ligne label="Ville" value={ville} />
                  <Ligne label="Proche" value={p.proche_nom} extra={p.proche_tel} href={p.proche_tel ? `tel:${p.proche_tel}` : undefined} />
                </Bloc>
                <Bloc titre="Environnement de soins">
                  {p.operation && <Ligne label="Opération" value={p.operation} extra={formatDate(p.date_operation)} />}
                  <Ligne label="Prise en charge" value={duree} />
                  <Ligne label="Type de traitement" value={p.traitement} />
                  <Ligne label={p.operation ? "Chirurgien" : "Médecin"} value={p.chirurgien} />
                  <Ligne label="Pharmacie" value={p.pharmacie} extra={p.pharmacie_tel} href={p.pharmacie_tel ? `tel:${p.pharmacie_tel}` : undefined} />
                  <Ligne label="Infirmière libérale" value={p.infirmiere_nom} extra={p.infirmiere_tel} href={p.infirmiere_tel ? `tel:${p.infirmiere_tel}` : undefined} />
                </Bloc>
              </div>

              <div className="grid gap-2 border-t border-rose-100 pt-3">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Ordonnances pharmacie</p>
                {ordsP.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune ordonnance pharmacie signée pour ce patient.</p>
                ) : (
                  ordsP.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-100 px-3 py-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{o.titre}</span>
                          <span className="badge bg-green-100 text-ok">Signée</span>
                          {estNouvelle(o) && <span className="badge bg-brand text-white">Nouveau</span>}
                        </div>
                        <p className="text-xs text-slate-400">
                          {o.signee_le ? `Signée le ${new Date(o.signee_le).toLocaleDateString("fr-FR")}` : new Date(o.created_at).toLocaleDateString("fr-FR")}
                          {o.signataire_nom ? ` · ${o.signataire_nom}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => voir(o, p.nom, p.date_naissance)} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Voir
                        </button>
                        <button onClick={() => telecharger(o, p.nom, p.date_naissance)} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                          </svg>
                          PDF
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">{titre}</p>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}

function Ligne({ label, value, extra, href }: { label: string; value: string | null; extra?: string | null; href?: string }) {
  if (!value && !extra) return null;
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">
        {href ? <a href={href} className="text-brand hover:underline">{value || extra}</a> : value}
        {extra && value && <span className="text-slate-400"> · {extra}</span>}
      </span>
    </div>
  );
}
