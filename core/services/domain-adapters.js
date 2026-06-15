const { normalizeCombatResult } = require("../domain/competitions/combat-result");

function pick(source, camelKey, snakeKey) {
  return source[camelKey] !== undefined ? source[camelKey] : source[snakeKey];
}

function toCanonicalJudoka(user = {}) {
  return {
    judokaId: pick(user, "judokaId", "id_judoka"),
    accountEmail: pick(user, "accountEmail", "email"),
    firstName: pick(user, "firstName", "prenom"),
    lastName: pick(user, "lastName", "nom"),
    profileType: pick(user, "profileType", "profile_type"),
    accessRole: pick(user, "accessRole", "role")
  };
}

function toCanonicalCompetition(competition = {}) {
  return {
    competitionId: pick(competition, "competitionId", "id_competition"),
    clubCompetitionId: pick(competition, "clubCompetitionId", "club_competition_id"),
    ownerJudokaId: pick(competition, "ownerJudokaId", "id_judoka"),
    name: pick(competition, "name", "nom"),
    competitionDate: pick(competition, "competitionDate", "date"),
    ageCategory: pick(competition, "ageCategory", "categorie_age"),
    weightCategory: pick(competition, "weightCategory", "categorie_poids"),
    result: pick(competition, "result", "classement")
  };
}

function toCanonicalCombat(combat = {}) {
  const rawResult = pick(combat, "result", "resultat");
  const normalizedResult = normalizeCombatResult(rawResult);
  return {
    combatId: pick(combat, "combatId", "id_combat"),
    judokaId: pick(combat, "judokaId", "id_judoka"),
    competitionId: pick(combat, "competitionId", "id_competition"),
    opponent: pick(combat, "opponent", "adversaire"),
    result: normalizedResult || (rawResult === "Disqualification" ? "Défaite" : rawResult),
    victoryType: pick(combat, "victoryType", "type_victoire"),
    notes: pick(combat, "notes", "deroule")
  };
}

function toCanonicalManagedChild(child = {}) {
  return {
    judokaId: pick(child, "judokaId", "id_judoka"),
    accountEmail: pick(child, "accountEmail", "email"),
    firstName: pick(child, "firstName", "prenom"),
    lastName: pick(child, "lastName", "nom")
  };
}

function toCombatReadModel(combat = {}, extra = {}) {
  return {
    ...toCanonicalCombat(combat),
    ...extra
  };
}

function toCombatReadModelsWithJudokas(combats = [], judokas = [], options = {}) {
  const formatJudokaDisplayName = options.formatJudokaDisplayName || (judoka => {
    return [judoka.firstName, judoka.lastName].filter(Boolean).join(" ");
  });
  const judokasById = new Map(judokas.map(judoka => [String(judoka.judokaId), judoka]));

  return combats.map(combat => {
    const domainCombat = toCanonicalCombat(combat);
    const judoka = judokasById.get(String(domainCombat.judokaId));
    return toCombatReadModel(domainCombat, {
      judokaDisplayName: judoka ? formatJudokaDisplayName(judoka) : domainCombat.judokaId
    });
  });
}

function toInvitationReadModel(invitation = {}) {
  return {
    email: invitation.email,
    invitedProfileType: pick(invitation, "invitedProfileType", "invited_profile_type"),
    invitedBy: pick(invitation, "invitedBy", "invited_by"),
    createdAt: pick(invitation, "createdAt", "created_at"),
    updatedAt: pick(invitation, "updatedAt", "updated_at")
  };
}

module.exports = {
  toCanonicalCombat,
  toCanonicalCompetition,
  toCanonicalJudoka,
  toCanonicalManagedChild,
  toCombatReadModel,
  toCombatReadModelsWithJudokas,
  toInvitationReadModel
};
