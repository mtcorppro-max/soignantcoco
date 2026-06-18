// Types métier — alignés sur supabase/migrations/0001_init.sql

export type RolePro = "coordinatrice" | "chirurgien" | "delegue";

export type TypeMesure =
  | "temperature"
  | "ta_systolique"
  | "ta_diastolique"
  | "spo2"
  | "poids";

export type StatutAlerte = "declenchee" | "acquittee" | "escaladee" | "resolue";
export type StatutSurveillance = "active" | "suspendue" | "terminee";

export interface Prestataire {
  id: string;
  nom: string;
  created_at: string;
}

export interface Professionnel {
  id: string;
  user_id: string;
  prestataire_id: string;
  nom: string;
  email: string | null;
  role: RolePro;
  created_at: string;
}

export interface Patient {
  id: string;
  user_id: string | null;
  prestataire_id: string;
  code_unique: string;
  nom: string;
  statut: StatutSurveillance;
  code_postal: string | null;
  tel_alerte_1: string | null;
  tel_alerte_2: string | null;
  created_at: string;
}

export interface Seuil {
  id: string;
  patient_id: string;
  type_mesure: TypeMesure;
  valeur_min: number | null;
  valeur_max: number | null;
  actif: boolean;
  created_at: string;
}

export interface Mesure {
  id: string;
  patient_id: string;
  type: TypeMesure;
  valeur: number;
  horodatage: string;
}

export interface Message {
  id: string;
  patient_id: string;
  auteur_user_id: string;
  contenu: string;
  horodatage: string;
}

export interface Photo {
  id: string;
  patient_id: string;
  auteur_user_id: string;
  chemin_stockage: string;
  legende: string | null;
  horodatage: string;
}

export interface Alerte {
  id: string;
  patient_id: string;
  mesure_id: string | null;
  statut: StatutAlerte;
  declenchee_le: string;
  acquittee_par: string | null;
  acquittee_le: string | null;
  escalade_vers: string | null;
  escalade_le: string | null;
  escalade_note: string | null;
  resolue_le: string | null;
  canal: string | null;
}
