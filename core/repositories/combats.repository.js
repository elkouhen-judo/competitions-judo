module.exports = function createCombatsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  const LEGACY_RESULTS_BY_CANONICAL_RESULT = {
    Victoire: "V",
    "Défaite": "D",
    Egalité: "E"
  };

  function toLegacyCompatibleResult(value) {
    return LEGACY_RESULTS_BY_CANONICAL_RESULT[value] || value || "";
  }

  function toLegacyCompatibleCombatRecord(record) {
    return {
      ...record,
      resultat: toLegacyCompatibleResult(record && record.resultat)
    };
  }

  function shouldRetryWithLegacyResult(error, record) {
    return Boolean(
      error
      && record
      && LEGACY_RESULTS_BY_CANONICAL_RESULT[record.resultat]
      && /combats_resultat_check/.test(String(error.message || error))
    );
  }

  function toCombatRecord(combat) {
    const draft = combat && combat.draft;
    if (!draft) {
      throw new Error("Combat domain draft required.");
    }
    return {
      id_judoka: combat.judokaId,
      id_competition: combat.competitionId,
      adversaire: draft.opponent,
      resultat: draft.result,
      type_victoire: draft.victoryType,
      deroule: draft.notes
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
    const record = toNewCombatRecord(combat, idCombat);
    try {
      return await supabaseInsert("combats", record);
    } catch (error) {
      if (!shouldRetryWithLegacyResult(error, record)) {
        throw error;
      }
      return supabaseInsert("combats", toLegacyCompatibleCombatRecord(record));
    }
  }

  async function update(idCombat, combat) {
    const record = toCombatRecord(combat);
    try {
      return await supabasePatch("combats", eqFilter("id_combat", idCombat), record);
    } catch (error) {
      if (!shouldRetryWithLegacyResult(error, record)) {
        throw error;
      }
      return supabasePatch("combats", eqFilter("id_combat", idCombat), toLegacyCompatibleCombatRecord(record));
    }
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
