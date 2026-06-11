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
    seasonResult: competition.seasonResult || competition.classement || ""
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
      const combatCompetitionId = combat && (combat.competitionId || combat.id_competition);
      const combatJudokaId = combat && (combat.judokaId || combat.id_judoka);

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
        judokaId: combatDraft.judokaId || combatDraft.id_judoka || record.ownerJudokaId
      });
      this.assertCanContainCombat(combat);
      return combat;
    }
  };
}

function createPersistedCompetition(competition) {
  createCompetitionId(competition && (competition.competitionId || competition.id_competition));
  return createCompetition(competition, competition.ownerJudokaId || competition.id_judoka);
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
