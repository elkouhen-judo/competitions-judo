function toCompetitionRecord(competition, ownerJudokaId) {
  if (!ownerJudokaId) {
    throw new Error("Judoka participant obligatoire.");
  }
  if (!competition || !competition.nom || !competition.date) {
    throw new Error("Nom et date obligatoires.");
  }

  return {
    id_judoka: ownerJudokaId,
    nom: competition.nom,
    date: competition.date,
    categorie_age: competition.categorie_age || "",
    categorie_poids: competition.categorie_poids || "",
    classement: competition.classement || ""
  };
}

module.exports = {
  toCompetitionRecord
};
