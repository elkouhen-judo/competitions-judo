const { createCombatResult } = require("./combat-result");
const { createCombatDecisionType } = require("./combat-decision-type");
const { createCombatId, createCompetitionId, createJudokaId } = require("../shared/identity");

function createCombatDraft(combat = {}) {
  const result = createCombatResult(combat.result);
  const victoryTypeValue =
    result === "Egalité" ? combat.victoryType || "Hiki wake" : combat.victoryType;

  return {
    opponent: combat.opponent || "",
    result,
    victoryType: createCombatDecisionType(victoryTypeValue, result),
    notes: combat.notes || ""
  };
}

function createCombat(combat) {
  const competitionId = createCompetitionId(combat && combat.competitionId);
  const judokaId = createJudokaId(combat && combat.judokaId);
  const combatId = combat && combat.combatId ? createCombatId(combat.combatId) : null;
  const draft = createCombatDraft(combat);

  return {
    combatId,
    competitionId,
    judokaId,
    draft,
    opponent: draft.opponent,
    result: draft.result,
    victoryType: draft.victoryType,
    notes: draft.notes
  };
}

function updateCombat(combat) {
  if (!combat || !combat.combatId) {
    throw new Error("Combat obligatoire.");
  }

  return createCombat(combat);
}

module.exports = {
  createCombat,
  createCombatDraft,
  updateCombat
};
