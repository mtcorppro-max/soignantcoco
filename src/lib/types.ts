// Types métier — alignés sur supabase/migrations/0001_init.sql

export type RolePro = "coordinatrice" | "chirurgien" | "delegue" | "manager" | "infirmiere_liberale" | "livreur" | "pharmacie" | "dirigeant";

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
  prenom: string | null;
  titre: string | null;
  email: string | null;
  role: RolePro;
  niveau: number;
  agence_id: string | null;
  region_id: string | null;
  zone_exercice: string | null;
  // Consignes médecin / chirurgien (cf. migration 0015)
  specialite: string | null;
  cabinets: string | null;
  telephone: string | null;
  secretariat_nom: string | null;
  secretariat_email: string | null;
  secretariat_tel: string | null;
  protocole: string | null;
  duree_prise_en_charge: number | null;
  jours_suivi: number[] | null;
  molecules: { nom: string; posologie: string }[] | null;
  pansement: boolean | null;
  pansement_detail: string | null;
  cryotherapie: boolean | null;
  cryotherapie_duree: string | null;
  cryotherapie_machine: string | null;
  envoi_ordo: string[] | null;
  pharmacie_per_os: boolean | null;
  medicaments_per_os: { nom: string; posologie: string }[] | null;
  materiel_paramedical: string | null;
  // Protocoles par intervention (cf. migration 0023)
  protocoles: ProtocoleConsigne[] | null;
  created_at: string;
}

export interface ProtocoleConsigne {
  intervention: string;
  duree: string;
  sortie_post_op?: string; // J+N post-op : nb de jours entre la chirurgie et la sortie
  jours: number[];
  molecules: { nom: string; posologie: string }[];
  pansement: boolean;
  pansement_detail: string;
  cryotherapie: boolean;
  cryotherapie_duree: string;
  cryotherapie_machine: string;
  envoi_ordo: string[];
  pharmacie_per_os: boolean;
  medicaments_per_os: { nom: string; posologie: string }[];
  surveiller_constantes?: boolean;
  constantes?: { type: string; min: string; max: string }[];
  bilan_sanguin?: boolean;
  bilan_voie?: string;
  bilan_analyses?: string[];
  bilan_autres?: string;
  materiel: boolean;
  materiel_paramedical: string;
  autres: string;
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
  // Jours de suivi programmés ex. [1,3,5] (cf. migration 0026)
  jours_suivi: number[] | null;
  // Agence de rattachement (cf. migration 0029)
  agence_id: string | null;
  // Traitement à suivre + jour de sortie (cf. migration 0039)
  traitement: string | null;
  date_sortie: string | null;
  // Délégué médical rattaché (cf. migration 0046)
  delegue_nom: string | null;
  // Livreur rattaché (cf. migration 0055)
  livreur_nom: string | null;
  // Compte pharmacie rattaché (accès portail) (cf. migration 0057)
  pharmacie_compte_nom: string | null;
  created_at: string;
}

// Livraison (tournée du livreur) — cf. migration 0056
export interface Livraison {
  id: string;
  patient_id: string;
  livreur_id: string;
  prestataire_id: string;
  date_prevue: string | null;
  statut: "a_planifier" | "planifiee" | "livree";
  note: string | null;
  created_at: string;
  updated_at: string;
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
