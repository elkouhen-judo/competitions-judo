const { createOptionalEmail } = require("./email");
const { createProfileType } = require("./profile-type");
const { createRole } = require("./role");

function assertManagedChildName(prenom, nom) {
  if (!prenom || !nom) {
    throw new Error("Prénom et nom de l'enfant obligatoires.");
  }
}

function normalizeOptionalEmail(email) {
  return createOptionalEmail(email, "Email de l'enfant invalide.");
}

function createJudoka(user = {}) {
  const record = {
    id_judoka: user.id_judoka,
    email: normalizeOptionalEmail(user.email),
    prenom: user.prenom,
    nom: user.nom,
    profile_type: createProfileType(user.profile_type || "JUDOKA"),
    role: createRole(user.role || "NORMAL")
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
  assertManagedChildName(prenom, nom);

  return createJudoka({
    id_judoka,
    email,
    prenom,
    nom,
    profile_type: "JUDOKA",
    role: "NORMAL"
  });
}

function updateManagedChild({ email, prenom, nom }) {
  assertManagedChildName(prenom, nom);

  return {
    email: normalizeOptionalEmail(email),
    prenom,
    nom
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
