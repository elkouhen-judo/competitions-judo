import type { CombatScoreDraft } from "../domain/competitions/combat-score";
import type { CombatScoreRow, SupabaseRestDeps } from "./types";

const COMBAT_SCORE_SELECT_BATCH_SIZE = 100;

export interface CombatScoresRepository {
  listByCombatId(idCombat: string): Promise<CombatScoreRow[]>;
  listByCombatIds(ids: string[]): Promise<CombatScoreRow[]>;
  replaceForCombat(
    idCombat: string,
    scores: CombatScoreDraft[],
    concededScores?: CombatScoreDraft[]
  ): Promise<CombatScoreRow[]>;
}

export const CONCEDED_SCORE_CAMP = "ADVERSAIRE";

export function isConcededScoreRow(row: Pick<CombatScoreRow, "camp">): boolean {
  return String(row.camp || "").toUpperCase() === CONCEDED_SCORE_CAMP;
}

function toCombatScoreRecord(
  idCombat: string,
  score: CombatScoreDraft,
  index: number,
  conceded = false
): Record<string, unknown> {
  return {
    id_combat_score: `${idCombat}_${conceded ? "C" : "S"}${index}`,
    id_combat: idCombat,
    categorie: score.category,
    technique: score.technique || "",
    type_ne_waza: score.neWazaType || "",
    valeur: score.value,
    ordre: score.order ?? index,
    camp: conceded ? CONCEDED_SCORE_CAMP : "JUDOKA"
  };
}

export default function createCombatScoresRepository(
  deps: SupabaseRestDeps
): CombatScoresRepository {
  const { supabaseDelete, supabaseInsert, supabaseSelect, eqFilter } = deps;

  async function listByCombatId(idCombat: string): Promise<CombatScoreRow[]> {
    return supabaseSelect<CombatScoreRow>(
      "combat_scores",
      `select=*&${eqFilter("id_combat", idCombat)}&order=ordre.asc`
    );
  }

  async function listByCombatIds(ids: string[]): Promise<CombatScoreRow[]> {
    const uniqueIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
    if (!uniqueIds.length) {
      return [];
    }

    const rows: CombatScoreRow[] = [];
    for (let index = 0; index < uniqueIds.length; index += COMBAT_SCORE_SELECT_BATCH_SIZE) {
      const batchIds = uniqueIds.slice(index, index + COMBAT_SCORE_SELECT_BATCH_SIZE);
      rows.push(
        ...(await supabaseSelect<CombatScoreRow>(
          "combat_scores",
          `select=*&id_combat=in.(${batchIds.join(",")})&order=ordre.asc`
        ))
      );
    }
    return rows;
  }

  async function replaceForCombat(
    idCombat: string,
    scores: CombatScoreDraft[],
    concededScores: CombatScoreDraft[] = []
  ): Promise<CombatScoreRow[]> {
    await supabaseDelete("combat_scores", eqFilter("id_combat", idCombat));

    const inserted: CombatScoreRow[] = [];
    const insertAll = async (list: CombatScoreDraft[], conceded: boolean) => {
      for (let index = 0; index < list.length; index += 1) {
        const score = list[index];
        if (!score) {
          continue;
        }
        const row = await supabaseInsert<CombatScoreRow>(
          "combat_scores",
          toCombatScoreRecord(idCombat, score, index, conceded)
        );
        if (row) {
          inserted.push(row);
        }
      }
    };
    await insertAll(scores, false);
    await insertAll(concededScores, true);
    return inserted;
  }

  return {
    listByCombatId,
    listByCombatIds,
    replaceForCombat
  };
}
