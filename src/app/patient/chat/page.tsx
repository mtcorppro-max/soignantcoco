import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatBox } from "@/components/ChatBox";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PageChat() {
  const patient = await requirePatient();
  const supabase = createClient();

  // user_id est nullable (patient non encore lié à un compte Auth), mais ici
  // on est authentifié donc user_id est forcément défini.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: messages } = await supabase
    .from("message")
    .select("*")
    .eq("patient_id", patient.id)
    .order("horodatage", { ascending: true })
    .limit(200);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Mon infirmière coordinatrice
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Posez vos questions, elle vous répondra dès que possible.
        </p>
      </div>

      <ChatBox
        patientId={patient.id}
        currentUserId={user!.id}
        otherLabel="Équipe soignante"
        initialMessages={(messages ?? []) as Message[]}
      />
    </div>
  );
}
