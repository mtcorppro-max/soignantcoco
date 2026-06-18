import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PhotoUpload } from "@/components/PhotoUpload";
import { urlsSignees } from "@/lib/photos";
import type { Photo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PagePhotos() {
  const patient = await requirePatient();
  const supabase = createClient();

  const { data: photos } = await supabase
    .from("photo")
    .select("*")
    .eq("patient_id", patient.id)
    .order("horodatage", { ascending: false });

  const liste = (photos ?? []) as Photo[];
  const urls = await urlsSignees(liste.map((p) => p.chemin_stockage));

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Photos de cicatrice</h1>
        <p className="mt-1 text-sm text-slate-500">
          Envoyez une photo à votre équipe médicale pour le suivi de la
          cicatrisation.
        </p>
      </div>

      <PhotoUpload />

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold text-slate-600">Mes envois</h2>
        {liste.length === 0 ? (
          <p className="card p-4 text-sm text-slate-400">
            Aucune photo envoyée pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {liste.map((p) => {
              const url = urls.get(p.chemin_stockage);
              return (
                <div key={p.id} className="card overflow-hidden p-0">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={p.legende ?? "Photo de cicatrice"}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center bg-rose-50 text-xs text-slate-400">
                      Indisponible
                    </div>
                  )}
                  <div className="p-2">
                    {p.legende && (
                      <p className="text-xs font-medium text-slate-600">
                        {p.legende}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {new Date(p.horodatage).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
