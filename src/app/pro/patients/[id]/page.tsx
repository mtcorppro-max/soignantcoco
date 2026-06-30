"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { useData } from "@/lib/hooks/useData";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { SeuilEditor } from "@/components/SeuilEditor";
import { ChatBox } from "@/components/ChatBox";
import { InfosPatient } from "@/components/InfosPatient";
import { LivraisonPatient } from "@/components/LivraisonPatient";
import { EquipementsPatient } from "@/components/EquipementsPatient";
import { OrdonnancesPatient } from "@/components/OrdonnancesPatient";
import { FacturationPatient } from "@/components/FacturationPatient";
import { StatutPatient } from "@/components/StatutPatient";
import { MarquerVisite } from "@/components/MarquerVisite";
import { AlertesPatient } from "@/components/AlertesPatient";
import { SuiviPatient } from "@/components/SuiviPatient";
import { SaisieMesure } from "@/components/SaisieMesure";
import type { Mesure, Seuil, Photo, Message, Patient } from "@/lib/types";

// ── Fetchers (navigateur → Supabase, sans round-trip serveur) ───────

async function fetchPatient(id: string): Promise<{ patient: Patient | null }> {
  const supabase = createClient();
  const { data } = await supabase.from("patient").select("*").eq("id", id).maybeSingle();
  return { patient: (data as Patient) ?? null };
}

async function fetchCourbes(id: string): Promise<{ mesures: Mesure[]; seuilParType: Map<string, Seuil> }> {
  const supabase = createClient();
  const [{ data: mesures }, { data: seuils }] = await Promise.all([
    supabase
      .from("mesure")
      .select("id,patient_id,type,valeur,horodatage")
      .eq("patient_id", id)
      .order("horodatage", { ascending: false })
      .limit(150),
    supabase
      .from("seuil")
      .select("id,patient_id,type_mesure,valeur_min,valeur_max,actif")
      .eq("patient_id", id)
      .eq("actif", true),
  ]);
  const seuilParType = new Map<string, Seuil>();
  (seuils ?? []).forEach((s) => seuilParType.set(s.type_mesure, s as Seuil));
  return { mesures: (mesures ?? []) as Mesure[], seuilParType };
}

async function fetchMessages(id: string): Promise<Message[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("message")
    .select("id,patient_id,auteur_user_id,contenu,horodatage")
    .eq("patient_id", id)
    .order("horodatage", { ascending: true })
    .limit(100);
  return (data ?? []) as Message[];
}

async function fetchPhotos(id: string): Promise<{ photos: Photo[]; urls: Record<string, string> }> {
  const supabase = createClient();
  const { data } = await supabase
    .from("photo")
    .select("id,patient_id,chemin_stockage,legende,horodatage")
    .eq("patient_id", id)
    .order("horodatage", { ascending: false })
    .limit(50);
  const photos = (data ?? []) as Photo[];
  let urls: Record<string, string> = {};
  if (photos.length > 0) {
    const res = await fetch("/api/signed-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chemins: photos.map((p) => p.chemin_stockage) }),
    });
    urls = (await res.json().catch(() => ({ urls: {} }))).urls ?? {};
  }
  return { photos, urls };
}

// ── Page ────────────────────────────────────────────────────────────

export default function FichePatient() {
  const params = useParams();
  const id = String(params.id);
  const pro = useProSession();

  const [reloadMesures, setReloadMesures] = useState(0);
  const patientData = useData(`pro:patient:${id}`, () => fetchPatient(id), [id]);
  const courbes = useData(`pro:patient-courbes:${id}`, () => fetchCourbes(id), [id, reloadMesures]);
  const messages = useData<Message[]>(`pro:patient-chat:${id}`, () => fetchMessages(id), [id]);
  const photos = useData(`pro:patient-photos:${id}`, () => fetchPhotos(id), [id]);

  const modifiableSeuils = pro?.role === "coordinatrice";
  const modifiableInfos = true;
  // Saisie des constantes : réservée à l'infirmière libérale (et au patient, côté patient).
  // La coordinatrice ne saisit pas de constantes.
  const peutSaisirMesure = pro?.role === "infirmiere_liberale";
  // Rubriques en onglets (boutons en haut) : suivis / ordonnances / livraisons / facturation.
  const [onglet, setOnglet] = useState<"suivis" | "ordonnances" | "livraisons" | "facturation" | "messagerie" | null>(null);
  const peutFacturation = !!pro && (pro.niveau <= 1 || ["dirigeant", "coordinatrice"].includes(pro.role));
  const peutStatut = !!pro && (pro.niveau <= 1 || pro.role === "coordinatrice");

  // Dernières valeurs par type
  const dernieres = new Map<string, number>();
  (courbes?.mesures ?? []).forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, Number(m.valeur));
  });

  // En cours de chargement
  if (!patientData) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-rose-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  const patient = patientData.patient;

  // Chargé mais patient inexistant
  if (!patient) {
    return (
      <div className="grid gap-4">
        <Link href="/pro" className="text-sm text-slate-400 hover:text-brand" prefetch>
          ← Tableau de bord
        </Link>
        <p className="card p-6 text-center text-slate-500">Patient introuvable.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0">
      {/* ── En-tête : nom + icônes de rubriques + statut ── */}
      <div className="grid gap-2">
        <Link href="/pro" className="text-sm text-slate-400 hover:text-brand" prefetch>
          ← Tableau de bord
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold text-slate-800">{patient.nom}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <OngletBtn label="Suivis" icon={<ICal />} actif={onglet === "suivis"} onClick={() => setOnglet((o) => (o === "suivis" ? null : "suivis"))} />
            <OngletBtn label="Ordonnances" icon={<IDoc />} actif={onglet === "ordonnances"} onClick={() => setOnglet((o) => (o === "ordonnances" ? null : "ordonnances"))} />
            <OngletBtn label="Livraison" icon={<ITruck />} actif={onglet === "livraisons"} onClick={() => setOnglet((o) => (o === "livraisons" ? null : "livraisons"))} />
            <OngletBtn label="Messagerie" icon={<IChat />} actif={onglet === "messagerie"} onClick={() => setOnglet((o) => (o === "messagerie" ? null : "messagerie"))} />
            {peutFacturation && <OngletBtn label="Facturation" icon={<IEuro />} actif={onglet === "facturation"} onClick={() => setOnglet((o) => (o === "facturation" ? null : "facturation"))} />}
          </div>
          <div className="ml-auto"><StatutPatient patientId={patient.id} statut={patient.statut} modifiable={peutStatut} /></div>
        </div>
        <p className="text-sm text-slate-500">
          Code : <span className="font-mono font-semibold">{patient.code_unique}</span>
          {patient.code_postal ? ` · ${patient.code_postal}` : ""}
        </p>
      </div>

      {/* ── Panneau de la rubrique ouverte ── */}
      {onglet === "suivis" && (
        <SuiviPatient
          patient={patient}
          constantes={{
            ta:
              dernieres.has("ta_systolique") || dernieres.has("ta_diastolique")
                ? `${dernieres.get("ta_systolique") ?? "—"}/${dernieres.get("ta_diastolique") ?? "—"}`
                : "",
            pouls: dernieres.get("bpm")?.toString() ?? "",
            temperature: dernieres.get("temperature")?.toString() ?? "",
            spo2: dernieres.get("spo2")?.toString() ?? "",
          }}
        />
      )}
      {onglet === "ordonnances" && <OrdonnancesPatient patientId={patient.id} patientNom={patient.nom} patientNaissance={patient.date_naissance} patientChirurgien={patient.chirurgien} />}
      {onglet === "livraisons" && (
        <>
          <LivraisonPatient patientId={patient.id} prestataireId={patient.prestataire_id} />
          <EquipementsPatient patientId={patient.id} />
        </>
      )}
      {onglet === "facturation" && <FacturationPatient patientId={patient.id} />}
      {onglet === "messagerie" && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Messagerie avec {patient.nom}</h2>
          {!messages || !pro ? (
            <SkeletonChat />
          ) : (
            <ChatBox patientId={patient.id} currentUserId={pro.user_id} otherLabel={patient.nom} initialMessages={messages} />
          )}
        </section>
      )}

      <MarquerVisite patientId={patient.id} />

      {/* ── Alertes en cours — clôturables ici ── */}
      <AlertesPatient patientId={patient.id} />

      {/* ── Informations patient ── */}
      <InfosPatient patient={patient} modifiable={modifiableInfos} />

      {/* ── Dernières valeurs ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Dernières valeurs</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {TYPES_MESURE.map((type) => {
            const v = dernieres.get(type);
            const meta = MESURES[type];
            return (
              <div key={type} className="card p-3 text-center">
                <p className="text-[11px] text-slate-400">{meta.court}</p>
                <p className="mt-1 text-xl font-bold text-brand">{v ?? "—"}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Saisie de constantes (infirmière libérale uniquement) ── */}
      {peutSaisirMesure && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-slate-600">Saisir une constante</h2>
          <SaisieMesure patientId={patient.id} pro onSaved={() => setReloadMesures((x) => x + 1)} />
        </section>
      )}

      {/* ── Courbes + seuils ── */}
      {!courbes ? (
        <SkeletonCourbes />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {TYPES_MESURE.map((type) => (
            <SeuilEditor
              key={type}
              type={type}
              patientId={patient.id}
              mesures={courbes.mesures.filter((m) => m.type === type)}
              seuil={courbes.seuilParType.get(type) ?? null}
              modifiable={modifiableSeuils}
            />
          ))}
        </section>
      )}

      {/* ── Photos ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Photos de cicatrice</h2>
        {!photos ? (
          <SkeletonPhotos />
        ) : photos.photos.length === 0 ? (
          <p className="card p-4 text-sm text-slate-400">Aucune photo envoyée par le patient.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {photos.photos.map((p) => {
              const url = photos.urls[p.chemin_stockage];
              return (
                <a key={p.id} href={url ?? "#"} target="_blank" rel="noopener noreferrer" className="card overflow-hidden p-0">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={p.legende ?? "Photo de cicatrice"} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-rose-50 text-[11px] text-slate-400">Indispo</div>
                  )}
                  <div className="p-1.5">
                    {p.legende && <p className="truncate text-[11px] font-medium text-slate-600">{p.legende}</p>}
                    <p className="text-[10px] text-slate-400">
                      {new Date(p.horodatage).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Skeletons ───────────────────────────────────────────────────────

function OngletBtn({ label, icon, actif, onClick }: { label: string; icon: React.ReactNode; actif: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-xl border p-2 transition ${actif ? "border-brand bg-brand text-white" : "border-rose-200 bg-white text-brand hover:bg-rose-50"}`}
    >
      {icon}
    </button>
  );
}

// Icônes (style ligne, couleur héritée).
const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">{children}</svg>
);
const ICal = () => svg(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /><path d="M8.5 14l2.2 2.2 4.3-4.3" /></>);
const IDoc = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><line x1="8.5" y1="13" x2="15.5" y2="13" /><line x1="8.5" y1="16.5" x2="13" y2="16.5" /></>);
const ITruck = () => svg(<><path d="M3 6.5h11v9H3z" /><path d="M14 9.5h3.8l3.2 3.2v2.8H14z" /><circle cx="7" cy="17.7" r="1.6" /><circle cx="17.3" cy="17.7" r="1.6" /></>);
const IChat = () => svg(<path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-3.9A7.5 7.5 0 1 1 21 11.5Z" />);
const IEuro = () => svg(<><path d="M16.5 7.2a5.5 5.5 0 1 0 0 9.6" /><line x1="4.5" y1="10.8" x2="13" y2="10.8" /><line x1="4.5" y1="13.4" x2="12" y2="13.4" /></>);

function SkeletonCourbes() {
  return (
    <div className="grid gap-4 animate-pulse lg:grid-cols-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-rose-100 bg-white p-5">
          <div className="mb-3 h-5 w-32 rounded bg-rose-100" />
          <div className="h-48 rounded-xl bg-rose-50" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChat() {
  return (
    <div className="animate-pulse rounded-2xl border border-rose-100 bg-white p-5">
      <div className="h-40 rounded-xl bg-rose-50" />
    </div>
  );
}

function SkeletonPhotos() {
  return (
    <div className="grid grid-cols-3 gap-3 animate-pulse sm:grid-cols-4 lg:grid-cols-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="aspect-square rounded-2xl bg-rose-100" />
      ))}
    </div>
  );
}
