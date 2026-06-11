function getCompetitionResultRank(value) {
  const ranking = {
    "1er": 1,
    "2e": 2,
    "3e": 3,
    "5e": 5,
    "7e": 7
  };
  return ranking[String(value || "").toLowerCase()] || Number.POSITIVE_INFINITY;
}

function getCompetitionCategoryLabel(competition) {
  return [competition.categorie_age, competition.categorie_poids].filter(Boolean).join(" - ");
}

module.exports = {
  getCompetitionCategoryLabel,
  getCompetitionResultRank
};
