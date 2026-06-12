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
  const lastCompetition = sortedCompetitions[0] || null;
  const referenceDate = lastCompetition ? new Date(lastCompetition.competitionDate) : null;
  const bounds = referenceDate && !Number.isNaN(referenceDate.getTime())
    ? getCurrentSeasonBounds(referenceDate)
    : currentBounds;
  const seasonCompetitions = sortedCompetitions.filter(c => isDateWithinSeason(c.competitionDate, bounds));
  const seasonCompetitionIds = new Set(seasonCompetitions.map(c => String(c.competitionId)));
  const seasonCombats = combats.filter(c => seasonCompetitionIds.has(String(c.competitionId)));
  const seasonWins = seasonCombats.filter(c => String(c.result || "").toUpperCase() === "V").length;
  const seasonLosses = seasonCombats.filter(c => String(c.result || "").toUpperCase() === "D").length;

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
