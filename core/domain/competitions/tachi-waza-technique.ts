export const TACHI_WAZA_TECHNIQUES = [
  "Seoi-nage",
  "Ippon Seoi-nage",
  "O-soto-gari",
  "O-uchi-gari",
  "Ko-uchi-gari",
  "Ko-soto-gari",
  "Uchi-mata",
  "Harai-goshi",
  "Tai-otoshi",
  "Tomoe-nage",
  "Sumi-gaeshi",
  "Kata-guruma",
  "De-ashi-barai",
  "Hiza-guruma",
  "Sasae-tsurikomi-goshi",
  "Okuri-ashi-barai",
  "Ura-nage",
  "Yoko-tomoe-nage"
] as const;

export type TachiWazaTechnique = (typeof TACHI_WAZA_TECHNIQUES)[number];

function normalizeTachiWazaTechniqueKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-\s]+/g, " ");
}

const TACHI_WAZA_TECHNIQUE_ALIASES = new Map<string, TachiWazaTechnique>(
  TACHI_WAZA_TECHNIQUES.map((technique) => [normalizeTachiWazaTechniqueKey(technique), technique])
);

export function normalizeTachiWazaTechnique(value: unknown): TachiWazaTechnique | "" {
  return TACHI_WAZA_TECHNIQUE_ALIASES.get(normalizeTachiWazaTechniqueKey(value)) || "";
}

export function createTachiWazaTechnique(value: unknown): TachiWazaTechnique | "" {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const technique = normalizeTachiWazaTechnique(rawValue);
  if (!technique) {
    throw new Error("Nom de la prise Tachi-waza invalide.");
  }
  return technique;
}
