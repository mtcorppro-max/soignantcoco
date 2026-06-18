"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";
import { ChatBox } from "@/components/ChatBox";
import type { Message } from "@/lib/types";

type PatientItem = { id: string; nom: string; statut: string };

export default function MessageriePro() {
  const pro = useProSession();
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patient");

  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [msgReady, setMsgReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("patient")
      .select("id,nom,statut")
      .eq("statut", "active")
      .order("nom")
      .then(({ data }) => {
        setPatients((data ?? []) as PatientItem[]);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!patientId) { setMessages([]); setMsgReady(true); return; }
    setMsgReady(false);
    const supabase = createClient();
    supabase
      .from("message")
      .select("id,patient_id,auteur_user_id,contenu,horodatage")
      .eq("patient_id", patientId)
      .order("horodatage", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages((data ?? []) as Message[]);
        setMsgReady(true);
      });
  }, [patientId]);

  if (pro?.role === "delegue") {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Accès non autorisé pour ce rôle.</p>
      </div>
    );
  }

  const patientSelectionne = patients.find((p) => p.id === patientId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* ── Liste patients ── */}
      <aside className="card h-fit">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-rose-400">Patients actifs</p>
        {!ready ? (
          <div className="grid gap-2 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-rose-50" />)}
          </div>
        ) : patients.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun patient.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pro/messagerie?patient=${p.id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    p.id === patientId ? "bg-brand text-white" : "text-slate-600 hover:bg-rose-50 hover:text-brand"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-brand">
                    {p.nom.charAt(0).toUpperCase()}
                  </span>
                  {p.nom}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* ── Zone chat ── */}
      <div className="card">
        {!patientSelectionne ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
            <span className="text-3xl">◇</span>
            <p className="text-sm">Sélectionnez un patient pour démarrer</p>
          </div>
        ) : !msgReady || !pro ? (
          <div className="animate-pulse h-40 rounded-xl bg-rose-50" />
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3 border-b border-rose-100 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-brand">
                {patientSelectionne.nom.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-slate-800">{patientSelectionne.nom}</p>
                <p className="text-xs text-slate-400">Messagerie sécurisée</p>
              </div>
            </div>
            <ChatBox
              patientId={patientId!}
              currentUserId={pro.user_id}
              otherLabel={patientSelectionne.nom}
              initialMessages={messages}
            />
          </>
        )}
      </div>
    </div>
  );
}
