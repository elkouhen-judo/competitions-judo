const { createCompetitionId, createJudokaId, createOptionalCompetitionId } = require("../shared/identity");
const { createCompetitionRanking } = require("../competition-results");
const { createCombat } = require("./combat");

function cleanCompetitionText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createCompetitionDate(value) {
  const competitionDate = cleanCompetitionText(value);
  if (!competitionDate) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(competitionDate)) {
    throw new Error("Date de compétition invalide.");
  }

  const parsedDate = new Date(`${competitionDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== competitionDate) {
    throw new Error("Date de compétition invalide.");
  }

  return competitionDate;
}

function createCompetitionDetailsDraft(competition = {}) {
  const name = cleanCompetitionText(competition.name);
  const competitionDate = createCompetitionDate(competition.competitionDate);

  if (!name || !competitionDate) {
    throw new Error("Nom et date obligatoires.");
  }

  return {
    name,
    competitionDate,
    ageCategory: cleanCompetitionText(competition.ageCategory),
    weightCategory: cleanCompetitionText(competition.weightCategory)
  };
}

function createCompetitionFinalResult(value) {
  return createCompetitionRanking(value);
}

function createCompetition(competition, ownerJudokaId) {
  const draft = createCompetitionDetailsDraft(competition);
  const resolvedOwnerJudokaId = createJudokaId(ownerJudokaId, "Judoka participant obligatoire.");
  const competitionId = createOptionalCompetitionId(competition && competition.competitionId);
  const result = createCompetitionFinalResult(competition && competition.result);

  const record = {
    competitionId,
    ownerJudokaId: resolvedOwnerJudokaId,
    draft,
    name: draft.name,
    competitionDate: draft.competitionDate,
    ageCategory: draft.ageCategory,
    weightCategory: draft.weightCategory,
    result
  };

  return {
    ...record,
    changeDetails(details = {}) {
      return createCompetition({
        ...details,
        competitionId: record.competitionId,
        result: details.result !== undefined ? details.result : record.result
      }, record.ownerJudokaId);
    },
    finalize(finalResult) {
      return {
        competitionId: record.competitionId,
        ownerJudokaId: record.ownerJudokaId,
        result: createCompetitionFinalResult(finalResult)
      };
    },
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
  createCompetitionDetailsDraft,
  createCompetitionFinalResult,
  createPersistedCompetition
};
