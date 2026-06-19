import { isVictoryCombatResult, isLossCombatResult } from "./competitions/combat-result";
import { getAllowedDecisionTypesForCombatResult } from "./competitions/combat-decision-type";
import { OPPONENT_STANCES } from "./competitions/opponent-stance";
import { GENDERS, HANDEDNESSES, COMPETITION_LEVELS } from "./category-reference";
import type {
  Combat,
  CoachDashboardDecisionBreakdownEntry,
  CoachDashboardGenderBreakdownEntry,
  CoachDashboardHandednessBreakdownEntry,
  CoachDashboardLateralMatchupBreakdownEntry,
  CoachDashboardLevelBreakdownEntry,
  CoachDashboardStats
} from "../types";

export type CoachDashboardCombat = Combat & {
  competitionLevel?: string;
  judokaGender?: string;
  judokaHandedness?: string;
};

function computeRate(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

function computeDecisionBreakdown(
  combats: CoachDashboardCombat[],
  result: "Victoire" | "Défaite"
): CoachDashboardDecisionBreakdownEntry[] {
  const relevantCombats = combats.filter((combat) => combat.result === result);
  const total = relevantCombats.length;

  return getAllowedDecisionTypesForCombatResult(result).map((decisionType) => {
    const count = relevantCombats.filter((combat) => combat.victoryType === decisionType).length;
    return { decisionType, count, total, rate: computeRate(count, total) };
  });
}

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
    { matchup: "same" as const, label: "Même garde" }
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

function computeLevelBreakdown(
  combats: CoachDashboardCombat[]
): CoachDashboardLevelBreakdownEntry[] {
  return COMPETITION_LEVELS.map((level) => {
    const levelCombats = combats.filter((combat) => combat.competitionLevel === level);
    const victories = levelCombats.filter((combat) => isVictoryCombatResult(combat.result)).length;
    return {
      level,
      combats: levelCombats.length,
      victories,
      victoryRate: computeRate(victories, levelCombats.length)
    };
  });
}

export function computeCoachDashboardStats(combats: CoachDashboardCombat[]): CoachDashboardStats {
  const totalCombats = combats.length;
  const victories = combats.filter((combat) => isVictoryCombatResult(combat.result)).length;
  const tachiWazaVictories = combats.filter(
    (combat) =>
      isVictoryCombatResult(combat.result) &&
      (combat.scores || []).some((score) => score.category === "Tachi-waza")
  ).length;
  const neWazaVictories = combats.filter(
    (combat) =>
      isVictoryCombatResult(combat.result) &&
      (combat.scores || []).some((score) => score.category === "Ne-waza")
  ).length;
  const hansokuMakeLosses = combats.filter(
    (combat) => isLossCombatResult(combat.result) && combat.victoryType === "Hansoku-make"
  ).length;

  return {
    totalCombats,
    victories,
    victoryRate: computeRate(victories, totalCombats),
    tachiWazaVictories,
    tachiWazaVictoryRate: computeRate(tachiWazaVictories, totalCombats),
    neWazaVictories,
    neWazaVictoryRate: computeRate(neWazaVictories, totalCombats),
    hansokuMakeLosses,
    hansokuMakeLossRate: computeRate(hansokuMakeLosses, totalCombats),
    victoriesByDecisionType: computeDecisionBreakdown(combats, "Victoire"),
    defeatsByDecisionType: computeDecisionBreakdown(combats, "Défaite"),
    byLateralMatchup: computeLateralMatchupBreakdown(combats),
    byCompetitionLevel: computeLevelBreakdown(combats),
    judokasByGender: computeJudokaCountByGender(combats),
    judokasByHandedness: computeJudokaCountByHandedness(combats)
  };
}
