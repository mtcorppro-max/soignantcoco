"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionPatient = { id: string; nom: string; code_postal: string | null; user_id: string };
export type SessionPro = { id: string; nom: string; prenom: string | null; titre: string | null; role: string; niveau: number; agence_id: string | null; region_id: string | null; prestataire_id: string; user_id: string; recevoir_alertes: boolean };

const LS_PATIENT = "sc_patient";
const LS_PRO = "sc_pro6"; // bump : ajout recevoir_alertes
const TTL = 15 * 60 * 1000; // 15 min

type Cached<T> = { v: T; ts: number };

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { v, ts } = JSON.parse(raw) as Cached<T>;
    if (Date.now() - ts > TTL) { localStorage.removeItem(key); return null; }
    return v;
  } catch { return null; }
}

function lsSet<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); } catch { /* private mode */ }
}

// Module-level memory cache — survit aux re-renders, pas aux refreshs
let memPatient: SessionPatient | null = null;
let memPro: SessionPro | null = null;

// ── Patient ──────────────────────────────────────────────────────────

export function usePatientSession() {
  // Init = cache mémoire uniquement (null au 1er chargement, donc identique
  // côté serveur et client → pas d'erreur d'hydratation). Le localStorage est
  // lu après le montage. Lors des navigations suivantes, memPatient est déjà
  // rempli → affichage instantané sans flash.
  const [patient, setPatient] = useState<SessionPatient | null>(memPatient);

  useEffect(() => {
    if (patient) return; // déjà en cache mémoire
    const cached = lsGet<SessionPatient>(LS_PATIENT);
    if (cached) { memPatient = cached; setPatient(cached); return; }
    fetchPatient().then((p) => { if (p) setPatient(p); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return patient;
}

async function fetchPatient(): Promise<SessionPatient | null> {
  const supabase = createClient();
  // getSession lit depuis localStorage du client Supabase — pas de réseau
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from("patient")
    .select("id,nom,code_postal,user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!data) return null;
  const p = data as SessionPatient;
  memPatient = p;
  lsSet(LS_PATIENT, p);
  return p;
}

// ── Pro ──────────────────────────────────────────────────────────────

export function useProSession() {
  const [pro, setPro] = useState<SessionPro | null>(memPro);

  useEffect(() => {
    if (pro) return;
    const cached = lsGet<SessionPro>(LS_PRO);
    if (cached) { memPro = cached; setPro(cached); return; }
    fetchPro().then((p) => { if (p) setPro(p); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return pro;
}

async function fetchPro(): Promise<SessionPro | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  // On tente avec recevoir_alertes ; si la colonne n'existe pas encore
  // (migration 0051 non appliquée), on retombe sur la requête sans ce champ
  // pour ne jamais casser la connexion.
  const COLS = "id,nom,prenom,titre,role,niveau,agence_id,region_id,prestataire_id,user_id";
  let { data, error } = await supabase
    .from("professionnel")
    .select(`${COLS},recevoir_alertes`)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) {
    ({ data } = await supabase
      .from("professionnel")
      .select(COLS)
      .eq("user_id", session.user.id)
      .maybeSingle());
  }
  if (!data) return null;
  const p = { recevoir_alertes: false, ...(data as object) } as SessionPro;
  memPro = p;
  lsSet(LS_PRO, p);
  return p;
}

// Met à jour le cache de session pro (mémoire + localStorage) sans refetch.
// Utile après que l'utilisateur a modifié son propre profil (ex. opt-in alertes)
// pour que les écrans suivants reflètent la nouvelle valeur sans re-connexion.
export function patchProSession(patch: Partial<SessionPro>) {
  if (!memPro) {
    const cached = lsGet<SessionPro>(LS_PRO);
    if (cached) memPro = cached;
  }
  if (!memPro) return;
  memPro = { ...memPro, ...patch };
  lsSet(LS_PRO, memPro);
}

// Exposer pour invalider le cache à la déconnexion
export function clearSessionCache() {
  memPatient = null;
  memPro = null;
  try { localStorage.removeItem(LS_PATIENT); localStorage.removeItem(LS_PRO); } catch { /* */ }
}
