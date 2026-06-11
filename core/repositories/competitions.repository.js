module.exports = function createCompetitionsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  function toCompetitionRecord(competition) {
    return {
      id_judoka: competition.id_judoka,
      nom: competition.nom,
      date: competition.date,
      categorie_age: competition.categorie_age,
      categorie_poids: competition.categorie_poids,
      classement: competition.classement
    };
  }

  function toNewCompetitionRecord(competition, idCompetition) {
    return {
      id_competition: idCompetition,
      ...toCompetitionRecord(competition)
    };
  }

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

  async function insert(competition, idCompetition) {
    return supabaseInsert("competitions", toNewCompetitionRecord(competition, idCompetition));
  }

  async function update(idCompetition, competition) {
    return supabasePatch("competitions", eqFilter("id_competition", idCompetition), toCompetitionRecord(competition));
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
