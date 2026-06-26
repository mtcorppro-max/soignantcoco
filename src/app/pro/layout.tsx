"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE, estCoordOuManager } from "@/lib/roles";
import { RechercheSoignants } from "@/components/RechercheSoignants";

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
    if (!pro || pro.niveau !== 1) return; // seul le manager valide
    const supabase = createClient();
    Promise.all([
      supabase.from("evenement_planning").select("professionnel:professionnel_id(agence_id)").eq("statut", "en_attente"),
      supabase.from("agence").select("id,region_id"),
    ]).then(([{ data: evts }, { data: ags }]) => {
      const regionAgence = new Map((ags ?? []).map((a) => [a.id as string, a.region_id as string]));
      const maRegion = pro.region_id ?? (pro.agence_id ? regionAgence.get(pro.agence_id) : undefined);
      const n = (evts ?? []).filter((e) => {
        const agId = (e.professionnel as { agence_id?: string } | null)?.agence_id;
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
            <nav className="hidden items-center gap-0.5 sm:flex">
              <Onglet href="/pro" icon="dashboard" label="Tableau de bord" pathname={pathname} exact />
              <Onglet href="/pro/alertes" icon="bell" label="Alertes" pathname={pathname} />
              {estCoord && <Onglet href="/pro/suivis" icon="calendar" label="Suivis" pathname={pathname} />}
              {estCoord && <Onglet href="/pro/calendrier" icon="clipboard" label="Organisation" pathname={pathname} badge={nbDemandes} />}
              {peutGerer && <Onglet href="/pro/equipe" icon="users" label="Équipe soignante" pathname={pathname} />}
              {peutPec && <Onglet href="/pro/pec" icon="chart" label="PEC" pathname={pathname} />}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            {peutGerer && <RechercheSoignants />}
            {(estCoord || estChir || peutGerer) && (
              <Link
                href="/pro/nouveau"
                prefetch={true}
                className="hidden items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark sm:inline-flex"
              >
                <IconeNav name="plus" className="h-4 w-4" />
                Nouveau
              </Link>
            )}
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
        <NavItem href="/pro" icon="dashboard" label="Tableau" />
        <NavItem href="/pro/alertes" icon="bell" label="Alertes" />
        {estCoord && <NavItem href="/pro/suivis" icon="calendar" label="Suivis" />}
        {estCoord && <NavItem href="/pro/calendrier" icon="clipboard" label="Organisation" badge={nbDemandes} />}
        {peutGerer && <NavItem href="/pro/equipe" icon="users" label="Équipe" />}
        {peutPec && <NavItem href="/pro/pec" icon="chart" label="PEC" />}
        {(estCoord || estChir || peutGerer) && <NavItem href="/pro/nouveau" icon="plus" label="Nouveau" />}
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
        <span className="absolute right-1/2 top-0.5 flex h-[15px] min-w-[15px] translate-x-3 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">{badge}</span>
      )}
      <IconeNav name={icon} className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function Onglet({ href, icon, label, pathname, exact, badge }: { href: string; icon: string; label: string; pathname: string; exact?: boolean; badge?: number }) {
  const actif = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      prefetch={true}
      title={label}
      className={`group relative flex h-10 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors ${
        actif ? "bg-rose-50 text-brand" : "text-slate-500 hover:bg-rose-50 hover:text-brand"
      }`}
    >
      <IconeNav name={icon} className="block h-5 w-5 shrink-0" />
      {/* Libellé : affiché si actif, sinon au survol (animation de largeur) */}
      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
          actif ? "ml-1.5 max-w-[14rem]" : "max-w-0 group-hover:ml-1.5 group-hover:max-w-[14rem]"
        }`}
      >
        {label}
      </span>
      {!!badge && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold leading-none text-white ring-2 ring-white">{badge}</span>
      )}
    </Link>
  );
}

// Icônes de navigation (style ligne, cohérent — pas d'emoji).
function IconeNav({ name, className }: { name: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    dashboard: (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>),
    bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7H3.5S6 15 6 9Z" /><path d="M10.5 21a1.8 1.8 0 0 0 3 0" /></>),
    chart: (<><line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="18" y1="20" x2="18" y2="9" /></>),
    calendar: (<><rect x="3" y="4.5" width="18" height="17" rx="2" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><path d="m8.5 14.5 2 2 3.5-3.5" /></>),
    clipboard: (<><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>),
    users: (<><path d="M16 21v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21" /><circle cx="9" cy="7" r="3.5" /><path d="M22 21v-1.5a4 4 0 0 0-3-3.85" /><path d="M16 3.6a3.5 3.5 0 0 1 0 6.8" /></>),
    home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>),
    plus: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} {...p} aria-hidden="true">
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}
