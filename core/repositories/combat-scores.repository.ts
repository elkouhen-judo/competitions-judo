import type { CombatScoreDraft } from "../domain/competitions/combat-score";
import type { CombatScoreRow, SupabaseRestDeps } from "./types";

export interface CombatScoresRepository {
  listByCombatId(idCombat: string): Promise<CombatScoreRow[]>;
  listByCombatIds(ids: string[]): Promise<CombatScoreRow[]>;
  replaceForCombat(idCombat: string, scores: CombatScoreDraft[]): Promise<CombatScoreRow[]>;
}

function toCombatScoreRecord(
  idCombat: string,
  score: CombatScoreDraft,
  index: number
): Record<string, unknown> {
  return {
    id_combat_score: `${idCombat}_S${index}`,
    id_combat: idCombat,
    categorie: score.category,
    technique: score.technique || "",
    type_ne_waza: score.neWazaType || "",
    valeur: score.value,
    ordre: index
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
    if (!ids.length) {
      return [];
    }

    return supabaseSelect<CombatScoreRow>(
      "combat_scores",
      `select=*&id_combat=in.(${ids.join(",")})&order=ordre.asc`
    );
  }

  async function replaceForCombat(
    idCombat: string,
    scores: CombatScoreDraft[]
  ): Promise<CombatScoreRow[]> {
    await supabaseDelete("combat_scores", eqFilter("id_combat", idCombat));

    const inserted: CombatScoreRow[] = [];
    for (let index = 0; index < scores.length; index += 1) {
      const score = scores[index];
      if (!score) {
        continue;
      }
      const row = await supabaseInsert<CombatScoreRow>(
        "combat_scores",
        toCombatScoreRecord(idCombat, score, index)
      );
      if (row) {
        inserted.push(row);
      }
    }
    return inserted;
  }

  return {
    listByCombatId,
    listByCombatIds,
    replaceForCombat
  };
}
