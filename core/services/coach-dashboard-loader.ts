import { toCanonicalCombat, toCanonicalJudoka } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { CombatScoreRow } from "../repositories/types";
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

  const allCompetitionRows = await deps.competitionsRepository.listAll();
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

  const judokaRows = await deps.judokasRepository.listAll();
  const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), toCanonicalJudoka(row)]));
  const competitionLevelById = new Map(
    competitionRows.map((competition) => [
      String(competition.id_competition),
      String(competition.niveau || "")
    ])
  );

  const combatRowsByCompetition = await Promise.all(
    competitionRows.map((competition) => deps.combatsRepository.listByCompetition(competition.id_competition))
  );
  const combatRows = combatRowsByCompetition.flat();
  const scoreRows = await deps.combatScoresRepository.listByCombatIds(
    combatRows.map((combat) => combat.id_combat)
  );
  const scoresByCombatId = groupScoresByCombatId(scoreRows);

  return combatRows
    .filter((combat) => {
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
    })
    .map((combat) => ({
      ...toCanonicalCombat({
        ...combat,
        scores: scoresByCombatId.get(String(combat.id_combat)) || []
      }),
      competitionLevel: competitionLevelById.get(String(combat.id_competition)) || "",
      judokaGender: judokasById.get(String(combat.id_judoka))?.gender || "",
      judokaHandedness: judokasById.get(String(combat.id_judoka))?.handedness || ""
    }));
}
