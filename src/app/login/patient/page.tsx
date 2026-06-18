"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LoginPatient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const res = await fetch("/api/patient-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? "Code invalide.");
      }
      router.push("/patient");
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur de connexion.");
      setChargement(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <Logo className="justify-center text-xl" />
        <h1 className="mt-4 text-lg font-semibold text-slate-700">
          Mon suivi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Saisissez le code remis par votre infirmière coordinatrice.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card grid gap-4">
        <div>
          <label className="label" htmlFor="code">
            Code d&apos;accès
          </label>
          <input
            id="code"
            className="input text-center text-2xl font-bold uppercase tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </div>
        {erreur && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">
            {erreur}
          </p>
        )}
        <button className="btn-primary py-3.5 text-base" disabled={chargement}>
          {chargement ? "Connexion…" : "Accéder à mon suivi"}
        </button>
      </form>

      <Link href="/login" className="text-center text-sm text-slate-400 hover:text-brand">
        ← Retour
      </Link>
    </main>
  );
}
