module.exports = function createCombatsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  function toCombatRecord(combat) {
    return {
      id_judoka: combat.id_judoka,
      id_competition: combat.id_competition,
      adversaire: combat.adversaire,
      resultat: combat.resultat,
      type_victoire: combat.type_victoire,
      deroule: combat.deroule
    };
  }

  function toNewCombatRecord(combat, idCombat) {
    return {
      id_combat: idCombat,
      ...toCombatRecord(combat)
    };
  }

  async function listByJudoka(idJudoka) {
    return supabaseSelect("combats", `select=*&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function listByCompetition(idCompetition) {
    return supabaseSelect("combats", `select=*&${eqFilter("id_competition", idCompetition)}`);
  }

  async function listByCompetitionAndJudoka(idCompetition, idJudoka) {
    return supabaseSelect(
      "combats",
      `select=*&${eqFilter("id_competition", idCompetition)}&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function listByCompetitionAndJudokaIds(idCompetition, ids) {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect("combats", `select=*&${eqFilter("id_competition", idCompetition)}&id_judoka=in.(${ids.join(",")})`);
  }

  async function getById(idCombat) {
    return supabaseSelectOne("combats", `select=*&${eqFilter("id_combat", idCombat)}`);
  }

  async function existsForJudoka(idJudoka) {
    return supabaseSelectOne("combats", `select=id_combat&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(combat, idCombat) {
    return supabaseInsert("combats", toNewCombatRecord(combat, idCombat));
  }

  async function update(idCombat, combat) {
    return supabasePatch("combats", eqFilter("id_combat", idCombat), toCombatRecord(combat));
  }

  async function remove(idCombat) {
    return supabaseDelete("combats", eqFilter("id_combat", idCombat));
  }

  return {
    existsForJudoka,
    getById,
    insert,
    listByCompetition,
    listByCompetitionAndJudoka,
    listByCompetitionAndJudokaIds,
    listByJudoka,
    remove,
    update
  };
};
