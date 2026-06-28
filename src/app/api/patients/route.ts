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
    .select("id, role, niveau, prestataire_id, agence_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pro) {
    return NextResponse.json({ message: "Compte introuvable." }, { status: 403 });
  }
  // Tout soignant (niveau 0 à 3) peut créer un patient.
  if (!pro.prestataire_id) {
    return NextResponse.json(
      { message: "Aucun prestataire associé à votre compte — impossible de créer le patient." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  // Nom complet = « Prénom Nom » (le prénom est facultatif).
  const nom = [body.prenom, body.nom]
    .map((s: string) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
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
      telephone: body.telephone || null,
      email: body.email || null,
      adresse: body.adresse || null,
      chirurgien: body.chirurgien || null,
      pharmacie: body.pharmacie || null,
      pharmacie_tel: body.pharmacie_tel || null,
      infirmiere_nom: body.infirmiere_nom || null,
      infirmiere_tel: body.infirmiere_tel || null,
      proche_nom: body.proche_nom || null,
      proche_tel: body.proche_tel || null,
      ville: body.ville || null,
      date_naissance: body.date_naissance || null,
      operation: body.operation || null,
      date_operation: body.date_operation || null,
      alerte_1_nom: body.alerte_1_nom || null,
      alerte_2_nom: body.alerte_2_nom || null,
      duree_prise_en_charge: body.duree_prise_en_charge
        ? Number(body.duree_prise_en_charge) || null
        : null,
      jours_suivi: Array.isArray(body.jours_suivi) && body.jours_suivi.length > 0 ? body.jours_suivi : null,
      traitement: body.traitement || null,
      date_sortie: body.date_sortie || null,
      delegue_nom: body.delegue_nom || null,
      livreur_nom: body.livreur_nom || null,
      // Agence : celle choisie, sinon l'agence du créateur (pour la visibilité niveau 1/2)
      agence_id: (typeof body.agence_id === "string" && body.agence_id) || pro.agence_id || null,
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

  // 2b. Rattachement aux soignants sélectionnés (niveau 2 = accès restreint).
  // On ne garde que les professionnels du même prestataire.
  const recus: string[] = Array.isArray(body.rattachements)
    ? body.rattachements.filter((x: unknown) => typeof x === "string")
    : [];
  // Le créateur est toujours rattaché (utile pour un chirurgien de niveau 2).
  const ids: string[] = [...new Set([...recus, pro.id])];
  if (ids.length) {
    const { data: prosOk } = await admin
      .from("professionnel")
      .select("id")
      .eq("prestataire_id", pro.prestataire_id)
      .in("id", ids);
    const liens = (prosOk ?? []).map((p) => ({
      patient_id: patient.id,
      professionnel_id: p.id,
    }));
    if (liens.length) await admin.from("patient_soignant").insert(liens);
  }

  // 3. Seuils : ceux définis dans le protocole (constantes à surveiller) priment,
  //    sinon valeurs par défaut. Permet la génération auto des graphiques de suivi.
  const num = (v: unknown) => { const n = Number(v); return v != null && v !== "" && isFinite(n) ? n : null; };
  const protoSeuils = new Map<string, { min: number | null; max: number | null }>();
  if (Array.isArray(body.seuils)) {
    body.seuils.forEach((s: { type?: string; min?: string; max?: string }) => {
      if (s?.type) protoSeuils.set(s.type, { min: num(s.min), max: num(s.max) });
    });
  }
  const seuils = TYPES_MESURE
    .map((t) => {
      const p = protoSeuils.get(t);
      const min = p ? p.min : MESURES[t].seuilDefautMin;
      const max = p ? p.max : MESURES[t].seuilDefautMax;
      return { patient_id: patient.id, type_mesure: t, valeur_min: min, valeur_max: max, actif: true };
    })
    .filter((s) => s.valeur_min != null || s.valeur_max != null);
  if (seuils.length) await admin.from("seuil").insert(seuils);

  return NextResponse.json({ code, patientId: patient.id });
}
