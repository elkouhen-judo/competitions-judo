import { randomUUID } from "node:crypto";

export function buildJudokaId() {
  return `JUDO${randomUUID().replace(/-/g, "")}`;
}

export function buildCompetitionId() {
  return `COMP${Date.now()}`;
}

export function buildCombatId() {
  return `CB${Date.now()}`;
}
