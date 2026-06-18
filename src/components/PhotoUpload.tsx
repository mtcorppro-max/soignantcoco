"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Envoi d'une photo de cicatrice. Sur mobile, `capture` propose l'appareil
// photo ; sur desktop, la sélection de fichier classique.
export function PhotoUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [legende, setLegende] = useState("");
  const [etat, setEtat] = useState<"idle" | "envoi" | "ok" | "erreur">("idle");
  const [message, setMessage] = useState("");

  function choisir(f: File | null) {
    setFichier(f);
    setMessage("");
    setEtat("idle");
    setApercu((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  function reset() {
    choisir(null);
    setLegende("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function envoyer() {
    if (!fichier) return;
    setEtat("envoi");
    setMessage("");
    const data = new FormData();
    data.append("fichier", fichier);
    if (legende.trim()) data.append("legende", legende.trim());

    const res = await fetch("/api/photos", { method: "POST", body: data });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "" }));
      setEtat("erreur");
      setMessage(message || "Échec de l'envoi. Réessayez.");
      return;
    }
    setEtat("ok");
    setMessage("Photo envoyée ✓");
    reset();
    router.refresh();
    setTimeout(() => setEtat("idle"), 1500);
  }

  return (
    <div className="card grid gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => choisir(e.target.files?.[0] ?? null)}
      />

      {apercu ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={apercu}
          alt="Aperçu de la photo"
          className="max-h-64 w-full rounded-xl object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid place-items-center gap-1 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50 py-10 text-slate-500 hover:border-brand"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-medium">Prendre / choisir une photo</span>
        </button>
      )}

      {apercu && (
        <input
          type="text"
          className="input"
          placeholder="Légende (optionnel) — ex. « cicatrice J+5 »"
          value={legende}
          onChange={(e) => setLegende(e.target.value)}
        />
      )}

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            etat === "ok" ? "bg-green-50 text-ok" : "bg-red-50 text-critique"
          }`}
        >
          {message}
        </p>
      )}

      {apercu && (
        <div className="flex gap-3">
          <button onClick={reset} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            onClick={envoyer}
            disabled={etat === "envoi"}
            className="btn-primary flex-1"
          >
            {etat === "envoi" ? "Envoi…" : "Envoyer la photo"}
          </button>
        </div>
      )}
    </div>
  );
}
