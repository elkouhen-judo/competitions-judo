const { isParentProfileType } = require("./profile-type");
const { isAdminRole } = require("./role");

function isAdmin(user) {
  return isAdminRole(user && user.accessRole);
}

function isParent(user) {
  return isParentProfileType(user && user.profileType);
}

function canManageChildrenProfile(user) {
  return isParent(user);
}

function assertCanManageChildrenProfile(user) {
  if (!canManageChildrenProfile(user)) {
    throw new Error("Gestion des enfants non disponible pour ce profil.");
  }
}

function getUserJudokaId(user) {
  return user && user.judokaId;
}

function getCompetitionOwnerJudokaId(competition) {
  return competition && competition.ownerJudokaId;
}

function isInManagedScope(managedJudokaScope, idJudoka) {
  return Boolean(managedJudokaScope && managedJudokaScope.includes(idJudoka));
}

function canManageCombatFor(user, idJudoka, managedJudokaScope) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, idJudoka);
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

function canManageCompetition(user, competition, managedJudokaScope) {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, ownerJudokaId);
  }
  return String(getUserJudokaId(user)) === String(ownerJudokaId);
}

function canAccessJudokaProfile(user, idJudoka, managedJudokaScope) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, idJudoka);
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

function assertCanAccessJudokaProfile(user, idJudoka, managedJudokaScope) {
  if (!canAccessJudokaProfile(user, idJudoka, managedJudokaScope)) {
    throw new Error("Accès refusé à cette fiche judoka.");
  }
}

function resolveCompetitionOwnerId(user, competition, managedJudokaScope) {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);

  if (isAdmin(user)) {
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    return ownerJudokaId;
  }

  if (isParent(user)) {
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    if (!isInManagedScope(managedJudokaScope, ownerJudokaId)) {
      throw new Error("Ce judoka n'est pas dans votre liste.");
    }
    return ownerJudokaId;
  }

  return getUserJudokaId(user);
}

module.exports = {
  assertCanAccessJudokaProfile,
  assertCanManageChildrenProfile,
  canAccessJudokaProfile,
  canManageChildrenProfile,
  canManageCombatFor,
  canManageCompetition,
  isAdmin,
  isParent,
  resolveCompetitionOwnerId
};
