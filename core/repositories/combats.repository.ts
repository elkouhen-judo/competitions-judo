import type { CombatModel } from "../domain/competitions/combat";
import type { CombatOfficialScore } from "../domain/competitions/combat-official-score";
import { inFilter, selectByIdBatches } from "../shared/query";
import type { CombatRow, CombatScoreRow, CombatWithScoresRow, SupabaseRestDeps } from "./types";

/** Ce qu'il faut d'un combat pour proposer adversaires et techniques déjà saisis. */
export type CombatSuggestionRow = Pick<CombatRow, "adversaire"> & {
  combat_scores: Pick<CombatScoreRow, "categorie" | "technique" | "type_ne_waza" | "camp">[];
};

const LEGACY_RESULTS_BY_CANONICAL_RESULT: Record<string, string> = {
  Victoire: "V",
  Défaite: "D",
  Egalité: "E"
};

// Tri stable : ordre de saisie, puis identifiant.
const COMBAT_ORDER = "order=created_at.asc,id_combat.asc";
// DETAIL-1 : les points d'un combat se lisent avec lui, dans l'ordre de saisie.
const COMBAT_WITH_SCORES = `select=*,combat_scores(*)&combat_scores.order=ordre.asc&${COMBAT_ORDER}`;

export interface CombatsRepository {
  existsForJudoka(idJudoka: string): Promise<CombatRow | null>;
  getById(idCombat: string): Promise<CombatRow | null>;
  insert(combat: CombatModel, idCombat: string): Promise<CombatRow | null>;
  listByCompetitionIds(ids: string[]): Promise<CombatRow[]>;
  listByCompetitionIdsWithScores(ids: string[]): Promise<CombatWithScoresRow[]>;
  listByCompetitionWithScores(idCompetition: string): Promise<CombatWithScoresRow[]>;
  listByJudoka(idJudoka: string): Promise<CombatRow[]>;
  listSuggestionsByJudoka(idJudoka: string): Promise<CombatSuggestionRow[]>;
  remove(idCombat: string): Promise<void>;
  update(idCombat: string, combat: CombatModel): Promise<CombatRow | null>;
}

function toLegacyCompatibleResult(value: unknown): string {
  return LEGACY_RESULTS_BY_CANONICAL_RESULT[String(value)] || String(value || "");
}

function toLegacyCompatibleCombatRecord(record: Record<string, unknown>): Record<string, unknown> {
  return {
    ...record,
    resultat: toLegacyCompatibleResult(record.resultat)
  };
}

function shouldRetryWithLegacyResult(error: unknown, record: Record<string, unknown>): boolean {
  const result = String(record.resultat || "");
  return Boolean(
    LEGACY_RESULTS_BY_CANONICAL_RESULT[result] &&
      /combats_resultat_check/.test(String((error as Error | null)?.message || error || ""))
  );
}

// COMBAT-SCORE : score IWY - IWY et shidos à plat sur 8 colonnes ; null partout = non renseigné.
// Score absent (undefined) : colonnes non envoyées, la valeur en base est conservée.
function toOfficialScoreColumns(score: CombatOfficialScore | null | undefined): Record<string, number | null> {
  if (score === undefined) {
    return {};
  }
  return {
    score_judoka_ippon: score ? score.judoka.ippon : null,
    score_judoka_wazaari: score ? score.judoka.wazaAri : null,
    score_judoka_yuko: score ? score.judoka.yuko : null,
    score_adversaire_ippon: score ? score.opponent.ippon : null,
    score_adversaire_wazaari: score ? score.opponent.wazaAri : null,
    score_adversaire_yuko: score ? score.opponent.yuko : null,
    score_judoka_shido: score ? score.judoka.shido ?? 0 : null,
    score_adversaire_shido: score ? score.opponent.shido ?? 0 : null
  };
}

function toCombatRecord(combat: CombatModel): Record<string, unknown> {
  const { draft } = combat;
  if (!draft) {
    throw new Error("Combat domain draft required.");
  }

  return {
    id_judoka: combat.judokaId,
    id_competition: combat.competitionId,
    adversaire: draft.opponent,
    garde_adversaire: draft.opponentStance,
    etape: draft.stage || "",
    resultat: draft.result,
    type_victoire: draft.victoryType,
    ...toOfficialScoreColumns(draft.officialScore),
    deroule: draft.notes
  };
}

function toNewCombatRecord(combat: CombatModel, idCombat: string): Record<string, unknown> {
  return {
    id_combat: idCombat,
    ...toCombatRecord(combat)
  };
}

export default function createCombatsRepository(deps: SupabaseRestDeps): CombatsRepository {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  async function listByJudoka(idJudoka: string): Promise<CombatRow[]> {
    return supabaseSelect<CombatRow>(
      "combats",
      `select=*&${eqFilter("id_judoka", idJudoka)}&${COMBAT_ORDER}`
    );
  }

  // DETAIL-2 : adversaires et techniques d'un judoka, sans le reste des combats.
  async function listSuggestionsByJudoka(idJudoka: string): Promise<CombatSuggestionRow[]> {
    return supabaseSelect<CombatSuggestionRow>(
      "combats",
      `select=adversaire,combat_scores(categorie,technique,type_ne_waza,camp)&${eqFilter("id_judoka", idJudoka)}&${COMBAT_ORDER}`
    );
  }

  async function listByCompetitionWithScores(idCompetition: string): Promise<CombatWithScoresRow[]> {
    return supabaseSelect<CombatWithScoresRow>(
      "combats",
      `${COMBAT_WITH_SCORES}&${eqFilter("id_competition", idCompetition)}`
    );
  }

  async function listByCompetitionIds(ids: string[]): Promise<CombatRow[]> {
    return selectByIdBatches(ids, (batchIds) =>
      supabaseSelect<CombatRow>(
        "combats",
        `select=*&${inFilter("id_competition", batchIds)}&${COMBAT_ORDER}`
      )
    );
  }

  // COACH-2 : les combats de plusieurs compétitions se lisent par lots, avec leurs points.
  async function listByCompetitionIdsWithScores(ids: string[]): Promise<CombatWithScoresRow[]> {
    return selectByIdBatches(ids, (batchIds) =>
      supabaseSelect<CombatWithScoresRow>(
        "combats",
        `${COMBAT_WITH_SCORES}&${inFilter("id_competition", batchIds)}`
      )
    );
  }

  async function getById(idCombat: string): Promise<CombatRow | null> {
    return supabaseSelectOne<CombatRow>("combats", `select=*&${eqFilter("id_combat", idCombat)}`);
  }

  async function existsForJudoka(idJudoka: string): Promise<CombatRow | null> {
    return supabaseSelectOne<CombatRow>("combats", `select=id_combat&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function insert(combat: CombatModel, idCombat: string): Promise<CombatRow | null> {
    const record = toNewCombatRecord(combat, idCombat);

    try {
      return await supabaseInsert<CombatRow>("combats", record);
    } catch (error) {
      if (!shouldRetryWithLegacyResult(error, record)) {
        throw error;
      }

      return supabaseInsert<CombatRow>("combats", toLegacyCompatibleCombatRecord(record));
    }
  }

  async function update(idCombat: string, combat: CombatModel): Promise<CombatRow | null> {
    const record = toCombatRecord(combat);

    try {
      return await supabasePatch<CombatRow>("combats", eqFilter("id_combat", idCombat), record);
    } catch (error) {
      if (!shouldRetryWithLegacyResult(error, record)) {
        throw error;
      }

      return supabasePatch<CombatRow>(
        "combats",
        eqFilter("id_combat", idCombat),
        toLegacyCompatibleCombatRecord(record)
      );
    }
  }

  async function remove(idCombat: string): Promise<void> {
    return supabaseDelete("combats", eqFilter("id_combat", idCombat));
  }

  return {
    existsForJudoka,
    getById,
    insert,
    listByCompetitionIds,
    listByCompetitionIdsWithScores,
    listByCompetitionWithScores,
    listByJudoka,
    listSuggestionsByJudoka,
    remove,
    update
  };
}
