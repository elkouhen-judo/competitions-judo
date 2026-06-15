const { createCompetitionAgeCategory, createCompetitionDetailsDraft } = require("./competition");
const { createJudokaId, createOptionalCompetitionId } = require("../shared/identity");

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createClubCompetitionParticipantIds(values) {
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

function createClubCompetition(event = {}) {
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

module.exports = {
  createClubCompetition,
  createClubCompetitionParticipantIds
};
