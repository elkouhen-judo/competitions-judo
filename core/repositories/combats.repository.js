module.exports = function createCombatsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

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

  async function insert(payload) {
    return supabaseInsert("combats", payload);
  }

  async function update(idCombat, payload) {
    return supabasePatch("combats", eqFilter("id_combat", idCombat), payload);
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
