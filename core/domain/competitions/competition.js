function createCompetition(competition, ownerJudokaId) {
  if (!ownerJudokaId) {
    throw new Error("Judoka participant obligatoire.");
  }
  if (!competition || !competition.nom || !competition.date) {
    throw new Error("Nom et date obligatoires.");
  }

  const record = {
    id_judoka: ownerJudokaId,
    nom: competition.nom,
    date: competition.date,
    categorie_age: competition.categorie_age || "",
    categorie_poids: competition.categorie_poids || "",
    classement: competition.classement || ""
  };

  return {
    ...record,
    assertCanContainCombat(combat) {
      if (!combat || String(combat.id_competition) !== String(competition.id_competition || "")) {
        throw new Error("Ce combat n'appartient pas à cette compétition.");
      }
      if (String(combat.id_judoka) !== String(record.id_judoka)) {
        throw new Error("Le combat doit concerner le judoka de la compétition.");
      }
    }
  };
}

function createPersistedCompetition(competition) {
  if (!competition || !competition.id_competition) {
    throw new Error("Compétition obligatoire.");
  }

  const persistedCompetition = createCompetition(competition, competition.id_judoka);
  return {
    ...persistedCompetition,
    id_competition: competition.id_competition
  };
}

function assertCompetitionCanContainCombat(competition, combat) {
  createPersistedCompetition(competition).assertCanContainCombat(combat);
}

module.exports = {
  assertCompetitionCanContainCombat,
  createCompetition,
  createPersistedCompetition
};
