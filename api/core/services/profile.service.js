module.exports = function createProfileService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    getCompetitionCategoryLabel,
    getCompetitionResultRank,
    getCurrentSeasonBounds,
    isDateWithinSeason
  } = deps;

  async function getJudokaProfile(email, idJudoka) {
    const { target } = await userContextService.getAccessibleJudokaProfile(email, idJudoka);
    const competitions = await competitionsRepository.listByJudoka(target.id_judoka);
    const combats = await combatsRepository.listByJudoka(target.id_judoka);
    const bounds = getCurrentSeasonBounds();
    const seasonCompetitions = competitions.filter(c => isDateWithinSeason(c.date, bounds));
    const seasonCompetitionIds = new Set(seasonCompetitions.map(c => String(c.id_competition)));
    const seasonCombats = combats
      .filter(c => seasonCompetitionIds.has(String(c.id_competition)));
    const seasonWins = seasonCombats.filter(c => c.resultat === "V").length;
    const seasonLosses = seasonCombats.filter(c => c.resultat === "D").length;
    const competitionsById = new Map(competitions.map(c => [String(c.id_competition), c]));
    const lastCombatCompetition = combats
      .map(combat => ({
        combat,
        competition: competitionsById.get(String(combat.id_competition))
      }))
      .filter(entry => entry.competition)
      .sort((a, b) => {
        const dateDiff = String(b.competition.date || "").localeCompare(String(a.competition.date || ""));
        if (dateDiff !== 0) return dateDiff;
        return String(b.combat.id_combat || "").localeCompare(String(a.combat.id_combat || ""));
      })[0] || null;
    const bestSeasonResults = seasonCompetitions
      .filter(c => c.classement && Number.isFinite(getCompetitionResultRank(c.classement)))
      .sort((a, b) => {
        const rankDiff = getCompetitionResultRank(a.classement) - getCompetitionResultRank(b.classement);
        if (rankDiff !== 0) return rankDiff;
        return String(b.date || "").localeCompare(String(a.date || ""));
      })
      .slice(0, 3)
      .map(c => ({
        id_competition: c.id_competition,
        nom: c.nom,
        date: c.date,
        classement: c.classement
      }));
    const lastCompetition = competitions[0] || null;
    const lastCompetitionForCategory = lastCombatCompetition ? lastCombatCompetition.competition : lastCompetition;

    return {
      judoka: target,
      season: bounds,
      lastCompetition: lastCompetition
        ? {
            id_competition: lastCompetition.id_competition,
            nom: lastCompetition.nom,
            date: lastCompetition.date,
            category: lastCompetitionForCategory ? getCompetitionCategoryLabel(lastCompetitionForCategory) : "",
            weightCategory: lastCompetitionForCategory ? (lastCompetitionForCategory.categorie_poids || "") : ""
          }
        : null,
      bestSeasonResults,
      seasonCombatCount: seasonCombats.length,
      seasonCompetitionCount: seasonCompetitions.length,
      seasonWins,
      seasonLosses
    };
  }

  return {
    methods: {
      getJudokaProfile
    }
  };
};
