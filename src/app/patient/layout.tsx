"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { usePatientSession } from "@/lib/hooks/useSession";

const NAV = [
  { href: "/patient",          label: "Accueil",  icon: "⌂" },
  { href: "/patient/chat",     label: "Infirmière", icon: "◇" },
  { href: "/patient/conseils", label: "Conseils", icon: "✦" },
  { href: "/patient/profil",   label: "Profil",   icon: "☺" },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const patient = usePatientSession();
  const pathname = usePathname();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-rose-50">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo />
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                prefetch={true}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-brand"
              >
                {n.href === "/patient/profil" ? <IconeProfil className="h-4 w-4" /> : <span className="text-base">{n.icon}</span>}
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {patient && (
              <span className="hidden text-sm font-medium text-slate-600 sm:block">
                {patient.nom}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-6 md:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-rose-100 bg-white py-2 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            prefetch={true}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium text-slate-500 hover:text-brand"
          >
            {n.href === "/patient/profil" ? <IconeProfil className="h-5 w-5" /> : <span className="text-lg">{n.icon}</span>}
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function IconeProfil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}
