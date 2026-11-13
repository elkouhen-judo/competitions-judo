import type { CompetitionModel } from "../domain/competitions/competition";
import { inFilter, selectByIdBatches, uniqueIds } from "../shared/query";
import type { CompetitionRow, CompetitionWithResultsRow, SupabaseRestDeps } from "./types";

/** Périmètre et période d'une lecture de compétitions. Un périmètre vide ne lit rien. */
export interface CompetitionScopeFilter {
  /** Compétitions de ces judokas. */
  judokaIds?: string[];
  /** Compétitions des judokas de ces clubs (jointure, sans liste d'identifiants). */
  clubIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  ageCategory?: string;
}

interface CompetitionFinalization {
  competitionId: string | null;
  ownerJudokaId: string;
  result: string;
}

export interface CompetitionsRepository {
  existsForJudoka(
    idJudoka: string,
    name?: string,
    competitionDate?: string,
    excludedCompetitionId?: string
  ): Promise<CompetitionRow | null>;
  getById(idCompetition: string): Promise<CompetitionRow | null>;
  insert(competition: CompetitionModel, idCompetition: string): Promise<CompetitionRow | null>;
  detachAllFromClubCompetition(idClubCompetition: string): Promise<void>;
  getOldestDate(scope: CompetitionScopeFilter): Promise<string>;
  insertMany(
    competitions: { competition: CompetitionModel; idCompetition: string }[]
  ): Promise<CompetitionRow[]>;
  listByClubCompetition(idClubCompetition: string): Promise<CompetitionRow[]>;
  listByJudoka(idJudoka: string): Promise<CompetitionRow[]>;
  listInScope(scope: CompetitionScopeFilter): Promise<CompetitionRow[]>;
  listInScopeWithResults(scope: CompetitionScopeFilter): Promise<CompetitionWithResultsRow[]>;
  updateClubCompetitionFields(
    idClubCompetition: string,
    fields: { name: string; competitionDate: string; ageCategory: string; level: string }
  ): Promise<void>;
  remove(idCompetition: string): Promise<void>;
  removeByJudoka(idJudoka: string): Promise<void>;
  update(idCompetition: string, competition: CompetitionModel): Promise<CompetitionRow | null>;
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
    supabaseInsertMany,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    eqFilter
  } = deps;

  const COMPETITION_ORDER = "order=date.desc,id_competition.asc";

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

  async function listByJudoka(idJudoka: string): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("id_judoka", idJudoka)}&${COMPETITION_ORDER}`
    );
  }

  function periodFilters(scope: CompetitionScopeFilter): string[] {
    const filters: string[] = [];
    if (scope.dateFrom) {
      filters.push(`date=gte.${encodeURIComponent(scope.dateFrom)}`);
    }
    if (scope.dateTo) {
      filters.push(`date=lte.${encodeURIComponent(scope.dateTo)}`);
    }
    if (scope.ageCategory) {
      filters.push(eqFilter("categorie_age", scope.ageCategory));
    }
    return filters;
  }

  type ScopedRow = CompetitionRow & { judokas?: unknown };

  // PAGE-4 : le périmètre d'un coach se filtre par club (jointure sur judokas.club_id) ;
  // les identifiants de judokas, peu nombreux (soi-même, ses enfants), partent par lots.
  async function selectInScope<T extends ScopedRow>(
    scope: CompetitionScopeFilter,
    columns: string
  ): Promise<T[]> {
    const period = periodFilters(scope);
    const clubIds = uniqueIds(scope.clubIds);
    const reads: Promise<T[]>[] = [];
    if (clubIds.length) {
      reads.push(
        supabaseSelect<T>(
          "competitions",
          [
            `select=${columns},judokas!inner(club_id)`,
            inFilter("judokas.club_id", clubIds),
            ...period,
            COMPETITION_ORDER
          ].join("&")
        )
      );
    }
    reads.push(
      selectByIdBatches(scope.judokaIds, (batchIds) =>
        supabaseSelect<T>(
          "competitions",
          [`select=${columns}`, inFilter("id_judoka", batchIds), ...period, COMPETITION_ORDER].join("&")
        )
      )
    );

    const byId = new Map<string, T>();
    (await Promise.all(reads)).flat().forEach((row) => {
      // La jointure sur judokas ne sert qu'au filtre : elle ne sort pas du dépôt.
      const competition = { ...row };
      delete competition.judokas;
      byId.set(String(row.id_competition), competition);
    });
    return [...byId.values()].sort(
      (a, b) =>
        String(b.date).localeCompare(String(a.date)) ||
        String(a.id_competition).localeCompare(String(b.id_competition))
    );
  }

  async function listInScope(scope: CompetitionScopeFilter): Promise<CompetitionRow[]> {
    return selectInScope<CompetitionRow>(scope, "*");
  }

  // INIT-2 : le bilan V/D ne lit que le résultat de chaque combat, avec la compétition.
  async function listInScopeWithResults(
    scope: CompetitionScopeFilter
  ): Promise<CompetitionWithResultsRow[]> {
    return selectInScope<CompetitionWithResultsRow>(scope, "*,combats(resultat)");
  }

  // PAGE-2 : date de la plus ancienne compétition du périmètre ("" s'il est vide).
  async function getOldestDate(scope: CompetitionScopeFilter): Promise<string> {
    const clubIds = uniqueIds(scope.clubIds);
    const judokaIds = uniqueIds(scope.judokaIds);
    const reads: Promise<Pick<CompetitionRow, "date"> | null>[] = [];
    if (clubIds.length) {
      reads.push(
        supabaseSelectOne<Pick<CompetitionRow, "date">>(
          "competitions",
          `select=date,judokas!inner(club_id)&${inFilter("judokas.club_id", clubIds)}&order=date.asc`
        )
      );
    }
    if (judokaIds.length) {
      reads.push(
        supabaseSelectOne<Pick<CompetitionRow, "date">>(
          "competitions",
          `select=date&${inFilter("id_judoka", judokaIds)}&order=date.asc`
        )
      );
    }
    const dates = (await Promise.all(reads))
      .map((row) => String((row && row.date) || ""))
      .filter(Boolean)
      .sort();
    return dates[0] || "";
  }

  async function listByClubCompetition(idClubCompetition: string): Promise<CompetitionRow[]> {
    return supabaseSelect<CompetitionRow>(
      "competitions",
      `select=*&${eqFilter("club_competition_id", idClubCompetition)}&order=nom.asc,id_competition.asc`
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

  // ECRIT-3 : les participations d'une compétition club se créent en un seul envoi.
  async function insertMany(
    competitions: { competition: CompetitionModel; idCompetition: string }[]
  ): Promise<CompetitionRow[]> {
    return supabaseInsertMany<CompetitionRow>(
      "competitions",
      competitions.map(({ competition, idCompetition }) =>
        toNewCompetitionRecord(competition, idCompetition)
      )
    );
  }

  // ECRIT-3 : les champs hérités de la compétition club se propagent en une requête.
  async function updateClubCompetitionFields(
    idClubCompetition: string,
    fields: { name: string; competitionDate: string; ageCategory: string; level: string }
  ): Promise<void> {
    await supabasePatch("competitions", eqFilter("club_competition_id", idClubCompetition), {
      nom: fields.name,
      date: fields.competitionDate,
      categorie_age: fields.ageCategory,
      niveau: fields.level || ""
    });
  }

  async function detachAllFromClubCompetition(idClubCompetition: string): Promise<void> {
    await supabasePatch("competitions", eqFilter("club_competition_id", idClubCompetition), {
      club_competition_id: null
    });
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

  async function updateCoachReview(idCompetition: string, review: string): Promise<CompetitionRow | null> {
    return supabasePatch<CompetitionRow>(
      "competitions",
      eqFilter("id_competition", idCompetition),
      { coach_review: review }
    );
  }

  async function remove(idCompetition: string): Promise<void> {
    return supabaseDelete("competitions", eqFilter("id_competition", idCompetition));
  }

  async function removeByJudoka(idJudoka: string): Promise<void> {
    return supabaseDelete("competitions", eqFilter("id_judoka", idJudoka));
  }

  return {
    detachAllFromClubCompetition,
    existsForJudoka,
    getById,
    getOldestDate,
    insert,
    insertMany,
    listByClubCompetition,
    listByJudoka,
    listInScope,
    listInScopeWithResults,
    remove,
    removeByJudoka,
    update,
    updateClubCompetitionFields,
    updateCoachReview,
    updateResult
  };
}
