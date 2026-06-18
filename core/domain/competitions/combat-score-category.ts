export type CombatScoreCategory = "Tachi-waza" | "Ne-waza";

export const SCORE_CATEGORIES: CombatScoreCategory[] = ["Tachi-waza", "Ne-waza"];

const SCORE_CATEGORY_ALIASES = new Map<string, CombatScoreCategory>([
  ["tachi-waza", "Tachi-waza"],
  ["tachi waza", "Tachi-waza"],
  ["tachiwaza", "Tachi-waza"],
  ["ne-waza", "Ne-waza"],
  ["ne waza", "Ne-waza"],
  ["newaza", "Ne-waza"]
]);

function normalizeScoreCategoryKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeCombatScoreCategory(value: unknown): CombatScoreCategory | "" {
  return SCORE_CATEGORY_ALIASES.get(normalizeScoreCategoryKey(value)) || "";
}

export function createCombatScoreCategory(value: unknown): CombatScoreCategory {
  const category = normalizeCombatScoreCategory(value);
  if (!category) {
    throw new Error("Catégorie de prise invalide.");
  }
  return category;
}
