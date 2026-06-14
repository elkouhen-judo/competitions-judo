const { isParentProfileType } = require("./profile-type");
const { isAdminRole, isCoachRole } = require("./role");

function isAdmin(user) {
  return isAdminRole(user && user.accessRole);
}

function isCoach(user) {
  return isCoachRole(user && user.accessRole);
}

function hasClubReadAccess(user) {
  return isAdmin(user) || isCoach(user);
}

function isParent(user) {
  return isParentProfileType(user && user.profileType);
}

function canManageChildrenProfile(user) {
  return isParent(user);
}

function canManageClubCompetition(user) {
  return isAdmin(user) || isCoach(user);
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

function createAccessScope(kind, options = {}) {
  const judokaId = options.judokaId || "";
  const managedJudokaScope = options.managedJudokaScope;

  return {
    kind,
    judokaId,
    managedJudokaScope,
    isAll() {
      return kind === "ALL";
    },
    isManaged() {
      return kind === "MANAGED";
    },
    isOwn() {
      return kind === "OWN";
    },
    canManageJudoka(targetJudokaId) {
      if (this.isAll()) return true;
      if (this.isManaged()) return isInManagedScope(managedJudokaScope, targetJudokaId);
      return String(judokaId) === String(targetJudokaId);
    },
    canManageCompetition(competition) {
      return this.canManageJudoka(getCompetitionOwnerJudokaId(competition));
    },
    visibleJudokaIds() {
      if (this.isAll()) return null;
      if (this.isManaged()) return managedJudokaScope ? managedJudokaScope.toIds() : [];
      return [judokaId];
    }
  };
}

function resolveJudokaDataAccess(user, managedJudokaScope) {
  if (hasClubReadAccess(user)) {
    return createAccessScope("ALL");
  }

  if (isParent(user)) {
    return createAccessScope("MANAGED", { managedJudokaScope });
  }

  return createAccessScope("OWN", { judokaId: getUserJudokaId(user) });
}

function canManageCombatFor(user, idJudoka, managedJudokaScope) {
  if (isAdmin(user) || isCoach(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, idJudoka);
  }
  return String(getUserJudokaId(user)) === String(idJudoka);
}

function assertCanManageCombatFor(user, idJudoka, managedJudokaScope, message) {
  if (!canManageCombatFor(user, idJudoka, managedJudokaScope)) {
    throw new Error(message);
  }
}

function canManageCompetition(user, competition, managedJudokaScope) {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);
  if (isAdmin(user) || isCoach(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, ownerJudokaId);
  }
  return String(getUserJudokaId(user)) === String(ownerJudokaId);
}

function assertCanManageCompetition(user, competition, managedJudokaScope, message) {
  if (!canManageCompetition(user, competition, managedJudokaScope)) {
    throw new Error(message);
  }
}

function canAccessJudokaProfile(user, idJudoka, managedJudokaScope) {
  if (hasClubReadAccess(user)) return true;
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

function canAccessCompetition(user, competition, managedJudokaScope) {
  const ownerJudokaId = getCompetitionOwnerJudokaId(competition);
  if (hasClubReadAccess(user)) return true;
  if (isParent(user)) {
    return isInManagedScope(managedJudokaScope, ownerJudokaId);
  }
  return String(getUserJudokaId(user)) === String(ownerJudokaId);
}

function assertCanAccessCompetition(user, competition, managedJudokaScope, message) {
  if (!canAccessCompetition(user, competition, managedJudokaScope)) {
    throw new Error(message);
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
  assertCanAccessCompetition,
  assertCanManageChildrenProfile,
  assertCanManageCombatFor,
  assertCanManageCompetition,
  canAccessCompetition,
  canAccessJudokaProfile,
  canManageChildrenProfile,
  canManageClubCompetition,
  canManageCombatFor,
  canManageCompetition,
  createAccessScope,
  hasClubReadAccess,
  isAdmin,
  isCoach,
  isParent,
  resolveJudokaDataAccess,
  resolveCompetitionOwnerId
};
