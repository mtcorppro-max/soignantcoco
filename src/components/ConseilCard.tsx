import type { Conseil } from "@/lib/conseils";

// Carte d'un conseil. Variante "meteo" mise en avant (bandeau ambré).
export function ConseilCard({
  conseil,
  highlight = false,
}: {
  conseil: Conseil;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-rose-700 bg-rose-800 p-4"
          : "card p-4"
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{conseil.emoji}</span>
        <div>
          <h3
            className={
              highlight
                ? "text-sm font-semibold text-white"
                : "text-sm font-semibold text-slate-800"
            }
          >
            {conseil.titre}
          </h3>
          <p
            className={
              highlight
                ? "mt-1 text-sm text-rose-200"
                : "mt-1 text-sm text-slate-500"
            }
          >
            {conseil.contenu}
          </p>
        </div>
      </div>
    </div>
  );
}
