import { computeCoachDashboardStats } from "../domain/coach-dashboard-statistics";
import {
  createCoachAssistantSearch,
  type CoachChatDatasets,
  type AnthropicClient
} from "./coach-assistant-search";
import {
  filterCompetitionsByScope,
  filterCompetitionsBySelection,
  loadCoachDashboardCombats
} from "./coach-dashboard-loader";
import { toCanonicalCompetition } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoreRow, CompetitionRow } from "../repositories/types";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type {
  CoachAssistantMatch,
  CoachAssistantResponse,
  CoachChatFilters,
  CoachChatHistoryMessage,
  CoachDashboard,
  CoachDashboardFilters,
  RpcMethods
} from "../types";
import type { UserContextService } from "./user-context.service";

type CoachDashboardMethods = Pick<RpcMethods, "askCoachAssistant" | "getCoachDashboard" | "searchCombats">;

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
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
  competitionsRepository: CompetitionsRepository;
  getCurrentDate?: () => string;
  anthropicClient?: AnthropicClient;
  judokasRepository: JudokasRepository;
  userContextService: UserContextService;
}

export interface CoachDashboardService {
  methods: CoachDashboardMethods;
}

export default function createCoachDashboardService(
  deps: CoachDashboardServiceDeps
): CoachDashboardService {
  const {
    combatsRepository,
    combatScoresRepository,
    competitionsRepository,
    getCurrentDate = () => new Date().toISOString().slice(0, 10),
    anthropicClient,
    judokasRepository,
    userContextService
  } = deps;
  const coachAssistantSearch = createCoachAssistantSearch({ getCurrentDate, anthropicClient });

  async function requireCoach(email: string, message: string): Promise<void> {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH") {
      throw new Error(message);
    }
  }

  async function loadCoachChatDatasets(): Promise<CoachChatDatasets> {
    const [competitionRows, judokaRows] = await Promise.all([
      competitionsRepository.listAll(),
      judokasRepository.listAll()
    ]);
    const combatRowsByCompetition = await Promise.all(
      competitionRows.map((competition) => combatsRepository.listByCompetition(competition.id_competition))
    );
    const combatRows = combatRowsByCompetition.flat();
    const scoreRows = await combatScoresRepository.listByCombatIds(
      combatRows.map((combat) => combat.id_combat)
    );
    const scoresByCombatId = new Map<string, CombatScoreRow[]>();
    scoreRows.forEach((score) => {
      const idCombat = String(score.id_combat);
      scoresByCombatId.set(idCombat, [...(scoresByCombatId.get(idCombat) || []), score]);
    });
    return { judokaRows, competitionRows, combatRows, scoresByCombatId };
  }

  async function getCoachDashboard(
    email: string,
    filters: CoachDashboardFilters = {}
  ): Promise<CoachDashboard> {
    await requireCoach(email, "Tableau de bord réservé aux coachs.");
    const [combats, allCompetitionRows] = await Promise.all([
      loadCoachDashboardCombats(
        { combatsRepository, combatScoresRepository, competitionsRepository, judokasRepository },
        filters
      ),
      competitionsRepository.listAll()
    ]);
    const competitionsInScope = filterCompetitionsBySelection(
      filterCompetitionsByScope(allCompetitionRows, filters),
      filters
    ).map(toCanonicalCompetition);
    return {
      stats: computeCoachDashboardStats(combats, competitionsInScope),
      availableCompetitions: buildCoachDashboardCompetitionOptions(
        filterCompetitionsByScope(allCompetitionRows, filters)
      )
    };
  }

  async function askCoachAssistant(
    email: string,
    question: string,
    history: CoachChatHistoryMessage[] = []
  ): Promise<CoachAssistantResponse> {
    await requireCoach(email, "Assistant coach réservé aux coachs.");
    return coachAssistantSearch.ask(question, await loadCoachChatDatasets(), history);
  }

  async function searchCombats(
    email: string,
    filters: CoachChatFilters = {},
    limit?: number
  ): Promise<{ matches: CoachAssistantMatch[] }> {
    await requireCoach(email, "Recherche de combats réservée aux coachs.");
    return coachAssistantSearch.searchCombats(filters, limit, await loadCoachChatDatasets());
  }

  return {
    methods: { askCoachAssistant, getCoachDashboard, searchCombats }
  };
}
