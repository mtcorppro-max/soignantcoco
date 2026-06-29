"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

// Scanner caméra (QR / codes-barres) en surcouche modale.
// `continu` : reste ouvert et renvoie chaque scan (anti-doublon 1,5 s).
export function Scanner({
  onScan,
  onClose,
  continu = false,
  titre = "Scanner",
}: {
  onScan: (texte: string) => void;
  onClose: () => void;
  continu?: boolean;
  titre?: string;
}) {
  const idRef = useRef("scan-" + Math.random().toString(36).slice(2));
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const dernier = useRef<{ t: string; ts: number }>({ t: "", ts: 0 });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let monte = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!monte) return;
        const sc = new Html5Qrcode(idRef.current);
        scannerRef.current = sc;
        await sc.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (texte: string) => {
            const now = Date.now();
            if (texte === dernier.current.t && now - dernier.current.ts < 1500) return;
            dernier.current = { t: texte, ts: now };
            onScan(texte);
            if (!continu) { void arreter(); onClose(); }
          },
          () => { /* erreurs de frame ignorées */ }
        );
      } catch {
        setErr("Caméra inaccessible. Autorisez l'accès, ou scannez le QR avec l'appareil photo natif.");
      }
    })();
    return () => { monte = false; void arreter(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function arreter() {
    const sc = scannerRef.current;
    scannerRef.current = null;
    if (sc) { try { await sc.stop(); sc.clear(); } catch { /* déjà arrêté */ } }
  }
  function fermer() { void arreter(); onClose(); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={fermer}>
      <div className="card grid w-full max-w-sm gap-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-slate-700">{titre}</h2>
        <div id={idRef.current} className="overflow-hidden rounded-xl bg-black [&_video]:rounded-xl" />
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critique">{err}</p>}
        {continu && !err && <p className="text-center text-xs text-slate-400">Scannez les articles un par un.</p>}
        <button onClick={fermer} className="btn-secondary py-2 text-sm">Fermer</button>
      </div>
    </div>
  );
}
