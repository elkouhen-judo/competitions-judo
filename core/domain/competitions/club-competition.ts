import {
  createCompetitionAgeCategory,
  createCompetitionDetailsDraft,
  type AgeCategory,
  type CompetitionInput
} from "./competition";
import { createJudokaId, createOptionalCompetitionId } from "../shared/identity";

export interface ClubCompetitionInput extends CompetitionInput {
  participantJudokaIds?: unknown[];
}

export interface ClubCompetitionModel {
  clubCompetitionId: string | null;
  name: string;
  competitionDate: string;
  ageCategory: AgeCategory | "";
  weightCategory: string;
  participantJudokaIds: string[];
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  return {
    clubCompetitionId: createOptionalCompetitionId(event.clubCompetitionId),
    name: details.name,
    competitionDate: details.competitionDate,
    ageCategory: createCompetitionAgeCategory(details.ageCategory),
    weightCategory: cleanText(details.weightCategory),
    participantJudokaIds: event.participantJudokaIds
      ? createClubCompetitionParticipantIds(event.participantJudokaIds)
      : []
  };
}
