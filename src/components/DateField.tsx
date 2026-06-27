"use client";

import { useEffect, useRef, useState } from "react";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Champ de date moderne (calendrier popover, thème du site). value/onChange en ISO "YYYY-MM-DD".
export function DateField({ value, onChange, placeholder = "Choisir une date" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"jours" | "mois" | "annees">("jours");
  const ref = useRef<HTMLDivElement>(null);
  const sel = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState(() => (sel ? new Date(sel) : new Date()));

  // Saisie clavier « JJ/MM/AAAA » synchronisée avec la valeur.
  const isoToFr = (v: string) => { const [Y, M, D] = v.split("-"); return `${D}/${M}/${Y}`; };
  const [texte, setTexte] = useState(value ? isoToFr(value) : "");
  useEffect(() => { setTexte(value ? isoToFr(value) : ""); }, [value]);

  const onType = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setTexte([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/"));
    if (digits.length === 0) { onChange(""); return; }
    if (digits.length === 8) {
      const dd = +digits.slice(0, 2), mm = +digits.slice(2, 4), yy = +digits.slice(4, 8);
      const dt = new Date(yy, mm - 1, dd);
      if (dt.getFullYear() === yy && dt.getMonth() === mm - 1 && dt.getDate() === dd) {
        onChange(iso(yy, mm - 1, dd));
        setView(dt);
      }
    }
  };

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setMode("jours"); } };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const today = new Date();
  const estJour = (d: number, dt: Date) => dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;

  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const nb = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: nb }, (_, i) => i + 1)];
  const decadeStart = Math.floor(y / 12) * 12;

  const Chevron = ({ dir, onClick }: { dir: "g" | "d"; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d={dir === "g" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <div className="input flex w-full items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder={placeholder === "Choisir une date" ? "jj/mm/aaaa" : placeholder}
          value={texte}
          onChange={onType}
          onFocus={() => { if (window.matchMedia?.("(pointer: coarse)").matches) return; setOpen(true); setMode("jours"); }}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
        />
        <button type="button" onClick={() => { setOpen((o) => !o); setMode("jours"); }} title="Calendrier" className="shrink-0 text-brand hover:opacity-80">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4">
            <rect x="3" y="4.5" width="18" height="17" rx="2" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" /><line x1="3" y1="9.5" x2="21" y2="9.5" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-rose-200 bg-white p-3 shadow-xl">
          {/* En-tête : navigation + bascule de mode */}
          <div className="mb-2 flex items-center justify-between">
            <Chevron dir="g" onClick={() => setView(mode === "annees" ? new Date(y - 12, m, 1) : mode === "mois" ? new Date(y - 1, m, 1) : new Date(y, m - 1, 1))} />
            <button type="button" onClick={() => setMode(mode === "jours" ? "mois" : mode === "mois" ? "annees" : "jours")} className="rounded-lg px-3 py-1 text-sm font-semibold capitalize text-slate-700 hover:bg-rose-50 hover:text-brand">
              {mode === "jours" ? `${MOIS[m]} ${y}` : mode === "mois" ? `${y}` : `${decadeStart} – ${decadeStart + 11}`}
            </button>
            <Chevron dir="d" onClick={() => setView(mode === "annees" ? new Date(y + 12, m, 1) : mode === "mois" ? new Date(y + 1, m, 1) : new Date(y, m + 1, 1))} />
          </div>

          {mode === "jours" && (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
                {JOURS.map((j, i) => <span key={i} className="py-1">{j}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) =>
                  d === null ? <span key={i} /> : (
                    <button key={i} type="button" onClick={() => { onChange(iso(y, m, d)); setOpen(false); }}
                      className={`h-8 rounded-lg text-sm transition ${
                        sel && estJour(d, sel) ? "bg-brand font-semibold text-white"
                          : estJour(d, today) ? "font-semibold text-brand ring-1 ring-rose-200 hover:bg-rose-50"
                            : "text-slate-600 hover:bg-rose-50"}`}>
                      {d}
                    </button>
                  )
                )}
              </div>
            </>
          )}

          {mode === "mois" && (
            <div className="grid grid-cols-3 gap-1">
              {MOIS_COURT.map((mc, i) => (
                <button key={i} type="button" onClick={() => { setView(new Date(y, i, 1)); setMode("jours"); }}
                  className={`rounded-lg py-2 text-sm capitalize transition ${i === m ? "bg-brand font-semibold text-white" : "text-slate-600 hover:bg-rose-50"}`}>
                  {mc}
                </button>
              ))}
            </div>
          )}

          {mode === "annees" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((an) => (
                <button key={an} type="button" onClick={() => { setView(new Date(an, m, 1)); setMode("mois"); }}
                  className={`rounded-lg py-2 text-sm transition ${an === y ? "bg-brand font-semibold text-white" : "text-slate-600 hover:bg-rose-50"}`}>
                  {an}
                </button>
              ))}
            </div>
          )}

          {value && mode === "jours" && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="mt-2 w-full rounded-lg py-1 text-xs text-slate-400 hover:text-critique">
              Effacer la date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
