// =====================================================================
// Conseils hygiéno-diététiques — bibliothèque + déclenchement météo.
//
// ⚠️ Clinique : ces conseils sont des exemples génériques de prototype.
// En production, le contenu doit être rédigé/validé par l'équipe médicale
// du prestataire (cf. cahier des charges §10) et stocké en table `conseil`.
//
// La météo utilise des API publiques SANS clé :
//   - geo.api.gouv.fr  : code postal (FR) -> coordonnées
//   - open-meteo.com   : prévision du jour
// Tout est encapsulé dans un try/catch : en cas d'échec réseau, on
// retombe simplement sur les conseils quotidiens (aucune erreur visible).
// =====================================================================

export type CategorieConseil = "hydratation" | "activite" | "alimentation" | "repos" | "meteo";

export interface Conseil {
  categorie: CategorieConseil;
  titre: string;
  contenu: string;
  emoji: string;
}

// Bibliothèque quotidienne (rotation). Adaptée au post-opératoire digestif.
const CONSEILS_QUOTIDIENS: Conseil[] = [
  {
    categorie: "hydratation",
    emoji: "💧",
    titre: "Pensez à bien vous hydrater",
    contenu:
      "Buvez régulièrement de petites quantités d'eau tout au long de la journée, sans attendre d'avoir soif.",
  },
  {
    categorie: "activite",
    emoji: "🚶",
    titre: "Marchez un peu chaque jour",
    contenu:
      "Une marche douce, même courte, favorise la reprise du transit et limite les complications. Augmentez progressivement.",
  },
  {
    categorie: "alimentation",
    emoji: "🍵",
    titre: "Fractionnez vos repas",
    contenu:
      "Privilégiez plusieurs petits repas légers plutôt que de gros repas, et mangez lentement en mâchant bien.",
  },
  {
    categorie: "alimentation",
    emoji: "🥗",
    titre: "Des aliments faciles à digérer",
    contenu:
      "Préférez des aliments doux et cuits. Réintroduisez les fibres progressivement selon les conseils de votre équipe.",
  },
  {
    categorie: "repos",
    emoji: "😴",
    titre: "Respectez votre repos",
    contenu:
      "Le sommeil aide la cicatrisation. Alternez activité douce et repos, sans forcer.",
  },
  {
    categorie: "activite",
    emoji: "🩹",
    titre: "Surveillez votre cicatrice",
    contenu:
      "Gardez la zone propre et sèche. Signalez toute rougeur, chaleur, gonflement ou écoulement inhabituel.",
  },
];

// Conseil « du jour » : rotation stable basée sur le quantième de l'année.
export function conseilDuJour(date = new Date()): Conseil {
  const debut = new Date(date.getFullYear(), 0, 0);
  const jour = Math.floor((date.getTime() - debut.getTime()) / 86400000);
  return CONSEILS_QUOTIDIENS[jour % CONSEILS_QUOTIDIENS.length];
}

export function tousLesConseils(): Conseil[] {
  return CONSEILS_QUOTIDIENS;
}

// --- Météo -----------------------------------------------------------

export interface ConseilMeteo extends Conseil {
  tMax: number;
  tMin: number;
}

const SEUIL_CHALEUR = 30; // °C — au-delà : conseil hydratation renforcée
const SEUIL_FROID = 2; // °C — en deçà : conseil grand froid

// Renvoie un conseil météo si la journée est « à risque » (chaleur/froid),
// sinon null. Ne lève jamais : tout échec réseau -> null.
export async function conseilMeteo(codePostal: string | null): Promise<ConseilMeteo | null> {
  if (!codePostal) return null;
  try {
    const geo = await fetch(
      `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(
        codePostal
      )}&fields=centre&format=json`,
      { next: { revalidate: 86400 } } // coordonnées stables -> cache 1 j
    );
    if (!geo.ok) return null;
    const communes = (await geo.json()) as Array<{
      centre?: { coordinates?: [number, number] };
    }>;
    const coords = communes[0]?.centre?.coordinates;
    if (!coords) return null;
    const [lon, lat] = coords;

    const meteo = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
      { next: { revalidate: 3600 } } // météo -> cache 1 h
    );
    if (!meteo.ok) return null;
    const data = (await meteo.json()) as {
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
    };
    const tMax = data.daily?.temperature_2m_max?.[0];
    const tMin = data.daily?.temperature_2m_min?.[0];
    if (tMax == null || tMin == null) return null;

    if (tMax >= SEUIL_CHALEUR) {
      return {
        tMax,
        tMin,
        categorie: "meteo",
        emoji: "🌡️",
        titre: `Forte chaleur aujourd'hui (jusqu'à ${Math.round(tMax)} °C)`,
        contenu:
          "Pensez à bien vous hydrater, restez au frais aux heures les plus chaudes et évitez les efforts en plein soleil.",
      };
    }
    if (tMin <= SEUIL_FROID) {
      return {
        tMax,
        tMin,
        categorie: "meteo",
        emoji: "❄️",
        titre: `Temps très froid aujourd'hui (jusqu'à ${Math.round(tMin)} °C)`,
        contenu:
          "Couvrez-vous bien avant de sortir, surveillez la qualité de l'air intérieur et hydratez-vous malgré le froid.",
      };
    }
    return null;
  } catch {
    return null;
  }
}
