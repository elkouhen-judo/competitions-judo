import { toCanonicalCombat, toCanonicalJudoka } from "./domain-adapters";
import { computeCoachDashboardStats } from "../domain/coach-dashboard-statistics";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoreRow } from "../repositories/types";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { CoachDashboard, CoachDashboardFilters, RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

type CoachDashboardMethods = Pick<RpcMethods, "getCoachDashboard">;

export interface CoachDashboardServiceDeps {
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
  competitionsRepository: CompetitionsRepository;
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
    judokasRepository,
    userContextService
  } = deps;

  async function getCoachDashboard(
    email: string,
    filters: CoachDashboardFilters = {}
  ): Promise<CoachDashboard> {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH") {
      throw new Error("Tableau de bord réservé aux coachs.");
    }

    const ageCategory = String(filters.ageCategory || "").trim();
    const categoryYear = String(filters.categoryYear || "").trim();
    const dateFrom = String(filters.dateFrom || "").trim();
    const dateTo = String(filters.dateTo || "").trim();
    const gender = String(filters.gender || "").trim();
    const handedness = String(filters.handedness || "").trim();
    const selectedCompetitionIds =
      Array.isArray(filters.competitionIds) && filters.competitionIds.length
        ? new Set(filters.competitionIds.map(String))
        : null;

    const allCompetitionRows = await competitionsRepository.listAll();
    const competitionRows = allCompetitionRows.filter((competition) => {
      if (selectedCompetitionIds && !selectedCompetitionIds.has(String(competition.id_competition))) {
        return false;
      }
      const competitionDate = String(competition.date || "");
      if (dateFrom && competitionDate < dateFrom) {
        return false;
      }
      if (dateTo && competitionDate > dateTo) {
        return false;
      }
      if (ageCategory && String(competition.categorie_age || "") !== ageCategory) {
        return false;
      }
      return true;
    });

    const judokaRows = await judokasRepository.listAll();
    const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), toCanonicalJudoka(row)]));
    const competitionLevelById = new Map(
      competitionRows.map((competition) => [
        String(competition.id_competition),
        String(competition.niveau || "")
      ])
    );

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

    const filteredCombatRows = combatRows.filter((combat) => {
      if (!gender && !categoryYear && !handedness) {
        return true;
      }
      const judoka = judokasById.get(String(combat.id_judoka));
      if (gender && (!judoka || judoka.gender !== gender)) {
        return false;
      }
      if (categoryYear && (!judoka || judoka.yearInCategory !== categoryYear)) {
        return false;
      }
      if (handedness && (!judoka || judoka.handedness !== handedness)) {
        return false;
      }
      return true;
    });

    const combats = filteredCombatRows.map((combat) => ({
      ...toCanonicalCombat({
        ...combat,
        scores: scoresByCombatId.get(String(combat.id_combat)) || []
      }),
      competitionLevel: competitionLevelById.get(String(combat.id_competition)) || "",
      judokaGender: judokasById.get(String(combat.id_judoka))?.gender || "",
      judokaHandedness: judokasById.get(String(combat.id_judoka))?.handedness || ""
    }));

    return { stats: computeCoachDashboardStats(combats) };
  }

  return {
    methods: { getCoachDashboard }
  };
}
