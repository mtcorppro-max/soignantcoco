"use client";

import * as React from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

export function AnimatedButton({
  label,
  href,
  highlightHueDeg = 340,
  className,
}: {
  label: string;
  href: string;
  highlightHueDeg?: number;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={clsx("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => router.push(href)}
        className={clsx(
          "ui-anim-btn",
          "relative flex items-center justify-center gap-2",
          "cursor-pointer select-none rounded-[24px]",
          "px-7 py-3 text-base font-semibold"
        )}
        style={{ ["--highlight-hue" as string]: `${highlightHueDeg}deg` } as React.CSSProperties}
      >
        {/* Icône sparkles */}
        <svg
          className="ui-anim-btn-svg h-5 w-5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
          />
        </svg>

        {/* Lettres animées en décalé */}
        <span className="flex">
          {Array.from(label).map((ch, i) => (
            <span
              key={i}
              className="ui-anim-letter inline-block"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
      </button>
    </div>
  );
}
