import { normalizeCombatResult } from "../domain/competitions/combat-result";
import type {
  AccessInvitation,
  Combat,
  CombatReadModel,
  Competition,
  Judoka
} from "../types";

type SourceRecord = object;

function pick<T = unknown>(
  source: SourceRecord | null | undefined,
  camelKey: string,
  snakeKey: string
): T | undefined {
  if (!source) {
    return undefined;
  }

  const record = source as Record<string, unknown>;
  return (record[camelKey] !== undefined ? record[camelKey] : record[snakeKey]) as T | undefined;
}

function normalizeProfileType(value: unknown): Judoka["profileType"] {
  return String(value || "").trim() === "PARENT" ? "PARENT" : "JUDOKA";
}

function normalizeAccessRole(value: unknown): Judoka["accessRole"] {
  const normalized = String(value || "").trim();
  if (normalized === "ADMIN") {
    return "ADMIN";
  }
  if (normalized === "COACH") {
    return "COACH";
  }
  return "NORMAL";
}

function normalizeCanonicalCombatResult(value: unknown): Combat["result"] {
  const normalized = normalizeCombatResult(value);
  if (normalized) {
    return normalized;
  }
  return "Défaite";
}

export function toCanonicalJudoka(user: SourceRecord = {}): Judoka {
  return {
    judokaId: String(pick(user, "judokaId", "id_judoka") || ""),
    accountEmail: String(pick(user, "accountEmail", "email") || ""),
    firstName: String(pick(user, "firstName", "prenom") || ""),
    lastName: String(pick(user, "lastName", "nom") || ""),
    profileType: normalizeProfileType(pick(user, "profileType", "profile_type")),
    accessRole: normalizeAccessRole(pick(user, "accessRole", "role")),
    ageCategory: String(pick(user, "ageCategory", "categorie_age") || ""),
    weightCategory: String(pick(user, "weightCategory", "categorie_poids") || ""),
    beltColor: String(pick(user, "beltColor", "couleur_ceinture") || "")
  };
}

export function toCanonicalCompetition(competition: SourceRecord = {}): Competition {
  return {
    competitionId: String(pick(competition, "competitionId", "id_competition") || ""),
    clubCompetitionId: (pick(competition, "clubCompetitionId", "club_competition_id") || null) as
      | string
      | null,
    ownerJudokaId: String(pick(competition, "ownerJudokaId", "id_judoka") || ""),
    name: String(pick(competition, "name", "nom") || ""),
    competitionDate: String(pick(competition, "competitionDate", "date") || ""),
    ageCategory: String(pick(competition, "ageCategory", "categorie_age") || ""),
    weightCategory: String(pick(competition, "weightCategory", "categorie_poids") || ""),
    level: String(pick(competition, "level", "niveau") || ""),
    result: (pick(competition, "result", "classement") || null) as string | null,
    coachObjective: String(pick(competition, "coachObjective", "coach_objective") || ""),
    coachReview: String(pick(competition, "coachReview", "coach_review") || "")
  };
}

export function toCanonicalCombat(combat: SourceRecord = {}): Combat {
  return {
    combatId: String(pick(combat, "combatId", "id_combat") || ""),
    judokaId: String(pick(combat, "judokaId", "id_judoka") || ""),
    competitionId: String(pick(combat, "competitionId", "id_competition") || ""),
    opponent: String(pick(combat, "opponent", "adversaire") || ""),
    result: normalizeCanonicalCombatResult(pick(combat, "result", "resultat")),
    victoryType: String(pick(combat, "victoryType", "type_victoire") || ""),
    notes: String(pick(combat, "notes", "deroule") || "")
  };
}

export function toCombatReadModel(
  combat: SourceRecord = {},
  extra: Partial<CombatReadModel> = {}
): CombatReadModel {
  return {
    ...toCanonicalCombat(combat),
    judokaDisplayName: String(extra.judokaDisplayName || ""),
    ...extra
  };
}

export function toCombatReadModelsWithJudokas(
  combats: SourceRecord[] = [],
  judokas: Judoka[] = [],
  options: { formatJudokaDisplayName?: (judoka: Judoka) => string } = {}
): CombatReadModel[] {
  const formatJudokaDisplayName =
    options.formatJudokaDisplayName ||
    ((judoka: Judoka) => [judoka.firstName, judoka.lastName].filter(Boolean).join(" "));
  const judokasById = new Map(judokas.map((judoka) => [String(judoka.judokaId), judoka]));

  return combats.map((combat) => {
    const domainCombat = toCanonicalCombat(combat);
    const judoka = judokasById.get(String(domainCombat.judokaId));

    return toCombatReadModel(domainCombat, {
      judokaDisplayName: judoka ? formatJudokaDisplayName(judoka) : domainCombat.judokaId
    });
  });
}

export function toInvitationReadModel(invitation: SourceRecord = {}): AccessInvitation {
  return {
    email: String(pick(invitation, "email", "email") || ""),
    invitedProfileType: String(
      pick(invitation, "invitedProfileType", "invited_profile_type") || "JUDOKA"
    ) as AccessInvitation["invitedProfileType"],
    invitedBy: String(pick(invitation, "invitedBy", "invited_by") || ""),
    createdAt: String(pick(invitation, "createdAt", "created_at") || ""),
    updatedAt: String(pick(invitation, "updatedAt", "updated_at") || "")
  };
}
