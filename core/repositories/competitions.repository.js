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
    const draft = competition && competition.draft;
    if (!draft) {
      throw new Error("Competition domain draft required.");
    }
    return {
      id_judoka: competition.ownerJudokaId,
      club_competition_id: competition.clubCompetitionId || null,
      nom: draft.name,
      date: draft.competitionDate,
      categorie_age: draft.ageCategory,
      categorie_poids: draft.weightCategory,
      classement: competition.result || ""
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
    return supabaseSelect(
      "competitions",
      `select=*&${eqFilter("id_judoka", idJudoka)}&order=date.desc`
    );
  }

  async function listByJudokaIds(ids) {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect(
      "competitions",
      `select=*&id_judoka=in.(${ids.join(",")})&order=date.desc`
    );
  }

  async function listByClubCompetition(idClubCompetition) {
    return supabaseSelect(
      "competitions",
      `select=*&${eqFilter("club_competition_id", idClubCompetition)}&order=nom.asc`
    );
  }

  async function getById(idCompetition) {
    return supabaseSelectOne(
      "competitions",
      `select=*&${eqFilter("id_competition", idCompetition)}`
    );
  }

  async function existsForJudoka(idJudoka) {
    return supabaseSelectOne(
      "competitions",
      `select=id_competition&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function insert(competition, idCompetition) {
    return supabaseInsert("competitions", toNewCompetitionRecord(competition, idCompetition));
  }

  async function update(idCompetition, competition) {
    return supabasePatch(
      "competitions",
      eqFilter("id_competition", idCompetition),
      toCompetitionRecord(competition)
    );
  }

  async function updateResult(idCompetition, finalization) {
    return supabasePatch("competitions", eqFilter("id_competition", idCompetition), {
      classement: finalization.result || ""
    });
  }

  async function detachFromClubCompetition(idCompetition) {
    return supabasePatch("competitions", eqFilter("id_competition", idCompetition), {
      club_competition_id: null
    });
  }

  async function remove(idCompetition) {
    return supabaseDelete("competitions", eqFilter("id_competition", idCompetition));
  }

  return {
    detachFromClubCompetition,
    existsForJudoka,
    getById,
    insert,
    listAll,
    listByClubCompetition,
    listByJudoka,
    listByJudokaIds,
    remove,
    update,
    updateResult
  };
};
