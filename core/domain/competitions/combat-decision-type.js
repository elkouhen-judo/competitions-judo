const { normalizeCombatResult } = require("./combat-result");

const DECISION_TYPE_ALIASES = new Map([
  ["", ""],
  ["ippon", "Ippon"],
  ["waza-ari", "Waza-ari"],
  ["waza ari", "Waza-ari"],
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

const DECISION_TYPES_BY_RESULT = new Map([
  ["Victoire", ["Ippon", "Waza-ari", "Décision", "Forfait"]],
  ["Défaite", ["Ippon", "Waza-ari", "Décision", "Forfait"]],
  ["Egalité", ["Hiki wake"]],
  ["Disqualification", ["Hansoku-make"]]
]);

function normalizeDecisionTypeKey(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeCombatDecisionType(value) {
  return DECISION_TYPE_ALIASES.get(normalizeDecisionTypeKey(value)) || "";
}

function getAllowedDecisionTypesForCombatResult(result) {
  return DECISION_TYPES_BY_RESULT.get(normalizeCombatResult(result)) || [];
}

function isCombatDecisionTypeAllowed(result, decisionType) {
  return getAllowedDecisionTypesForCombatResult(result).includes(decisionType);
}

function createCombatDecisionType(value, result) {
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

module.exports = {
  createCombatDecisionType,
  getAllowedDecisionTypesForCombatResult,
  isCombatDecisionTypeAllowed,
  normalizeCombatDecisionType
};
