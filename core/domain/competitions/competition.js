const { createCompetitionId, createJudokaId, createOptionalCompetitionId } = require("../shared/identity");
const { createCombat } = require("./combat");

function createCompetitionDraft(competition = {}) {
  const name = competition.name || competition.nom;
  const competitionDate = competition.competitionDate || competition.date;

  if (!name || !competitionDate) {
    throw new Error("Nom et date obligatoires.");
  }

  return {
    name,
    competitionDate,
    ageCategory: competition.ageCategory || competition.categorie_age || "",
    weightCategory: competition.weightCategory || competition.categorie_poids || "",
    seasonResult: competition.seasonResult || competition.classement || "",
    nom: name,
    date: competitionDate,
    categorie_age: competition.ageCategory || competition.categorie_age || "",
    categorie_poids: competition.weightCategory || competition.categorie_poids || "",
    classement: competition.seasonResult || competition.classement || ""
  };
}

function createCompetition(competition, ownerJudokaId) {
  const draft = createCompetitionDraft(competition);
  const resolvedOwnerJudokaId = createJudokaId(ownerJudokaId, "Judoka participant obligatoire.");
  const competitionId = createOptionalCompetitionId(competition && (competition.competitionId || competition.id_competition));

  const record = {
    competitionId,
    ownerJudokaId: resolvedOwnerJudokaId,
    draft,
    id_competition: competitionId,
    id_judoka: resolvedOwnerJudokaId,
    nom: draft.name,
    date: draft.competitionDate,
    categorie_age: draft.ageCategory,
    categorie_poids: draft.weightCategory,
    classement: draft.seasonResult
  };

  return {
    ...record,
    belongsToJudoka(judokaId) {
      return String(record.ownerJudokaId) === String(judokaId);
    },
    assertCanContainCombat(combat) {
      if (!combat || String(combat.id_competition) !== String(record.competitionId || "")) {
        throw new Error("Ce combat n'appartient pas à cette compétition.");
      }
      if (!this.belongsToJudoka(combat.id_judoka)) {
        throw new Error("Le combat doit concerner le judoka de la compétition.");
      }
    },
    recordCombat(combatDraft) {
      const combat = createCombat({
        ...combatDraft,
        id_competition: record.competitionId,
        id_judoka: combatDraft.judokaId || combatDraft.id_judoka || record.ownerJudokaId
      });
      this.assertCanContainCombat(combat);
      return combat;
    }
  };
}

function createPersistedCompetition(competition) {
  createCompetitionId(competition && (competition.competitionId || competition.id_competition));

  const persistedCompetition = createCompetition(competition, competition.ownerJudokaId || competition.id_judoka);
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
  createCompetitionDraft,
  createPersistedCompetition
};
