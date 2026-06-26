"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProSession } from "@/lib/hooks/useSession";

type Pro = { id: string; nom: string; prenom: string | null; titre: string | null; role: string; niveau: number };
type Message = { id: string; expediteur_id: string; destinataire_id: string; contenu: string; lu: boolean; created_at: string };

const nomComplet = (p: Pro) => [p.titre, p.prenom, p.nom].filter(Boolean).join(" ");

export default function MessageriePage() {
  const pro = useProSession();
  const monId = pro?.id ?? "";
  const params = useSearchParams();
  const [pros, setPros] = useState<Pro[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
    if (!monId) return;
    const supabase = createClient();
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from("professionnel").select("id,nom,prenom,titre,role,niveau").neq("id", monId).order("nom"),
      supabase.from("message_pro").select("id,expediteur_id,destinataire_id,contenu,lu,created_at").order("created_at", { ascending: true }),
    ]);
    // On garde tout le monde pour résoudre les noms (y compris un niveau 0 qui
    // vous a écrit) ; le filtrage niveau 0 ne s'applique qu'au choix d'un nouveau contact.
    setPros((ps ?? []) as Pro[]);
    setMessages((ms ?? []) as Message[]);
  }, [monId]);

  useEffect(() => { charger(); }, [charger]);

  // Sélection initiale via ?to=
  useEffect(() => {
    const to = params.get("to");
    if (to) setSelId(to);
  }, [params]);

  // Marque comme lus les messages reçus de la conversation ouverte.
  useEffect(() => {
    if (!selId || !monId) return;
    const nonLus = messages.filter((m) => m.expediteur_id === selId && m.destinataire_id === monId && !m.lu).map((m) => m.id);
    if (nonLus.length === 0) return;
    createClient().from("message_pro").update({ lu: true }).in("id", nonLus).then(() => {
      setMessages((arr) => arr.map((m) => (nonLus.includes(m.id) ? { ...m, lu: true } : m)));
    });
  }, [selId, monId, messages]);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selId, messages]);

  const proParId = useMemo(() => new Map(pros.map((p) => [p.id, p])), [pros]);

  // Conversations existantes : autre partie + dernier message + non-lus.
  const conversations = useMemo(() => {
    const m = new Map<string, { dernier: Message; nonLus: number }>();
    messages.forEach((msg) => {
      const autre = msg.expediteur_id === monId ? msg.destinataire_id : msg.expediteur_id;
      const nonLu = msg.destinataire_id === monId && !msg.lu ? 1 : 0;
      const e = m.get(autre);
      if (!e) m.set(autre, { dernier: msg, nonLus: nonLu });
      else { e.dernier = msg; e.nonLus += nonLu; }
    });
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.dernier.created_at.localeCompare(a.dernier.created_at));
  }, [messages, monId]);

  const fil = useMemo(
    () => messages.filter((m) => (m.expediteur_id === selId && m.destinataire_id === monId) || (m.expediteur_id === monId && m.destinataire_id === selId)),
    [messages, selId, monId]
  );

  async function envoyer() {
    const t = texte.trim();
    if (!t || !selId || !monId) return;
    setBusy(true);
    const { data, error } = await createClient()
      .from("message_pro")
      .insert({ expediteur_id: monId, destinataire_id: selId, contenu: t })
      .select("id,expediteur_id,destinataire_id,contenu,lu,created_at")
      .single();
    setBusy(false);
    if (error) { alert("Échec de l'envoi : " + error.message); return; }
    setMessages((arr) => [...arr, data as Message]);
    setTexte("");
  }

  const sel = selId ? proParId.get(selId) : undefined;
  const dejaEnConv = new Set(conversations.map((c) => c.id));
  // Nouveau contact : on ne propose pas les comptes niveau 0 (invisibles).
  const autresPros = pros.filter((p) => p.niveau !== 0 && !dejaEnConv.has(p.id));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-2xl font-bold text-slate-800">Messagerie</h1>

      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        {/* Conversations + nouveau message */}
        <div className="grid min-w-0 content-start gap-2">
          {conversations.map((c) => {
            const p = proParId.get(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setSelId(c.id)}
                className={`flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition ${selId === c.id ? "border-brand bg-rose-50" : "border-rose-100 hover:bg-rose-50"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-700">{p ? nomComplet(p) : "Soignant"}</p>
                  <p className="truncate text-xs text-slate-400">{c.dernier.contenu}</p>
                </div>
                {c.nonLus > 0 && <span className="badge shrink-0 bg-brand text-white">{c.nonLus}</span>}
              </button>
            );
          })}

          <details className="mt-1" open={conversations.length === 0}>
            <summary className="cursor-pointer px-1 text-xs font-semibold uppercase tracking-widest text-rose-400">Nouveau message</summary>
            <div className="mt-2 grid gap-0.5">
              {autresPros.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelId(p.id)}
                  className={`rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-rose-50 ${selId === p.id ? "bg-rose-50 text-brand" : "text-slate-600"}`}
                >
                  {nomComplet(p)}
                </button>
              ))}
            </div>
          </details>
        </div>

        {/* Fil de discussion */}
        <div className="grid grid-rows-[auto_1fr_auto] rounded-2xl border border-rose-100 bg-white" style={{ minHeight: "60vh" }}>
          {!selId ? (
            <div className="row-span-3 flex items-center justify-center p-8 text-center text-sm text-slate-400">
              Sélectionnez un soignant pour démarrer une conversation.
            </div>
          ) : (
            <>
              <div className="border-b border-rose-100 px-4 py-3">
                <p className="font-semibold text-slate-800">{sel ? nomComplet(sel) : "Soignant"}</p>
              </div>
              <div className="grid content-start gap-2 overflow-auto p-4">
                {fil.length === 0 ? (
                  <p className="text-center text-sm text-slate-400">Aucun message. Écrivez le premier.</p>
                ) : (
                  fil.map((m) => {
                    const moi = m.expediteur_id === monId;
                    return (
                      <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${moi ? "justify-self-end bg-brand text-white" : "justify-self-start bg-rose-50 text-slate-700"}`}>
                        {m.contenu}
                        <span className={`mt-0.5 block text-[10px] ${moi ? "text-white/70" : "text-slate-400"}`}>
                          {new Date(m.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={finRef} />
              </div>
              <div className="flex items-end gap-2 border-t border-rose-100 p-3">
                <textarea
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                  rows={1}
                  placeholder="Votre message…"
                  className="input flex-1 resize-none"
                />
                <button onClick={envoyer} disabled={busy || !texte.trim()} className="btn-primary px-4 py-2 disabled:opacity-50">
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
