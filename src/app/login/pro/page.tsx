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
  const [voirMdp, setVoirMdp] = useState(false);
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
    // Un admin (allowlist, sans fiche soignant) est redirigé vers /admin.
    const ctx = await fetch("/api/admin/context").then((r) => r.json()).catch(() => null);
    const proExiste = await supabase
      .from("professionnel")
      .select("id")
      .maybeSingle()
      .then(({ data }) => !!data);
    router.push(ctx?.isAdmin && !proExiste ? "/admin" : "/pro");
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
          <div className="relative">
            <input
              id="mdp"
              type={voirMdp ? "text" : "password"}
              className="input pr-11"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setVoirMdp((v) => !v)}
              aria-label={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-brand"
            >
              {voirMdp ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A9.5 9.5 0 0112 4c5 0 9 4.5 9 8a11 11 0 01-2.2 3.4M6.1 6.1A11 11 0 003 12c0 3.5 4 8 9 8a9.6 9.6 0 003.9-.8" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>
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
