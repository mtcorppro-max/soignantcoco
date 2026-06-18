"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { Photo } from "@/lib/types";

export default function PagePhotos() {
  const patient = usePatientSession();
  const [liste, setListe] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  async function charger(patientId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("photo")
      .select("id,patient_id,chemin_stockage,legende,horodatage")
      .eq("patient_id", patientId)
      .order("horodatage", { ascending: false })
      .limit(50);

    const photos = (data ?? []) as Photo[];
    setListe(photos);

    if (photos.length > 0) {
      const res = await fetch("/api/signed-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chemins: photos.map((p) => p.chemin_stockage) }),
      });
      const json = await res.json();
      setUrls(json.urls ?? {});
    }
    setReady(true);
  }

  useEffect(() => {
    if (patient) charger(patient.id);
  }, [patient?.id]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Photos de cicatrice</h1>
        <p className="mt-1 text-sm text-slate-500">Envoyez une photo à votre équipe médicale pour le suivi de la cicatrisation.</p>
      </div>

      <PhotoUpload />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold text-slate-600">Mes envois</h2>
        {!ready ? (
          <div className="grid grid-cols-2 gap-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-rose-100" />)}
          </div>
        ) : liste.length === 0 ? (
          <p className="card p-4 text-sm text-slate-400">Aucune photo envoyée pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {liste.map((p) => {
              const url = urls[p.chemin_stockage];
              return (
                <div key={p.id} className="card overflow-hidden p-0">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={p.legende ?? "Photo de cicatrice"} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-rose-50 text-xs text-slate-400">Indisponible</div>
                  )}
                  <div className="p-2">
                    {p.legende && <p className="text-xs font-medium text-slate-600">{p.legende}</p>}
                    <p className="text-[11px] text-slate-400">
                      {new Date(p.horodatage).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
