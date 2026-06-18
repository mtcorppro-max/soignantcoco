import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { href: "/patient",          label: "Accueil",  icon: "⌂" },
  { href: "/patient/mesure",   label: "Mesure",   icon: "＋" },
  { href: "/patient/suivi",    label: "Suivi",    icon: "∿" },
  { href: "/patient/chat",     label: "Chat",     icon: "◇" },
  { href: "/patient/photos",   label: "Photos",   icon: "◎" },
  { href: "/patient/conseils", label: "Conseils", icon: "✦" },
];

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const patient = await requirePatient();

  return (
    <div className="min-h-screen bg-rose-50">

      {/* ── Header desktop ──────────────────────────────────── */}
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo />
          {/* Nav horizontale — desktop uniquement */}
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-brand"
              >
                <span className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-600 sm:block">
              {patient.nom}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ── Contenu ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-6 md:pb-10">
        {children}
      </main>

      {/* ── Nav bas — mobile uniquement ─────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-rose-100 bg-white py-2 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-medium text-slate-500 hover:text-brand"
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
