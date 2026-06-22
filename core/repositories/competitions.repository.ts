import type { CompetitionModel } from "../domain/competitions/competition";
import type { CompetitionRow, SupabaseRestDeps } from "./types";

interface CompetitionFinalization {
  competitionId: string | null;
  ownerJudokaId: string;
  result: string;
}

export interface CompetitionsRepository {
  detachFromClubCompetition(idCompetition: string): Promise<CompetitionRow | null>;
  existsForJudoka(
    idJudoka: string,
    name?: string,
    competitionDate?: string,
    excludedCompetitionId?: string
  ): Promise<CompetitionRow | null>;
  getById(idCompetition: string): Promise<CompetitionRow | null>;
  insert(competition: CompetitionModel, idCompetition: string): Promise<CompetitionRow | null>;
  listAll(): Promise<CompetitionRow[]>;
  listByClubCompetition(idClubCompetition: string): Promise<CompetitionRow[]>;
  listByJudoka(idJudoka: string): Promise<CompetitionRow[]>;
  listByJudokaIds(ids: string[]): Promise<CompetitionRow[]>;
  remove(idCompetition: string): Promise<void>;
  removeByJudoka(idJudoka: string): Promise<void>;
  update(idCompetition: string, competition: CompetitionModel): Promise<CompetitionRow | null>;
  updateCoachObjective(idCompetition: string, objective: string): Promise<CompetitionRow | null>;
  updateCoachReview(idCompetition: string, review: string): Promise<CompetitionRow | null>;
  updateResult(
    idCompetition: string,
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
      niveau: draft.level || "",
      classement: competition.result || ""
    };
  }

  function toNewCompetitionRecord(
    competition: CompetitionModel,
    idCompetition: string
  ): Record<string, unknown> {
    return {
      id_competition: idCompetition,
      ...toCompetitionRecord(competition)
    };
  }

  async function listAll(): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>("competitions", "select=*&order=date.desc");
  }

  async function listByJudoka(idJudoka: string): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("id_judoka", idJudoka)}&order=date.desc`
    );
  }

  async function listByJudokaIds(ids: string[]): Promise<CompetitionRow[]> {
    if (!ids || !ids.length) {
      return [];
    }
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&id_judoka=in.(${ids.join(",")})&order=date.desc`
    );
  }

  async function listByClubCompetition(idClubCompetition: string): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("club_competition_id", idClubCompetition)}&order=nom.asc`
    );
  }

  async function getById(idCompetition: string): Promise<CompetitionRow | null> {
    return supabaseSelectOne<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("id_competition", idCompetition)}`
    );
  }

  async function existsForJudoka(
    idJudoka: string,
    name?: string,
    competitionDate?: string,
    excludedCompetitionId?: string
  ): Promise<CompetitionRow | null> {
    const filters = [`select=id_competition,club_competition_id`, eqFilter("id_judoka", idJudoka)];
    if (name) {
      filters.push(eqFilter("nom", name));
    }
    if (competitionDate) {
      filters.push(eqFilter("date", competitionDate));
    }
    if (excludedCompetitionId) {
      filters.push(`id_competition=neq.${encodeURIComponent(excludedCompetitionId)}`);
    }
    return supabaseSelectOne<CompetitionRow>(
      "competitions",
      filters.join("&")
    );
  }

  async function insert(
    competition: CompetitionModel,
    idCompetition: string
  ): Promise<CompetitionRow | null> {
    return supabaseInsert<CompetitionRow>(
      "competitions",
      toNewCompetitionRecord(competition, idCompetition)
    );
  }

  async function update(
    idCompetition: string,
    competition: CompetitionModel
  ): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      toCompetitionRecord(competition)
    );
  }

  async function updateResult(
    idCompetition: string,
    finalization: CompetitionFinalization
  ): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { classement: finalization.result || "" }
    );
  }

  async function updateCoachObjective(idCompetition: string, objective: string): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { coach_objective: objective }
    );
  }

  async function updateCoachReview(idCompetition: string, review: string): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { coach_review: review }
    );
  }

  async function detachFromClubCompetition(idCompetition: string): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { club_competition_id: null }
    );
  }

  async function remove(idCompetition: string): Promise<void> {
    return supabaseDelete("competitions", eqFilter("id_competition", idCompetition));
  }

  async function removeByJudoka(idJudoka: string): Promise<void> {
    return supabaseDelete("competitions", eqFilter("id_judoka", idJudoka));
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
    removeByJudoka,
    update,
    updateCoachObjective,
    updateCoachReview,
    updateResult
  };
}
