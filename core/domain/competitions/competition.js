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
    toRecord() {
      return { ...record };
    },
    toNewRecord(buildCompetitionId) {
      return {
        id_competition: buildCompetitionId(),
        ...record
      };
    }
  };
}

function toCompetitionRecord(competition, ownerJudokaId) {
  return createCompetition(competition, ownerJudokaId).toRecord();
}

function createCompetitionRecord(competition, ownerJudokaId, buildCompetitionId) {
  return createCompetition(competition, ownerJudokaId).toNewRecord(buildCompetitionId);
}

module.exports = {
  createCompetition,
  createCompetitionRecord,
  toCompetitionRecord
};
