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

function canManageCombatFor(user, idJudoka, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    if (managedJudokaIds && typeof managedJudokaIds.includes === "function") {
      return managedJudokaIds.includes(idJudoka);
    }
    return (managedJudokaIds || []).includes(String(idJudoka));
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

function canManageCompetition(user, competition, managedJudokaIds) {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    if (managedJudokaIds && typeof managedJudokaIds.includes === "function") {
      return managedJudokaIds.includes(ownerJudokaId);
    }
    return (managedJudokaIds || []).includes(String(ownerJudokaId));
  }
  return String(getUserJudokaId(user)) === String(ownerJudokaId);
}

function canAccessJudokaProfile(user, idJudoka, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    if (managedJudokaIds && typeof managedJudokaIds.includes === "function") {
      return managedJudokaIds.includes(idJudoka);
    }
    return (managedJudokaIds || []).includes(String(idJudoka));
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

function assertCanAccessJudokaProfile(user, idJudoka, managedJudokaIds) {
  if (!canAccessJudokaProfile(user, idJudoka, managedJudokaIds)) {
    throw new Error("Accès refusé à cette fiche judoka.");
  }
}

function resolveCompetitionOwnerId(user, competition, managedJudokaIds) {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);

  if (isAdmin(user)) {
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    return ownerJudokaId;
  }

  if (isParent(user)) {
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    const inScope = managedJudokaIds && typeof managedJudokaIds.includes === "function"
      ? managedJudokaIds.includes(ownerJudokaId)
      : (managedJudokaIds || []).includes(String(ownerJudokaId));
    if (!inScope) {
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
