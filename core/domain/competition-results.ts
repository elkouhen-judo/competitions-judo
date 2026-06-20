const RESULT_RANKS: Record<string, number> = {
  "1er": 1,
  "2e": 2,
  "3e": 3,
  "4e": 4,
  "5e": 5,
  "6e": 6,
  "7e": 7,
  "8e": 8,
  "non classé": 99
};

const RESULT_DISPLAY_LABELS: Record<string, string> = {
  "1er": "🥇",
  "2e": "🥈",
  "3e": "🥉"
};

export const COMPETITION_RESULTS: string[] = Object.keys(RESULT_RANKS);

export function createCompetitionRanking(value: unknown): string {
  const ranking = typeof value === "string" ? value.trim() : "";
  if (!ranking) {
    return "";
  }

  if (!Number.isFinite(getCompetitionResultRank(ranking))) {
    throw new Error("Classement invalide.");
  }

  return ranking;
}

export function getCompetitionResultRank(value: unknown): number {
  return RESULT_RANKS[String(value || "").toLowerCase()] || Number.POSITIVE_INFINITY;
}

export function formatCompetitionRankingDisplay(value: unknown): string {
  const ranking = String(value || "").trim();
  return RESULT_DISPLAY_LABELS[ranking] || ranking;
}

export interface CompetitionCategoryLike {
  ageCategory?: unknown;
  weightCategory?: unknown;
}

export function getCompetitionCategoryLabel(competition: CompetitionCategoryLike): string {
  return [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - ");
}
