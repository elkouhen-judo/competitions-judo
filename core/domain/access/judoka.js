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
  const record = {
    judokaId,
    accountEmail,
    name,
    profileType,
    accessRole,
    id_judoka: judokaId,
    email: accountEmail,
    prenom: name.firstName,
    nom: name.lastName,
    profile_type: profileType,
    role: accessRole
  };

  return {
    ...record,
    hasDirectAccount() {
      return Boolean(record.email);
    },
    isAdmin() {
      return record.role === "ADMIN";
    },
    grantAdminRole() {
      if (this.isAdmin()) {
        throw new Error("Cet utilisateur est déjà admin.");
      }

      return { role: createRole("ADMIN") };
    },
    revokeAdminRole(actorIdJudoka) {
      if (!this.isAdmin()) {
        throw new Error("Admin introuvable.");
      }
      if (String(actorIdJudoka) === String(record.id_judoka)) {
        throw new Error("Vous ne pouvez pas retirer vos propres droits admin.");
      }

      return { role: createRole("NORMAL") };
    }
  };
}

function createManagedChild({ id_judoka, email, prenom, nom }) {
  const name = createPersonName({ prenom, nom });

  return createJudoka({
    id_judoka: createJudokaId(id_judoka),
    email,
    name,
    profile_type: "JUDOKA",
    role: "NORMAL"
  });
}

function updateManagedChild({ email, prenom, nom }) {
  const name = createPersonName({ prenom, nom });
  const accountEmail = normalizeOptionalEmail(email);

  return {
    email: accountEmail,
    accountEmail,
    name,
    prenom: name.firstName,
    nom: name.lastName
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
