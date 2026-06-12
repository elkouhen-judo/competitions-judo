const RESULT_RANKS = {
  "1er": 1,
  "2e": 2,
  "3e": 3,
  "5e": 5,
  "7e": 7,
  "non classé": 99
};

function createCompetitionRanking(value) {
  const ranking = typeof value === "string" ? value.trim() : "";
  if (!ranking) {
    return "";
  }

  if (!Number.isFinite(getCompetitionResultRank(ranking))) {
    throw new Error("Classement invalide.");
  }

  return ranking;
}

function getCompetitionResultRank(value) {
  return RESULT_RANKS[String(value || "").toLowerCase()] || Number.POSITIVE_INFINITY;
}

function getCompetitionCategoryLabel(competition) {
  return [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - ");
}

module.exports = {
  createCompetitionRanking,
  getCompetitionCategoryLabel,
  getCompetitionResultRank
};
