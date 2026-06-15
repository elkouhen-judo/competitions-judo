import { normalizeCombatResult } from "./combat-result";

export type CombatDecisionType =
  | ""
  | "Ippon"
  | "Waza-ari"
  | "Yuko"
  | "Décision"
  | "Hiki wake"
  | "Hansoku-make"
  | "Forfait";

const DECISION_TYPE_ALIASES = new Map<string, CombatDecisionType>([
  ["", ""],
  ["ippon", "Ippon"],
  ["waza-ari", "Waza-ari"],
  ["waza ari", "Waza-ari"],
  ["yuko", "Yuko"],
  ["decision", "Décision"],
  ["décision", "Décision"],
  ["kinsa / decision", "Décision"],
  ["kinsa / décision", "Décision"],
  ["hiki wake", "Hiki wake"],
  ["hansoku-make", "Hansoku-make"],
  ["hansoku make", "Hansoku-make"],
  ["penalite (hansoku-make / shido)", "Hansoku-make"],
  ["pénalité (hansoku-make / shido)", "Hansoku-make"],
  ["forfait", "Forfait"],
  ["forfait / abandon", "Forfait"]
]);

const DECISION_TYPES_BY_RESULT = new Map<string, CombatDecisionType[]>([
  ["Victoire", ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait"]],
  ["Défaite", ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait"]],
  ["Egalité", ["Hiki wake"]]
]);

function normalizeDecisionTypeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeCombatDecisionType(value: unknown): CombatDecisionType {
  return DECISION_TYPE_ALIASES.get(normalizeDecisionTypeKey(value)) || "";
}

export function getAllowedDecisionTypesForCombatResult(result: unknown): CombatDecisionType[] {
  return DECISION_TYPES_BY_RESULT.get(normalizeCombatResult(result)) || [];
}

export function isCombatDecisionTypeAllowed(
  result: unknown,
  decisionType: CombatDecisionType
): boolean {
  return getAllowedDecisionTypesForCombatResult(result).includes(decisionType);
}

export function createCombatDecisionType(value: unknown, result?: unknown): CombatDecisionType {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const decisionType = normalizeCombatDecisionType(rawValue);
  if (!decisionType) {
    throw new Error("Type de décision invalide.");
  }
  if (result !== undefined && !isCombatDecisionTypeAllowed(result, decisionType)) {
    throw new Error("Type de décision incompatible avec le résultat.");
  }
  return decisionType;
}
