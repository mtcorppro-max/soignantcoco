import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requirePro } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { SeuilEditor } from "@/components/SeuilEditor";
import { ChatBox } from "@/components/ChatBox";
import { urlsSignees } from "@/lib/photos";
import type { Mesure, Seuil, Photo, Message } from "@/lib/types";

// ── Sections asynchrones streamées indépendamment ───────────────────

async function SectionCourbes({ patientId, modifiable }: { patientId: string; modifiable: boolean }) {
  const supabase = createClient();
  const [{ data: mesures }, { data: seuils }] = await Promise.all([
    supabase
      .from("mesure")
      .select("id,patient_id,type,valeur,horodatage")
      .eq("patient_id", patientId)
      .order("horodatage", { ascending: false })
      .limit(150),
    supabase
      .from("seuil")
      .select("id,patient_id,type_mesure,valeur_min,valeur_max,actif")
      .eq("patient_id", patientId)
      .eq("actif", true),
  ]);

  const seuilParType = new Map<string, Seuil>();
  (seuils ?? []).forEach((s) => seuilParType.set(s.type_mesure, s as Seuil));

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {TYPES_MESURE.map((type) => (
        <SeuilEditor
          key={type}
          type={type}
          patientId={patientId}
          mesures={(mesures ?? []).filter((m) => m.type === type) as Mesure[]}
          seuil={seuilParType.get(type) ?? null}
          modifiable={modifiable}
        />
      ))}
    </section>
  );
}

async function SectionChat({ patientId, proUserId, patientNom }: { patientId: string; proUserId: string; patientNom: string }) {
  const supabase = createClient();
  const { data: messages } = await supabase
    .from("message")
    .select("id,patient_id,auteur_user_id,contenu,horodatage")
    .eq("patient_id", patientId)
    .order("horodatage", { ascending: true })
    .limit(100);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-600">
        Messagerie avec {patientNom}
      </h2>
      <ChatBox
        patientId={patientId}
        currentUserId={proUserId}
        otherLabel={patientNom}
        initialMessages={(messages ?? []) as Message[]}
      />
    </section>
  );
}

async function SectionPhotos({ patientId }: { patientId: string }) {
  const supabase = createClient();
  const { data: photos } = await supabase
    .from("photo")
    .select("id,patient_id,chemin_stockage,legende,horodatage")
    .eq("patient_id", patientId)
    .order("horodatage", { ascending: false })
    .limit(50);

  const listePhotos = (photos ?? []) as Photo[];
  const urlsPhotos = await urlsSignees(listePhotos.map((p) => p.chemin_stockage));

  if (listePhotos.length === 0) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Photos de cicatrice</h2>
        <p className="card p-4 text-sm text-slate-400">Aucune photo envoyée par le patient.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-600">Photos de cicatrice</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {listePhotos.map((p) => {
          const url = urlsPhotos.get(p.chemin_stockage);
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
    </section>
  );
}

// ── Skeletons inline pour Suspense ───────────────────────────────────

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
      <div className="mb-3 h-5 w-24 rounded bg-rose-100" />
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

// ── Page principale — rendu immédiat ────────────────────────────────

export default async function FichePatient({ params }: { params: { id: string } }) {
  const pro = await requirePro();
  const supabase = createClient();

  // Requêtes rapides : patient + alertes actives + dernières valeurs
  const [{ data: patient }, { data: alertes }, { data: dernieresRaw }] = await Promise.all([
    supabase
      .from("patient")
      .select("id,nom,code_unique,code_postal,statut,prestataire_id")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("alerte")
      .select("id")
      .eq("patient_id", params.id)
      .in("statut", ["declenchee", "escaladee"]),
    supabase
      .from("mesure")
      .select("id,type,valeur,horodatage")
      .eq("patient_id", params.id)
      .order("horodatage", { ascending: false })
      .limit(30),
  ]);

  if (!patient) notFound();

  // Dernière valeur par type
  const dernieres = new Map<string, { valeur: number }>();
  (dernieresRaw ?? []).forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, { valeur: Number(m.valeur) });
  });

  const alertesActives = alertes?.length ?? 0;
  const modifiable = pro.role === "coordinatrice";

  return (
    <div className="grid gap-6">
      {/* ── En-tête — instantané ── */}
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
        {alertesActives > 0 && (
          <Link href="/pro/alertes" className="badge bg-critique text-white animate-pulse">
            {alertesActives} alerte(s) active(s)
          </Link>
        )}
      </div>

      {/* ── Dernières valeurs — instantané ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Dernières valeurs</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TYPES_MESURE.map((type) => {
            const m = dernieres.get(type);
            const meta = MESURES[type];
            return (
              <div key={type} className="card p-3 text-center">
                <p className="text-[11px] text-slate-400">{meta.court}</p>
                <p className="mt-1 text-xl font-bold text-brand">{m ? m.valeur : "—"}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Courbes — streamées ── */}
      <Suspense fallback={<SkeletonCourbes />}>
        <SectionCourbes patientId={patient.id} modifiable={modifiable} />
      </Suspense>

      {/* ── Chat — streamé ── */}
      <Suspense fallback={<SkeletonChat />}>
        <SectionChat patientId={patient.id} proUserId={pro.user_id} patientNom={patient.nom} />
      </Suspense>

      {/* ── Photos — streamées ── */}
      <Suspense fallback={<SkeletonPhotos />}>
        <SectionPhotos patientId={patient.id} />
      </Suspense>
    </div>
  );
}
