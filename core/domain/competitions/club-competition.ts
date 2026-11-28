import {
  createCompetitionDetailsDraft,
  type AgeCategory,
  type CompetitionInput
} from "./competition";
import { createJudokaId, createOptionalCompetitionId } from "../shared/identity";

export interface ClubCompetitionInput extends CompetitionInput {
  participantJudokaIds?: unknown[] | undefined;
  clubId?: unknown;
  /** CONV-001 : lieu, date limite de réponse et message du coach, tous facultatifs. */
  place?: unknown;
  responseDeadline?: unknown;
  convocationMessage?: unknown;
}

export interface ClubCompetitionModel {
  clubCompetitionId: string | null;
  name: string;
  competitionDate: string;
  ageCategory: AgeCategory;
  level: string;
  clubId: string;
  participantJudokaIds: string[];
  place: string;
  /** "" sans date limite. */
  responseDeadline: string;
  convocationMessage: string;
}

export const CONVOCATION_PLACE_MAX_LENGTH = 200;
export const CONVOCATION_MESSAGE_MAX_LENGTH = 1000;

function createConvocationText(value: unknown, maxLength: number, label: string): string {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) {
    throw new Error(`${label} : ${maxLength} caractères au plus.`);
  }
  return text;
}

// CONV-001 : la date limite de réponse tombe au plus tard le jour de la compétition.
export function createResponseDeadline(value: unknown, competitionDate: string): string {
  const deadline = String(value ?? "").trim();
  if (!deadline) {
    return "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(new Date(`${deadline}T00:00:00Z`).getTime())) {
    throw new Error("Date limite de réponse invalide.");
  }
  if (deadline > competitionDate) {
    throw new Error("La date limite de réponse doit tomber au plus tard le jour de la compétition.");
  }
  return deadline;
}

export function createClubCompetitionParticipantIds(values: unknown[] | undefined): string[] {
  const ids = [
    ...new Set(
      (values || []).map((value) => createJudokaId(value, "Judoka participant obligatoire."))
    )
  ];
  if (!ids.length) {
    throw new Error("Au moins un judoka doit être sélectionné.");
  }
  return ids;
}

export function createClubCompetition(event: ClubCompetitionInput = {}): ClubCompetitionModel {
  const details = createCompetitionDetailsDraft(event);
  if (!details.level) {
    throw new Error("Niveau de compétition obligatoire.");
  }
  return {
    clubCompetitionId: createOptionalCompetitionId(event.clubCompetitionId),
    name: details.name,
    competitionDate: details.competitionDate,
    ageCategory: details.ageCategory,
    level: details.level,
    clubId: String(event.clubId || "").trim(),
    participantJudokaIds: event.participantJudokaIds
      ? createClubCompetitionParticipantIds(event.participantJudokaIds)
      : [],
    place: createConvocationText(event.place, CONVOCATION_PLACE_MAX_LENGTH, "Lieu"),
    responseDeadline: createResponseDeadline(event.responseDeadline, details.competitionDate),
    convocationMessage: createConvocationText(
      event.convocationMessage,
      CONVOCATION_MESSAGE_MAX_LENGTH,
      "Message du coach"
    )
  };
}
