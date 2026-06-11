function normalizeCombatResult(value) {
  return String(value || "").toUpperCase().trim();
}

function createCombatResult(value) {
  const result = normalizeCombatResult(value);
  if (!["V", "D", "E"].includes(result)) {
    throw new Error("Résultat invalide.");
  }
  return result;
}

module.exports = {
  createCombatResult,
  normalizeCombatResult
};
