import Link from "next/link";

// Petit lien de retour vers le hub « Nouveau » (mobile + desktop).
export function RetourNouveau() {
  return (
    <Link
      href="/pro/nouveau"
      className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Retour
    </Link>
  );
}
