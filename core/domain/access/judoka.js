const { createOptionalEmail } = require("./email");
const { createOptionalPersonName, createPersonName } = require("./person-name");
const { createProfileType } = require("./profile-type");
const { createRole } = require("./role");
const { createJudokaId } = require("../shared/identity");

function normalizeOptionalEmail(email) {
  return createOptionalEmail(email, "Email de l'enfant invalide.");
}

function createJudoka(user = {}) {
  const name = user.name || createOptionalPersonName(user);
  const judokaId = user.judokaId;
  const accountEmail = normalizeOptionalEmail(user.accountEmail);
  const profileType = createProfileType(user.profileType || "JUDOKA");
  const accessRole = createRole(user.accessRole || "NORMAL");
  const record = { judokaId, accountEmail, name, profileType, accessRole };

  return {
    ...record,
    hasDirectAccount() {
      return Boolean(record.accountEmail);
    },
    isAdmin() {
      return record.accessRole === "ADMIN";
    },
    grantAdminRole() {
      if (this.isAdmin()) {
        throw new Error("Cet utilisateur est déjà admin.");
      }

      return { accessRole: createRole("ADMIN") };
    },
    revokeAdminRole(actorIdJudoka) {
      if (!this.isAdmin()) {
        throw new Error("Admin introuvable.");
      }
      if (String(actorIdJudoka) === String(record.judokaId)) {
        throw new Error("Vous ne pouvez pas retirer vos propres droits admin.");
      }

      return { accessRole: createRole("NORMAL") };
    }
  };
}

function createManagedChild({ judokaId, accountEmail, name, firstName, lastName }) {
  const childName = name || createPersonName({ firstName, lastName });

  return createJudoka({
    judokaId: createJudokaId(judokaId),
    accountEmail,
    name: childName,
    profileType: "JUDOKA",
    accessRole: "NORMAL"
  });
}

function updateManagedChild({ accountEmail, name, firstName, lastName }) {
  const childName = name || createPersonName({ firstName, lastName });
  const normalizedAccountEmail = normalizeOptionalEmail(accountEmail);

  return {
    accountEmail: normalizedAccountEmail,
    name: childName
  };
}

function decideManagedChildRemoval({ child, hasCompetitions, hasCombats, hasOtherParentLink }) {
  const managedChild = createJudoka(child);

  if (hasCompetitions) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des compétitions.");
  }
  if (hasCombats) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des combats.");
  }

  const removeJudoka = !hasOtherParentLink && !managedChild.hasDirectAccount();
  return {
    removeJudoka,
    message: removeJudoka ? "Enfant supprimé." : "Enfant retiré."
  };
}

module.exports = {
  createJudoka,
  createManagedChild,
  decideManagedChildRemoval,
  updateManagedChild
};
