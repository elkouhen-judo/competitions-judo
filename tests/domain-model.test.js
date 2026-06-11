const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../core/domain/access/permission-policy");
const {
  createJudoka,
  createManagedChild,
  decideManagedChildRemoval,
  updateManagedChild
} = require("../core/domain/access/judoka");
const { createEmail, createOptionalEmail } = require("../core/domain/access/email");
const { createAccessInvitation } = require("../core/domain/access/access-invitation");
const {
  assertCompetitionCanContainCombat,
  createCompetition
} = require("../core/domain/competitions/competition");
const { createCombat, updateCombat } = require("../core/domain/competitions/combat");
const { buildJudokaProfileSnapshot } = require("../core/domain/season-statistics");

test("permission policy derives access from immutable profile type and role", () => {
  assert.equal(permissions.isParent({ profile_type: "PARENT", role: "NORMAL" }), true);
  assert.equal(permissions.isAdmin({ profile_type: "JUDOKA", role: "ADMIN" }), true);
  assert.equal(permissions.canManageChildrenProfile({ profile_type: "JUDOKA", role: "ADMIN" }), false);
  assert.doesNotThrow(() => permissions.assertCanAccessJudokaProfile(
    { id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" },
    "CHILD1",
    ["PARENT1", "CHILD1"]
  ));
  assert.throws(() => permissions.assertCanAccessJudokaProfile(
    { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" },
    "OTHER",
    []
  ), /Accès refusé/);
});

test("email value object normalizes and validates addresses", () => {
  assert.equal(createEmail(" User@Example.COM "), "user@example.com");
  assert.equal(createOptionalEmail(""), null);
  assert.throws(() => createEmail("not-an-email"), /Email invalide/);
  assert.throws(() => createEmail("", "Email invalide.", "Email obligatoire."), /Email obligatoire/);
  assert.throws(() => createOptionalEmail("child@", "Email de l'enfant invalide."), /Email de l'enfant invalide/);
});

test("judoka domain creates and updates managed child records with invariants", () => {
  const child = createManagedChild({
    id_judoka: "JUDO123",
    email: "child@example.com",
    prenom: "Aya",
    nom: "Martin"
  });

  assert.equal(child.hasDirectAccount(), true);

  assert.equal(child.id_judoka, "JUDO123");
  assert.equal(child.email, "child@example.com");
  assert.equal(child.profile_type, "JUDOKA");
  assert.equal(child.role, "NORMAL");

  const updatedChild = updateManagedChild({
    email: "",
    prenom: "Aya",
    nom: "Martin"
  });

  assert.deepEqual(updatedChild, {
    email: null,
    prenom: "Aya",
    nom: "Martin"
  });

  assert.throws(() => createManagedChild({ prenom: "", nom: "Martin" }), /Prénom et nom/);
});

test("judoka domain handles admin role lifecycle and child removal decisions", () => {
  const admin = createJudoka({
    id_judoka: "JUDOADMIN",
    email: "admin@example.com",
    profile_type: "PARENT",
    role: "ADMIN"
  });
  const normalUser = createJudoka({
    id_judoka: "JUDO123",
    email: "user@example.com",
    profile_type: "JUDOKA",
    role: "NORMAL"
  });

  assert.deepEqual(normalUser.grantAdminRole(), { role: "ADMIN" });
  assert.deepEqual(admin.revokeAdminRole("JUDOOTHER"), { role: "NORMAL" });
  assert.throws(() => admin.revokeAdminRole("JUDOADMIN"), /retirer vos propres droits/);
  assert.throws(() => admin.grantAdminRole(), /déjà admin/);

  assert.deepEqual(
    decideManagedChildRemoval({
      child: { id_judoka: "JUDO123", email: null, profile_type: "JUDOKA", role: "NORMAL" },
      hasCompetitions: false,
      hasCombats: false,
      hasOtherParentLink: false
    }),
    {
      removeJudoka: true,
      message: "Enfant supprimé."
    }
  );

  assert.deepEqual(
    decideManagedChildRemoval({
      child: { id_judoka: "JUDO123", email: "child@example.com", profile_type: "JUDOKA", role: "NORMAL" },
      hasCompetitions: false,
      hasCombats: false,
      hasOtherParentLink: false
    }),
    {
      removeJudoka: false,
      message: "Enfant retiré."
    }
  );
});

test("access invitation domain normalizes invited profile type", () => {
  const invitation = createAccessInvitation({
    email: "parent@example.com",
    invited_profile_type: "parent",
    invited_by: "JUDOADMIN"
  });

  assert.deepEqual(invitation, {
    email: "parent@example.com",
    invited_profile_type: "PARENT",
    invited_by: "JUDOADMIN"
  });

  assert.throws(
    () => createAccessInvitation({ email: "x@example.com", invited_profile_type: "coach" }),
    /Type de profil invalide/
  );
  assert.throws(
    () => createAccessInvitation({ email: "", invited_profile_type: "parent" }),
    /Email d'invitation obligatoire/
  );
});

test("competition domain builds a normalized entity", () => {
  const competition = createCompetition(
    {
      nom: "Tournoi regional",
      date: "2026-06-11",
      categorie_age: "Cadet",
      categorie_poids: "-55 kg",
      classement: "3e"
    },
    "JUDO123"
  );

  assert.equal(competition.id_judoka, "JUDO123");
  assert.equal(competition.nom, "Tournoi regional");
  assert.equal(competition.date, "2026-06-11");
  assert.equal(competition.categorie_age, "Cadet");
  assert.equal(competition.categorie_poids, "-55 kg");
  assert.equal(competition.classement, "3e");
  assert.equal(typeof competition.assertCanContainCombat, "function");

  const defaultCompetition = createCompetition({ nom: "Tournoi regional", date: "2026-06-11" }, "JUDO123");
  assert.equal(defaultCompetition.categorie_age, "");
  assert.equal(defaultCompetition.categorie_poids, "");
  assert.equal(defaultCompetition.classement, "");

  assert.throws(() => createCompetition({ nom: "", date: "" }, "JUDO123"), /Nom et date obligatoires/);
});

test("competition domain enforces combat ownership", () => {
  const competition = {
    id_competition: "COMP123",
    id_judoka: "JUDO123",
    nom: "Tournoi regional",
    date: "2026-06-11"
  };

  assert.doesNotThrow(() => assertCompetitionCanContainCombat(competition, {
    id_competition: "COMP123",
    id_judoka: "JUDO123",
    resultat: "V"
  }));

  assert.throws(() => assertCompetitionCanContainCombat(competition, {
    id_competition: "COMP123",
    id_judoka: "JUDO999",
    resultat: "V"
  }), /judoka de la compétition/);
});

test("combat domain enforces allowed results and required identifiers", () => {
  const combat = createCombat({
    id_judoka: "JUDO123",
    id_competition: "COMP123",
    adversaire: "Lee",
    resultat: "v",
    type_victoire: "Ippon",
    deroule: "Bon rythme"
  });

  assert.deepEqual(combat, {
    id_judoka: "JUDO123",
    id_competition: "COMP123",
    adversaire: "Lee",
    resultat: "V",
    type_victoire: "Ippon",
    deroule: "Bon rythme"
  });

  assert.deepEqual(
    updateCombat({
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
    () => createCombat({ id_judoka: "JUDO123", id_competition: "COMP123", resultat: "X" }),
    /Résultat invalide/
  );
});

test("season statistics domain computes current season snapshot", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { id_judoka: "JUDO123", prenom: "Aya", nom: "Martin" },
    competitions: [
      {
        id_competition: "COMP2",
        nom: "Tournoi B",
        date: "2026-02-01",
        categorie_age: "Cadet",
        categorie_poids: "-55 kg",
        classement: "1er"
      },
      {
        id_competition: "COMP1",
        nom: "Tournoi A",
        date: "2025-10-01",
        categorie_age: "Cadet",
        categorie_poids: "-52 kg",
        classement: "3e"
      }
    ],
    combats: [
      { id_combat: "CB2", id_competition: "COMP2", resultat: "V" },
      { id_combat: "CB1", id_competition: "COMP1", resultat: "D" }
    ],
    getCompetitionCategoryLabel: competition => [competition.categorie_age, competition.categorie_poids].filter(Boolean).join(" - "),
    getCompetitionResultRank: value => ({ "1er": 1, "3e": 3 }[value] || Number.POSITIVE_INFINITY),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.seasonCompetitionCount, 2);
  assert.equal(snapshot.seasonCombatCount, 2);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.equal(snapshot.bestSeasonResults[0].id_competition, "COMP2");
  assert.equal(snapshot.lastCompetition.weightCategory, "-55 kg");
});
