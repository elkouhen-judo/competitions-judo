import { createCombatScoreCategory, type CombatScoreCategory } from "./combat-score-category";
import { createTachiWazaTechnique, type TachiWazaTechnique } from "./tachi-waza-technique";
import { createNeWazaType, type NeWazaType } from "./ne-waza-type";
import { createCombatScoreValue, type CombatScoreValue } from "./combat-score-value";

export interface CombatScoreInput {
  category?: unknown;
  technique?: unknown;
  neWazaType?: unknown;
  value?: unknown;
  order?: unknown;
}

export interface CombatScoreDraft {
  /** "" : technique non précisée (debout ou au sol inconnu). */
  category: CombatScoreCategory | "";
  technique: TachiWazaTechnique | "";
  neWazaType: NeWazaType | "";
  value: CombatScoreValue;
  /** COMBAT-CHRONO : rang du point dans le combat, tous camps confondus. */
  order?: number;
}

function createScoreOrder(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const order = Number(value);
  return Number.isInteger(order) && order >= 0 ? order : undefined;
}

// COMBAT-TECH-OPT : seule la valeur est obligatoire ; la technique peut rester à préciser.
export function createCombatScore(score: CombatScoreInput = {}): CombatScoreDraft {
  const category = String(score.category || "").trim() ? createCombatScoreCategory(score.category) : "";
  const value = createCombatScoreValue(score.value);
  const order = createScoreOrder(score.order);
  const withOrder = (draft: CombatScoreDraft): CombatScoreDraft => (order === undefined ? draft : { ...draft, order });

  if (category === "Tachi-waza") {
    return withOrder({ category, technique: createTachiWazaTechnique(score.technique), neWazaType: "", value });
  }
  if (category === "Ne-waza") {
    return withOrder({ category, technique: "", neWazaType: createNeWazaType(score.neWazaType), value });
  }
  return withOrder({ category: "", technique: "", neWazaType: "", value });
}

export function createCombatScores(scores: unknown): CombatScoreDraft[] {
  if (!Array.isArray(scores)) {
    return [];
  }
  return scores.map((score) => createCombatScore((score || {}) as CombatScoreInput));
}
