const { createCompetitionId, createJudokaId, createOptionalCompetitionId } = require("../shared/identity");
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

function createCompetitionDraft(competition = {}) {
  const name = cleanCompetitionText(competition.name);
  const competitionDate = createCompetitionDate(competition.competitionDate);

  if (!name || !competitionDate) {
    throw new Error("Nom et date obligatoires.");
  }

  return {
    name,
    competitionDate,
    ageCategory: cleanCompetitionText(competition.ageCategory),
    weightCategory: cleanCompetitionText(competition.weightCategory),
    seasonResult: cleanCompetitionText(competition.seasonResult)
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
