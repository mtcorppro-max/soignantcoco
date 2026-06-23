import type { TypeMesure } from "./types";

// Métadonnées d'affichage par type de mesure.
// Les valeurs min/max ici ne sont QUE des valeurs par défaut d'amorçage :
// les seuils réels sont définis par patient par la coordinatrice (cf. §2 —
// le contenu clinique relève du client / équipe médicale).
export const MESURES: Record<
  TypeMesure,
  {
    label: string;
    court: string;
    unite: string;
    min: number;
    max: number;
    pas: number;
    seuilDefautMin: number | null;
    seuilDefautMax: number | null;
    sansSeuilMax?: boolean; // mesure avec seuil minimum uniquement (ex. SpO₂)
    pertePoidsPct?: number; // alerte sur perte relative (%) au lieu d'un seuil fixe (ex. poids)
  }
> = {
  temperature: {
    label: "Température",
    court: "Temp.",
    unite: "°C",
    min: 34,
    max: 43,
    pas: 0.1,
    seuilDefautMin: 35,
    seuilDefautMax: 38.5,
  },
  ta_systolique: {
    label: "Tension systolique",
    court: "TA sys.",
    unite: "mmHg",
    min: 60,
    max: 250,
    pas: 1,
    seuilDefautMin: 90,
    seuilDefautMax: 160,
  },
  ta_diastolique: {
    label: "Tension diastolique",
    court: "TA dia.",
    unite: "mmHg",
    min: 30,
    max: 150,
    pas: 1,
    seuilDefautMin: 50,
    seuilDefautMax: 100,
  },
  spo2: {
    label: "Saturation O₂ (SpO₂)",
    court: "SpO₂",
    unite: "%",
    min: 70,
    max: 100,
    pas: 1,
    seuilDefautMin: 92,
    seuilDefautMax: null,
    sansSeuilMax: true,
  },
  bpm: {
    label: "Fréquence cardiaque",
    court: "Pouls",
    unite: "bpm",
    min: 30,
    max: 200,
    pas: 1,
    seuilDefautMin: 50,
    seuilDefautMax: 120,
  },
  poids: {
    label: "Poids",
    court: "Poids",
    unite: "kg",
    min: 30,
    max: 250,
    pas: 0.1,
    seuilDefautMin: null,
    seuilDefautMax: null,
    pertePoidsPct: 5, // alerte si perte ≥ 5 % du poids de référence
  },
};

export const TYPES_MESURE = Object.keys(MESURES) as TypeMesure[];

// Convention de login patient (prototype) — cf. 0001_init.sql
export const EMAIL_PATIENT_DOMAIN = "patient.soignantcoco.local";
export function emailDepuisCode(code: string): string {
  return `${code.toLowerCase()}@${EMAIL_PATIENT_DOMAIN}`;
}
