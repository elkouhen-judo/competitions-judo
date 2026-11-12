export const TACHI_WAZA_TECHNIQUES = [
  "Seoi-nage",
  "Ippon Seoi-nage",
  "Morote-seoi-nage",
  "Seoi-otoshi",
  "Tai-otoshi",
  "Kata-guruma",
  "Sukui-nage",
  "Uki-otoshi",
  "Sumi-otoshi",
  "Obi-otoshi",
  "Kuchiki-taoshi",
  "Kibisu-gaeshi",
  "O-goshi",
  "Uki-goshi",
  "Koshi-guruma",
  "Tsurikomi-goshi",
  "Sode-tsurikomi-goshi",
  "Harai-goshi",
  "Hane-goshi",
  "Tsuri-goshi",
  "Ushiro-goshi",
  "Utsuri-goshi",
  "O-soto-gari",
  "O-uchi-gari",
  "Ko-uchi-gari",
  "Ko-soto-gari",
  "Ko-soto-gake",
  "Uchi-mata",
  "De-ashi-barai",
  "Okuri-ashi-barai",
  "Hiza-guruma",
  "Sasae-tsurikomi-ashi",
  "Harai-tsurikomi-ashi",
  "Ashi-guruma",
  "O-guruma",
  "O-soto-guruma",
  "Tsubame-gaeshi",
  "Tomoe-nage",
  "Yoko-tomoe-nage",
  "Sumi-gaeshi",
  "Ura-nage",
  "Tani-otoshi",
  "Yoko-guruma",
  "Uki-waza",
  "Yoko-otoshi",
  "Hikikomi-gaeshi",
  "Soto-makikomi",
  "Uchi-makikomi",
  "Hane-makikomi"
] as const;

export type TachiWazaTechnique = string;

function normalizeTachiWazaTechniqueKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-\s]+/g, " ");
}

const TACHI_WAZA_TECHNIQUE_ALIASES = new Map<string, string>(
  TACHI_WAZA_TECHNIQUES.map((technique) => [normalizeTachiWazaTechniqueKey(technique), technique])
);
// Ancien libellé erroné de la liste : la technique s'appelle Sasae-tsurikomi-ashi.
TACHI_WAZA_TECHNIQUE_ALIASES.set(normalizeTachiWazaTechniqueKey("Sasae-tsurikomi-goshi"), "Sasae-tsurikomi-ashi");

export function normalizeTachiWazaTechnique(value: unknown): TachiWazaTechnique | "" {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }
  return TACHI_WAZA_TECHNIQUE_ALIASES.get(normalizeTachiWazaTechniqueKey(rawValue)) || rawValue;
}

export function createTachiWazaTechnique(value: unknown): TachiWazaTechnique | "" {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  return normalizeTachiWazaTechnique(rawValue);
}
