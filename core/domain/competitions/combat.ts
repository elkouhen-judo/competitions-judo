import { createCombatResult, type CombatResult } from "./combat-result";
import { createCombatDecisionType, type CombatDecisionType } from "./combat-decision-type";
import { createCombatId, createCompetitionId, createJudokaId } from "../shared/identity";

export interface CombatInput {
  competitionId?: unknown;
  judokaId?: unknown;
  combatId?: unknown;
  opponent?: unknown;
  result?: unknown;
  victoryType?: unknown;
  notes?: unknown;
}

export interface CombatDraft {
  opponent: string;
  result: CombatResult;
  victoryType: CombatDecisionType;
  notes: string;
}

export interface CombatModel {
  combatId: string | null;
  competitionId: string;
  judokaId: string;
  draft: CombatDraft;
  opponent: string;
  result: CombatResult;
  victoryType: CombatDecisionType;
  notes: string;
}

export function createCombatDraft(combat: CombatInput = {}): CombatDraft {
  const result = createCombatResult(combat.result);
  const victoryTypeValue =
    result === "Egalité" ? combat.victoryType || "Hiki wake" : combat.victoryType;

  return {
    opponent: String(combat.opponent || ""),
    result,
    victoryType: createCombatDecisionType(victoryTypeValue, result),
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
    result: draft.result,
    victoryType: draft.victoryType,
    notes: draft.notes
  };
}

export function updateCombat(combat: CombatInput): CombatModel {
  if (!combat || !combat.combatId) {
    throw new Error("Combat obligatoire.");
  }

  return createCombat(combat);
}
