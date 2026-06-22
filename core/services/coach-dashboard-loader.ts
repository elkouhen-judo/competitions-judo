import { toCanonicalCombat, toCanonicalJudoka } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { CombatScoreRow, CompetitionRow } from "../repositories/types";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { CoachDashboardFilters } from "../types";

export interface CoachDashboardLoaderDeps {
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
  competitionsRepository: CompetitionsRepository;
  judokasRepository: JudokasRepository;
}

export function validateCoachDashboardFilters(filters: CoachDashboardFilters): void {
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("La date de début doit être antérieure ou égale à la date de fin.");
  }
}

/**
 * Filters competitions by date range and age category only (not by
 * `competitionIds`), so it can scope both the combat loading and the
 * competition picker's available options to the same date/age criteria.
 */
export function filterCompetitionsByScope(
  competitionRows: CompetitionRow[],
  filters: Pick<CoachDashboardFilters, "dateFrom" | "dateTo" | "ageCategory">
): CompetitionRow[] {
  const ageCategory = String(filters.ageCategory || "").trim();
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();
  return competitionRows.filter((competition) => {
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
}

/**
 * Filters competitions down to the ones explicitly selected via
 * `competitionIds` (no-op when none is selected), so the same selection can
 * scope both combat loading and the podium breakdown.
 */
export function filterCompetitionsBySelection(
  competitionRows: CompetitionRow[],
  filters: Pick<CoachDashboardFilters, "competitionIds">
): CompetitionRow[] {
  const selectedCompetitionIds =
    Array.isArray(filters.competitionIds) && filters.competitionIds.length
      ? new Set(filters.competitionIds.map(String))
      : null;
  return competitionRows.filter(
    (competition) =>
      !selectedCompetitionIds || selectedCompetitionIds.has(String(competition.id_competition))
  );
}

function groupScoresByCombatId(scoreRows: CombatScoreRow[]): Map<string, CombatScoreRow[]> {
  const scoresByCombatId = new Map<string, CombatScoreRow[]>();
  scoreRows.forEach((score) => {
    const idCombat = String(score.id_combat);
    scoresByCombatId.set(idCombat, [...(scoresByCombatId.get(idCombat) || []), score]);
  });
  return scoresByCombatId;
}

export async function loadCoachDashboardCombats(
  deps: CoachDashboardLoaderDeps,
  filters: CoachDashboardFilters = {}
) {
  validateCoachDashboardFilters(filters);

  const allCompetitionRows = await deps.competitionsRepository.listAll();
  const competitionRows = filterCompetitionsBySelection(
    filterCompetitionsByScope(allCompetitionRows, filters),
    filters
  );

  const judokaRows = await deps.judokasRepository.listAll();
  const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), toCanonicalJudoka(row)]));
  const competitionLevelById = new Map(
    competitionRows.map((competition) => [
      String(competition.id_competition),
      String(competition.niveau || "")
    ])
  );

  const combatRows = await deps.combatsRepository.listByCompetitionIds(
    competitionRows.map((competition) => competition.id_competition)
  );
  const scoreRows = await deps.combatScoresRepository.listByCombatIds(
    combatRows.map((combat) => combat.id_combat)
  );
  const scoresByCombatId = groupScoresByCombatId(scoreRows);

  return combatRows.map((combat) => ({
    ...toCanonicalCombat({
      ...combat,
      scores: scoresByCombatId.get(String(combat.id_combat)) || []
    }),
    competitionLevel: competitionLevelById.get(String(combat.id_competition)) || "",
    judokaGender: judokasById.get(String(combat.id_judoka))?.gender || "",
    judokaHandedness: judokasById.get(String(combat.id_judoka))?.handedness || ""
  }));
}
