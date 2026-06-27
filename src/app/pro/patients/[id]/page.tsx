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
import { OrdonnancesPatient } from "@/components/OrdonnancesPatient";
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
  const peutSaisirMesure = pro?.role === "coordinatrice" || pro?.role === "infirmiere_liberale";

  // Dernières valeurs par type
  const dernieres = new Map<string, number>();
  (courbes?.mesures ?? []).forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, Number(m.valeur));
  });

  // En cours de chargement
  if (!patientData) {
    return (
      <div className="grid gap-6">
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
    <div className="grid gap-6">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/pro" className="text-sm text-slate-400 hover:text-brand" prefetch>
            ← Tableau de bord
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">{patient.nom}</h1>
          <p className="text-sm text-slate-500">
            Code : <span className="font-mono font-semibold">{patient.code_unique}</span>
            {patient.code_postal ? ` · ${patient.code_postal}` : ""}
          </p>
        </div>
      </div>

      <MarquerVisite patientId={patient.id} />

      {/* ── Alertes en cours — clôturables ici ── */}
      <AlertesPatient patientId={patient.id} />

      {/* ── Suivis (fiches quotidiennes + PDF) ── */}
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

      {/* ── Informations patient ── */}
      <InfosPatient patient={patient} modifiable={modifiableInfos} />

      {/* ── Ordonnances du patient ── */}
      <OrdonnancesPatient patientId={patient.id} patientNom={patient.nom} patientNaissance={patient.date_naissance} patientChirurgien={patient.chirurgien} />

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

      {/* ── Saisie de constantes (infirmière libérale / coordinatrice) ── */}
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

      {/* ── Messagerie ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">Messagerie avec {patient.nom}</h2>
        {!messages || !pro ? (
          <SkeletonChat />
        ) : (
          <ChatBox
            patientId={patient.id}
            currentUserId={pro.user_id}
            otherLabel={patient.nom}
            initialMessages={messages}
          />
        )}
      </section>

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
