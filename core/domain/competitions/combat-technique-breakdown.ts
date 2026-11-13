import { isLossCombatResult, isVictoryCombatResult } from "./combat-result";
import type { Combat, CombatScore, TechniqueBreakdownEntry } from "../../types";

const DEFAULT_TOP_TECHNIQUES_LIMIT = 3;

function getCombatScoreTechniqueLabel(score: Pick<CombatScore, "category" | "technique" | "neWazaType">): string {
  return score.category === "Tachi-waza" ? String(score.technique || "") : String(score.neWazaType || "");
}

function rankTechniques(
  scores: Array<Pick<CombatScore, "category" | "technique" | "neWazaType">>,
  limit: number
): TechniqueBreakdownEntry[] {
  const counts = new Map<string, number>();
  scores.forEach((score) => {
    const technique = getCombatScoreTechniqueLabel(score);
    if (technique) {
      counts.set(technique, (counts.get(technique) || 0) + 1);
    }
  });

  return Array.from(counts.entries())
    .map(([technique, count]) => ({ technique, count }))
    .sort((a, b) => b.count - a.count || a.technique.localeCompare(b.technique, "fr"))
    .slice(0, limit);
}

/**
 * Ranks the techniques most frequently scored in won combats, so a coach can
 * see at a glance what a judoka (or the whole club) relies on to win.
 */
export function computeTopWinTechniques(
  combats: Array<Pick<Combat, "result" | "scores">>,
  limit: number = DEFAULT_TOP_TECHNIQUES_LIMIT
): TechniqueBreakdownEntry[] {
  return rankTechniques(
    combats.filter((combat) => isVictoryCombatResult(combat.result)).flatMap((combat) => combat.scores || []),
    limit
  );
}

/** STAT-4 : techniques des points marqués par les adversaires dans les combats perdus. */
export function computeTopDefeatTechniques(
  combats: Array<Pick<Combat, "result" | "concededScores">>,
  limit: number = DEFAULT_TOP_TECHNIQUES_LIMIT
): TechniqueBreakdownEntry[] {
  return rankTechniques(
    combats.filter((combat) => isLossCombatResult(combat.result)).flatMap((combat) => combat.concededScores || []),
    limit
  );
}

/** STAT-29 : nombre de techniques différentes marquées dans les combats gagnés. */
export function countDistinctWinTechniques(combats: Array<Pick<Combat, "result" | "scores">>): number {
  const techniques = new Set<string>();
  combats
    .filter((combat) => isVictoryCombatResult(combat.result))
    .flatMap((combat) => combat.scores || [])
    .forEach((score) => {
      const technique = getCombatScoreTechniqueLabel(score);
      if (technique) techniques.add(technique);
    });
  return techniques.size;
}
