/** Agenda FFJDA (AGD-018 à AGD-020) : ce qu'un événement suggère pour créer une compétition club. */
import { NATIONAL_LIGUE } from "./ligues";

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * AGD-019 : niveau déduit de l'organisateur. Comité → Départemental, ligue → Régional,
 * fédération ou agenda national → National ; sinon rien (un club, un organisateur inconnu).
 */
export function detectCompetitionLevel(proprietaire: string, ligue: string): string {
  const owner = normalize(proprietaire);
  if (owner.startsWith("FFJDA") || owner.includes("FEDERATION")) return "National";
  if (owner.startsWith("COMITE")) return "Départemental";
  if (owner.startsWith("LIGUE")) return "Régional";
  if (!owner && ligue === NATIONAL_LIGUE) return "National";
  return "";
}

// Du plus spécifique au plus large : « POUSSINETS » ne doit pas compter comme « POUSSINS ».
const AGE_CATEGORY_PATTERNS: Array<{ category: string; pattern: RegExp }> = [
  { category: "Poussinet", pattern: /\bPOUSSINET(?:TE)?S?\b/ },
  { category: "Poussin", pattern: /\bPOUSSINE?S?\b/ },
  { category: "Benjamin", pattern: /\bBENJAMINE?S?\b/ },
  { category: "Minime", pattern: /\bMINIMES?\b/ },
  { category: "Cadet", pattern: /\bCADET(?:TE)?S?\b/ },
  { category: "Junior", pattern: /\bJUNIORS?\b/ },
  { category: "Senior", pattern: /\bSENIORS?\b/ },
  { category: "Vétéran", pattern: /\bVETERANE?S?\b/ }
];

/** AGD-020 : catégorie d'âge citée par le titre, seulement s'il en cite exactement une. */
export function detectAgeCategory(titre: string): string {
  const title = normalize(titre);
  const found = AGE_CATEGORY_PATTERNS.filter(({ pattern }) => pattern.test(title)).map(({ category }) => category);
  return found.length === 1 ? found[0] : "";
}
