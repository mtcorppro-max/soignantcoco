// Types métier — alignés sur supabase/migrations/0001_init.sql

export type RolePro = "coordinatrice" | "chirurgien" | "delegue";

export type TypeMesure =
  | "temperature"
  | "ta_systolique"
  | "ta_diastolique"
  | "spo2"
  | "bpm"
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
  // Coordonnées & contacts (cf. migration 0002)
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  chirurgien: string | null;
  pharmacie: string | null;
  pharmacie_tel: string | null;
  infirmiere_nom: string | null;
  infirmiere_tel: string | null;
  proche_nom: string | null;
  proche_tel: string | null;
  // Ville, naissance & opération (cf. migration 0004)
  ville: string | null;
  date_naissance: string | null;
  operation: string | null;
  date_operation: string | null;
  // Noms des destinataires d'alerte (cf. migration 0005)
  alerte_1_nom: string | null;
  alerte_2_nom: string | null;
  // Durée totale de prise en charge en jours (cf. migration 0013)
  duree_prise_en_charge: number | null;
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
  suivi_id: string | null;
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

export interface Suivi {
  id: string;
  patient_id: string;
  auteur_user_id: string | null;
  auteur_nom: string | null;
  etat_general: string | null;
  ta: string | null;
  pouls: string | null;
  temperature: string | null;
  spo2: string | null;
  douleur_en: string | null;
  alimentation: string | null;
  hydratation: string | null;
  transit: string | null;
  cicatrisation: string | null;
  mobilisation: string | null;
  bilan_sanguin: string | null;
  created_at: string;
}

export interface Absence {
  id: string;
  professionnel_id: string;
  remplacant_id: string | null;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  created_at: string;
}
