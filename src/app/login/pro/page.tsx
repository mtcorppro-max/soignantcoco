"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

export default function LoginPro() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });
    if (error) {
      setErreur("Identifiants incorrects.");
      setChargement(false);
      return;
    }
    router.push("/pro");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <Logo className="justify-center text-xl" />
        <h1 className="mt-4 text-lg font-semibold text-slate-700">
          Espace équipe médicale
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Coordinatrice · Chirurgien · Délégué médical
        </p>
      </div>

      <form onSubmit={onSubmit} className="card grid gap-4">
        <div>
          <label className="label" htmlFor="email">
            Email professionnel
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="mdp">
            Mot de passe
          </label>
          <input
            id="mdp"
            type="password"
            className="input"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {erreur && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">
            {erreur}
          </p>
        )}
        <button className="btn-primary py-3" disabled={chargement}>
          {chargement ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <Link href="/login" className="text-center text-sm text-slate-400 hover:text-brand">
        ← Retour
      </Link>
    </main>
  );
}
