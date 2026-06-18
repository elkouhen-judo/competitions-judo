export type CombatResult = "Victoire" | "Défaite" | "Egalité";

export const COMBAT_RESULTS: CombatResult[] = ["Victoire", "Défaite", "Egalité"];

const RESULT_ALIASES = new Map<string, CombatResult>([
  ["v", "Victoire"],
  ["victoire", "Victoire"],
  ["d", "Défaite"],
  ["defaite", "Défaite"],
  ["défaite", "Défaite"],
  ["e", "Egalité"],
  ["egalite", "Egalité"],
  ["égalité", "Egalité"]
]);

function normalizeCombatResultKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeCombatResult(value: unknown): CombatResult | "" {
  return RESULT_ALIASES.get(normalizeCombatResultKey(value)) || "";
}

export function createCombatResult(value: unknown): CombatResult {
  const result = normalizeCombatResult(value);
  if (!result) {
    throw new Error("Résultat invalide.");
  }
  return result;
}

export function isVictoryCombatResult(value: unknown): boolean {
  return normalizeCombatResult(value) === "Victoire";
}

export function isLossCombatResult(value: unknown): boolean {
  return normalizeCombatResult(value) === "Défaite";
}
