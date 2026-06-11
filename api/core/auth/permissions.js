function isAdmin(user) {
  return String(user.role || "").toUpperCase().trim() === "ADMIN";
}

function isParent(user) {
  return String(user.profile_type || "").toUpperCase().trim() === "PARENT";
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
  if (isParent(user)) return (managedJudokaIds || []).includes(String(idJudoka));
  return String(user.id_judoka) === String(idJudoka);
}

function canManageCompetition(user, competition, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) return (managedJudokaIds || []).includes(String(competition.id_judoka));
  return String(user.id_judoka) === String(competition.id_judoka);
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
    if (!(managedJudokaIds || []).includes(String(ownerJudokaId))) {
      throw new Error("Ce judoka n'est pas dans votre liste.");
    }
    return ownerJudokaId;
  }

  return user.id_judoka;
}

module.exports = {
  assertCanManageChildrenProfile,
  canManageChildrenProfile,
  canManageCombatFor,
  canManageCompetition,
  isAdmin,
  isParent,
  resolveCompetitionOwnerId
};
