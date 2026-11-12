import type { CombatScoreDraft } from "../domain/competitions/combat-score";
import type { CombatScoreRow, SupabaseRestDeps } from "./types";

export interface CombatScoresRepository {
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

/** Sépare les points lus avec un combat : marqués d'un côté, subis de l'autre. */
export function splitCombatScores<T extends { combat_scores?: CombatScoreRow[] | "" }>(
  combat: T
): Omit<T, "combat_scores"> & { scores: CombatScoreRow[]; concededScores: CombatScoreRow[] } {
  const { combat_scores: rows, ...rest } = combat;
  const scoreRows = Array.isArray(rows) ? rows : [];
  return {
    ...rest,
    scores: scoreRows.filter((row) => !isConcededScoreRow(row)),
    concededScores: scoreRows.filter(isConcededScoreRow)
  };
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
  const { supabaseDelete, supabaseInsertMany, eqFilter } = deps;

  // ECRIT-1 : les points d'un combat partent en un seul envoi (suppression, puis insertion).
  async function replaceForCombat(
    idCombat: string,
    scores: CombatScoreDraft[],
    concededScores: CombatScoreDraft[] = []
  ): Promise<CombatScoreRow[]> {
    await supabaseDelete("combat_scores", eqFilter("id_combat", idCombat));

    const toRecords = (list: CombatScoreDraft[], conceded: boolean) =>
      list.flatMap((score, index) =>
        score ? [toCombatScoreRecord(idCombat, score, index, conceded)] : []
      );
    return supabaseInsertMany<CombatScoreRow>("combat_scores", [
      ...toRecords(scores, false),
      ...toRecords(concededScores, true)
    ]);
  }

  return {
    replaceForCombat
  };
}
