"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const STATS = [
  { valeur: "5", label: "Constantes surveillées", num: 5, suffix: "" },
  { valeur: "< 1 min", label: "Délai d'alerte automatique", num: null, suffix: "" },
  { valeur: "3", label: "Rôles professionnels", num: 3, suffix: "" },
  { valeur: "100%", label: "Accès sécurisé RLS", num: 100, suffix: "%" },
];

function useCounter(target: number, duration = 1200, active: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = Math.ceil(duration / target);
    const timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start >= target) clearInterval(timer);
    }, step);
    return () => clearInterval(timer);
  }, [active, target, duration]);

  return count;
}

function StatItem({ valeur, label, num, suffix, active }: typeof STATS[0] & { active: boolean }) {
  const count = useCounter(num ?? 0, 1400, active && num !== null);
  const display = num !== null ? `${count}${suffix}` : valeur;

  return (
    <div className="text-center text-white">
      <p className="text-3xl font-bold transition-all duration-300 md:text-4xl">
        {num === null ? valeur : display}
      </p>
      <p className="mt-1 text-sm text-rose-200">{label}</p>
    </div>
  );
}

export function StatsAnimees() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 lg:grid-cols-4">
      {STATS.map((s) => (
        <StatItem key={s.label} {...s} active={inView} />
      ))}
    </div>
  );
}
