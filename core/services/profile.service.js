const { toDomainCombat, toDomainCompetition, toDomainJudoka } = require("./domain-adapters");

module.exports = function createProfileService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    buildJudokaProfileSnapshot,
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
    const snapshot = buildJudokaProfileSnapshot({
      judoka: toDomainJudoka(target),
      competitions: competitions.map(toDomainCompetition),
      combats: combats.map(toDomainCombat),
      getCompetitionCategoryLabel,
      getCompetitionResultRank,
      getCurrentSeasonBounds,
      isDateWithinSeason
    });

    return {
      ...snapshot,
      judoka: target,
      lastCompetition: snapshot.lastCompetition
        ? {
            id_competition: snapshot.lastCompetition.competitionId,
            nom: snapshot.lastCompetition.name,
            date: snapshot.lastCompetition.competitionDate,
            category: snapshot.lastCompetition.category,
            weightCategory: snapshot.lastCompetition.weightCategory
          }
        : null,
      bestSeasonResults: snapshot.bestSeasonResults.map(result => ({
        id_competition: result.competitionId,
        nom: result.name,
        date: result.competitionDate,
        classement: result.seasonResult
      }))
    };
  }

  return {
    methods: {
      getJudokaProfile
    }
  };
};
