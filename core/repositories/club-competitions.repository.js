module.exports = function createClubCompetitionsRepository(deps) {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  function toClubCompetitionRecord(event) {
    return {
      id_club_competition: event.clubCompetitionId,
      nom: event.name,
      date: event.competitionDate,
      categorie_age: event.ageCategory || "",
      categorie_poids: event.weightCategory || ""
    };
  }

  async function listAll() {
    return supabaseSelect("club_competitions", "select=*&order=date.desc");
  }

  async function getById(idClubCompetition) {
    return supabaseSelectOne(
      "club_competitions",
      `select=*&${eqFilter("id_club_competition", idClubCompetition)}`
    );
  }

  async function insert(event) {
    return supabaseInsert("club_competitions", toClubCompetitionRecord(event));
  }

  async function update(idClubCompetition, event) {
    const record = toClubCompetitionRecord({ ...event, clubCompetitionId: idClubCompetition });
    delete record.id_club_competition;
    return supabasePatch(
      "club_competitions",
      eqFilter("id_club_competition", idClubCompetition),
      record
    );
  }

  async function remove(idClubCompetition) {
    return supabaseDelete("club_competitions", eqFilter("id_club_competition", idClubCompetition));
  }

  return {
    getById,
    insert,
    listAll,
    remove,
    update
  };
};
