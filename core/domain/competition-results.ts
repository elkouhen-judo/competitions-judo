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

export interface CompetitionCategoryLike {
  ageCategory?: unknown;
  weightCategory?: unknown;
}

export function getCompetitionCategoryLabel(competition: CompetitionCategoryLike): string {
  return [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - ");
}
