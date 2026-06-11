function toDomainJudoka(user = {}) {
  return {
    judokaId: user.judokaId !== undefined ? user.judokaId : user.id_judoka,
    accountEmail: user.accountEmail !== undefined ? user.accountEmail : user.email,
    firstName: user.firstName !== undefined ? user.firstName : user.prenom,
    lastName: user.lastName !== undefined ? user.lastName : user.nom,
    profileType: user.profileType !== undefined ? user.profileType : user.profile_type,
    accessRole: user.accessRole !== undefined ? user.accessRole : user.role
  };
}

function toDomainCompetition(competition = {}) {
  return {
    competitionId: competition.competitionId !== undefined ? competition.competitionId : competition.id_competition,
    ownerJudokaId: competition.ownerJudokaId !== undefined ? competition.ownerJudokaId : competition.id_judoka,
    name: competition.name !== undefined ? competition.name : competition.nom,
    competitionDate: competition.competitionDate !== undefined ? competition.competitionDate : competition.date,
    ageCategory: competition.ageCategory !== undefined ? competition.ageCategory : competition.categorie_age,
    weightCategory: competition.weightCategory !== undefined ? competition.weightCategory : competition.categorie_poids,
    seasonResult: competition.seasonResult !== undefined ? competition.seasonResult : competition.classement
  };
}

function toDomainCombat(combat = {}) {
  return {
    combatId: combat.combatId !== undefined ? combat.combatId : combat.id_combat,
    judokaId: combat.judokaId !== undefined ? combat.judokaId : combat.id_judoka,
    competitionId: combat.competitionId !== undefined ? combat.competitionId : combat.id_competition,
    opponent: combat.opponent !== undefined ? combat.opponent : combat.adversaire,
    result: combat.result !== undefined ? combat.result : combat.resultat,
    victoryType: combat.victoryType !== undefined ? combat.victoryType : combat.type_victoire,
    notes: combat.notes !== undefined ? combat.notes : combat.deroule
  };
}

function toDomainManagedChild(child = {}) {
  return {
    judokaId: child.judokaId !== undefined ? child.judokaId : child.id_judoka,
    accountEmail: child.accountEmail !== undefined ? child.accountEmail : child.email,
    firstName: child.firstName !== undefined ? child.firstName : child.prenom,
    lastName: child.lastName !== undefined ? child.lastName : child.nom
  };
}

function toJudokaReadModel(user = {}) {
  return toDomainJudoka(user);
}

function toCompetitionReadModel(competition = {}) {
  return toDomainCompetition(competition);
}

function toCombatReadModel(combat = {}, extra = {}) {
  return {
    ...toDomainCombat(combat),
    ...extra
  };
}

function toCombatReadModelsWithJudokas(combats = [], judokas = [], options = {}) {
  const formatJudokaDisplayName = options.formatJudokaDisplayName || (judoka => {
    return [judoka.firstName, judoka.lastName].filter(Boolean).join(" ");
  });
  const judokasById = new Map(judokas.map(judoka => [String(judoka.judokaId), judoka]));

  return combats.map(combat => {
    const domainCombat = toDomainCombat(combat);
    const judoka = judokasById.get(String(domainCombat.judokaId));
    return toCombatReadModel(domainCombat, {
      judokaDisplayName: judoka ? formatJudokaDisplayName(judoka) : domainCombat.judokaId
    });
  });
}

function toInvitationReadModel(invitation = {}) {
  return {
    email: invitation.email,
    invitedProfileType: invitation.invitedProfileType !== undefined
      ? invitation.invitedProfileType
      : invitation.invited_profile_type,
    invitedBy: invitation.invitedBy !== undefined ? invitation.invitedBy : invitation.invited_by,
    createdAt: invitation.createdAt !== undefined ? invitation.createdAt : invitation.created_at,
    updatedAt: invitation.updatedAt !== undefined ? invitation.updatedAt : invitation.updated_at
  };
}

module.exports = {
  toDomainCombat,
  toDomainCompetition,
  toDomainJudoka,
  toDomainManagedChild,
  toCombatReadModel,
  toCombatReadModelsWithJudokas,
  toCompetitionReadModel,
  toInvitationReadModel,
  toJudokaReadModel
};
