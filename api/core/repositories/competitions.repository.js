module.exports = function createCompetitionsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  async function listAll() {
    return supabaseSelect("competitions", "select=*&order=date.desc");
  }

  async function listByJudoka(idJudoka) {
    return supabaseSelect("competitions", `select=*&${eqFilter("id_judoka", idJudoka)}&order=date.desc`);
  }

  async function listByJudokaIds(ids) {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect("competitions", `select=*&id_judoka=in.(${ids.join(",")})&order=date.desc`);
  }

  async function getById(idCompetition) {
    return supabaseSelectOne("competitions", `select=*&${eqFilter("id_competition", idCompetition)}`);
  }

  async function existsForJudoka(idJudoka) {
    return supabaseSelectOne("competitions", `select=id_competition&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(payload) {
    return supabaseInsert("competitions", payload);
  }

  async function update(idCompetition, payload) {
    return supabasePatch("competitions", eqFilter("id_competition", idCompetition), payload);
  }

  async function remove(idCompetition) {
    return supabaseDelete("competitions", eqFilter("id_competition", idCompetition));
  }

  return {
    existsForJudoka,
    getById,
    insert,
    listAll,
    listByJudoka,
    listByJudokaIds,
    remove,
    update
  };
};
