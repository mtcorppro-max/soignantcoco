"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SessionPatient = { id: string; nom: string; code_postal: string | null; user_id: string };
export type SessionPro = { id: string; nom: string; role: string; prestataire_id: string; user_id: string };

let cachedPatient: SessionPatient | null = null;
let cachedPro: SessionPro | null = null;

export function usePatientSession() {
  const [patient, setPatient] = useState<SessionPatient | null>(cachedPatient);

  useEffect(() => {
    if (cachedPatient) { setPatient(cachedPatient); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("patient")
        .select("id,nom,code_postal,user_id")
        .eq("user_id", data.user.id)
        .maybeSingle()
        .then(({ data: p }) => {
          if (p) { cachedPatient = p as SessionPatient; setPatient(p as SessionPatient); }
        });
    });
  }, []);

  return patient;
}

export function useProSession() {
  const [pro, setPro] = useState<SessionPro | null>(cachedPro);

  useEffect(() => {
    if (cachedPro) { setPro(cachedPro); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("professionnel")
        .select("id,nom,role,prestataire_id,user_id")
        .eq("user_id", data.user.id)
        .maybeSingle()
        .then(({ data: p }) => {
          if (p) { cachedPro = p as SessionPro; setPro(p as SessionPro); }
        });
    });
  }, []);

  return pro;
}
