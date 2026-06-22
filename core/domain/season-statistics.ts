import { isLossCombatResult, isVictoryCombatResult } from "./competitions/combat-result";
import { computeTopWinTechniques } from "./competitions/combat-technique-breakdown";
import { computeDecisionBreakdown } from "./competitions/combat-decision-breakdown";
import type {
  Combat,
  Competition,
  CompetitionCombatRecord,
  CompetitionResultBadge,
  Judoka,
  JudokaProfile,
  JudokaProfileLastCompetition,
  SeasonBounds,
  SeasonCompetitionResult
} from "../types";

export interface BuildJudokaProfileSnapshotInput {
  judoka: Judoka;
  competitions: Competition[];
  combats: Combat[];
  getCompetitionCategoryLabel: (competition: Competition) => string;
  getCurrentSeasonBounds: (referenceDate?: Date) => SeasonBounds;
  isDateWithinSeason: (dateValue: unknown, bounds: SeasonBounds) => boolean;
}

export function buildJudokaProfileSnapshot({
  judoka,
  competitions,
  combats,
  getCompetitionCategoryLabel,
  getCurrentSeasonBounds,
  isDateWithinSeason
}: BuildJudokaProfileSnapshotInput): JudokaProfile {
  const currentBounds = getCurrentSeasonBounds();
  const sortedCompetitions = [...competitions].sort((a, b) =>
    String(b.competitionDate || "").localeCompare(String(a.competitionDate || ""))
  );
  const currentSeasonCompetitions = sortedCompetitions.filter((c) =>
    isDateWithinSeason(c.competitionDate, currentBounds)
  );
  const latestCompetition = sortedCompetitions[0] || null;
  const referenceDate = latestCompetition ? new Date(latestCompetition.competitionDate) : null;
  const fallbackBounds =
    referenceDate && !Number.isNaN(referenceDate.getTime())
      ? getCurrentSeasonBounds(referenceDate)
      : currentBounds;
  const bounds = currentSeasonCompetitions.length ? currentBounds : fallbackBounds;
  const seasonCompetitions = currentSeasonCompetitions.length
    ? currentSeasonCompetitions
    : sortedCompetitions.filter((c) => isDateWithinSeason(c.competitionDate, bounds));
  const lastCompetition = seasonCompetitions[0] || null;
  const seasonCompetitionIds = new Set(seasonCompetitions.map((c) => String(c.competitionId)));
  const seasonCombats = combats.filter((c) => seasonCompetitionIds.has(String(c.competitionId)));
  const seasonWins = seasonCombats.filter((c) => isVictoryCombatResult(c.result)).length;
  const seasonLosses = seasonCombats.filter((c) => isLossCombatResult(c.result)).length;
  const seasonDraws = seasonCombats.length - seasonWins - seasonLosses;
  const victoryRate = seasonCombats.length
    ? Math.round((seasonWins / seasonCombats.length) * 100)
    : 0;

  const competitionResults: SeasonCompetitionResult[] = seasonCompetitions.map((c) => ({
    competitionId: c.competitionId,
    name: c.name,
    competitionDate: c.competitionDate,
    result: c.result || "",
    category: getCompetitionCategoryLabel(c),
    weightCategory: c.weightCategory || "",
    resultBadge: getCompetitionResultBadge(c.result),
    combatRecord: getCompetitionCombatRecord(seasonCombats, c.competitionId)
  }));

  const lastCompetitionSummary: JudokaProfileLastCompetition | null = lastCompetition
    ? {
        competitionId: lastCompetition.competitionId,
        name: lastCompetition.name,
        competitionDate: lastCompetition.competitionDate,
        category: getCompetitionCategoryLabel(lastCompetition),
        weightCategory: lastCompetition.weightCategory || ""
      }
    : null;

  return {
    judoka,
    season: bounds,
    lastCompetition: lastCompetitionSummary,
    victoriesByDecisionType: computeDecisionBreakdown(seasonCombats, "Victoire"),
    defeatsByDecisionType: computeDecisionBreakdown(seasonCombats, "Défaite"),
    topWinTechniques: computeTopWinTechniques(seasonCombats),
    competitionResults,
    seasonCombatCount: seasonCombats.length,
    seasonCompetitionCount: seasonCompetitions.length,
    seasonWins,
    seasonLosses,
    seasonDraws,
    victoryRate
  };
}

function getCompetitionCombatRecord(
  combats: Combat[],
  competitionId: unknown
): CompetitionCombatRecord {
  const competitionCombats = combats.filter(
    (c) => String(c.competitionId) === String(competitionId)
  );
  const wins = competitionCombats.filter((c) => isVictoryCombatResult(c.result)).length;
  const losses = competitionCombats.filter((c) => isLossCombatResult(c.result)).length;
  const draws = competitionCombats.length - wins - losses;
  return {
    total: competitionCombats.length,
    wins,
    losses,
    draws,
    label: `${wins}V · ${losses}D${draws ? ` · ${draws}N` : ""}`
  };
}

const RANKED_FINALIST_BADGE: CompetitionResultBadge = { label: "classé", className: "rank-top5" };

function getCompetitionResultBadge(result: unknown): CompetitionResultBadge {
  const normalized = String(result || "").trim();
  if (normalized === "1er") return { label: "podium", className: "rank-gold" };
  if (normalized === "2e") return { label: "podium", className: "rank-silver" };
  if (normalized === "3e") return { label: "podium", className: "rank-bronze" };
  if (["4e", "5e", "6e", "7e", "8e"].includes(normalized)) return RANKED_FINALIST_BADGE;
  return { label: "non classé", className: "rank-unclassified" };
}
