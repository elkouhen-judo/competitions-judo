import { randomUUID } from "node:crypto";

export function buildJudokaId(): string {
  return `JUDO${randomUUID().replace(/-/g, "")}`;
}

export function buildClubId(): string {
  return `CLUB${randomUUID().replace(/-/g, "")}`;
}

// Identifiant aléatoire : plusieurs participations sont créées dans la même milliseconde (ECRIT-3).
export function buildCompetitionId(): string {
  return `COMP${randomUUID().replace(/-/g, "")}`;
}

export function buildCombatId(): string {
  return `CB${Date.now()}`;
}
