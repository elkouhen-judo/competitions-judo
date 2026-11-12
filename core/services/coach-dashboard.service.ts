import { computeCoachDashboardStats } from "../domain/coach-dashboard-statistics";
import { createCoachAssistantSearch } from "./coach-assistant-search";
import {
  filterCompetitionsByScope,
  filterCompetitionsBySelection,
  groupScoredPointsByCombatId,
  loadCoachDashboardCombats,
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

function buildCoachDashboardCompetitionOptions(competitionRows: CompetitionRow[]) {
  const optionsByKey = new Map<
    string,
    { competitionId: string; competitionIds: string[]; name: string; competitionDate: string }
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
      competitionDate: competition.date || ""
    });
  });
  return Array.from(optionsByKey.values());
}

export interface CoachDashboardServiceDeps {
  combatsRepository: Pick<CombatsRepository, "listByCompetitionIdsWithScores">;
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
  // clubs et lui-même ; avec un club : les judokas de ce club seulement.
  async function loadCoachData(
    email: string,
    message: string,
    clubId: string | undefined,
    filters: Pick<CoachDashboardFilters, "dateFrom" | "dateTo" | "ageCategory">
  ): Promise<{ competitionRows: CompetitionRow[]; judokaRows: JudokaRow[] }> {
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
    const scope: CompetitionScopeFilter = selectedClubId
      ? { clubIds: [selectedClubId] }
      : { clubIds: identity.coachClubIds, judokaIds: [String(identity.user.id_judoka)] };

    // Les compétitions sont lues une seule fois, en même temps que les judokas du périmètre.
    const [{ judokas }, competitionRows] = await Promise.all([
      userContextService.getDomainUserContext(email),
      competitionsRepository.listInScope(toCompetitionScopeFilter(scope, filters))
    ]);
    const judokaRows = selectedClubId
      ? judokas.filter((judoka) => String(judoka.club_id || "") === selectedClubId)
      : judokas;
    // Un coach d'un club ne lit aucune ligne d'un autre club : le périmètre est revérifié.
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
    const { competitionRows, judokaRows } = await loadCoachData(
      email,
      "Tableau de bord réservé aux coachs.",
      filters.clubId,
      filters
    );
    const scopedRows = filterCompetitionsByScope(competitionRows, filters);
    const selectedRows = filterCompetitionsBySelection(scopedRows, filters);
    const combats = await loadCoachDashboardCombats(combatsRepository, selectedRows, judokaRows);
    return {
      stats: computeCoachDashboardStats(combats, selectedRows.map(toCanonicalCompetition)),
      availableCompetitions: buildCoachDashboardCompetitionOptions(scopedRows)
    };
  }

  // COACH-2 : les combats se lisent par lots avec leurs points, et non par compétition.
  async function searchCombats(
    email: string,
    filters: CoachChatFilters = {},
    limit?: number
  ): Promise<{ matches: CoachAssistantMatch[] }> {
    const { competitionRows, judokaRows } = await loadCoachData(
      email,
      "Recherche de combats réservée aux coachs.",
      undefined,
      {}
    );
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
