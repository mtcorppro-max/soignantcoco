import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESURES, TYPES_MESURE } from "@/lib/constants";
import { conseilDuJour, conseilMeteo } from "@/lib/conseils";
import { ConseilCard } from "@/components/ConseilCard";
import type { Mesure } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PatientAccueil() {
  const patient = await requirePatient();
  const supabase = createClient();

  const [{ data: mesures }, meteo] = await Promise.all([
    supabase
      .from("mesure")
      .select("*")
      .eq("patient_id", patient.id)
      .order("horodatage", { ascending: false })
      .limit(50),
    conseilMeteo(patient.code_postal),
  ]);
  const duJour = conseilDuJour();

  const dernieres = new Map<string, Mesure>();
  (mesures ?? []).forEach((m) => {
    if (!dernieres.has(m.type)) dernieres.set(m.type, m as Mesure);
  });

  const aujourdhui = (mesures ?? []).filter(
    (m) => new Date(m.horodatage).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

      {/* ── Colonne principale ── */}
      <div className="grid gap-5">

        {/* Bonjour */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Bonjour {patient.nom.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {aujourdhui > 0
              ? `${aujourdhui} mesure(s) saisie(s) aujourd'hui.`
              : "Pensez à relever vos constantes du jour."}
          </p>
        </div>

        {/* Alerte météo */}
        {meteo && <ConseilCard conseil={meteo} highlight />}

        {/* Bouton saisie */}
        <Link href="/patient/mesure" className="btn-primary py-4 text-center text-base">
          ＋ Saisir une mesure
        </Link>

        {/* Dernières valeurs */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">
            Mes dernières valeurs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TYPES_MESURE.map((type) => {
              const m = dernieres.get(type);
              const meta = MESURES[type];
              return (
                <div key={type} className="card p-4">
                  <p className="text-xs text-slate-400">{meta.label}</p>
                  <p className="mt-1 text-2xl font-bold text-brand">
                    {m ? Number(m.valeur) : "—"}
                    <span className="ml-1 text-sm font-normal text-slate-400">
                      {meta.unite}
                    </span>
                  </p>
                  {m && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {new Date(m.horodatage).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <Link
          href="/patient/suivi"
          className="text-center text-sm font-medium text-brand hover:underline"
        >
          Voir mes graphiques de suivi →
        </Link>
      </div>

      {/* ── Colonne droite (desktop) ── */}
      <aside className="grid gap-5">

        {/* Conseil du jour */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">Conseil du jour</h2>
            <Link
              href="/patient/conseils"
              className="text-xs font-medium text-brand hover:underline"
            >
              Tous →
            </Link>
          </div>
          <ConseilCard conseil={duJour} />
        </section>

        {/* Accès rapides */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Accès rapide</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/patient/chat",    icon: "◇", label: "Chat" },
              { href: "/patient/photos",  icon: "◎", label: "Photos" },
              { href: "/patient/suivi",   icon: "∿", label: "Suivi" },
              { href: "/patient/conseils",icon: "✦", label: "Conseils" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="card flex flex-col items-center gap-2 py-4 text-center transition hover:shadow-md hover:border-rose-200"
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium text-slate-600">{a.label}</span>
              </Link>
            ))}
          </div>
        </section>

      </aside>
    </div>
  );
}
