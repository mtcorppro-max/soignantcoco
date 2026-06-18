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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll au dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    setEnvoi(true);
    const supabase = createClient();
    const { error } = await supabase.from("message").insert({
      patient_id: patientId,
      auteur_user_id: currentUserId,
      contenu,
    });
    if (!error) {
      setTexte("");
      inputRef.current?.focus();
    }
    setEnvoi(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Fil de messages */}
      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-rose-50 p-3">
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
        <div ref={bottomRef} />
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
