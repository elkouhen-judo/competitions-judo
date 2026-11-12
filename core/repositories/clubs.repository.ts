import { inFilter, uniqueIds } from "../shared/query";
import type { ClubRow, CoachClubRow, SupabaseRestDeps } from "./types";

export interface ClubsRepository {
  listAll(): Promise<ClubRow[]>;
  listByIds(clubIds: string[]): Promise<ClubRow[]>;
  getById(idClub: string): Promise<ClubRow | null>;
  insert(club: ClubRow): Promise<ClubRow | null>;
  rename(idClub: string, nom: string): Promise<ClubRow | null>;
  remove(idClub: string): Promise<void>;
  listCoachLinks(): Promise<CoachClubRow[]>;
  listClubIdsByCoach(idCoach: string): Promise<string[]>;
  replaceCoachClubs(idCoach: string, clubIds: string[]): Promise<void>;
}

export default function createClubsRepository(deps: SupabaseRestDeps): ClubsRepository {
  const { supabaseDelete, supabaseInsert, supabasePatch, supabaseSelect, supabaseSelectOne, eqFilter } = deps;

  async function listAll(): Promise<ClubRow[]> {
    return supabaseSelect<ClubRow>("clubs", "select=id_club,nom&order=nom.asc,id_club.asc");
  }

  // INIT-1 : les clubs d'un coach sont filtrés par la requête.
  async function listByIds(clubIds: string[]): Promise<ClubRow[]> {
    const ids = uniqueIds(clubIds);
    if (!ids.length) {
      return [];
    }
    return supabaseSelect<ClubRow>("clubs", `select=id_club,nom&${inFilter("id_club", ids)}&order=nom.asc,id_club.asc`);
  }

  async function getById(idClub: string): Promise<ClubRow | null> {
    return supabaseSelectOne<ClubRow>("clubs", `select=id_club,nom&${eqFilter("id_club", idClub)}`);
  }

  async function insert(club: ClubRow): Promise<ClubRow | null> {
    return supabaseInsert<ClubRow>("clubs", { id_club: club.id_club, nom: club.nom });
  }

  async function rename(idClub: string, nom: string): Promise<ClubRow | null> {
    return supabasePatch<ClubRow>("clubs", eqFilter("id_club", idClub), { nom });
  }

  async function remove(idClub: string): Promise<void> {
    await supabaseDelete("clubs", eqFilter("id_club", idClub));
  }

  async function listCoachLinks(): Promise<CoachClubRow[]> {
    return supabaseSelect<CoachClubRow>("coach_clubs", "select=id_coach,id_club&order=id_coach.asc,id_club.asc");
  }

  async function listClubIdsByCoach(idCoach: string): Promise<string[]> {
    const rows = await supabaseSelect<CoachClubRow>(
      "coach_clubs",
      `select=id_club&${eqFilter("id_coach", idCoach)}&order=id_club.asc`
    );
    return rows.map((row) => String(row.id_club));
  }

  async function replaceCoachClubs(idCoach: string, clubIds: string[]): Promise<void> {
    await supabaseDelete("coach_clubs", eqFilter("id_coach", idCoach));
    for (const idClub of [...new Set(clubIds.map(String))]) {
      await supabaseInsert<CoachClubRow>("coach_clubs", { id_coach: idCoach, id_club: idClub });
    }
  }

  return {
    listAll,
    listByIds,
    getById,
    insert,
    rename,
    remove,
    listCoachLinks,
    listClubIdsByCoach,
    replaceCoachClubs
  };
}
