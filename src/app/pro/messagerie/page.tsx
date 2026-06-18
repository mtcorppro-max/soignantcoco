import { requirePro } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatBox } from "@/components/ChatBox";
import type { Message } from "@/lib/types";
import Link from "next/link";

export default async function MessageriePro({
  searchParams,
}: {
  searchParams: { patient?: string };
}) {
  const pro = await requirePro();

  // Délégué exclu du chat (RLS + règle métier)
  if (pro.role === "delegue") {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Accès non autorisé pour ce rôle.</p>
      </div>
    );
  }

  const supabase = await createClient();

  // Liste des patients du prestataire
  const { data: patients } = await supabase
    .from("patient")
    .select("id, nom, statut")
    .eq("statut", "active")
    .order("nom");

  const patientId = searchParams.patient ?? null;
  const patientSelectionne = patients?.find((p) => p.id === patientId) ?? null;

  // Messages du patient sélectionné
  let messages: Message[] = [];
  if (patientId) {
    const { data } = await supabase
      .from("message")
      .select("*")
      .eq("patient_id", patientId)
      .order("horodatage");
    messages = (data as Message[]) ?? [];
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">

      {/* ── Liste patients ── */}
      <aside className="card h-fit">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-rose-400">
          Patients actifs
        </p>
        {!patients?.length && (
          <p className="text-sm text-slate-400">Aucun patient.</p>
        )}
        <ul className="flex flex-col gap-1">
          {patients?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pro/messagerie?patient=${p.id}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  p.id === patientId
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-rose-50 hover:text-brand"
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
      </aside>

      {/* ── Zone chat ── */}
      <div className="card">
        {!patientSelectionne ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
            <span className="text-3xl">◇</span>
            <p className="text-sm">Sélectionnez un patient pour démarrer</p>
          </div>
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
