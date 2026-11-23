import {
  computeClubBreakdown,
  computeCoachDashboardStats,
  computeWithheldScope,
  isGroupScope
} from "../domain/coach-dashboard-statistics";
import { createCoachAssistantSearch } from "./coach-assistant-search";
import {
  filterCompetitionsByScope,
  filterCompetitionsBySelection,
  getPreviousPeriod,
  groupScoredPointsByCombatId,
  toCoachDashboardCombats,
  toCompetitionScopeFilter,
  validateCoachDashboardFilters,
  withoutScores
} from "./coach-dashboard-loader";
import { toCanonicalCompetition, toCanonicalJudoka } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CompetitionRow, JudokaRow } from "../repositories/types";
import type { CompetitionScopeFilter, CompetitionsRepository } from "../repositories/competitions.repository";
import type {
  CoachAssistantMatch,
  CoachChatFilters,
  CoachDashboard,
  CoachDashboardFilters,
  RpcMethods
} from "../types";
import type { UserContextService } from "./user-context.service";

type CoachDashboardMethods = Pick<RpcMethods, "getCoachDashboard" | "searchCombats">;

// MULTI-1 : chaque option porte le club de sa compétition, pour distinguer deux clubs.
function buildCoachDashboardCompetitionOptions(competitionRows: CompetitionRow[]) {
  const optionsByKey = new Map<
    string,
    { competitionId: string; competitionIds: string[]; name: string; competitionDate: string; clubId: string }
  >();
  competitionRows.forEach((competition) => {
    const competitionId = String(competition.id_competition || "");
    const clubCompetitionId = String(competition.club_competition_id || "");
    const key = clubCompetitionId || competitionId;
    const existingOption = optionsByKey.get(key);
    if (existingOption) {
      existingOption.competitionIds.push(competitionId);
      return;
    }
    optionsByKey.set(key, {
      competitionId,
      competitionIds: [competitionId],
      name: competition.nom || "Compétition",
      competitionDate: competition.date || "",
      clubId: String(competition.stats_club_id || "")
    });
  });
  return Array.from(optionsByKey.values());
}

export interface CoachDashboardServiceDeps {
  combatsRepository: Pick<CombatsRepository, "listByCompetitionIdsWithScores" | "listCoachDashboardData">;
  competitionsRepository: Pick<CompetitionsRepository, "listInScope">;
  getCurrentDate?: () => string;
  userContextService: Pick<UserContextService, "getDomainUserContext" | "getIdentity">;
}

export interface CoachDashboardService {
  methods: CoachDashboardMethods;
}

export default function createCoachDashboardService(
  deps: CoachDashboardServiceDeps
): CoachDashboardService {
  const {
    combatsRepository,
    competitionsRepository,
    getCurrentDate = () => new Date().toISOString().slice(0, 10),
    userContextService
  } = deps;
  const coachAssistantSearch = createCoachAssistantSearch({ getCurrentDate });

  // COACH-1 : le périmètre du coach filtre la requête. Sans club choisi : les judokas de ses
  // clubs ; avec un club : les judokas de ce club seulement. MULTI-5 : le coach n'y entre que
  // s'il est inscrit dans un de ses clubs.
  async function resolveCoachScope(
    email: string,
    message: string,
    clubId: string | undefined
  ): Promise<{ scope: CompetitionScopeFilter; clubIds: string[] }> {
    const identity = await userContextService.getIdentity(email);
    if (!identity) {
      throw new Error(`Accès refusé pour : ${email}`);
    }
    if (toCanonicalJudoka(identity.user).accessRole !== "COACH") {
      throw new Error(message);
    }
    const selectedClubId = String(clubId || "").trim();
    if (selectedClubId && !identity.coachClubIds.includes(selectedClubId)) {
      throw new Error("Club introuvable.");
    }
    const clubIds = selectedClubId ? [selectedClubId] : identity.coachClubIds;
    return { scope: { clubIds }, clubIds };
  }

  // Un coach d'un club ne lit aucune ligne d'un autre club : le périmètre est revérifié.
  function restrictToScope(
    judokas: JudokaRow[],
    competitionRows: CompetitionRow[],
    clubIds: string[]
  ): { competitionRows: CompetitionRow[]; judokaRows: JudokaRow[] } {
    const judokaRows = judokas.filter((judoka) => clubIds.includes(String(judoka.club_id || "")));
    const allowed = new Set(judokaRows.map((judoka) => String(judoka.id_judoka)));
    return {
      competitionRows: competitionRows.filter((row) => allowed.has(String(row.id_judoka))),
      judokaRows
    };
  }

  async function getCoachDashboard(
    email: string,
    filters: CoachDashboardFilters = {}
  ): Promise<CoachDashboard> {
    validateCoachDashboardFilters(filters);
    const { scope, clubIds } = await resolveCoachScope(
      email,
      "Tableau de bord réservé aux coachs.",
      filters.clubId
    );
    // STAT-17 : compétitions, combats et points en un appel, en même temps que les judokas.
    // STAT-23 : la lecture commence un an plus tôt pour la période comparée ; le partage est fait ici.
    const competitionIds = Array.isArray(filters.competitionIds) ? filters.competitionIds.map(String) : [];
    const previousPeriod = getPreviousPeriod(filters);
    const readFilters = previousPeriod ? { ...filters, dateFrom: previousPeriod.dateFrom } : filters;
    const [, data] = await Promise.all([
      userContextService.getDomainUserContext(email),
      combatsRepository.listCoachDashboardData(toCompetitionScopeFilter(scope, readFilters), competitionIds)
    ]);
    // MULTI-4 : une participation compte pour le club où elle a été obtenue, même si le judoka a
    // changé de club depuis ; aucune donnée nominative ne sort (DASH-026).
    const competitionRows = data.competitions.filter((row) => clubIds.includes(String(row.stats_club_id || "")));
    const scopedRows = filterCompetitionsByScope(competitionRows, filters);
    const selectedRows = filterCompetitionsBySelection(scopedRows, filters);
    const today = getCurrentDate();
    const readPeriod = (rows: CompetitionRow[]) => {
      const ids = new Set(rows.map((row) => String(row.id_competition)));
      const combats = toCoachDashboardCombats(
        data.combats.filter((combat) => ids.has(String(combat.id_competition))),
        rows
      );
      return { combats, competitions: rows.map(toCanonicalCompetition) };
    };
    const readPeriodPair = (rows: CompetitionRow[]) => {
      const { combats, competitions } = readPeriod(rows);
      return [combats, competitions] as const;
    };
    const computePeriod = (rows: CompetitionRow[]) => {
      const { combats, competitions } = readPeriod(rows);
      // STAT-20 : sous 2 judokas, aucune statistique : elle décrirait un judoka identifiable.
      const isGroup = isGroupScope(combats, competitions);
      return {
        stats: isGroup ? computeCoachDashboardStats(combats, competitions, { today }) : null,
        withheld: isGroup ? null : computeWithheldScope(combats, competitions, today)
      };
    };
    const current = computePeriod(selectedRows);
    // MULTI-6 : sur « Tous mes clubs » d'un coach de plusieurs clubs, une ligne par club.
    const byClub =
      !filters.clubId && clubIds.length > 1 && current.stats
        ? computeClubBreakdown(
            clubIds,
            ...readPeriodPair(selectedRows),
            new Map(selectedRows.map((row) => [String(row.id_competition), String(row.stats_club_id || "")])),
            today
          )
        : null;
    const previousRows = previousPeriod
      ? filterCompetitionsByScope(competitionRows, { ...filters, ...previousPeriod })
      : [];
    const previousStats = current.stats && previousRows.length ? computePeriod(previousRows).stats : null;
    return {
      ...current,
      previous: previousPeriod && previousStats ? { ...previousPeriod, stats: previousStats } : null,
      byClub,
      availableCompetitions: buildCoachDashboardCompetitionOptions(scopedRows)
    };
  }

  // COACH-2 : les combats se lisent par lots avec leurs points, et non par compétition.
  async function searchCombats(
    email: string,
    filters: CoachChatFilters = {},
    limit?: number
  ): Promise<{ matches: CoachAssistantMatch[] }> {
    const { scope, clubIds } = await resolveCoachScope(
      email,
      "Recherche de combats réservée aux coachs.",
      undefined
    );
    // Les compétitions sont lues une seule fois, en même temps que les judokas du périmètre.
    const [{ judokas }, scopedCompetitions] = await Promise.all([
      userContextService.getDomainUserContext(email),
      competitionsRepository.listInScope(scope)
    ]);
    const { competitionRows, judokaRows } = restrictToScope(judokas, scopedCompetitions, clubIds);
    const combatsWithScores = await combatsRepository.listByCompetitionIdsWithScores(
      competitionRows.map((competition) => competition.id_competition)
    );
    return coachAssistantSearch.searchCombats(filters, limit, {
      judokaRows,
      competitionRows,
      combatRows: combatsWithScores.map(withoutScores),
      scoresByCombatId: groupScoredPointsByCombatId(combatsWithScores)
    });
  }

  return {
    methods: { getCoachDashboard, searchCombats }
  };
}
