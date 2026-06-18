import {
  createCompetitionDetailsDraft,
  type AgeCategory,
  type CompetitionInput
} from "./competition";
import { createJudokaId, createOptionalCompetitionId } from "../shared/identity";

export interface ClubCompetitionInput extends CompetitionInput {
  participantJudokaIds?: unknown[] | undefined;
}

export interface ClubCompetitionModel {
  clubCompetitionId: string | null;
  name: string;
  competitionDate: string;
  ageCategory: AgeCategory;
  weightCategory: string;
  participantJudokaIds: string[];
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
    ageCategory: details.ageCategory,
    weightCategory: details.weightCategory,
    participantJudokaIds: event.participantJudokaIds
      ? createClubCompetitionParticipantIds(event.participantJudokaIds)
      : []
  };
}
