"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE, estCoordOuManager } from "@/lib/roles";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const pro = useProSession();
  const pathname = usePathname();
  const estN0 = pro?.niveau === 0; // super-admin plateforme : accès à tout
  const estCoord = estCoordOuManager(pro?.role) || estN0;
  const estChir = pro?.role === "chirurgien" && !estN0;
  // Gérer/créer des comptes & l'équipe : niveau 0, 1 ou 2 (hors chirurgien)
  const peutGerer = estN0 || (!!pro && pro.niveau <= 2 && pro.role !== "chirurgien");
  // PEC : managers (niveau 1) et plateforme (niveau 0)
  const peutPec = !!pro && pro.niveau <= 1;

  // Demandes de planning en attente dans le périmètre (badge Organisation).
  const [nbDemandes, setNbDemandes] = useState(0);
  useEffect(() => {
    if (!pro || pro.niveau > 1) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("evenement_planning").select("professionnel:professionnel_id(agence_id)").eq("statut", "en_attente"),
      supabase.from("agence").select("id,region_id"),
    ]).then(([{ data: evts }, { data: ags }]) => {
      const regionAgence = new Map((ags ?? []).map((a) => [a.id as string, a.region_id as string]));
      const maRegion = pro.region_id ?? (pro.agence_id ? regionAgence.get(pro.agence_id) : undefined);
      const n = (evts ?? []).filter((e) => {
        const agId = (e.professionnel as { agence_id?: string } | null)?.agence_id;
        if (pro.niveau === 0) return true;
        return !!agId && regionAgence.get(agId) === maRegion;
      }).length;
      setNbDemandes(n);
    });
  }, [pro, pathname]);

  // Remonte en haut à chaque changement de page (évite la restauration de
  // scroll qui laissait la fiche patient en bas après un clic depuis le tableau).
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden gap-1 sm:flex">
              <Onglet href="/pro" label="Tableau de bord" />
              <Onglet href="/pro/alertes" label="Alertes" />
              {peutPec && <Onglet href="/pro/pec" label="PEC" />}
              {estCoord && <Onglet href="/pro/suivis" label="Suivis" />}
              {estCoord && <Onglet href="/pro/calendrier" label="Organisation" badge={nbDemandes} />}
              {peutGerer && <Onglet href="/pro/equipe" label="Équipe soignante" />}
              {(estCoord || estChir || peutGerer) && (
                <Link
                  href="/pro/nouveau"
                  prefetch={true}
                  className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
                >
                  <span className="text-base leading-none">＋</span>
                  Nouveau
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            {pro && (
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-700">
                  {[pro.titre, pro.prenom, pro.nom].filter(Boolean).join(" ")}
                </p>
                <p className="text-xs text-slate-400">{LIBELLE_ROLE[pro.role as keyof typeof LIBELLE_ROLE]}</p>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:pb-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-rose-100 bg-white sm:hidden">
        <NavItem href="/pro" icon="⊞" label="Tableau" />
        <NavItem href="/pro/alertes" icon="◎" label="Alertes" />
        {peutPec && <NavItem href="/pro/pec" icon="📊" label="PEC" />}
        {estCoord && <NavItem href="/pro/suivis" icon="🗓" label="Suivis" />}
        {estCoord && <NavItem href="/pro/calendrier" icon="▦" label="Organisation" badge={nbDemandes} />}
        {peutGerer && <NavItem href="/pro/equipe" icon="👥" label="Équipe" />}
        {(estCoord || estChir || peutGerer) && <NavItem href="/pro/nouveau" icon="＋" label="Nouveau" />}
      </nav>
    </div>
  );
}

function NavItem({ href, icon, label, badge }: { href: string; icon: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="relative flex flex-1 flex-col items-center gap-1 py-2 text-slate-400 hover:text-brand"
    >
      {!!badge && badge > 0 && (
        <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-critique px-1.5 text-[10px] font-bold leading-4 text-white">{badge}</span>
      )}
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function Onglet({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="relative rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-brand"
    >
      {label}
      {!!badge && badge > 0 && (
        <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-critique px-1 text-[11px] font-bold text-white">{badge}</span>
      )}
    </Link>
  );
}
