const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../api/core/domain/access/permission-policy");
const { createManagedChildRecord, updateManagedChildRecord } = require("../api/core/domain/access/judoka");
const { createAccessInvitationRecord } = require("../api/core/domain/access/access-invitation");
const { toCompetitionRecord } = require("../api/core/domain/competitions/competition");
const { createCombatRecord, updateCombatRecord } = require("../api/core/domain/competitions/combat");

test("permission policy derives access from immutable profile type and role", () => {
  assert.equal(permissions.isParent({ profile_type: "PARENT", role: "NORMAL" }), true);
  assert.equal(permissions.isAdmin({ profile_type: "JUDOKA", role: "ADMIN" }), true);
  assert.equal(permissions.canManageChildrenProfile({ profile_type: "JUDOKA", role: "ADMIN" }), false);
});

test("judoka domain creates and updates managed child records with invariants", () => {
  assert.deepEqual(
    createManagedChildRecord({
      id_judoka: "JUDO123",
      email: "child@example.com",
      prenom: "Aya",
      nom: "Martin"
    }),
    {
      id_judoka: "JUDO123",
      email: "child@example.com",
      prenom: "Aya",
      nom: "Martin",
      profile_type: "JUDOKA",
      role: "NORMAL"
    }
  );

  assert.deepEqual(
    updateManagedChildRecord({
      email: "",
      prenom: "Aya",
      nom: "Martin"
    }),
    {
      email: null,
      prenom: "Aya",
      nom: "Martin"
    }
  );

  assert.throws(() => createManagedChildRecord({ prenom: "", nom: "Martin" }), /Prénom et nom/);
});

test("access invitation domain normalizes invited profile type", () => {
  assert.deepEqual(
    createAccessInvitationRecord({
      email: "parent@example.com",
      invited_profile_type: "parent",
      invited_by: "JUDOADMIN"
    }),
    {
      email: "parent@example.com",
      invited_profile_type: "PARENT",
      invited_by: "JUDOADMIN"
    }
  );

  assert.throws(
    () => createAccessInvitationRecord({ email: "x@example.com", invited_profile_type: "coach" }),
    /Type de profil invalide/
  );
});

test("competition domain builds a normalized record", () => {
  assert.deepEqual(
    toCompetitionRecord(
      {
        nom: "Tournoi regional",
        date: "2026-06-11",
        categorie_age: "Cadet",
        categorie_poids: "-55 kg",
        classement: "3e"
      },
      "JUDO123"
    ),
    {
      id_judoka: "JUDO123",
      nom: "Tournoi regional",
      date: "2026-06-11",
      categorie_age: "Cadet",
      categorie_poids: "-55 kg",
      classement: "3e"
    }
  );

  assert.throws(() => toCompetitionRecord({ nom: "", date: "" }, "JUDO123"), /Nom et date obligatoires/);
});

test("combat domain enforces allowed results and required identifiers", () => {
  assert.deepEqual(
    createCombatRecord(
      {
        id_judoka: "JUDO123",
        id_competition: "COMP123",
        adversaire: "Lee",
        resultat: "v",
        type_victoire: "Ippon",
        deroule: "Bon rythme"
      },
      () => "CB123"
    ),
    {
      id_combat: "CB123",
      id_judoka: "JUDO123",
      id_competition: "COMP123",
      adversaire: "Lee",
      resultat: "V",
      type_victoire: "Ippon",
      deroule: "Bon rythme"
    }
  );

  assert.deepEqual(
    updateCombatRecord({
      id_combat: "CB123",
      id_judoka: "JUDO123",
      id_competition: "COMP123",
      resultat: "D"
    }),
    {
      id_judoka: "JUDO123",
      id_competition: "COMP123",
      adversaire: "",
      resultat: "D",
      type_victoire: "",
      deroule: ""
    }
  );

  assert.throws(
    () => createCombatRecord({ id_judoka: "JUDO123", id_competition: "COMP123", resultat: "X" }, () => "CBX"),
    /Résultat invalide/
  );
});
