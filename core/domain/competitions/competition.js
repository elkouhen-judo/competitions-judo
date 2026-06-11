const { createCompetitionId, createJudokaId, createOptionalCompetitionId } = require("../shared/identity");
const { createCombat } = require("./combat");

function createCompetitionDraft(competition = {}) {
  const { name, competitionDate } = competition;

  if (!name || !competitionDate) {
    throw new Error("Nom et date obligatoires.");
  }

  return {
    name,
    competitionDate,
    ageCategory: competition.ageCategory || "",
    weightCategory: competition.weightCategory || "",
    seasonResult: competition.seasonResult || ""
  };
}

function createCompetition(competition, ownerJudokaId) {
  const draft = createCompetitionDraft(competition);
  const resolvedOwnerJudokaId = createJudokaId(ownerJudokaId, "Judoka participant obligatoire.");
  const competitionId = createOptionalCompetitionId(competition && competition.competitionId);

  const record = {
    competitionId,
    ownerJudokaId: resolvedOwnerJudokaId,
    draft,
    name: draft.name,
    competitionDate: draft.competitionDate,
    ageCategory: draft.ageCategory,
    weightCategory: draft.weightCategory,
    seasonResult: draft.seasonResult
  };

  return {
    ...record,
    belongsToJudoka(judokaId) {
      return String(record.ownerJudokaId) === String(judokaId);
    },
    assertCanContainCombat(combat) {
      const combatCompetitionId = combat && combat.competitionId;
      const combatJudokaId = combat && combat.judokaId;

      if (!combat || String(combatCompetitionId) !== String(record.competitionId || "")) {
        throw new Error("Ce combat n'appartient pas à cette compétition.");
      }
      if (!this.belongsToJudoka(combatJudokaId)) {
        throw new Error("Le combat doit concerner le judoka de la compétition.");
      }
    },
    recordCombat(combatDraft) {
      const combat = createCombat({
        ...combatDraft,
        competitionId: record.competitionId,
        judokaId: combatDraft.judokaId || record.ownerJudokaId
      });
      this.assertCanContainCombat(combat);
      return combat;
    }
  };
}

function createPersistedCompetition(competition) {
  createCompetitionId(competition && competition.competitionId);
  return createCompetition(competition, competition.ownerJudokaId);
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
