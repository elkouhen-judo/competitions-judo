import { toCanonicalCombat, toCanonicalJudoka } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import { isConcededScoreRow } from "../repositories/combat-scores.repository";
import type { CompetitionScopeFilter } from "../repositories/competitions.repository";
import type {
  CombatRow,
  CombatScoreRow,
  CombatWithScoresRow,
  CompetitionRow,
  JudokaRow
} from "../repositories/types";
import type { CoachDashboardFilters } from "../types";

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

/** Les statistiques portent sur les points marqués : les points subis sont écartés. */
export function groupScoredPointsByCombatId(
  combatRows: CombatWithScoresRow[]
): Map<string, CombatScoreRow[]> {
  return new Map(
    combatRows.map((combat) => [
      String(combat.id_combat),
      (Array.isArray(combat.combat_scores) ? combat.combat_scores : []).filter(
        (score) => !isConcededScoreRow(score)
      )
    ])
  );
}

export function withoutScores(row: CombatWithScoresRow): CombatRow {
  const combat: Partial<CombatWithScoresRow> = { ...row };
  delete combat.combat_scores;
  return combat as CombatRow;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * COACH-1 : club, dates et catégorie d'âge filtrent la requête. Une date mal formée n'est
 * pas envoyée à la base ; `filterCompetitionsByScope` l'applique ensuite en mémoire.
 */
export function toCompetitionScopeFilter(
  scope: CompetitionScopeFilter,
  filters: Pick<CoachDashboardFilters, "dateFrom" | "dateTo" | "ageCategory">
): CompetitionScopeFilter {
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();
  const ageCategory = String(filters.ageCategory || "").trim();
  return {
    ...scope,
    ...(ISO_DATE.test(dateFrom) ? { dateFrom } : {}),
    ...(ISO_DATE.test(dateTo) ? { dateTo } : {}),
    ...(ageCategory ? { ageCategory } : {})
  };
}

/** Combats des compétitions retenues, lus par lots avec leurs points, enrichis pour les statistiques. */
export async function loadCoachDashboardCombats(
  combatsRepository: Pick<CombatsRepository, "listByCompetitionIdsWithScores">,
  competitionRows: CompetitionRow[],
  judokaRows: JudokaRow[]
) {
  const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), toCanonicalJudoka(row)]));
  const competitionLevelById = new Map(
    competitionRows.map((competition) => [
      String(competition.id_competition),
      String(competition.niveau || "")
    ])
  );

  const combatRows = await combatsRepository.listByCompetitionIdsWithScores(
    competitionRows.map((competition) => competition.id_competition)
  );
  const scoresByCombatId = groupScoredPointsByCombatId(combatRows);

  return combatRows.map((combat) => ({
    ...toCanonicalCombat({
      ...withoutScores(combat),
      scores: scoresByCombatId.get(String(combat.id_combat)) || [],
      // TDB-5 : les points subis alimentent « Techniques subies », jamais les autres statistiques.
      concededScores: (Array.isArray(combat.combat_scores) ? combat.combat_scores : []).filter(isConcededScoreRow)
    }),
    competitionLevel: competitionLevelById.get(String(combat.id_competition)) || "",
    judokaGender: judokasById.get(String(combat.id_judoka))?.gender || "",
    judokaHandedness: judokasById.get(String(combat.id_judoka))?.handedness || ""
  }));
}
