"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionPatient = { id: string; nom: string; code_postal: string | null; user_id: string; date_naissance: string | null; sexe: string | null };
export type SessionPro = { id: string; nom: string; prenom: string | null; titre: string | null; role: string; niveau: number; agence_id: string | null; region_id: string | null; prestataire_id: string; user_id: string; recevoir_alertes: boolean; photo_url: string | null };

const LS_PATIENT = "sc_patient2"; // bump : ajout date_naissance + sexe (avatar-guide)
const LS_PRO = "sc_pro7"; // bump : ajout photo_url
const TTL = 15 * 60 * 1000; // 15 min

type Cached<T> = { v: T; ts: number };

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { v, ts } = JSON.parse(raw) as Cached<T>;
    if (Date.now() - ts > TTL) return null; // périmé (mais on ne supprime pas : stale-while-revalidate)
    return v;
  } catch { return null; }
}

// Lit le cache SANS tenir compte du TTL (affichage immédiat, même périmé).
function lsRead<T>(key: string): Cached<T> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch { return null; }
}

function lsSet<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify({ v, ts: Date.now() })); } catch { /* private mode */ }
}

// Module-level memory cache — survit aux re-renders, pas aux refreshs
let memPatient: SessionPatient | null = null;
let memPro: SessionPro | null = null;

// Abonnés à la session pro : permet de mettre à jour tous les composants qui
// utilisent useProSession (ex. l'avatar de l'en-tête) après un patchProSession,
// sans rechargement de page.
const proListeners = new Set<() => void>();
function notifierPro() { proListeners.forEach((l) => l()); }

// Revalidation en tâche de fond de la session pro. Ne vide JAMAIS la session
// en cas d'échec (réseau, jeton momentanément invalide) — on garde l'existant.
// Réessaie quelques fois si getSession() renvoie null : au démarrage à froid
// (surtout mobile iOS/Android), la restauration du jeton est asynchrone et la
// 1re tentative peut échouer — sans réessai, la navbar resterait bloquée.
let proRevalEnCours = false;
function revaliderPro() {
  if (proRevalEnCours) return;
  proRevalEnCours = true;
  const tenter = (n: number) => {
    fetchPro()
      .then((p) => {
        if (p) { proRevalEnCours = false; notifierPro(); return; }
        if (n < 5) { setTimeout(() => tenter(n + 1), 700 * (n + 1)); return; }
        proRevalEnCours = false; // pas de session après plusieurs essais (déconnecté)
      })
      .catch(() => {
        if (n < 5) { setTimeout(() => tenter(n + 1), 700 * (n + 1)); return; }
        proRevalEnCours = false;
      });
  };
  tenter(0);
}

// Écoute unique des changements d'auth : dès que la session est restaurée /
// rafraîchie (INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_IN), on (re)charge le pro.
let proAuthSub = false;
function ensureProAuthSub() {
  if (proAuthSub) return;
  proAuthSub = true;
  try {
    createClient().auth.onAuthStateChange((_event, session) => {
      if (session) revaliderPro();
    });
  } catch { /* */ }
}

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

// Mise à jour locale de la session patient après modification du profil
// (ex. sexe → avatar-guide) : cache mémoire + localStorage, sans refetch.
export function patchPatientSession(patch: Partial<SessionPatient>) {
  if (!memPatient) return;
  memPatient = { ...memPatient, ...patch };
  lsSet(LS_PATIENT, memPatient);
}

async function fetchPatient(): Promise<SessionPatient | null> {
  const supabase = createClient();
  // getSession lit depuis localStorage du client Supabase — pas de réseau
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from("patient")
    .select("id,nom,code_postal,user_id,date_naissance,sexe")
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
    // S'abonner aux mises à jour de la session (patchProSession) pour refléter
    // les changements (photo de profil, opt-in alertes…) sans recharger la page.
    const maj = () => setPro(memPro);
    proListeners.add(maj);
    ensureProAuthSub(); // recharge le pro dès que le jeton est restauré (mobile)

    // Affichage immédiat depuis le cache, même périmé (stale-while-revalidate) :
    // évite que la navbar retombe sur « Tableau + Messages » pendant un
    // rechargement de session ou un blip réseau.
    if (!memPro) {
      const cache = lsRead<SessionPro>(LS_PRO);
      if (cache) { memPro = cache.v; setPro(cache.v); }
    }
    // Revalidation systématique en arrière-plan : on affiche le cache tout de
    // suite (pas de blanc), mais on resynchronise toujours l'identité réelle du
    // compte connecté (le cache peut appartenir à un autre compte / être périmé).
    revaliderPro();
    return () => { proListeners.delete(maj); };
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
    .select(`${COLS},recevoir_alertes,photo_url`)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) {
    // Fallback si la colonne photo_url (0061) n'est pas encore appliquée.
    ({ data, error } = await supabase
      .from("professionnel")
      .select(`${COLS},recevoir_alertes`)
      .eq("user_id", session.user.id)
      .maybeSingle());
  }
  if (error) {
    // Fallback si recevoir_alertes (0051) n'est pas non plus appliquée.
    ({ data } = await supabase
      .from("professionnel")
      .select(COLS)
      .eq("user_id", session.user.id)
      .maybeSingle());
  }
  if (!data) return null;
  const p = { recevoir_alertes: false, photo_url: null, ...(data as object) } as SessionPro;
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
  notifierPro(); // rafraîchit l'en-tête et tout composant abonné
}

// Exposer pour invalider le cache à la déconnexion
export function clearSessionCache() {
  memPatient = null;
  memPro = null;
  try { localStorage.removeItem(LS_PATIENT); localStorage.removeItem(LS_PRO); } catch { /* */ }
  notifierPro();
}
