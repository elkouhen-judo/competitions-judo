import {
  createCompetitionId,
  createJudokaId,
  createOptionalCompetitionId
} from "../shared/identity";
import { createCompetitionRanking } from "../competition-results";
import { COMPETITION_LEVELS, createWeightCategory } from "../category-reference";
import { createCombat, type CombatInput, type CombatModel } from "./combat";

export const AGE_CATEGORIES = [
  "Poussinet",
  "Poussin",
  "Benjamin",
  "Minime",
  "Cadet",
  "Junior",
  "Senior",
  "Vétéran"
] as const;

export type AgeCategory = (typeof AGE_CATEGORIES)[number];

export interface CompetitionInput {
  competitionId?: unknown;
  clubCompetitionId?: unknown;
  ownerJudokaId?: unknown;
  name?: unknown;
  competitionDate?: unknown;
  ageCategory?: unknown;
  weightCategory?: unknown;
  level?: unknown;
  result?: unknown;
}

export interface CompetitionDraft {
  name: string;
  competitionDate: string;
  ageCategory: AgeCategory;
  weightCategory: string;
  level: string;
}

export interface CombatLike {
  competitionId?: unknown;
  judokaId?: unknown;
}

export interface CompetitionModel {
  competitionId: string | null;
  clubCompetitionId: string | null;
  ownerJudokaId: string;
  draft: CompetitionDraft;
  name: string;
  competitionDate: string;
  ageCategory: AgeCategory;
  weightCategory: string;
  level: string;
  result: string;
  changeDetails(details?: CompetitionInput): CompetitionModel;
  finalize(finalResult: unknown): {
    competitionId: string | null;
    ownerJudokaId: string;
    result: string;
  };
  belongsToJudoka(judokaId: unknown): boolean;
  assertCanContainCombat(combat: CombatLike | null | undefined): void;
  recordCombat(combatDraft: CombatInput): CombatModel;
}

function cleanCompetitionText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCompetitionKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const AGE_CATEGORY_ALIASES = new Map<string, AgeCategory>(
  AGE_CATEGORIES.map((category) => [normalizeCompetitionKey(category), category])
);

export function createCompetitionAgeCategory(value: unknown): AgeCategory | "" {
  const ageCategory = cleanCompetitionText(value);
  if (!ageCategory) {
    return "";
  }

  const normalizedAgeCategory = AGE_CATEGORY_ALIASES.get(normalizeCompetitionKey(ageCategory));
  if (!normalizedAgeCategory) {
    throw new Error("Catégorie d'âge invalide.");
  }

  return normalizedAgeCategory;
}

export function createCompetitionLevel(value: unknown): string {
  const level = cleanCompetitionText(value);
  if (!level) {
    return "";
  }
  if (!(COMPETITION_LEVELS as readonly string[]).includes(level)) {
    throw new Error("Niveau de compétition invalide.");
  }
  return level;
}

export function createCompetitionDate(value: unknown): string {
  const competitionDate = cleanCompetitionText(value);
  if (!competitionDate) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(competitionDate)) {
    throw new Error("Date de compétition invalide.");
  }

  const parsedDate = new Date(`${competitionDate}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== competitionDate
  ) {
    throw new Error("Date de compétition invalide.");
  }

  return competitionDate;
}

export function createCompetitionDetailsDraft(
  competition: CompetitionInput = {}
): CompetitionDraft {
  const name = cleanCompetitionText(competition.name);
  const competitionDate = createCompetitionDate(competition.competitionDate);

  if (!name || !competitionDate) {
    throw new Error("Nom et date obligatoires.");
  }

  const ageCategory = createCompetitionAgeCategory(competition.ageCategory);
  if (!ageCategory) {
    throw new Error("Catégorie d'âge obligatoire.");
  }

  return {
    name,
    competitionDate,
    ageCategory,
    weightCategory: createWeightCategory(competition.weightCategory, ageCategory),
    level: createCompetitionLevel(competition.level)
  };
}

export function createCompetitionFinalResult(value: unknown): string {
  return createCompetitionRanking(value);
}

export function createCompetition(
  competition: CompetitionInput,
  ownerJudokaId: unknown
): CompetitionModel {
  const draft = createCompetitionDetailsDraft(competition);
  const resolvedOwnerJudokaId = createJudokaId(ownerJudokaId, "Judoka participant obligatoire.");
  const competitionId = createOptionalCompetitionId(competition && competition.competitionId);
  const clubCompetitionId = createOptionalCompetitionId(
    competition && competition.clubCompetitionId
  );
  const result = createCompetitionFinalResult(competition && competition.result);

  const record = {
    competitionId,
    clubCompetitionId,
    ownerJudokaId: resolvedOwnerJudokaId,
    draft,
    name: draft.name,
    competitionDate: draft.competitionDate,
    ageCategory: draft.ageCategory,
    weightCategory: draft.weightCategory,
    level: draft.level,
    result
  };

  return {
    ...record,
    changeDetails(details: CompetitionInput = {}) {
      return createCompetition(
        {
          ...details,
          competitionId: record.competitionId,
          clubCompetitionId: record.clubCompetitionId,
          ageCategory: details.ageCategory !== undefined ? details.ageCategory : record.ageCategory,
          weightCategory:
            details.weightCategory !== undefined ? details.weightCategory : record.weightCategory,
          level: details.level !== undefined ? details.level : record.level,
          result: details.result !== undefined ? details.result : record.result
        },
        record.ownerJudokaId
      );
    },
    finalize(finalResult: unknown) {
      return {
        competitionId: record.competitionId,
        ownerJudokaId: record.ownerJudokaId,
        result: createCompetitionFinalResult(finalResult)
      };
    },
    belongsToJudoka(judokaId: unknown) {
      return String(record.ownerJudokaId) === String(judokaId);
    },
    assertCanContainCombat(combat: CombatLike | null | undefined) {
      const combatCompetitionId = combat && combat.competitionId;
      const combatJudokaId = combat && combat.judokaId;

      if (!combat || String(combatCompetitionId) !== String(record.competitionId || "")) {
        throw new Error("Ce combat n'appartient pas à cette compétition.");
      }
      if (!this.belongsToJudoka(combatJudokaId)) {
        throw new Error("Le combat doit concerner le judoka de la compétition.");
      }
    },
    recordCombat(combatDraft: CombatInput) {
      const combat = createCombat({
        ...combatDraft,
        competitionId: record.competitionId,
        judokaId: combatDraft.judokaId || record.ownerJudokaId
      });
      this.assertCanContainCombat(combat);
      return combat;
    }
  };
}

export function createPersistedCompetition(competition: CompetitionInput): CompetitionModel {
  createCompetitionId(competition && competition.competitionId);
  return createCompetition(competition, competition.ownerJudokaId);
}

export function assertCompetitionCanContainCombat(
  competition: CompetitionInput,
  combat: CombatLike | null | undefined
): void {
  createPersistedCompetition(competition).assertCanContainCombat(combat);
}
