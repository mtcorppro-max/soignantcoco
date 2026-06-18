"use client";
/**
 * Cache de données côté client avec déduplication.
 * Chaque clé ne déclenche qu'une seule requête réseau, même si plusieurs
 * composants demandent la même donnée simultanément.
 */
import { useState, useEffect } from "react";

type Fetcher<T> = () => Promise<T>;
const cache = new Map<string, { data: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();
const DATA_TTL = 30_000; // 30 s — donnée fraîche

export function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.ts > DATA_TTL) return null;
  return hit.data as T;
}

export function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidate(key: string) {
  cache.delete(key);
}

/** Fetch dédupliqué : si un fetch est déjà en cours, retourne la même promesse. */
export function fetchOnce<T>(key: string, fetcher: Fetcher<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return Promise.resolve(hit);
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fetcher().then((data) => {
    setCached(key, data);
    inflight.delete(key);
    return data;
  });
  inflight.set(key, p);
  return p;
}

/** Hook React qui consomme fetchOnce avec état local.
 *  Si `enabled` est false, le fetch ne démarre pas (utile quand les deps ne sont pas encore prêtes). */
export function useData<T>(key: string, fetcher: Fetcher<T>, deps: unknown[] = [], enabled = true): T | null {
  const [data, setData] = useState<T | null>(() => enabled ? getCached<T>(key) : null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchOnce(key, fetcher).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return data;
}
