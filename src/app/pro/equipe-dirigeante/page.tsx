"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { Avatar } from "@/components/Avatar";

type Dirigeant = {
  id: string;
  nom: string;
  prenom: string | null;
  titre: string | null;
  email: string | null;
  telephone: string | null;
  photo_url: string | null;
};

const nomComplet = (d: Dirigeant) => [d.titre, d.prenom, d.nom].filter(Boolean).join(" ");

export default function EquipeDirigeantePage() {
  const pro = useProSession();
  const [dirigeants, setDirigeants] = useState<Dirigeant[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    createClient()
      .from("professionnel")
      .select("id,nom,prenom,titre,email,telephone,photo_url")
      .eq("role", "dirigeant")
      .order("nom")
      .then(({ data }) => {
        setDirigeants((data ?? []) as Dirigeant[]);
        setPret(true);
      });
  }, []);

  // Réservé aux dirigeants et à l'administration (niveau 0).
  if (pro && pro.role !== "dirigeant" && pro.niveau !== 0) {
    return <div className="card text-sm text-slate-500">Cette page est réservée à l&apos;équipe dirigeante.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Équipe dirigeante</h1>
      <p className="mb-5 text-sm text-slate-500">Les comptes de direction de l&apos;entreprise. Ils sont créés par l&apos;administrateur.</p>

      {!pret ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : dirigeants.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun dirigeant enregistré.</p>
      ) : (
        <div className="grid gap-3">
          {dirigeants.map((d) => (
            <div key={d.id} className="card flex flex-wrap items-center gap-4">
              <Avatar url={d.photo_url} prenom={d.prenom} nom={d.nom} taille="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800">{nomComplet(d)}</span>
                  <span className="badge bg-rose-100 text-brand">Dirigeant</span>
                  {d.id === pro?.id && <span className="badge bg-slate-100 text-slate-500">Vous</span>}
                </div>
                <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                  {d.email && (
                    <div className="flex gap-2">
                      <span className="shrink-0 text-slate-400">Email :</span>
                      <a href={`mailto:${d.email}`} className="min-w-0 break-words font-medium text-brand hover:underline">{d.email}</a>
                    </div>
                  )}
                  {d.telephone && (
                    <div className="flex gap-2">
                      <span className="shrink-0 text-slate-400">Téléphone :</span>
                      <a href={`tel:${d.telephone}`} className="font-medium text-brand hover:underline">{d.telephone}</a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
