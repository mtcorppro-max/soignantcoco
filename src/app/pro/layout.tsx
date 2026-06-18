import Link from "next/link";
import { requirePro } from "@/lib/auth";
import { LIBELLE_ROLE } from "@/lib/roles";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pro = await requirePro();
  const estCoord = pro.role === "coordinatrice";
  const peutChatter = pro.role === "coordinatrice" || pro.role === "chirurgien";

  return (
    <div className="min-h-screen">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden gap-1 sm:flex">
              <Onglet href="/pro" label="Tableau de bord" />
              <Onglet href="/pro/alertes" label="Alertes" />
              {peutChatter && (
                <Onglet href="/pro/messagerie" label="Messagerie" />
              )}
              {estCoord && (
                <Onglet href="/pro/nouveau-patient" label="Nouveau patient" />
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-700">{pro.nom}</p>
              <p className="text-xs text-slate-400">{LIBELLE_ROLE[pro.role]}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}

function Onglet({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-brand"
    >
      {label}
    </Link>
  );
}
