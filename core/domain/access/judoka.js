const { createProfileType } = require("./profile-type");
const { createRole } = require("./role");

function assertManagedChildName(prenom, nom) {
  if (!prenom || !nom) {
    throw new Error("Prénom et nom de l'enfant obligatoires.");
  }
}

function createManagedChildRecord({ id_judoka, email, prenom, nom }) {
  assertManagedChildName(prenom, nom);

  return {
    id_judoka,
    email: email || null,
    prenom,
    nom,
    profile_type: createProfileType("JUDOKA"),
    role: createRole("NORMAL")
  };
}

function updateManagedChildRecord({ email, prenom, nom }) {
  assertManagedChildName(prenom, nom);

  return {
    email: email || null,
    prenom,
    nom
  };
}

module.exports = {
  createManagedChildRecord,
  updateManagedChildRecord
};
