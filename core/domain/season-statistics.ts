import { isLossCombatResult, isVictoryCombatResult } from "./competitions/combat-result";
import type {
  Combat,
  Competition,
  CombatProfile,
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
  const combatProfile = buildCombatProfile(seasonCombats);

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
    combatProfile,
    competitionResults,
    seasonCombatCount: seasonCombats.length,
    seasonCompetitionCount: seasonCompetitions.length,
    seasonWins,
    seasonLosses,
    seasonDraws,
    victoryRate
  };
}

function buildCombatProfile(combats: Combat[]): CombatProfile {
  const stats: CombatProfile = {
    victoryIppon: 0,
    victoryDecision: 0,
    lossIppon: 0,
    lossDecision: 0,
    lossPenalty: 0,
    lossForfeit: 0,
    draws: 0,
    penalties: 0,
    forfeits: 0
  };

  combats.forEach((combat) => {
    const decisionType = String(combat.victoryType || "");
    if (isVictoryCombatResult(combat.result)) {
      if (decisionType === "Ippon") stats.victoryIppon += 1;
      if (decisionType === "Décision") stats.victoryDecision += 1;
    } else if (isLossCombatResult(combat.result)) {
      if (decisionType === "Ippon") stats.lossIppon += 1;
      if (decisionType === "Décision") stats.lossDecision += 1;
      if (decisionType === "Hansoku-make") stats.lossPenalty += 1;
      if (decisionType === "Forfait") stats.lossForfeit += 1;
    } else {
      stats.draws += 1;
    }

    if (decisionType === "Hansoku-make") stats.penalties += 1;
    if (decisionType === "Forfait") stats.forfeits += 1;
  });

  return stats;
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
