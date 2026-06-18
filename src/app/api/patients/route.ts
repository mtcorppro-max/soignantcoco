import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailDepuisCode, MESURES, TYPES_MESURE } from "@/lib/constants";

function genererCode(): string {
  // 8 caractères hex majuscules (cf. generer_code_unique côté SQL)
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Création d'un patient par la coordinatrice :
// provisionne le compte Auth (service_role), la ligne patient et les seuils
// d'amorçage. Renvoie le code unique à remettre au patient.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
  }

  const { data: pro } = await supabase
    .from("professionnel")
    .select("role, prestataire_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pro || pro.role !== "coordinatrice") {
    return NextResponse.json(
      { message: "Seule la coordinatrice peut créer un patient." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const nom = (body.nom ?? "").trim();
  if (!nom) {
    return NextResponse.json({ message: "Nom requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const code = genererCode();
  const email = emailDepuisCode(code);

  // 1. Compte Auth (login patient = code)
  const { data: created, error: errUser } = await admin.auth.admin.createUser({
    email,
    password: code,
    email_confirm: true,
    user_metadata: { type: "patient" },
  });
  if (errUser || !created.user) {
    return NextResponse.json(
      { message: "Échec de création du compte patient." },
      { status: 500 }
    );
  }

  // 2. Ligne patient
  const { data: patient, error: errPatient } = await admin
    .from("patient")
    .insert({
      user_id: created.user.id,
      prestataire_id: pro.prestataire_id,
      code_unique: code,
      nom,
      code_postal: body.code_postal || null,
      tel_alerte_1: body.tel_alerte_1 || null,
      tel_alerte_2: body.tel_alerte_2 || null,
    })
    .select("id")
    .single();

  if (errPatient || !patient) {
    // rollback du compte Auth orphelin
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { message: "Échec de création de la fiche patient." },
      { status: 500 }
    );
  }

  // 3. Seuils d'amorçage (valeurs par défaut — à ajuster par la coordinatrice)
  const seuils = TYPES_MESURE.filter(
    (t) =>
      MESURES[t].seuilDefautMin != null || MESURES[t].seuilDefautMax != null
  ).map((t) => ({
    patient_id: patient.id,
    type_mesure: t,
    valeur_min: MESURES[t].seuilDefautMin,
    valeur_max: MESURES[t].seuilDefautMax,
    actif: true,
  }));
  if (seuils.length) await admin.from("seuil").insert(seuils);

  return NextResponse.json({ code, patientId: patient.id });
}
