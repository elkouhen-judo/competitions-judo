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
  const judokaId = user.judokaId || user.id_judoka;
  const accountEmail = normalizeOptionalEmail(user.accountEmail || user.email);
  const profileType = createProfileType(user.profileType || user.profile_type || "JUDOKA");
  const accessRole = createRole(user.accessRole || user.role || "NORMAL");
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

function createManagedChild({ judokaId, id_judoka, accountEmail, email, name, firstName, lastName, prenom, nom }) {
  const childName = name || createPersonName({ firstName, lastName, prenom, nom });

  return createJudoka({
    judokaId: createJudokaId(judokaId || id_judoka),
    accountEmail: accountEmail !== undefined ? accountEmail : email,
    name: childName,
    profileType: "JUDOKA",
    accessRole: "NORMAL"
  });
}

function updateManagedChild({ accountEmail, email, name, firstName, lastName, prenom, nom }) {
  const childName = name || createPersonName({ firstName, lastName, prenom, nom });
  const normalizedAccountEmail = normalizeOptionalEmail(accountEmail !== undefined ? accountEmail : email);

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
