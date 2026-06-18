import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Professionnel, Patient } from "@/lib/types";

// Récupère le professionnel connecté (ou redirige vers /login).
export async function requirePro(): Promise<Professionnel> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("professionnel")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) redirect("/login/pro?erreur=non_professionnel");
  return data as Professionnel;
}

// Récupère le patient connecté (ou redirige vers /login).
export async function requirePatient(): Promise<Patient> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login/patient");

  const { data } = await supabase
    .from("patient")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) redirect("/login/patient?erreur=non_patient");
  return data as Patient;
}
