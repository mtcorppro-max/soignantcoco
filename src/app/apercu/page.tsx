import Link from "next/link";
import { Logo } from "@/components/Logo";

const ECRANS = [
  { href: "/apercu/patient", label: "Patient — accueil", desc: "Mobile · mon suivi" },
  { href: "/apercu/patient/suivi", label: "Patient — suivi graphique", desc: "Courbes + ligne seuil" },
  { href: "/apercu/pro", label: "Cockpit — tableau de bord", desc: "Patients triés par criticité" },
  { href: "/apercu/pro/fiche", label: "Cockpit — fiche patient", desc: "Courbes + seuil ajustable" },
  { href: "/apercu/pro/alertes", label: "Cockpit — centre d'alertes", desc: "Acquittement / escalade" },
];

export default function ApercuIndex() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Logo className="text-2xl" />
      <h1 className="mt-4 text-xl font-bold text-slate-800">Aperçu des écrans</h1>
      <p className="mt-1 text-sm text-slate-500">
        Pages de démonstration avec données fictives (sans Supabase).
      </p>
      <div className="mt-6 grid gap-3">
        {ECRANS.map((e) => (
          <Link key={e.href} href={e.href} className="card flex items-center justify-between hover:border-brand">
            <div>
              <p className="font-semibold text-slate-700">{e.label}</p>
              <p className="text-sm text-slate-400">{e.desc}</p>
            </div>
            <span className="text-brand">→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
