import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function ChoixConnexion() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <Logo className="justify-center text-2xl" />
        <p className="mt-3 text-sm text-slate-500">Connexion</p>
      </div>
      <div className="grid gap-3">
        <Link href="/login/patient" className="btn-primary w-full py-4 text-base">
          Je suis patient
        </Link>
        <Link href="/login/pro" className="btn-secondary w-full py-4 text-base">
          Équipe médicale
        </Link>
      </div>
    </main>
  );
}
