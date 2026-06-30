"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePatientSession } from "@/lib/hooks/useSession";

type Row = {
  nom: string;
  operation: string | null;
  date_operation: string | null;
  duree_prise_en_charge: number | null;
  jours_suivi: number[] | null;
  traitement: string | null;
  rgpd_signe_le: string | null;
};

const TUTO = [
  { emoji: "👋", titre: "Bienvenue sur AS2CŒUR", texte: "Votre application de suivi de soins à domicile. Voici comment elle fonctionne en quelques écrans." },
  { emoji: "🩺", titre: "Vos mesures", texte: "Depuis l'accueil, saisissez vos constantes (tension, température, saturation…) lorsque cela vous est demandé. Tout est transmis à votre équipe." },
  { emoji: "📝", titre: "Votre bilan du jour", texte: "Les jours de suivi, un court questionnaire « état général » vous est proposé automatiquement. Quelques clics suffisent." },
  { emoji: "💬", titre: "Votre infirmière", texte: "Une question, un doute ? Écrivez à votre infirmière coordinatrice via la messagerie, onglet « Infirmière »." },
  { emoji: "📄", titre: "Conseils & documents", texte: "Retrouvez à tout moment vos conseils de soins, vos ordonnances et vos documents." },
];

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");

// Onboarding affiché à la première connexion (tant que le RGPD n'est pas signé).
export function OnboardingPatient() {
  const patient = usePatientSession();
  const [row, setRow] = useState<Row | null>(null);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [nom, setNom] = useState("");
  const [accepte, setAccepte] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    createClient().from("patient").select("nom,operation,date_operation,duree_prise_en_charge,jours_suivi,traitement,rgpd_signe_le").eq("id", patient.id).maybeSingle()
      .then(({ data }) => { const r = data as Row | null; setRow(r); setShow(!!r && !r.rgpd_signe_le); setNom(r?.nom ?? ""); });
  }, [patient?.id]);

  if (!show || !row) return null;

  const stepProtocole = TUTO.length;       // avant-dernière étape
  const stepRgpd = TUTO.length + 1;        // dernière étape
  const total = TUTO.length + 2;

  async function signer() {
    if (!accepte || !nom.trim()) return;
    setBusy(true);
    const res = await fetch("/api/patient/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom: nom.trim() }) });
    setBusy(false);
    if (res.ok) setShow(false);
    else alert("Échec de l'enregistrement. Réessayez.");
  }

  const jours = (row.jours_suivi ?? []).slice().sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* progression */}
        <div className="flex justify-center gap-1.5 px-6 pt-5">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-brand" : i < step ? "w-3 bg-rose-300" : "w-3 bg-rose-100"}`} />
          ))}
        </div>

        <div className="grid flex-1 content-start gap-3 overflow-y-auto px-6 py-6 text-center">
          {step < stepProtocole && (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-3xl">{TUTO[step].emoji}</span>
              <h2 className="text-xl font-bold text-slate-800">{TUTO[step].titre}</h2>
              <p className="text-sm leading-relaxed text-slate-500">{TUTO[step].texte}</p>
            </>
          )}

          {step === stepProtocole && (
            <div className="text-left">
              <h2 className="text-center text-xl font-bold text-slate-800">📋 Votre protocole de suivi</h2>
              <p className="mb-3 text-center text-sm text-slate-500">Voici ce qui est prévu pour vous.</p>
              <dl className="grid gap-2 rounded-2xl border border-rose-100 bg-rose-50/40 p-4 text-sm">
                {row.operation && <Ligne label="Intervention" value={row.operation} />}
                <Ligne label={row.operation ? "Date d'opération" : "Début de prise en charge"} value={fmtDate(row.date_operation)} />
                {row.duree_prise_en_charge != null && <Ligne label="Durée du suivi" value={`${row.duree_prise_en_charge} jour${row.duree_prise_en_charge > 1 ? "s" : ""}`} />}
                {jours.length > 0 && <Ligne label="Jours de suivi" value={jours.map((j) => `J${j}`).join(" · ")} />}
                {row.traitement && <Ligne label="Traitement" value={row.traitement} />}
              </dl>
              <p className="mt-3 text-center text-xs text-slate-400">Les jours de suivi, un bilan vous sera proposé automatiquement. En cas d&apos;anomalie, votre infirmière vous contactera.</p>
            </div>
          )}

          {step === stepRgpd && (
            <div className="text-left">
              <h2 className="text-center text-xl font-bold text-slate-800">🔒 Protection de vos données</h2>
              <div className="my-3 rounded-2xl border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-slate-700">
                Vos données sont protégées et vues uniquement par votre équipe de soins.
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                Vos données de santé sont collectées pour assurer votre suivi de soins à domicile, conformément au RGPD. Elles sont hébergées de façon sécurisée et ne sont accessibles qu&apos;aux professionnels de votre équipe de soins. Vous pouvez à tout moment exercer vos droits d&apos;accès, de rectification et de suppression auprès de votre prestataire.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
                <span>J&apos;ai lu et j&apos;accepte la politique de confidentialité et le traitement de mes données de santé.</span>
              </label>
              <div className="mt-3">
                <label className="label">Signature électronique (tapez votre nom)</label>
                <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom et prénom" />
              </div>
            </div>
          )}
        </div>

        {/* navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-rose-100 px-6 py-4">
          {step > 0 ? (
            <button onClick={() => setStep((s) => s - 1)} className="btn-secondary px-4 py-2 text-sm">Précédent</button>
          ) : <span />}
          {step < stepRgpd ? (
            <button onClick={() => setStep((s) => s + 1)} className="btn-primary px-5 py-2 text-sm">{step === stepProtocole ? "J'ai compris" : "Suivant"}</button>
          ) : (
            <button onClick={signer} disabled={!accepte || !nom.trim() || busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">{busy ? "Validation…" : "Je signe et j'accède"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Ligne({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-slate-700">{value}</dd>
    </div>
  );
}
