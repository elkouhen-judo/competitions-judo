import type { CombatModel } from "../domain/competitions/combat";
import type { CombatRow, SupabaseRestDeps } from "./types";

const LEGACY_RESULTS_BY_CANONICAL_RESULT: Record<string, string> = {
  Victoire: "V",
  Défaite: "D",
  Egalité: "E"
};

export interface CombatsRepository {
  existsForJudoka(idJudoka: string): Promise<CombatRow | null>;
  getById(idCombat: string): Promise<CombatRow | null>;
  insert(combat: CombatModel, idCombat: string): Promise<CombatRow | null>;
  listByCompetition(idCompetition: string): Promise<CombatRow[]>;
  listByCompetitionAndJudoka(idCompetition: string, idJudoka: string): Promise<CombatRow[]>;
  listByCompetitionAndJudokaIds(idCompetition: string, ids: string[]): Promise<CombatRow[]>;
  listByJudoka(idJudoka: string): Promise<CombatRow[]>;
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

function toCombatRecord(combat: CombatModel): Record<string, unknown> {
  const { draft } = combat;
  if (!draft) {
    throw new Error("Combat domain draft required.");
  }

  return {
    id_judoka: combat.judokaId,
    id_competition: combat.competitionId,
    adversaire: draft.opponent,
    resultat: draft.result,
    type_victoire: draft.victoryType,
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
    return supabaseSelect<CombatRow>("combats", `select=*&${eqFilter("id_judoka", idJudoka)}`);
  }

  async function listByCompetition(idCompetition: string): Promise<CombatRow[]> {
    return supabaseSelect<CombatRow>(
      "combats",
      `select=*&${eqFilter("id_competition", idCompetition)}`
    );
  }

  async function listByCompetitionAndJudoka(
    idCompetition: string,
    idJudoka: string
  ): Promise<CombatRow[]> {
    return supabaseSelect<CombatRow>(
      "combats",
      `select=*&${eqFilter("id_competition", idCompetition)}&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function listByCompetitionAndJudokaIds(
    idCompetition: string,
    ids: string[]
  ): Promise<CombatRow[]> {
    if (!ids?.length) {
      return [];
    }

    return supabaseSelect<CombatRow>(
      "combats",
      `select=*&${eqFilter("id_competition", idCompetition)}&id_judoka=in.(${ids.join(",")})`
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
    listByCompetition,
    listByCompetitionAndJudoka,
    listByCompetitionAndJudokaIds,
    listByJudoka,
    remove,
    update
  };
}
