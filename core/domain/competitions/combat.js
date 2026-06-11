const { createCombatResult } = require("./combat-result");
const { createCombatId, createCompetitionId, createJudokaId } = require("../shared/identity");

function createCombatDraft(combat = {}) {
  const result = createCombatResult(combat.result || combat.resultat);

  return {
    opponent: combat.opponent || combat.adversaire || "",
    result,
    victoryType: combat.victoryType || combat.type_victoire || "",
    notes: combat.notes || combat.deroule || ""
  };
}

function createCombat(combat) {
  const competitionId = createCompetitionId(combat && (combat.competitionId || combat.id_competition));
  const judokaId = createJudokaId(combat && (combat.judokaId || combat.id_judoka));
  const combatId = combat && (combat.combatId || combat.id_combat)
    ? createCombatId(combat.combatId || combat.id_combat)
    : null;
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
  if (!combat || !(combat.combatId || combat.id_combat)) {
    throw new Error("Combat obligatoire.");
  }

  return createCombat(combat);
}

module.exports = {
  createCombat,
  createCombatDraft,
  updateCombat
};
