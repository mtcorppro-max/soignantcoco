"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/types";

export function ChatBox({
  patientId,
  currentUserId,
  otherLabel,
  initialMessages,
}: {
  patientId: string;
  currentUserId: string;
  otherLabel: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync quand initialMessages arrive après le fetch asynchrone
  useEffect(() => {
    if (initialMessages.length > 0) setMessages(initialMessages);
  }, [initialMessages]);

  // Auto-scroll au dernier message — UNIQUEMENT dans la zone de messages.
  // (scrollIntoView ferait défiler toute la page, ce qui ramenait la fiche
  // patient tout en bas au chargement du chat.)
  useEffect(() => {
    const el = listeRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abonnement Realtime — nécessite que la table message soit dans la publication
  // (cf. SQL Editor : ALTER PUBLICATION supabase_realtime ADD TABLE public.message)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${patientId}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "message",
        filter: `patient_id=eq.${patientId}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, (payload: any) => {
        const msg = payload.new as Message;
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  async function envoyer() {
    const contenu = texte.trim();
    if (!contenu || envoi) return;

    // Mise à jour optimiste : le message apparaît immédiatement
    const tmpId = `tmp-${Date.now()}`;
    const optimiste: Message = {
      id: tmpId,
      patient_id: patientId,
      auteur_user_id: currentUserId,
      contenu,
      horodatage: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimiste]);
    setTexte("");
    inputRef.current?.focus();
    setEnvoi(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("message")
      .insert({ patient_id: patientId, auteur_user_id: currentUserId, contenu })
      .select()
      .single();

    if (error) {
      // Rollback si erreur
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      setTexte(contenu);
    } else if (data) {
      // Remplace le message temporaire par le vrai (avec id et horodatage serveur)
      setMessages((prev) => prev.map((m) => m.id === tmpId ? data as Message : m));
    }
    setEnvoi(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Fil de messages */}
      <div ref={listeRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-rose-50 p-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            Démarrez la conversation…
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.auteur_user_id === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                  isMine
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm border border-rose-100 bg-white text-slate-700"
                }`}
              >
                {!isMine && (
                  <p className="mb-0.5 text-[10px] font-semibold text-brand">
                    {otherLabel}
                  </p>
                )}
                <p className="text-sm leading-relaxed">{m.contenu}</p>
                <p
                  className={`mt-0.5 text-[10px] ${
                    isMine ? "text-rose-200" : "text-slate-400"
                  }`}
                >
                  {new Date(m.horodatage).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zone de saisie */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          className="input flex-1"
          placeholder="Votre message…"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              envoyer();
            }
          }}
          disabled={envoi}
        />
        <button
          onClick={envoyer}
          disabled={!texte.trim() || envoi}
          className="btn-primary px-4"
        >
          {envoi ? "…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
