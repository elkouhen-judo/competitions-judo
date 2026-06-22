import { normalizeCombatResult } from "./combat-result";
import { getAllowedDecisionTypesForCombatResult } from "./combat-decision-type";
import type { Combat, DecisionBreakdownEntry } from "../../types";

export function computeRate(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

/**
 * Breaks down how combats with a given result (Victoire/Défaite) ended,
 * across every allowed decision type for that result — shared by the coach
 * dashboard (club-wide) and the judoka profile (single judoka) so both
 * render the same count/total/rate shape.
 */
export function computeDecisionBreakdown(
  combats: Array<Pick<Combat, "result" | "victoryType">>,
  result: "Victoire" | "Défaite"
): DecisionBreakdownEntry[] {
  const relevantCombats = combats.filter((combat) => normalizeCombatResult(combat.result) === result);
  const total = relevantCombats.length;

  return getAllowedDecisionTypesForCombatResult(result).map((decisionType) => {
    const count = relevantCombats.filter((combat) => combat.victoryType === decisionType).length;
    return { decisionType, count, total, rate: computeRate(count, total) };
  });
}
