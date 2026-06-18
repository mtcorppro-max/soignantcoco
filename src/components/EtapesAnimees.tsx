"use client";

import { useEffect } from "react";
import { motion, useAnimate, useInView } from "framer-motion";

const ETAPES = [
  {
    icon: "∿",
    titre: "Le patient saisit ses constantes",
    description:
      "Depuis son téléphone, le patient entre sa température, tension, SpO₂ ou poids en quelques secondes, à tout moment de la journée.",
  },
  {
    icon: "◎",
    titre: "Alerte automatique",
    description:
      "Si une valeur dépasse le seuil fixé par le chirurgien, une alerte est générée instantanément sans aucune intervention manuelle.",
  },
  {
    icon: "✦",
    titre: "L'équipe soignante intervient",
    description:
      "La coordinatrice reçoit l'alerte sur son cockpit, peut contacter le patient par messagerie et tracer chaque action.",
  },
];

// Barre linéaire : les icônes sont à 0 %, ~33 % et ~66 % de sa longueur
const BAR_DURATION = 5;    // secondes — lent et lisible
const BAR_DELAY   = 0.4;   // secondes avant le départ

const PULSE_DELAYS_MS = [
  BAR_DELAY * 1000,                              // étape 1 : départ
  (BAR_DELAY + BAR_DURATION * 0.38) * 1000,     // étape 2 : ~38 % du trajet
  (BAR_DELAY + BAR_DURATION * 0.76) * 1000,     // étape 3 : ~76 % du trajet
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
    <div ref={scope} className="relative mt-14 grid gap-10 md:grid-cols-3">

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
            className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-xl text-white shadow-md"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.12, ease: "backOut" }}
          >
            {e.icon}
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
