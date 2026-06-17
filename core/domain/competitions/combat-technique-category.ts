export type CombatTechniqueCategory = "" | "Technique Avant" | "Technique Arrière" | "Contre" | "Ne waza";

const TECHNIQUE_CATEGORY_ALIASES = new Map<string, CombatTechniqueCategory>([
  ["technique avant", "Technique Avant"],
  ["avant", "Technique Avant"],
  ["technique arriere", "Technique Arrière"],
  ["arriere", "Technique Arrière"],
  ["contre", "Contre"],
  ["ne waza", "Ne waza"],
  ["newaza", "Ne waza"]
]);

function normalizeTechniqueCategoryKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeCombatTechniqueCategory(value: unknown): CombatTechniqueCategory {
  return TECHNIQUE_CATEGORY_ALIASES.get(normalizeTechniqueCategoryKey(value)) || "";
}

export function createCombatTechniqueCategory(value: unknown): CombatTechniqueCategory {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const category = normalizeCombatTechniqueCategory(rawValue);
  if (!category) {
    throw new Error("Catégorie de technique invalide.");
  }
  return category;
}
