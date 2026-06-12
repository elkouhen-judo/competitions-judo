const {
  isLossCombatResult,
  isVictoryCombatResult
} = require("./competitions/combat-result");

function buildJudokaProfileSnapshot({
  judoka,
  competitions,
  combats,
  getCompetitionCategoryLabel,
  getCompetitionResultRank,
  getCurrentSeasonBounds,
  isDateWithinSeason
}) {
  const currentBounds = getCurrentSeasonBounds();
  const sortedCompetitions = [...competitions].sort((a, b) => (
    String(b.competitionDate || "").localeCompare(String(a.competitionDate || ""))
  ));
  const currentSeasonCompetitions = sortedCompetitions.filter(c => isDateWithinSeason(c.competitionDate, currentBounds));
  const latestCompetition = sortedCompetitions[0] || null;
  const referenceDate = latestCompetition ? new Date(latestCompetition.competitionDate) : null;
  const fallbackBounds = referenceDate && !Number.isNaN(referenceDate.getTime())
    ? getCurrentSeasonBounds(referenceDate)
    : currentBounds;
  const bounds = currentSeasonCompetitions.length ? currentBounds : fallbackBounds;
  const seasonCompetitions = currentSeasonCompetitions.length
    ? currentSeasonCompetitions
    : sortedCompetitions.filter(c => isDateWithinSeason(c.competitionDate, bounds));
  const lastCompetition = seasonCompetitions[0] || null;
  const seasonCompetitionIds = new Set(seasonCompetitions.map(c => String(c.competitionId)));
  const seasonCombats = combats.filter(c => seasonCompetitionIds.has(String(c.competitionId)));
  const seasonWins = seasonCombats.filter(c => isVictoryCombatResult(c.result)).length;
  const seasonLosses = seasonCombats.filter(c => isLossCombatResult(c.result)).length;

  const bestSeasonResults = seasonCompetitions
    .filter(c => c.result && Number.isFinite(getCompetitionResultRank(c.result)))
    .sort((a, b) => {
      const rankDiff = getCompetitionResultRank(a.result) - getCompetitionResultRank(b.result);
      if (rankDiff !== 0) return rankDiff;
      return String(b.competitionDate || "").localeCompare(String(a.competitionDate || ""));
    })
    .slice(0, 3)
    .map(c => ({
      competitionId: c.competitionId,
      name: c.name,
      competitionDate: c.competitionDate,
      result: c.result
    }));

  return {
    judoka,
    season: bounds,
    lastCompetition: lastCompetition
      ? {
          competitionId: lastCompetition.competitionId,
          name: lastCompetition.name,
          competitionDate: lastCompetition.competitionDate,
          category: getCompetitionCategoryLabel(lastCompetition),
          weightCategory: lastCompetition.weightCategory || ""
        }
      : null,
    bestSeasonResults,
    seasonCombatCount: seasonCombats.length,
    seasonCompetitionCount: seasonCompetitions.length,
    seasonWins,
    seasonLosses
  };
}

module.exports = {
  buildJudokaProfileSnapshot
};
