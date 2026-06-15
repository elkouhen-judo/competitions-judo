import { randomUUID } from "node:crypto";

export function buildJudokaId(): string {
  return `JUDO${randomUUID().replace(/-/g, "")}`;
}

export function buildCompetitionId(): string {
  return `COMP${Date.now()}`;
}

export function buildCombatId(): string {
  return `CB${Date.now()}`;
}
