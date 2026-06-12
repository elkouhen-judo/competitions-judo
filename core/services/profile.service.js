const {
  toCanonicalCombat,
  toCanonicalCompetition,
  toCanonicalJudoka,
  toJudokaReadModel
} = require("./domain-adapters");

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
      judoka: toCanonicalJudoka(target),
      competitions: competitions.map(toCanonicalCompetition),
      combats: combats.map(toCanonicalCombat),
      getCompetitionCategoryLabel,
      getCompetitionResultRank,
      getCurrentSeasonBounds,
      isDateWithinSeason
    });

    return {
      ...snapshot,
      judoka: toJudokaReadModel(target)
    };
  }

  return {
    methods: {
      getJudokaProfile
    }
  };
};
