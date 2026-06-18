import { isVictoryCombatResult, isLossCombatResult } from "./competitions/combat-result";
import { getAllowedDecisionTypesForCombatResult } from "./competitions/combat-decision-type";
import { OPPONENT_STANCES } from "./competitions/opponent-stance";
import { GENDERS, HANDEDNESSES, COMPETITION_LEVELS } from "./category-reference";
import type {
  Combat,
  CoachDashboardDecisionBreakdownEntry,
  CoachDashboardGenderBreakdownEntry,
  CoachDashboardHandednessBreakdownEntry,
  CoachDashboardLevelBreakdownEntry,
  CoachDashboardStanceBreakdownEntry,
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

function computeJudokaStatsByHandedness(
  combats: CoachDashboardCombat[]
): CoachDashboardHandednessBreakdownEntry[] {
  return HANDEDNESSES.map((handedness) => {
    const handednessCombats = combats.filter((combat) => combat.judokaHandedness === handedness);
    const judokaIds = new Set(handednessCombats.map((combat) => combat.judokaId));
    const victories = handednessCombats.filter((combat) => isVictoryCombatResult(combat.result)).length;
    return {
      handedness,
      judokaCount: judokaIds.size,
      combats: handednessCombats.length,
      victories,
      victoryRate: computeRate(victories, handednessCombats.length)
    };
  });
}

function computeStanceBreakdown(
  combats: CoachDashboardCombat[]
): CoachDashboardStanceBreakdownEntry[] {
  return OPPONENT_STANCES.map((opponentStance) => {
    const stanceCombats = combats.filter((combat) => combat.opponentStance === opponentStance);
    const victories = stanceCombats.filter((combat) =>
      isVictoryCombatResult(combat.result)
    ).length;
    return {
      opponentStance,
      combats: stanceCombats.length,
      victories,
      victoryRate: computeRate(victories, stanceCombats.length)
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
    byOpponentStance: computeStanceBreakdown(combats),
    byCompetitionLevel: computeLevelBreakdown(combats),
    judokasByGender: computeJudokaCountByGender(combats),
    judokasByHandedness: computeJudokaStatsByHandedness(combats)
  };
}
