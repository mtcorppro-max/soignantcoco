import { Logo } from "@/components/Logo";

// Cadre visuel "desktop" pour les aperçus pro (reproduit pro/layout).
export function CadrePro({
  active,
  children,
}: {
  active: "Tableau de bord" | "Alertes" | "Nouveau patient";
  children: React.ReactNode;
}) {
  const onglets = ["Tableau de bord", "Alertes", "Nouveau patient"] as const;
  return (
    <div className="min-h-screen">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden gap-1 sm:flex">
              {onglets.map((o) => (
                <span
                  key={o}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    o === active ? "bg-rose-50 text-brand" : "text-slate-500"
                  }`}
                >
                  {o}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-700">Claire Coord.</p>
              <p className="text-xs text-slate-400">Coordinatrice</p>
            </div>
            <span className="text-sm text-slate-400">Déconnexion</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
