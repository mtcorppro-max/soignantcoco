import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePro } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { SeuilEditor } from "@/components/SeuilEditor";
import { ChatBox } from "@/components/ChatBox";
import { urlsSignees } from "@/lib/photos";
import type { Mesure, Seuil, Photo, Message } from "@/lib/types";

export default async function FichePatient({
  params,
}: {
  params: { id: string };
}) {
  const pro = await requirePro();
  const supabase = createClient();

  const { data: patient } = await supabase
    .from("patient")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!patient) notFound();

  const [{ data: mesures }, { data: seuils }, { data: alertes }, { data: photos }, { data: messages }] =
    await Promise.all([
      supabase
        .from("mesure")
        .select("*")
        .eq("patient_id", patient.id)
        .order("horodatage", { ascending: false })
        .limit(300),
      supabase
        .from("seuil")
        .select("*")
        .eq("patient_id", patient.id)
        .eq("actif", true),
      supabase
        .from("alerte")
        .select("*")
        .eq("patient_id", patient.id)
        .in("statut", ["declenchee", "escaladee"]),
      supabase
        .from("photo")
        .select("*")
        .eq("patient_id", patient.id)
        .order("horodatage", { ascending: false }),
      supabase
        .from("message")
        .select("*")
        .eq("patient_id", patient.id)
        .order("horodatage", { ascending: true })
        .limit(200),
    ]);

  const listeMessages = (messages ?? []) as Message[];
  const listePhotos = (photos ?? []) as Photo[];
  const urlsPhotos = await urlsSignees(
    listePhotos.map((p) => p.chemin_stockage)
  );

  const seuilParType = new Map<string, Seuil>();
  (seuils ?? []).forEach((s) => seuilParType.set(s.type_mesure, s as Seuil));

  const dernieres = new Map<string, Mesure>();
  (mesures ?? []).forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, m as Mesure);
  });

  const modifiable = pro.role === "coordinatrice";
  const alertesActives = alertes?.length ?? 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/pro" className="text-sm text-slate-400 hover:text-brand">
            ← Tableau de bord
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">
            {patient.nom}
          </h1>
          <p className="text-sm text-slate-500">
            Code patient : <span className="font-mono font-semibold">{patient.code_unique}</span>
            {patient.code_postal ? ` · ${patient.code_postal}` : ""}
          </p>
        </div>
        {alertesActives > 0 && (
          <Link href="/pro/alertes" className="badge bg-critique text-white">
            {alertesActives} alerte(s) active(s)
          </Link>
        )}
      </div>

      {/* Résumé dernières valeurs */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">
          Dernières valeurs
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TYPES_MESURE.map((type) => {
            const m = dernieres.get(type);
            const meta = MESURES[type];
            return (
              <div key={type} className="card p-3 text-center">
                <p className="text-[11px] text-slate-400">{meta.court}</p>
                <p className="mt-1 text-xl font-bold text-brand">
                  {m ? Number(m.valeur) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Courbes + seuils ajustables */}
      <section className="grid gap-4 lg:grid-cols-2">
        {TYPES_MESURE.map((type) => (
          <SeuilEditor
            key={type}
            type={type}
            patientId={patient.id}
            mesures={(mesures ?? []).filter((m) => m.type === type) as Mesure[]}
            seuil={seuilParType.get(type) ?? null}
            modifiable={modifiable}
          />
        ))}
      </section>

      {/* Messagerie avec le patient */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-600">
          Messagerie avec {patient.nom}
        </h2>
        <ChatBox
          patientId={patient.id}
          currentUserId={pro.user_id}
          otherLabel={patient.nom}
          initialMessages={listeMessages}
        />
      </section>

      {/* Photos de cicatrice envoyées par le patient */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">
          Photos de cicatrice
        </h2>
        {listePhotos.length === 0 ? (
          <p className="card p-4 text-sm text-slate-400">
            Aucune photo envoyée par le patient.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {listePhotos.map((p) => {
              const url = urlsPhotos.get(p.chemin_stockage);
              return (
                <a
                  key={p.id}
                  href={url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card overflow-hidden p-0"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={p.legende ?? "Photo de cicatrice"}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-rose-50 text-[11px] text-slate-400">
                      Indispo
                    </div>
                  )}
                  <div className="p-1.5">
                    {p.legende && (
                      <p className="truncate text-[11px] font-medium text-slate-600">
                        {p.legende}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      {new Date(p.horodatage).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
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
