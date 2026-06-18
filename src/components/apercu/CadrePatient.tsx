import { Logo } from "@/components/Logo";

// Cadre visuel "mobile" pour les aperçus patient (reproduit patient/layout).
export function CadrePatient({
  active,
  children,
}: {
  active: "Accueil" | "Mesure" | "Suivi";
  children: React.ReactNode;
}) {
  const items: { label: "Accueil" | "Mesure" | "Suivi"; icon: string }[] = [
    { label: "Accueil", icon: "🏠" },
    { label: "Mesure", icon: "➕" },
    { label: "Suivi", icon: "📈" },
  ];
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-rose-50">
      <header className="flex items-center justify-between border-b border-rose-100 bg-white px-5 py-3">
        <Logo />
        <span className="text-sm text-slate-400">Déconnexion</span>
      </header>
      <main className="flex-1 px-5 py-5 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-rose-100 bg-white py-2">
        {items.map((i) => (
          <span
            key={i.label}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-xs font-medium ${
              i.label === active ? "text-brand" : "text-slate-500"
            }`}
          >
            <span className="text-lg">{i.icon}</span>
            {i.label}
          </span>
        ))}
      </nav>
    </div>
  );
}
