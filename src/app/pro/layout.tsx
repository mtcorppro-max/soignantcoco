"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const pro = useProSession();
  const pathname = usePathname();
  const estCoord = pro?.role === "coordinatrice";
  const estChir = pro?.role === "chirurgien";
  // Gérer/créer des comptes & l'équipe : niveau 0, 1 ou 2 (hors chirurgien)
  const peutGerer = !!pro && pro.niveau <= 2 && pro.role !== "chirurgien";
  // Gérer la structure (régions/agences) : niveau 0 ou 1
  const peutStructure = !!pro && pro.niveau <= 1;

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
              {estCoord && <Onglet href="/pro/suivis" label="Suivis" />}
              {estCoord && <Onglet href="/pro/calendrier" label="Organisation" />}
              {peutGerer && <Onglet href="/pro/equipe" label="Équipe soignante" />}
              {peutStructure && <Onglet href="/pro/structure" label="Structure" />}
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
        {estCoord && <NavItem href="/pro/suivis" icon="🗓" label="Suivis" />}
        {estCoord && <NavItem href="/pro/calendrier" icon="▦" label="Organisation" />}
        {peutGerer && <NavItem href="/pro/equipe" icon="👥" label="Équipe" />}
        {peutStructure && <NavItem href="/pro/structure" icon="🗂" label="Structure" />}
        {(estCoord || estChir || peutGerer) && <NavItem href="/pro/nouveau" icon="＋" label="Nouveau" />}
      </nav>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="flex flex-1 flex-col items-center gap-1 py-2 text-slate-400 hover:text-brand"
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

function Onglet({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-brand"
    >
      {label}
    </Link>
  );
}
