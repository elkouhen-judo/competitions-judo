import type { CompetitionModel } from "../domain/competitions/competition";
import type { CompetitionRow, SupabaseRestDeps } from "./types";

interface CompetitionFinalization {
  competitionId: string | null;
  ownerJudokaId: string;
  result: string;
}

export interface CompetitionsRepository {
  detachFromClubCompetition(idCompetition: unknown): Promise<CompetitionRow | null>;
  existsForJudoka(idJudoka: unknown): Promise<CompetitionRow | null>;
  getById(idCompetition: unknown): Promise<CompetitionRow | null>;
  insert(competition: CompetitionModel, idCompetition: unknown): Promise<CompetitionRow | null>;
  listAll(): Promise<CompetitionRow[]>;
  listByClubCompetition(idClubCompetition: unknown): Promise<CompetitionRow[]>;
  listByJudoka(idJudoka: unknown): Promise<CompetitionRow[]>;
  listByJudokaIds(ids: unknown[]): Promise<CompetitionRow[]>;
  remove(idCompetition: unknown): Promise<void>;
  update(idCompetition: unknown, competition: CompetitionModel): Promise<CompetitionRow | null>;
  updateResult(
    idCompetition: unknown,
    finalization: CompetitionFinalization
  ): Promise<CompetitionRow | null>;
}

export default function createCompetitionsRepository(
  deps: SupabaseRestDeps
): CompetitionsRepository {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  function toCompetitionRecord(competition: CompetitionModel): Record<string, unknown> {
    const draft = competition && competition.draft;
    if (!draft) {
      throw new Error("Competition domain draft required.");
    }
    return {
      id_judoka: competition.ownerJudokaId,
      club_competition_id: competition.clubCompetitionId || null,
      nom: draft.name,
      date: draft.competitionDate,
      categorie_age: draft.ageCategory,
      categorie_poids: draft.weightCategory,
      classement: competition.result || ""
    };
  }

  function toNewCompetitionRecord(
    competition: CompetitionModel,
    idCompetition: unknown
  ): Record<string, unknown> {
    return {
      id_competition: idCompetition,
      ...toCompetitionRecord(competition)
    };
  }

  async function listAll(): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>("competitions", "select=*&order=date.desc");
  }

  async function listByJudoka(idJudoka: unknown): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("id_judoka", idJudoka)}&order=date.desc`
    );
  }

  async function listByJudokaIds(ids: unknown[]): Promise<CompetitionRow[]> {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&id_judoka=in.(${ids.join(",")})&order=date.desc`
    );
  }

  async function listByClubCompetition(idClubCompetition: unknown): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("club_competition_id", idClubCompetition)}&order=nom.asc`
    );
  }

  async function getById(idCompetition: unknown): Promise<CompetitionRow | null> {
    return supabaseSelectOne<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("id_competition", idCompetition)}`
    );
  }

  async function existsForJudoka(idJudoka: unknown): Promise<CompetitionRow | null> {
    return supabaseSelectOne<CompetitionRow>(
      "competitions",
      `select=id_competition&${eqFilter("id_judoka", idJudoka)}`
    );
  }

  async function insert(
    competition: CompetitionModel,
    idCompetition: unknown
  ): Promise<CompetitionRow | null> {
    return supabaseInsert<CompetitionRow>(
      "competitions",
      toNewCompetitionRecord(competition, idCompetition)
    );
  }

  async function update(
    idCompetition: unknown,
    competition: CompetitionModel
  ): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      toCompetitionRecord(competition)
    );
  }

  async function updateResult(
    idCompetition: unknown,
    finalization: CompetitionFinalization
  ): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { classement: finalization.result || "" }
    );
  }

  async function detachFromClubCompetition(idCompetition: unknown): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { club_competition_id: null }
    );
  }

  async function remove(idCompetition: unknown): Promise<void> {
    return supabaseDelete("competitions", eqFilter("id_competition", idCompetition));
  }

  return {
    detachFromClubCompetition,
    existsForJudoka,
    getById,
    insert,
    listAll,
    listByClubCompetition,
    listByJudoka,
    listByJudokaIds,
    remove,
    update,
    updateResult
  };
}
