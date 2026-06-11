const { createCombatResult } = require("./combat-result");

function toCombatRecord(combat) {
  if (!combat || !combat.id_competition) {
    throw new Error("Compétition obligatoire.");
  }
  if (!combat.id_judoka) {
    throw new Error("Judoka obligatoire.");
  }

  return {
    id_judoka: combat.id_judoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: createCombatResult(combat.resultat),
    type_victoire: combat.type_victoire || "",
    deroule: combat.deroule || ""
  };
}

function createCombatRecord(combat, buildCombatId) {
  return {
    id_combat: buildCombatId(),
    ...toCombatRecord(combat)
  };
}

function updateCombatRecord(combat) {
  if (!combat || !combat.id_combat) {
    throw new Error("Combat obligatoire.");
  }

  return toCombatRecord(combat);
}

module.exports = {
  createCombatRecord,
  toCombatRecord,
  updateCombatRecord
};
