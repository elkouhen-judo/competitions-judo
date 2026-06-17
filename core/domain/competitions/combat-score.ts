import { createCombatScoreCategory, type CombatScoreCategory } from "./combat-score-category";
import { createTachiWazaTechnique, type TachiWazaTechnique } from "./tachi-waza-technique";
import { createNeWazaType, type NeWazaType } from "./ne-waza-type";
import { createCombatScoreValue, type CombatScoreValue } from "./combat-score-value";

export interface CombatScoreInput {
  category?: unknown;
  technique?: unknown;
  neWazaType?: unknown;
  value?: unknown;
}

export interface CombatScoreDraft {
  category: CombatScoreCategory;
  technique: TachiWazaTechnique | "";
  neWazaType: NeWazaType | "";
  value: CombatScoreValue;
}

export function createCombatScore(score: CombatScoreInput = {}): CombatScoreDraft {
  const category = createCombatScoreCategory(score.category);
  const value = createCombatScoreValue(score.value);

  if (category === "Tachi-waza") {
    const technique = createTachiWazaTechnique(score.technique);
    if (!technique) {
      throw new Error("Nom de la prise obligatoire pour une prise Tachi-waza.");
    }
    return { category, technique, neWazaType: "", value };
  }

  const neWazaType = createNeWazaType(score.neWazaType);
  if (!neWazaType) {
    throw new Error("Type de prise obligatoire pour une prise Ne-waza.");
  }
  return { category, technique: "", neWazaType, value };
}

export function createCombatScores(scores: unknown): CombatScoreDraft[] {
  if (!Array.isArray(scores)) {
    return [];
  }
  return scores.map((score) => createCombatScore((score || {}) as CombatScoreInput));
}
