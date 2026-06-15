import type { ClubCompetitionModel } from "../domain/competitions/club-competition";
import type { ClubCompetitionRow, SupabaseRestDeps } from "./types";

export interface ClubCompetitionsRepository {
  getById(idClubCompetition: string): Promise<ClubCompetitionRow | null>;
  insert(event: ClubCompetitionModel): Promise<ClubCompetitionRow | null>;
  listAll(): Promise<ClubCompetitionRow[]>;
  remove(idClubCompetition: string): Promise<void>;
  update(
    idClubCompetition: string,
    event: ClubCompetitionModel
  ): Promise<ClubCompetitionRow | null>;
}

function toClubCompetitionRecord(event: ClubCompetitionModel): Record<string, unknown> {
  return {
    id_club_competition: event.clubCompetitionId,
    nom: event.name,
    date: event.competitionDate,
    categorie_age: event.ageCategory || "",
    categorie_poids: event.weightCategory || ""
  };
}

export default function createClubCompetitionsRepository(
  deps: SupabaseRestDeps
): ClubCompetitionsRepository {
  const {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  async function listAll(): Promise<ClubCompetitionRow[]> {
    return supabaseSelect<ClubCompetitionRow>("club_competitions", "select=*&order=date.desc");
  }

  async function getById(idClubCompetition: string): Promise<ClubCompetitionRow | null> {
    return supabaseSelectOne<ClubCompetitionRow>(
      "club_competitions",
      `select=*&${eqFilter("id_club_competition", idClubCompetition)}`
    );
  }

  async function insert(event: ClubCompetitionModel): Promise<ClubCompetitionRow | null> {
    return supabaseInsert<ClubCompetitionRow>("club_competitions", toClubCompetitionRecord(event));
  }

  async function update(
    idClubCompetition: string,
    event: ClubCompetitionModel
  ): Promise<ClubCompetitionRow | null> {
    const record = toClubCompetitionRecord({
      ...event,
      clubCompetitionId: String(idClubCompetition || "")
    });
    delete record.id_club_competition;

    return supabasePatch<ClubCompetitionRow>(
      "club_competitions",
      eqFilter("id_club_competition", idClubCompetition),
      record
    );
  }

  async function remove(idClubCompetition: string): Promise<void> {
    return supabaseDelete(
      "club_competitions",
      eqFilter("id_club_competition", idClubCompetition)
    );
  }

  return {
    getById,
    insert,
    listAll,
    remove,
    update
  };
}
