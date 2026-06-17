import { createCombatResult, type CombatResult } from "./combat-result";
import { createCombatDecisionType, type CombatDecisionType } from "./combat-decision-type";
import { createOpponentStance, type OpponentStance } from "./opponent-stance";
import {
  createCombatTechniqueCategory,
  type CombatTechniqueCategory
} from "./combat-technique-category";
import { createCombatId, createCompetitionId, createJudokaId } from "../shared/identity";

export interface CombatInput {
  competitionId?: unknown;
  judokaId?: unknown;
  combatId?: unknown;
  opponent?: unknown;
  opponentStance?: unknown;
  result?: unknown;
  victoryType?: unknown;
  techniqueCategory?: unknown;
  notes?: unknown;
}

export interface CombatDraft {
  opponent: string;
  opponentStance: OpponentStance;
  result: CombatResult;
  victoryType: CombatDecisionType;
  techniqueCategory: CombatTechniqueCategory;
  notes: string;
}

export interface CombatModel {
  combatId: string | null;
  competitionId: string;
  judokaId: string;
  draft: CombatDraft;
  opponent: string;
  opponentStance: OpponentStance;
  result: CombatResult;
  victoryType: CombatDecisionType;
  techniqueCategory: CombatTechniqueCategory;
  notes: string;
}

export function createCombatDraft(combat: CombatInput = {}): CombatDraft {
  const result = createCombatResult(combat.result);
  const victoryTypeValue =
    result === "Egalité" ? combat.victoryType || "Hiki wake" : combat.victoryType;

  return {
    opponent: String(combat.opponent || ""),
    opponentStance: createOpponentStance(combat.opponentStance),
    result,
    victoryType: createCombatDecisionType(victoryTypeValue, result),
    techniqueCategory: createCombatTechniqueCategory(combat.techniqueCategory),
    notes: String(combat.notes || "")
  };
}

export function createCombat(combat: CombatInput): CombatModel {
  const competitionId = createCompetitionId(combat && combat.competitionId);
  const judokaId = createJudokaId(combat && combat.judokaId);
  const combatId = combat && combat.combatId ? createCombatId(combat.combatId) : null;
  const draft = createCombatDraft(combat);

  return {
    combatId,
    competitionId,
    judokaId,
    draft,
    opponent: draft.opponent,
    opponentStance: draft.opponentStance,
    result: draft.result,
    victoryType: draft.victoryType,
    techniqueCategory: draft.techniqueCategory,
    notes: draft.notes
  };
}

export function updateCombat(combat: CombatInput): CombatModel {
  if (!combat || !combat.combatId) {
    throw new Error("Combat obligatoire.");
  }

  return createCombat(combat);
}
