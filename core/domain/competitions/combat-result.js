const RESULT_ALIASES = new Map([
  ["v", "Victoire"],
  ["victoire", "Victoire"],
  ["d", "Défaite"],
  ["defaite", "Défaite"],
  ["défaite", "Défaite"],
  ["e", "Egalité"],
  ["egalite", "Egalité"],
  ["égalité", "Egalité"]
]);

function normalizeCombatResultKey(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeCombatResult(value) {
  return RESULT_ALIASES.get(normalizeCombatResultKey(value)) || "";
}

function createCombatResult(value) {
  const result = normalizeCombatResult(value);
  if (!result) {
    throw new Error("Résultat invalide.");
  }
  return result;
}

function isVictoryCombatResult(value) {
  return normalizeCombatResult(value) === "Victoire";
}

function isLossCombatResult(value) {
  return normalizeCombatResult(value) === "Défaite";
}

module.exports = {
  createCombatResult,
  isLossCombatResult,
  isVictoryCombatResult,
  normalizeCombatResult
};
