const { createCombatResult } = require("./combat-result");

function createCombat(combat) {
  if (!combat || !combat.id_competition) {
    throw new Error("Compétition obligatoire.");
  }
  if (!combat.id_judoka) {
    throw new Error("Judoka obligatoire.");
  }

  const record = {
    id_judoka: combat.id_judoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: createCombatResult(combat.resultat),
    type_victoire: combat.type_victoire || "",
    deroule: combat.deroule || ""
  };

  return {
    ...record
  };
}

function updateCombat(combat) {
  if (!combat || !combat.id_combat) {
    throw new Error("Combat obligatoire.");
  }

  return createCombat(combat);
}

module.exports = {
  createCombat,
  updateCombat
};
