// Données fictives pour les pages d'aperçu (/apercu). Aucun accès Supabase.
import type { Mesure, Seuil } from "@/lib/types";

const now = Date.now();
const j = (n: number) => new Date(now - n * 86400000).toISOString();

export const mockMesures: Mesure[] = [
  { id: "1", patient_id: "p", type: "temperature", valeur: 37.0, horodatage: j(6) },
  { id: "2", patient_id: "p", type: "temperature", valeur: 37.3, horodatage: j(5) },
  { id: "3", patient_id: "p", type: "temperature", valeur: 37.8, horodatage: j(4) },
  { id: "4", patient_id: "p", type: "temperature", valeur: 38.1, horodatage: j(3) },
  { id: "5", patient_id: "p", type: "temperature", valeur: 38.0, horodatage: j(2) },
  { id: "6", patient_id: "p", type: "temperature", valeur: 39.2, horodatage: j(0) },
  { id: "7", patient_id: "p", type: "spo2", valeur: 98, horodatage: j(5) },
  { id: "8", patient_id: "p", type: "spo2", valeur: 96, horodatage: j(3) },
  { id: "9", patient_id: "p", type: "spo2", valeur: 95, horodatage: j(1) },
  { id: "10", patient_id: "p", type: "ta_systolique", valeur: 132, horodatage: j(4) },
  { id: "11", patient_id: "p", type: "ta_systolique", valeur: 128, horodatage: j(2) },
  { id: "12", patient_id: "p", type: "ta_systolique", valeur: 124, horodatage: j(0) },
  { id: "13", patient_id: "p", type: "ta_diastolique", valeur: 84, horodatage: j(4) },
  { id: "14", patient_id: "p", type: "ta_diastolique", valeur: 81, horodatage: j(2) },
  { id: "15", patient_id: "p", type: "poids", valeur: 72.4, horodatage: j(4) },
  { id: "16", patient_id: "p", type: "poids", valeur: 71.8, horodatage: j(0) },
];

export const mockSeuils: Record<string, Seuil> = {
  temperature: { id: "s1", patient_id: "p", type_mesure: "temperature", valeur_min: 35, valeur_max: 38.5, actif: true, created_at: j(10) },
  spo2: { id: "s2", patient_id: "p", type_mesure: "spo2", valeur_min: 92, valeur_max: null, actif: true, created_at: j(10) },
  ta_systolique: { id: "s3", patient_id: "p", type_mesure: "ta_systolique", valeur_min: 90, valeur_max: 160, actif: true, created_at: j(10) },
  ta_diastolique: { id: "s4", patient_id: "p", type_mesure: "ta_diastolique", valeur_min: 50, valeur_max: 100, actif: true, created_at: j(10) },
};

export const mockPatients = [
  { id: "p1", nom: "Monsieur Démo", statut: "active" as const, code_unique: "DEMO1234", actives: 1, acquittees: 0 },
  { id: "p2", nom: "Madame Lefèvre", statut: "active" as const, code_unique: "A1B2C3D4", actives: 0, acquittees: 1 },
  { id: "p3", nom: "Monsieur Nguyen", statut: "active" as const, code_unique: "E5F6G7H8", actives: 0, acquittees: 0 },
  { id: "p4", nom: "Madame Rossi", statut: "suspendue" as const, code_unique: "I9J0K1L2", actives: 0, acquittees: 0 },
];
