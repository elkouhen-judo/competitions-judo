import {
  createCompetitionDetailsDraft,
  type AgeCategory,
  type CompetitionInput
} from "./competition";
import { createJudokaId, createOptionalCompetitionId } from "../shared/identity";

export interface ClubCompetitionInput extends CompetitionInput {
  participantJudokaIds?: unknown[] | undefined;
  clubId?: unknown;
}

export interface ClubCompetitionModel {
  clubCompetitionId: string | null;
  name: string;
  competitionDate: string;
  ageCategory: AgeCategory;
  level: string;
  clubId: string;
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
      : []
  };
}
