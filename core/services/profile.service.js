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
    return buildJudokaProfileSnapshot({
      judoka: target,
      competitions,
      combats,
      getCompetitionCategoryLabel,
      getCompetitionResultRank,
      getCurrentSeasonBounds,
      isDateWithinSeason
    });
  }

  return {
    methods: {
      getJudokaProfile
    }
  };
};
