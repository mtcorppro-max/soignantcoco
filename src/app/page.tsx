import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EtapesAnimees } from "@/components/EtapesAnimees";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-rose-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          {/* Mobile : icône PWA (cœur sur fond rose foncé) — Desktop : logo complet */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192x192.png" alt="AS2CŒUR" className="h-9 w-9 shrink-0 rounded-xl md:hidden" />
          <Logo className="hidden md:inline-flex" />
          <nav className="hidden gap-1 md:flex">
            {[
              ["Fonctionnalités", "#fonctionnalites"],
              ["Comment ça marche", "#fonctionnement"],
              ["Sécurité", "#securite"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-brand"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
            <Link href="/login/patient" className="btn-secondary whitespace-nowrap py-2 text-center text-sm">
              Patient
            </Link>
            <Link href="/login/pro" className="btn-primary whitespace-nowrap py-2 text-center text-sm">
              Équipe médicale
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Photo de fond */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/NUMERO1.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Dégradé rose foncé de gauche vers transparent */}
          <div className="absolute inset-0 bg-rose-950/60 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-rose-950/90 via-rose-900/60 to-rose-950/30 md:from-rose-950/80 md:via-rose-900/50 md:to-transparent" />

          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:py-36">
            {/* Texte */}
            <div className="[text-shadow:_0_2px_12px_rgba(0,0,0,0.5)]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" />
                Télésuivi post-opératoire
              </div>
              <h1 className="text-4xl font-bold leading-tight text-white drop-shadow-lg md:text-5xl">
                Votre rétablissement{" "}
                <span className="text-white md:text-rose-300">suivi de près,</span>{" "}
                à domicile.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-white drop-shadow-md">
                AS2CŒUR accompagne les patients après une opération
                digestive : mesure des constantes, alertes automatiques et
                messagerie directe avec votre équipe soignante.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login/patient" className="rounded-xl bg-brand px-7 py-3 text-base font-semibold text-white shadow-lg hover:bg-brand-dark">
                  Accès patient
                </Link>
                <Link href="/login/pro" className="bord-anim rounded-xl bg-white/20 px-7 py-3 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/30">
                  Équipe médicale
                </Link>
              </div>
              <p className="mt-5 text-xs text-white/50">
                Prototype — accès strictement réservé aux personnes ayant une relation
                de soin avec le patient.
              </p>
            </div>

            {/* Mockup téléphone — desktop uniquement */}
            <div className="hidden lg:flex lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </section>

        {/* ── Comment ça marche ───────────────────────────────── */}
        <section id="fonctionnement" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <SectionTitle
              tag="Comment ça marche"
              title={`Simple pour le patient,\npuissant pour l'équipe.`}
            />
            <EtapesAnimees />
          </div>
        </section>

        {/* ── Fonctionnalités ─────────────────────────────────── */}
        <section id="fonctionnalites" className="bg-rose-800 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-white">Fonctionnalités</p>
              <h2 className="mt-2 whitespace-pre-line text-3xl font-bold text-white md:text-4xl">{`Tout ce qu'il faut\npour un suivi serein.`}</h2>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.titre} className="bord-anim flex flex-col gap-3 rounded-2xl bg-rose-900/50 p-5 transition hover:bg-rose-900/70">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20 text-xl text-white">
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-white">{f.titre}</h3>
                  <p className="text-sm leading-relaxed text-rose-200">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sécurité ────────────────────────────────────────── */}
        <section id="securite" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-14 lg:grid-cols-2">

              {/* Photos côte à côte façon "About Us" */}
              <div className="relative flex gap-4">
                {/* Photo gauche — plus haute */}
                <div className="w-1/2 overflow-hidden rounded-2xl shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/YES1.png.webp"
                    alt="Soignant accompagnant un patient"
                    className="h-full w-full object-cover"
                    style={{ minHeight: "340px" }}
                  />
                </div>
                {/* Photo droite — décalée vers le bas */}
                <div className="mt-10 w-1/2 overflow-hidden rounded-2xl shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/YES2.jpeg"
                    alt="Équipe soignante"
                    className="h-full w-full object-cover"
                    style={{ minHeight: "300px" }}
                  />
                </div>
              </div>

              {/* Texte */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
                  Sécurité &amp; Confidentialité
                </p>
                <h2 className="mt-2 text-3xl font-bold leading-tight text-slate-800 md:text-4xl">
                  Vos données de santé,
                  <br />
                  protégées par conception.
                </h2>
                <p className="mt-4 leading-relaxed text-slate-500">
                  Chaque règle d&apos;accès est appliquée directement en base
                  de données (Row Level Security). Un professionnel ne voit que
                  les patients de son prestataire ; un patient ne voit que son
                  propre dossier.
                </p>

                {/* Points clés 2 colonnes */}
                <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3">
                  {SECURITE.map((s) => (
                    <div key={s} className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] text-white">✓</span>
                      {s}
                    </div>
                  ))}
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section className="bg-rose-800 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-rose-300">FAQ</p>
              <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
                Questions fréquentes
              </h2>
            </div>
            <div className="mt-12 grid gap-4">
              {FAQ.map((item) => (
                <details key={item.q} className="group overflow-hidden rounded-2xl border border-white/30 bg-rose-900/50 open:shadow-lg transition-shadow">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold text-white">
                    {item.q}
                    <span className="shrink-0 text-rose-300 transition-transform duration-200 group-open:rotate-45">
                      ＋
                    </span>
                  </summary>
                  <p className="px-6 pb-5 text-sm leading-relaxed text-rose-200">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA final ───────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white py-24 text-center">
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-rose-50" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-rose-50" />
          <div className="relative mx-auto max-w-2xl px-6">
            <h2 className="text-3xl font-bold text-slate-800 md:text-4xl">Prêt à commencer ?</h2>
            <p className="mt-3 text-slate-500">
              Accédez à votre espace en quelques secondes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/login/patient"
                className="rounded-xl bg-brand px-8 py-3 text-base font-semibold text-white shadow hover:bg-brand-dark"
              >
                Espace patient
              </Link>
              <Link
                href="/login/pro"
                className="rounded-xl border border-rose-200 px-8 py-3 text-base font-semibold text-brand hover:bg-rose-50"
              >
                Espace professionnel
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-rose-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-400 sm:flex-row">
          <Logo />
          <p>Prototype — Télésuivi post-opératoire à domicile</p>
          <p>© 2026 AS2CŒUR</p>
        </div>
      </footer>
    </div>
  );
}

// ── Données ─────────────────────────────────────────────────────────



const FEATURES = [
  {
    icon: "∿",
    titre: "Suivi des constantes",
    description:
      "Température, tension artérielle, saturation en oxygène, fréquence cardiaque et poids, avec courbes, ligne de seuil rouge et tableau simplifié.",
  },
  {
    icon: "◎",
    titre: "Alertes automatiques",
    description:
      "Dès qu'une mesure franchit le seuil, un SMS est envoyé automatiquement au numéro 1. Sans réponse, le numéro 2 est contacté en escalade. Chaque action est tracée et horodatée.",
  },
  {
    icon: "◇",
    titre: "Messagerie directe",
    description:
      "Canal de chat sécurisé entre le patient et la coordinatrice ou le chirurgien, en temps réel. Le délégué est exclu par design.",
  },
  {
    icon: "◻",
    titre: "Photos de cicatrice",
    description:
      "Le patient envoie des photos depuis son téléphone (accès caméra direct). Stockage privé, URLs signées côté pro.",
  },
  {
    icon: "▤",
    titre: "Comptes rendus PDF",
    description:
      "Fiche de suivi structurée (état général, constantes, douleur, alimentation, cicatrisation…) générant un compte rendu PDF avec courbes de surveillance et photos de la cicatrice.",
  },
  {
    icon: "◷",
    titre: "Planification des suivis",
    description:
      "Durée de prise en charge par patient, suivi prévu à J1 et au dernier jour, et rappels d'actions à réaliser directement dans le tableau de bord.",
  },
  {
    icon: "▦",
    titre: "Organisation de l'équipe",
    description:
      "Calendrier des congés des soignants et gestion des astreintes (semaine / week-end), avec alerte si elles ne sont pas renseignées à l'avance.",
  },
  {
    icon: "✦",
    titre: "Conseils personnalisés",
    description:
      "Conseils hygiéno-diététiques quotidiens en rotation, avec alerte météo automatique (forte chaleur ≥ 30 °C, grand froid ≤ 2 °C).",
  },
  {
    icon: "⌂",
    titre: "Cockpit coordinatrice",
    description:
      "Dashboard trié par criticité, fiche patient complète avec seuils ajustables, création de patient et génération de code.",
  },
];

const FAQ = [
  {
    q: "Comment le patient reçoit-il son code de connexion ?",
    a: "La coordinatrice crée le dossier patient depuis son cockpit et génère un code unique à usage personnel. Ce code est remis directement au patient, sans email ni mot de passe à retenir.",
  },
  {
    q: "Que se passe-t-il si une alerte n'est pas traitée ?",
    a: "Un SMS est envoyé automatiquement au premier numéro d'urgence. Sans réponse dans le délai paramétré, le second numéro est contacté. Chaque étape est horodatée et tracée dans le dossier.",
  },
  {
    q: "Comment se passe le suivi du patient ?",
    a: "Au-delà des constantes, l'équipe réalise des suivis structurés (état général, douleur, cicatrisation, alimentation…), planifiés notamment à J1 et au dernier jour de prise en charge. Chaque suivi génère un compte rendu PDF avec les courbes de surveillance et les photos de cicatrice.",
  },
  {
    q: "Le chirurgien peut-il définir son propre protocole ?",
    a: "Oui. À la création de son compte, le médecin renseigne ses consignes (molécules, débits, pansement, suivi…), la durée de prise en charge et le nombre de suivis souhaités. Le suivi s'adapte ainsi aux préférences de chaque praticien.",
  },
  {
    q: "Que se passe-t-il quand un soignant est absent ?",
    a: "L'application intègre un calendrier des congés et la gestion des astreintes (semaine et week-end), avec une alerte si elles ne sont pas renseignées à l'avance, pour garantir la continuité du suivi.",
  },
  {
    q: "Qui peut consulter les photos de cicatrice envoyées ?",
    a: "Uniquement les professionnels de santé rattachés au prestataire du patient (coordinatrice, chirurgien). Les photos sont stockées dans un espace privé et accessibles uniquement via des liens signés à durée limitée.",
  },
  {
    q: "L'application est-elle conforme au RGPD ?",
    a: "L'application est conçue selon les principes du RGPD : accès par rôle, cloisonnement strict des données et journalisation des actions. Les données de santé (constantes, photos, dossiers) relèvent de l'hébergement HDS (Hébergeur de Données de Santé), certification obligatoire en France : la mise en production s'appuie sur un hébergeur certifié HDS, conformément à la réglementation.",
  },
];

const SECURITE = [
  "RLS active sur 100 % des tables",
  "Accès par rôle (infirmière coordinatrice / délégué médical / chirurgien)",
  "Dossier patient strictement cloisonné",
  "Clé service_role côté serveur uniquement",
  "Code unique régénérable sans mot de passe",
  "Alertes SMS en escalade automatique",
];

// ── Composants ──────────────────────────────────────────────────────

function SectionTitle({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
        {tag}
      </p>
      <h2 className="mt-2 whitespace-pre-line text-3xl font-bold text-slate-800 md:text-4xl">
        {title}
      </h2>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative">
      {/* Cadre téléphone */}
      <div className="relative h-[480px] w-[240px] overflow-hidden rounded-[3rem] border-[5px] border-slate-800 bg-rose-50 shadow-2xl">
        {/* Encoche */}
        <div className="absolute left-1/2 top-3 h-5 w-20 -translate-x-1/2 rounded-full bg-slate-800" />

        {/* Contenu écran */}
        <div className="mt-12 px-4 pb-4">
          {/* En-tête app */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-brand">AS2CŒUR</span>
            <span className="text-[10px] text-slate-400">Bonjour Marie</span>
          </div>

          {/* Cards constantes */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[
              { label: "Temp.", val: "37.4 °C", ok: true },
              { label: "SpO₂", val: "97 %", ok: true },
              { label: "TA sys.", val: "128", ok: true },
              { label: "TA dia.", val: "82", ok: true },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-white p-2 shadow-sm">
                <p className="text-[8px] text-slate-400">{m.label}</p>
                <p className="text-xs font-bold text-brand">{m.val}</p>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-rose-100">
                  <div className="h-1 rounded-full bg-brand" style={{ width: "62%" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Mini graphique */}
          <div className="mb-3 rounded-xl bg-white p-3 shadow-sm">
            <p className="mb-2 text-[8px] text-slate-400">Température — 7 jours</p>
            <svg width="100%" height="44" viewBox="0 0 200 44" fill="none">
              {/* Ligne seuil rouge */}
              <line x1="0" y1="12" x2="200" y2="12" stroke="#dc2626" strokeWidth="1" strokeDasharray="4 2" />
              {/* Courbe */}
              <polyline
                points="0,34 33,30 66,31 100,24 133,36 166,28 200,18"
                stroke="#961446"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Points */}
              {[[0,34],[33,30],[66,31],[100,24],[133,36],[166,28],[200,18]].map(([x,y]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="#961446" />
              ))}
              {/* Point hors seuil */}
              <circle cx="133" cy="36" r="3.5" fill="#dc2626" />
            </svg>
          </div>

          {/* Bouton saisie */}
          <div className="mb-3 rounded-xl bg-brand py-2 text-center text-[10px] font-semibold text-white">
            ＋ Saisir une mesure
          </div>

          {/* Bulle message */}
          <div className="rounded-xl bg-white p-2.5 shadow-sm">
            <p className="text-[8px] font-bold text-brand">◇ Nouveau message</p>
            <p className="mt-0.5 text-[8px] text-slate-500">Tout va bien, continuez ainsi.</p>
          </div>
        </div>
      </div>

      {/* Badge alerte flottant */}
      <div className="absolute -right-6 top-14 rounded-2xl bg-white px-3 py-2 shadow-lg">
        <p className="text-[10px] font-bold text-critique">⚠ Alerte</p>
        <p className="text-[9px] text-slate-500">Temp. 39.2 °C</p>
      </div>

      {/* Badge coordinatrice flottante */}
      <div className="absolute -left-10 bottom-24 rounded-2xl bg-white px-3 py-2 shadow-lg">
        <p className="text-[10px] font-bold text-brand">Coordinatrice</p>
        <p className="text-[9px] text-slate-500">Traité à 14h32</p>
      </div>
    </div>
  );
}
