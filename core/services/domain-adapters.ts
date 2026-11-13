import { normalizeCombatResult } from "../domain/competitions/combat-result";
import { isEmptyCombatOfficialScore } from "../domain/competitions/combat-official-score";
import { normalizeBeltColor } from "../domain/access/belt-color";
import type {
  AccessInvitation,
  Combat,
  CombatOfficialScore,
  CombatReadModel,
  CombatScore,
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
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
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
    beltColor: normalizeBeltColor(pick(user, "beltColor", "couleur_ceinture")),
    gender: String(pick(user, "gender", "genre") || ""),
    yearInCategory: String(pick(user, "yearInCategory", "annee_categorie") || ""),
    handedness: String(pick(user, "handedness", "lateralite") || ""),
    clubId: String(pick(user, "clubId", "club_id") || ""),
    adminAccess: pick(user, "adminAccess", "is_admin") === true
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

export function toCanonicalCombatScore(score: SourceRecord = {}): CombatScore {
  const canonical: CombatScore = {
    category: String(pick(score, "category", "categorie") || ""),
    technique: String(pick(score, "technique", "technique") || ""),
    neWazaType: String(pick(score, "neWazaType", "type_ne_waza") || ""),
    value: String(pick(score, "value", "valeur") || "")
  };
  const order = pick(score, "order", "ordre");
  if (order !== undefined && order !== null && order !== "") {
    canonical.order = Number(order);
  }
  return canonical;
}

function toCanonicalOfficialScore(combat: SourceRecord): CombatOfficialScore | null {
  const official = pick<CombatOfficialScore | null>(combat, "officialScore", "officialScore");
  if (official !== undefined) {
    return official && typeof official === "object" ? official : null;
  }
  const record = combat as Record<string, unknown>;
  const columns = [
    "score_judoka_ippon",
    "score_judoka_wazaari",
    "score_judoka_yuko",
    "score_adversaire_ippon",
    "score_adversaire_wazaari",
    "score_adversaire_yuko",
    "score_judoka_shido",
    "score_adversaire_shido"
  ];
  // Une ligne lue par l'API REST porte "" à la place de null : un score absent reste absent.
  if (columns.every((column) => record[column] === null || record[column] === undefined || record[column] === "")) {
    return null;
  }
  const [ji, jw, jy, ai, aw, ay, js, os] = columns.map((column) => Number(record[column] || 0));
  const score = {
    judoka: { ippon: ji, wazaAri: jw, yuko: jy, shido: js },
    opponent: { ippon: ai, wazaAri: aw, yuko: ay, shido: os }
  };
  // SCORE-VIDE : un score entièrement nul enregistré par erreur reste « non renseigné ».
  return isEmptyCombatOfficialScore(score) ? null : score;
}

export function toCanonicalCombat(combat: SourceRecord = {}): Combat {
  const rawScores = pick<SourceRecord[]>(combat, "scores", "scores");
  const rawConcededScores = pick<SourceRecord[]>(combat, "concededScores", "concededScores");

  return {
    combatId: String(pick(combat, "combatId", "id_combat") || ""),
    judokaId: String(pick(combat, "judokaId", "id_judoka") || ""),
    competitionId: String(pick(combat, "competitionId", "id_competition") || ""),
    opponent: String(pick(combat, "opponent", "adversaire") || ""),
    opponentStance: String(pick(combat, "opponentStance", "garde_adversaire") || ""),
    stage: String(pick(combat, "stage", "etape") || ""),
    result: normalizeCanonicalCombatResult(pick(combat, "result", "resultat")),
    victoryType: String(pick(combat, "victoryType", "type_victoire") || ""),
    scores: Array.isArray(rawScores) ? rawScores.map(toCanonicalCombatScore) : [],
    concededScores: Array.isArray(rawConcededScores) ? rawConcededScores.map(toCanonicalCombatScore) : [],
    officialScore: toCanonicalOfficialScore(combat),
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
      judokaDisplayName: judoka ? formatJudokaDisplayName(judoka) : domainCombat.judokaId,
      judokaHandedness: judoka?.handedness || ""
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
