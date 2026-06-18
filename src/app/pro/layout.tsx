"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { useProSession } from "@/lib/hooks/useSession";
import { LIBELLE_ROLE } from "@/lib/roles";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const pro = useProSession();
  const estCoord = pro?.role === "coordinatrice";
  const peutChatter = pro?.role === "coordinatrice" || pro?.role === "chirurgien";

  return (
    <div className="min-h-screen">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden gap-1 sm:flex">
              <Onglet href="/pro" label="Tableau de bord" />
              <Onglet href="/pro/alertes" label="Alertes" />
              {peutChatter && <Onglet href="/pro/messagerie" label="Messagerie" />}
              {estCoord && <Onglet href="/pro/nouveau-patient" label="Nouveau patient" />}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            {pro && (
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-700">{pro.nom}</p>
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
        {peutChatter && <NavItem href="/pro/messagerie" icon="◇" label="Messagerie" />}
        {estCoord && <NavItem href="/pro/nouveau-patient" icon="＋" label="Nouveau" />}
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
