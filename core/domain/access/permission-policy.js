const { isParentProfileType } = require("./profile-type");
const { isAdminRole } = require("./role");

function isAdmin(user) {
  return isAdminRole(user && user.role);
}

function isParent(user) {
  return isParentProfileType(user && user.profile_type);
}

function canManageChildrenProfile(user) {
  return isParent(user);
}

function assertCanManageChildrenProfile(user) {
  if (!canManageChildrenProfile(user)) {
    throw new Error("Gestion des enfants non disponible pour ce profil.");
  }
}

function canManageCombatFor(user, idJudoka, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    if (managedJudokaIds && typeof managedJudokaIds.includes === "function") {
      return managedJudokaIds.includes(idJudoka);
    }
    return (managedJudokaIds || []).includes(String(idJudoka));
  }
  return String(user.id_judoka) === String(idJudoka);
}

function canManageCompetition(user, competition, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    if (managedJudokaIds && typeof managedJudokaIds.includes === "function") {
      return managedJudokaIds.includes(competition.ownerJudokaId || competition.id_judoka);
    }
    return (managedJudokaIds || []).includes(String(competition.ownerJudokaId || competition.id_judoka));
  }
  return String(user.id_judoka) === String(competition.ownerJudokaId || competition.id_judoka);
}

function canAccessJudokaProfile(user, idJudoka, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) {
    if (managedJudokaIds && typeof managedJudokaIds.includes === "function") {
      return managedJudokaIds.includes(idJudoka);
    }
    return (managedJudokaIds || []).includes(String(idJudoka));
  }
  return String(user.id_judoka) === String(idJudoka);
}

function assertCanAccessJudokaProfile(user, idJudoka, managedJudokaIds) {
  if (!canAccessJudokaProfile(user, idJudoka, managedJudokaIds)) {
    throw new Error("Accès refusé à cette fiche judoka.");
  }
}

function resolveCompetitionOwnerId(user, competition, managedJudokaIds) {
  if (isAdmin(user)) {
    const ownerJudokaId = competition.id_judoka;
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    return ownerJudokaId;
  }

  if (isParent(user)) {
    const ownerJudokaId = competition.id_judoka;
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    const inScope = managedJudokaIds && typeof managedJudokaIds.includes === "function"
      ? managedJudokaIds.includes(ownerJudokaId)
      : (managedJudokaIds || []).includes(String(ownerJudokaId));
    if (!inScope) {
      throw new Error("Ce judoka n'est pas dans votre liste.");
    }
    return ownerJudokaId;
  }

  return user.id_judoka;
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
