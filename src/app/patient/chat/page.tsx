"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";
import { ChatBox } from "@/components/ChatBox";
import type { Message } from "@/lib/types";

export default function PageChat() {
  const patient = usePatientSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!patient) return;
    const supabase = createClient();
    supabase
      .from("message")
      .select("id,patient_id,auteur_user_id,contenu,horodatage")
      .eq("patient_id", patient.id)
      .order("horodatage", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages((data ?? []) as Message[]);
        setReady(true);
      });
  }, [patient?.id]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Mon infirmière coordinatrice</h1>
        <p className="mt-1 text-sm text-slate-500">Posez vos questions, elle vous répondra dès que possible.</p>
      </div>

      {!patient || !userId || !ready ? (
        <div className="animate-pulse rounded-2xl border border-rose-100 bg-white p-5">
          <div className="h-48 rounded-xl bg-rose-50" />
        </div>
      ) : (
        <ChatBox
          patientId={patient.id}
          currentUserId={userId}
          otherLabel="Équipe soignante"
          initialMessages={messages}
        />
      )}
    </div>
  );
}
