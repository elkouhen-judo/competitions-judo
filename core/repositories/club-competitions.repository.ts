import type { ClubCompetitionModel } from "../domain/competitions/club-competition";
import { inFilter, uniqueIds } from "../shared/query";
import type { ClubCompetitionRow, SupabaseRestDeps } from "./types";

export interface ClubCompetitionsRepository {
  getById(idClubCompetition: string): Promise<ClubCompetitionRow | null>;
  insert(event: ClubCompetitionModel): Promise<ClubCompetitionRow | null>;
  listByClubIds(clubIds: string[], dateFrom?: string, dateTo?: string): Promise<ClubCompetitionRow[]>;
  countByClub(idClub: string): Promise<number>;
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
    niveau: event.level || "",
    // N'écrit le club que s'il est connu : une mise à jour sans club ne doit jamais le détacher.
    ...(event.clubId ? { club_id: event.clubId } : {})
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
    supabaseSelectPage,
    eqFilter
  } = deps;

  async function listByClubIds(
    clubIds: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<ClubCompetitionRow[]> {
    const ids = uniqueIds(clubIds);
    if (!ids.length) {
      return [];
    }
    const filters = ["select=*", inFilter("club_id", ids)];
    if (dateFrom) {
      filters.push(`date=gte.${encodeURIComponent(dateFrom)}`);
    }
    if (dateTo) {
      filters.push(`date=lte.${encodeURIComponent(dateTo)}`);
    }
    return supabaseSelect<ClubCompetitionRow>(
      "club_competitions",
      [...filters, "order=date.desc,id_club_competition.asc"].join("&")
    );
  }

  async function countByClub(idClub: string): Promise<number> {
    const { total } = await supabaseSelectPage<Pick<ClubCompetitionRow, "id_club_competition">>(
      "club_competitions",
      `select=id_club_competition&${eqFilter("club_id", idClub)}`,
      1
    );
    return total;
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
    listByClubIds,
    countByClub,
    remove,
    update
  };
}
