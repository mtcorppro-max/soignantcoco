"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = { label: string; name: string; postcode: string; city: string };

// Autocomplétion d'adresse via la Base Adresse Nationale (api-adresse.data.gouv.fr).
// API publique française, sans clé. En tapant l'adresse, on propose des adresses
// réelles ; à la sélection, code postal et ville sont remplis automatiquement.
export function AdresseAutocomplete({
  adresse,
  codePostal,
  ville,
  onChange,
}: {
  adresse: string;
  codePostal: string;
  ville: string;
  onChange: (v: { adresse: string; code_postal: string; ville: string }) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState(false); // ne fetch qu'après frappe utilisateur
  const boxRef = useRef<HTMLDivElement>(null);

  // Recherche d'adresses (débounce 250 ms)
  useEffect(() => {
    if (!recherche) return;
    const q = adresse.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
        );
        if (!res.ok) return;
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sugg: Suggestion[] = (data.features ?? []).map((f: any) => ({
          label: f.properties.label,
          name: f.properties.name,
          postcode: f.properties.postcode,
          city: f.properties.city,
        }));
        setSuggestions(sugg);
        setOuvert(true);
      } catch {
        /* réseau indisponible : on laisse la saisie manuelle */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [adresse, recherche]);

  // Fermer la liste au clic extérieur
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choisir(s: Suggestion) {
    setRecherche(false);
    setOuvert(false);
    setSuggestions([]);
    onChange({ adresse: s.name, code_postal: s.postcode, ville: s.city });
  }

  return (
    <div className="grid gap-4">
      <div className="relative" ref={boxRef}>
        <label className="label">Adresse</label>
        <input
          className="input"
          value={adresse}
          autoComplete="off"
          placeholder="Tapez l'adresse, ex. 12 rue de la Paix…"
          onChange={(e) => {
            setRecherche(true);
            onChange({ adresse: e.target.value, code_postal: codePostal, ville });
          }}
          onFocus={() => suggestions.length > 0 && setOuvert(true)}
        />
        {ouvert && suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-rose-100 bg-white shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => choisir(s)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-rose-50"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Code postal</label>
          <input
            className="input"
            value={codePostal}
            onChange={(e) => onChange({ adresse, code_postal: e.target.value, ville })}
          />
        </div>
        <div>
          <label className="label">Ville</label>
          <input
            className="input"
            value={ville}
            onChange={(e) => onChange({ adresse, code_postal: codePostal, ville: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
