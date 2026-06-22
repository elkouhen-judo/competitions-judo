import { isVictoryCombatResult, isLossCombatResult } from "./competitions/combat-result";
import { computeTopWinTechniques } from "./competitions/combat-technique-breakdown";
import { computeDecisionBreakdown, computeRate } from "./competitions/combat-decision-breakdown";
import { OPPONENT_STANCES } from "./competitions/opponent-stance";
import { GENDERS, HANDEDNESSES, COMPETITION_LEVELS } from "./category-reference";
import { formatCompetitionRankingDisplay } from "./competition-results";
import type {
  Combat,
  Competition,
  CoachDashboardGenderBreakdownEntry,
  CoachDashboardHandednessBreakdownEntry,
  CoachDashboardLateralMatchupBreakdownEntry,
  CoachDashboardLevelPodiumBreakdownEntry,
  CoachDashboardQualityIssueEntry,
  CoachDashboardStats
} from "../types";

export type CoachDashboardCombat = Combat & {
  competitionLevel?: string;
  judokaGender?: string;
  judokaHandedness?: string;
};

function computeJudokaCountByGender(
  combats: CoachDashboardCombat[]
): CoachDashboardGenderBreakdownEntry[] {
  return GENDERS.map((gender) => {
    const judokaIds = new Set(
      combats.filter((combat) => combat.judokaGender === gender).map((combat) => combat.judokaId)
    );
    return { gender, judokaCount: judokaIds.size };
  });
}

function computeJudokaCountByHandedness(
  combats: CoachDashboardCombat[]
): CoachDashboardHandednessBreakdownEntry[] {
  return HANDEDNESSES.map((handedness) => {
    const judokaIds = new Set(
      combats
        .filter((combat) => combat.judokaHandedness === handedness)
        .map((combat) => combat.judokaId)
    );
    return { handedness, judokaCount: judokaIds.size };
  });
}

function computeLateralMatchupBreakdown(
  combats: CoachDashboardCombat[]
): CoachDashboardLateralMatchupBreakdownEntry[] {
  const knownHandednesses = HANDEDNESSES as readonly string[];
  const knownOpponentStances = OPPONENT_STANCES as readonly string[];
  const decidedCombats = combats.filter(
    (combat) =>
      (isVictoryCombatResult(combat.result) || isLossCombatResult(combat.result)) &&
      knownHandednesses.includes(combat.judokaHandedness || "") &&
      knownOpponentStances.includes(combat.opponentStance || "")
  );

  return [
    { matchup: "opposite" as const, label: "Garde opposée" },
    { matchup: "same" as const, label: "Même Garde" }
  ].map((entry) => {
    const matchupCombats = decidedCombats.filter((combat) =>
      entry.matchup === "opposite"
        ? combat.judokaHandedness !== combat.opponentStance
        : combat.judokaHandedness === combat.opponentStance
    );
    const victories = matchupCombats.filter((combat) =>
      isVictoryCombatResult(combat.result)
    ).length;
    return {
      ...entry,
      combats: matchupCombats.length,
      victories,
      victoryRate: computeRate(victories, matchupCombats.length)
    };
  });
}

function hasIpponScore(combat: CoachDashboardCombat, category: "Tachi-waza" | "Ne-waza"): boolean {
  return (combat.scores || []).some((score) => score.value === "Ippon" && score.category === category);
}

function hasAnyIpponScore(combat: CoachDashboardCombat): boolean {
  return hasIpponScore(combat, "Tachi-waza") || hasIpponScore(combat, "Ne-waza");
}

const DATA_QUALITY_CRITERIA: Array<{
  criterion: string;
  label: string;
  isMissing: (combat: CoachDashboardCombat) => boolean;
}> = [
  {
    criterion: "judokaHandedness",
    label: "Droitier/gaucher du judoka non renseigné",
    isMissing: (combat) => !combat.judokaHandedness
  },
  {
    criterion: "opponentStance",
    label: "Droitier/gaucher de l'adversaire non renseigné",
    isMissing: (combat) => !combat.opponentStance
  },
  {
    criterion: "victoryType",
    label: "Fin du combat non renseignée",
    isMissing: (combat) => !combat.victoryType
  },
  {
    criterion: "scores",
    label: "Points marqués non renseignés",
    isMissing: (combat) => !(combat.scores || []).length
  },
  {
    criterion: "competitionLevel",
    label: "Niveau de compétition non renseigné",
    isMissing: (combat) => !combat.competitionLevel
  },
  {
    criterion: "judokaGender",
    label: "Genre du judoka non renseigné",
    isMissing: (combat) => !combat.judokaGender
  },
  {
    criterion: "inconsistentIppon",
    label: "Ippon à vérifier",
    isMissing: (combat) =>
      isVictoryCombatResult(combat.result) &&
      combat.victoryType === "Ippon" &&
      !hasAnyIpponScore(combat)
  }
];

function computeDataQualityIssues(
  combats: CoachDashboardCombat[]
): CoachDashboardQualityIssueEntry[] {
  const total = combats.length;
  return DATA_QUALITY_CRITERIA.map(({ criterion, label, isMissing }) => {
    const count = combats.filter(isMissing).length;
    return { criterion, label, count, total, rate: computeRate(count, total) };
  });
}

const PODIUM_PLACES: Array<{ place: "1er" | "2e" | "3e"; label: string }> = [
  { place: "1er", label: formatCompetitionRankingDisplay("1er") },
  { place: "2e", label: formatCompetitionRankingDisplay("2e") },
  { place: "3e", label: formatCompetitionRankingDisplay("3e") }
];

function isFinalizedCompetitionResult(result: unknown): boolean {
  return Boolean(String(result || "").trim());
}

function computePodiumBreakdownByLevel(
  competitions: Pick<Competition, "result" | "level">[]
): CoachDashboardLevelPodiumBreakdownEntry[] {
  const finalizedCompetitions = competitions.filter((competition) =>
    isFinalizedCompetitionResult(competition.result)
  );
  return COMPETITION_LEVELS.map((level) => {
    const levelCompetitions = finalizedCompetitions.filter((competition) => competition.level === level);
    return {
      level,
      podiums: PODIUM_PLACES.map(({ place, label }) => ({
        place,
        label,
        count: levelCompetitions.filter((competition) => competition.result === place).length
      }))
    };
  });
}

function computeAnalyzedCompetitionCount(
  competitions: Array<Pick<Competition, "result" | "level"> & Partial<Pick<Competition, "competitionId" | "clubCompetitionId">>>
): number {
  const competitionKeys = new Set<string>();
  competitions.forEach((competition, index) => {
    const clubCompetitionId = String(competition.clubCompetitionId || "").trim();
    const competitionId = String(competition.competitionId || "").trim();
    competitionKeys.add(clubCompetitionId || competitionId || `competition-${index}`);
  });
  return competitionKeys.size;
}

export function computeCoachDashboardStats(
  combats: CoachDashboardCombat[],
  competitions: Array<Pick<Competition, "result" | "level"> & Partial<Pick<Competition, "competitionId" | "clubCompetitionId">>> = []
): CoachDashboardStats {
  const totalCombats = combats.length;
  const victories = combats.filter((combat) => isVictoryCombatResult(combat.result)).length;
  const tachiWazaIpponVictories = combats.filter(
    (combat) => isVictoryCombatResult(combat.result) && hasIpponScore(combat, "Tachi-waza")
  ).length;
  const neWazaIpponVictories = combats.filter(
    (combat) => isVictoryCombatResult(combat.result) && hasIpponScore(combat, "Ne-waza")
  ).length;

  return {
    analyzedCompetitions: computeAnalyzedCompetitionCount(competitions),
    totalCombats,
    victories,
    victoryRate: computeRate(victories, totalCombats),
    tachiWazaIpponVictories,
    tachiWazaIpponVictoryRate: computeRate(tachiWazaIpponVictories, totalCombats),
    neWazaIpponVictories,
    neWazaIpponVictoryRate: computeRate(neWazaIpponVictories, totalCombats),
    victoriesByDecisionType: computeDecisionBreakdown(combats, "Victoire"),
    defeatsByDecisionType: computeDecisionBreakdown(combats, "Défaite"),
    byLateralMatchup: computeLateralMatchupBreakdown(combats),
    judokasByGender: computeJudokaCountByGender(combats),
    judokasByHandedness: computeJudokaCountByHandedness(combats),
    dataQualityIssues: computeDataQualityIssues(combats),
    podiumsByLevel: computePodiumBreakdownByLevel(competitions),
    topWinTechniques: computeTopWinTechniques(combats)
  };
}
