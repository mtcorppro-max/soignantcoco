"use client";

import { useEffect, useRef, useState } from "react";

export type Option = { value: string; label: string };

// Menu déroulant maison (remplace le <select> natif) : s'ouvre proprement
// en dessous du champ, fond blanc, cohérent sur tous les navigateurs.
export function Select({
  value,
  onChange,
  options,
  placeholder = "— Choisir —",
  disabled,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex w-full items-center justify-between gap-2 text-left disabled:opacity-50"
        aria-invalid={required && !value ? true : undefined}
      >
        <span className={`min-w-0 truncate ${selected ? "text-slate-700" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-brand transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-rose-200 bg-white py-1 shadow-xl">
          {options.map((o) => {
            const actif = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition hover:bg-rose-50 ${actif ? "bg-rose-50 font-semibold text-brand" : "text-slate-700"}`}
                >
                  <span className="truncate">{o.label}</span>
                  {actif && <span className="text-brand">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
