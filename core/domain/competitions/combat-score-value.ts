export type CombatScoreValue = "Ippon" | "Waza-ari" | "Yuko";

const SCORE_VALUE_ALIASES = new Map<string, CombatScoreValue>([
  ["ippon", "Ippon"],
  ["waza-ari", "Waza-ari"],
  ["waza ari", "Waza-ari"],
  ["yuko", "Yuko"]
]);

function normalizeScoreValueKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeCombatScoreValue(value: unknown): CombatScoreValue | "" {
  return SCORE_VALUE_ALIASES.get(normalizeScoreValueKey(value)) || "";
}

export function createCombatScoreValue(value: unknown): CombatScoreValue {
  const scoreValue = normalizeCombatScoreValue(value);
  if (!scoreValue) {
    throw new Error("Valeur de la prise invalide.");
  }
  return scoreValue;
}
