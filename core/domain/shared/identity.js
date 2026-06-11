function createRequiredId(value, message) {
  const id = String(value || "").trim();
  if (!id) {
    throw new Error(message);
  }
  return id;
}

function createOptionalId(value) {
  const id = String(value || "").trim();
  return id || null;
}

function createJudokaId(value, message = "Judoka obligatoire.") {
  return createRequiredId(value, message);
}

function createOptionalJudokaId(value) {
  return createOptionalId(value);
}

function createCompetitionId(value, message = "Compétition obligatoire.") {
  return createRequiredId(value, message);
}

function createOptionalCompetitionId(value) {
  return createOptionalId(value);
}

function createCombatId(value, message = "Combat obligatoire.") {
  return createRequiredId(value, message);
}

module.exports = {
  createCombatId,
  createCompetitionId,
  createJudokaId,
  createOptionalCompetitionId,
  createOptionalJudokaId
};
