"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export type PointLivraison = {
  id: string;
  nom: string;
  adresse: string;
  lat: number;
  lon: number;
  ordre?: number;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Carte des points de livraison (OpenStreetMap via Leaflet, sans clé API).
// Marqueurs numérotés (ordre de la tournée). Leaflet est importé dynamiquement
// pour rester compatible avec le rendu serveur.
export function CarteLivraisons({ points }: { points: PointLivraison[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (annule || !ref.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { scrollWheelZoom: false }).setView([46.6, 2.4], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;
      if (layerRef.current) layerRef.current.remove();
      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      const latlngs: [number, number][] = [];
      points.forEach((p) => {
        const icon = L.divIcon({
          className: "",
          html:
            `<div style="display:flex;align-items:center;justify-content:center;` +
            `width:26px;height:26px;border-radius:50% 50% 50% 0;background:#be123c;` +
            `color:#fff;font-size:12px;font-weight:700;transform:rotate(-45deg);` +
            `box-shadow:0 1px 4px rgba(0,0,0,.4);border:2px solid #fff;">` +
            `<span style="transform:rotate(45deg);">${p.ordre ?? ""}</span></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 24],
          popupAnchor: [0, -22],
        });
        L.marker([p.lat, p.lon], { icon })
          .addTo(group)
          .bindPopup(`<strong>${p.ordre ? p.ordre + ". " : ""}${escapeHtml(p.nom)}</strong><br>${escapeHtml(p.adresse)}`);
        latlngs.push([p.lat, p.lon]);
      });

      if (latlngs.length === 1) map.setView(latlngs[0], 14);
      else if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [30, 30] });
      else map.setView([46.6, 2.4], 5);

      setTimeout(() => map.invalidateSize(), 100);
    })();
    return () => { annule = true; };
  }, [points]);

  // Détruire la carte au démontage.
  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  return <div ref={ref} className="z-0 h-80 w-full overflow-hidden rounded-2xl border border-rose-100" />;
}
