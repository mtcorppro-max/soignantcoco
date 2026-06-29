"use client";

import { useEffect } from "react";
import { motion, useAnimate, useInView } from "framer-motion";

const ETAPES = [
  {
    icon: "pulse",
    titre: "Le patient transmet ses données",
    description:
      "Constantes (température, tension, SpO₂, fréquence cardiaque, poids) et photos de cicatrice depuis son téléphone, ou saisies par l'infirmière lors de son passage.",
  },
  {
    icon: "bell",
    titre: "Surveillance & alertes",
    description:
      "Dès qu'une valeur franchit un seuil, une alerte est générée automatiquement et envoyée par SMS, avec escalade vers un second contact en l'absence de réponse.",
  },
  {
    icon: "chat",
    titre: "Suivi, échanges & ordonnances",
    description:
      "L'équipe échange avec le patient par messagerie sécurisée, valide les suivis planifiés. Le chirurgien génère et signe électroniquement les ordonnances CERFA depuis son protocole, envoyées automatiquement à la pharmacie.",
  },
  {
    icon: "truck",
    titre: "Coordination & livraison",
    description:
      "Chaque suivi génère un compte rendu PDF. Le livreur reçoit sa tournée du jour avec carte et itinéraire optimisé. Le manager pilote par agence et par région.",
  },
];

// Barre linéaire : les icônes sont à 0 %, ~33 % et ~66 % de sa longueur
const BAR_DURATION = 5;    // secondes — lent et lisible
const BAR_DELAY   = 0.4;   // secondes avant le départ

const PULSE_DELAYS_MS = [
  BAR_DELAY * 1000,                              // étape 1 : départ
  (BAR_DELAY + BAR_DURATION * 0.30) * 1000,     // étape 2 : ~30 % du trajet
  (BAR_DELAY + BAR_DURATION * 0.60) * 1000,     // étape 3 : ~60 % du trajet
  (BAR_DELAY + BAR_DURATION * 0.90) * 1000,     // étape 4 : ~90 % du trajet
];

function pulseIcon(
  animate: ReturnType<typeof useAnimate>[1],
  selector: string
) {
  animate(
    selector,
    {
      scale:  [1, 1.45, 0.85, 1.15, 0.97, 1],
      rotate: [0,  -6,    6,   -3,    2,  0],
    },
    { duration: 0.65, ease: "easeInOut" }
  );
}

export function EtapesAnimees() {
  const [scope, animate] = useAnimate();
  const inView = useInView(scope, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;

    const timers = PULSE_DELAYS_MS.map((delay, i) =>
      setTimeout(() => pulseIcon(animate, `[data-step-icon="${i}"]`), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [inView, animate]);

  return (
    <div ref={scope} className="relative mt-14 grid gap-10 md:grid-cols-4">

      {/* Piste grise fond */}
      <div className="absolute left-6 right-6 top-6 hidden h-0.5 bg-rose-100 md:block" />

      {/* Barre brand qui avance */}
      <motion.div
        className="absolute left-6 top-6 hidden h-0.5 bg-brand md:block"
        initial={{ width: 0 }}
        animate={inView ? { width: "calc(100% - 3rem)" } : { width: 0 }}
        transition={{
          duration: BAR_DURATION,
          ease: "linear",        // vitesse constante → timing prévisible
          delay: BAR_DELAY,
        }}
      />

      {ETAPES.map((e, i) => (
        <div key={e.titre} className="relative flex flex-col items-start gap-4">

          {/* Icône avec apparition douce */}
          <motion.div
            data-step-icon={i}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white shadow-md"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.12, ease: "backOut" }}
          >
            <EtapeIcon name={e.icon} className="h-6 w-6" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.35 + i * 0.15 }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
              Étape {i + 1}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-800">{e.titre}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{e.description}</p>
          </motion.div>

        </div>
      ))}
    </div>
  );
}

// Icônes des étapes (style ligne, cohérent avec la nav et les fonctionnalités).
function EtapeIcon({ name, className }: { name: string; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    pulse: (<path d="M3 12h4l2.5-7 4 14 2.5-7H21" />),
    bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7 2.5 7H3.5S6 15 6 9Z" /><path d="M10.3 21a1.8 1.8 0 0 0 3.4 0" /></>),
    chat: (<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />),
    truck: (<><path d="M3 6.5h11v9H3z" /><path d="M14 9.5h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.7" /><circle cx="17" cy="18" r="1.7" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} {...p} aria-hidden="true">
      {paths[name] ?? paths.chat}
    </svg>
  );
}
