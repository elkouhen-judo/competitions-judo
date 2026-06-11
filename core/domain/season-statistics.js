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
  const lastCompetition = competitions[0] || null;
  const hasCurrentSeasonCompetition = competitions.some(c => isDateWithinSeason(c.date, currentBounds));
  const referenceDate = lastCompetition ? new Date(lastCompetition.date) : null;
  const bounds = hasCurrentSeasonCompetition || !referenceDate || Number.isNaN(referenceDate.getTime())
    ? currentBounds
    : getCurrentSeasonBounds(referenceDate);
  const seasonCompetitions = competitions.filter(c => isDateWithinSeason(c.date, bounds));
  const seasonCompetitionIds = new Set(seasonCompetitions.map(c => String(c.id_competition)));
  const seasonCombats = combats.filter(c => seasonCompetitionIds.has(String(c.id_competition)));
  const seasonWins = seasonCombats.filter(c => String(c.resultat || "").toUpperCase() === "V").length;
  const seasonLosses = seasonCombats.filter(c => String(c.resultat || "").toUpperCase() === "D").length;

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

  return {
    judoka,
    season: bounds,
    lastCompetition: lastCompetition
      ? {
          id_competition: lastCompetition.id_competition,
          nom: lastCompetition.nom,
          date: lastCompetition.date,
          category: getCompetitionCategoryLabel(lastCompetition),
          weightCategory: lastCompetition.categorie_poids || ""
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
