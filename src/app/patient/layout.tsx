"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { usePatientSession } from "@/lib/hooks/useSession";

const NAV = [
  { href: "/patient",          label: "Accueil",    icon: "home" },
  { href: "/patient/chat",     label: "Infirmière", icon: "chat" },
  { href: "/patient/conseils", label: "Conseils",   icon: "bulb" },
  { href: "/patient/profil",   label: "Profil",     icon: "user" },
];

const estActif = (href: string, pathname: string) => (href === "/patient" ? pathname === "/patient" : pathname.startsWith(href));

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
            {NAV.map((n) => {
              const actif = estActif(n.href, pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  prefetch={true}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${actif ? "bg-rose-50 text-brand" : "text-slate-500 hover:bg-rose-50 hover:text-brand"}`}
                >
                  <IconePatient name={n.icon} className="h-5 w-5" />
                  {n.label}
                </Link>
              );
            })}
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
        {NAV.map((n) => {
          const actif = estActif(n.href, pathname);
          return (
            <Link
              key={n.href}
              href={n.href}
              prefetch={true}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium ${actif ? "text-brand" : "text-slate-500 hover:text-brand"}`}
            >
              <IconePatient name={n.icon} className="h-6 w-6" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// Icônes de navigation patient (style ligne, cohérent avec l'app).
function IconePatient({ name, className }: { name: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>),
    chat: (<><path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-3.9A7.5 7.5 0 1 1 21 11.5Z" /><circle cx="9" cy="11.5" r="0.7" fill="currentColor" stroke="none" /><circle cx="12.5" cy="11.5" r="0.7" fill="currentColor" stroke="none" /><circle cx="16" cy="11.5" r="0.7" fill="currentColor" stroke="none" /></>),
    bulb: (<><path d="M9.5 18h5" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1 1.05 1.7l.15.5h4.8l.15-.5c.15-.7.45-1.2 1.05-1.7A6 6 0 0 0 12 3Z" /></>),
    user: (<><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></>),
  };
  return <svg viewBox="0 0 24 24" className={className} {...p} aria-hidden="true">{paths[name] ?? paths.home}</svg>;
}
