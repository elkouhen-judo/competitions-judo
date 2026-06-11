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
const { createManagedJudokaScope } = require("../core/domain/access/managed-judoka-scope");
const { createAccessInvitation } = require("../core/domain/access/access-invitation");
const {
  assertCompetitionCanContainCombat,
  createCompetition
} = require("../core/domain/competitions/competition");
const { createCombat, updateCombat } = require("../core/domain/competitions/combat");
const { buildJudokaProfileSnapshot } = require("../core/domain/season-statistics");

test("permission policy derives access from immutable profile type and role", () => {
  const scope = createManagedJudokaScope(["PARENT1", "CHILD1"]);
  assert.equal(permissions.isParent({ profileType: "PARENT", accessRole: "NORMAL" }), true);
  assert.equal(permissions.isAdmin({ profileType: "JUDOKA", accessRole: "ADMIN" }), true);
  assert.equal(permissions.canManageChildrenProfile({ profileType: "JUDOKA", accessRole: "ADMIN" }), false);
  assert.doesNotThrow(() => permissions.assertCanAccessJudokaProfile(
    { judokaId: "PARENT1", profileType: "PARENT", accessRole: "NORMAL" },
    "CHILD1",
    scope
  ));
  assert.deepEqual(scope.toIds(), ["PARENT1", "CHILD1"]);
  assert.throws(() => permissions.assertCanAccessJudokaProfile(
    { judokaId: "JUDO1", profileType: "JUDOKA", accessRole: "NORMAL" },
    "OTHER",
    createManagedJudokaScope([])
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
    judokaId: "JUDO123",
    accountEmail: "child@example.com",
    firstName: "Aya",
    lastName: "Martin"
  });

  assert.equal(child.hasDirectAccount(), true);

  assert.equal(child.judokaId, "JUDO123");
  assert.equal(child.accountEmail, "child@example.com");
  assert.equal(child.profileType, "JUDOKA");
  assert.equal(child.accessRole, "NORMAL");
  assert.equal("id_judoka" in child, false);
  assert.equal("email" in child, false);
  assert.equal("profile_type" in child, false);
  assert.equal("role" in child, false);

  const updatedChild = updateManagedChild({
    accountEmail: "",
    firstName: "Aya",
    lastName: "Martin"
  });

  assert.equal(updatedChild.accountEmail, null);
  assert.equal(updatedChild.name.firstName, "Aya");
  assert.equal(updatedChild.name.lastName, "Martin");
  assert.equal("email" in updatedChild, false);
  assert.equal("prenom" in updatedChild, false);
  assert.equal("nom" in updatedChild, false);

  assert.throws(() => createManagedChild({ firstName: "", lastName: "Martin" }), /Prénom et nom/);
});

test("judoka domain handles admin role lifecycle and child removal decisions", () => {
  const admin = createJudoka({
    judokaId: "JUDOADMIN",
    accountEmail: "admin@example.com",
    profileType: "PARENT",
    accessRole: "ADMIN"
  });
  const normalUser = createJudoka({
    judokaId: "JUDO123",
    accountEmail: "user@example.com",
    profileType: "JUDOKA",
    accessRole: "NORMAL"
  });

  assert.deepEqual(normalUser.grantAdminRole(), { accessRole: "ADMIN" });
  assert.deepEqual(admin.revokeAdminRole("JUDOOTHER"), { accessRole: "NORMAL" });
  assert.throws(() => admin.revokeAdminRole("JUDOADMIN"), /retirer vos propres droits/);
  assert.throws(() => admin.grantAdminRole(), /déjà admin/);

  assert.deepEqual(
    decideManagedChildRemoval({
      child: { judokaId: "JUDO123", accountEmail: null, profileType: "JUDOKA", accessRole: "NORMAL" },
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
      child: { judokaId: "JUDO123", accountEmail: "child@example.com", profileType: "JUDOKA", accessRole: "NORMAL" },
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
      name: "Tournoi regional",
      competitionDate: "2026-06-11",
      ageCategory: "Cadet",
      weightCategory: "-55 kg",
      seasonResult: "3e"
    },
    "JUDO123"
  );

  assert.equal(competition.competitionId, null);
  assert.equal(competition.ownerJudokaId, "JUDO123");
  assert.equal(competition.name, "Tournoi regional");
  assert.equal(competition.competitionDate, "2026-06-11");
  assert.equal(competition.draft.name, "Tournoi regional");
  assert.equal(competition.draft.competitionDate, "2026-06-11");
  assert.equal(competition.ageCategory, "Cadet");
  assert.equal(competition.weightCategory, "-55 kg");
  assert.equal(competition.seasonResult, "3e");
  assert.equal("id_judoka" in competition, false);
  assert.equal("nom" in competition, false);
  assert.equal("date" in competition, false);
  assert.equal("categorie_age" in competition, false);
  assert.equal("categorie_poids" in competition, false);
  assert.equal("classement" in competition, false);
  assert.equal(typeof competition.assertCanContainCombat, "function");

  const defaultCompetition = createCompetition({ name: "Tournoi regional", competitionDate: "2026-06-11" }, "JUDO123");
  assert.equal(defaultCompetition.ageCategory, "");
  assert.equal(defaultCompetition.weightCategory, "");
  assert.equal(defaultCompetition.seasonResult, "");

  assert.throws(() => createCompetition({ name: "", competitionDate: "" }, "JUDO123"), /Nom et date obligatoires/);
});

test("competition domain enforces combat ownership", () => {
  const competition = {
    competitionId: "COMP123",
    ownerJudokaId: "JUDO123",
    name: "Tournoi regional",
    competitionDate: "2026-06-11"
  };

  assert.doesNotThrow(() => assertCompetitionCanContainCombat(competition, {
    competitionId: "COMP123",
    judokaId: "JUDO123",
    result: "V"
  }));

  assert.throws(() => assertCompetitionCanContainCombat(competition, {
    competitionId: "COMP123",
    judokaId: "JUDO999",
    result: "V"
  }), /judoka de la compétition/);
});

test("combat domain enforces allowed results and required identifiers", () => {
  const combat = createCombat({
    judokaId: "JUDO123",
    competitionId: "COMP123",
    opponent: "Lee",
    result: "v",
    victoryType: "Ippon",
    notes: "Bon rythme"
  });

  assert.equal(combat.judokaId, "JUDO123");
  assert.equal(combat.competitionId, "COMP123");
  assert.equal(combat.opponent, "Lee");
  assert.equal(combat.result, "V");
  assert.equal(combat.draft.result, "V");
  assert.equal(combat.victoryType, "Ippon");
  assert.equal(combat.notes, "Bon rythme");
  assert.equal("id_judoka" in combat, false);
  assert.equal("id_competition" in combat, false);
  assert.equal("adversaire" in combat, false);
  assert.equal("resultat" in combat, false);
  assert.equal("type_victoire" in combat, false);
  assert.equal("deroule" in combat, false);

  const updatedCombat = updateCombat({
    combatId: "CB123",
    judokaId: "JUDO123",
    competitionId: "COMP123",
    result: "D"
  });
  assert.equal(updatedCombat.combatId, "CB123");
  assert.equal(updatedCombat.judokaId, "JUDO123");
  assert.equal(updatedCombat.competitionId, "COMP123");
  assert.equal(updatedCombat.opponent, "");
  assert.equal(updatedCombat.result, "D");
  assert.equal(updatedCombat.victoryType, "");
  assert.equal(updatedCombat.notes, "");

  assert.throws(
    () => createCombat({ judokaId: "JUDO123", competitionId: "COMP123", result: "X" }),
    /Résultat invalide/
  );
});

test("season statistics domain computes current season snapshot", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "COMP2",
        name: "Tournoi B",
        competitionDate: "2026-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        seasonResult: "1er"
      },
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2025-10-01",
        ageCategory: "Cadet",
        weightCategory: "-52 kg",
        seasonResult: "3e"
      }
    ],
    combats: [
      { combatId: "CB2", competitionId: "COMP2", result: "V" },
      { combatId: "CB1", competitionId: "COMP1", result: "D" }
    ],
    getCompetitionCategoryLabel: competition => [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCompetitionResultRank: value => ({ "1er": 1, "3e": 3 }[value] || Number.POSITIVE_INFINITY),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.seasonCompetitionCount, 2);
  assert.equal(snapshot.seasonCombatCount, 2);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.equal(snapshot.bestSeasonResults[0].competitionId, "COMP2");
  assert.equal(snapshot.lastCompetition.weightCategory, "-55 kg");
});

test("season statistics keep latest competition details and normalize combat results", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "COMP3",
        name: "Tournoi C",
        competitionDate: "2026-03-10",
        ageCategory: "Junior",
        weightCategory: "-57 kg",
        seasonResult: "Non classé"
      },
      {
        competitionId: "COMP2",
        name: "Tournoi B",
        competitionDate: "2026-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        seasonResult: "1er"
      },
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2025-10-01",
        ageCategory: "Cadet",
        weightCategory: "-52 kg",
        seasonResult: "3e"
      }
    ],
    combats: [
      { combatId: "CB2", competitionId: "COMP2", result: "v" },
      { combatId: "CB1", competitionId: "COMP1", result: "d" }
    ],
    getCompetitionCategoryLabel: competition => [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCompetitionResultRank: value => ({ "1er": 1, "3e": 3 }[String(value || "").toLowerCase()] || Number.POSITIVE_INFINITY),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.seasonCompetitionCount, 3);
  assert.equal(snapshot.seasonCombatCount, 2);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.equal(snapshot.lastCompetition.competitionId, "COMP3");
  assert.equal(snapshot.lastCompetition.category, "Junior - -57 kg");
  assert.equal(snapshot.lastCompetition.weightCategory, "-57 kg");
  assert.deepEqual(snapshot.bestSeasonResults.map(result => result.competitionId), ["COMP2", "COMP1"]);
});

test("season statistics fall back to the latest season with competition data", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "COMP2",
        name: "Tournoi B",
        competitionDate: "2025-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        seasonResult: "1er"
      },
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2024-10-01",
        ageCategory: "Cadet",
        weightCategory: "-52 kg",
        seasonResult: "3e"
      }
    ],
    combats: [
      { combatId: "CB2", competitionId: "COMP2", result: "V" },
      { combatId: "CB1", competitionId: "COMP1", result: "D" }
    ],
    getCompetitionCategoryLabel: competition => [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCompetitionResultRank: value => ({ "1er": 1, "3e": 3 }[value] || Number.POSITIVE_INFINITY),
    getCurrentSeasonBounds: referenceDate => (
      referenceDate
        ? { start: "2024-09-01", end: "2025-08-31", label: "2024-2025" }
        : { start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }
    ),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.season.label, "2024-2025");
  assert.equal(snapshot.seasonCompetitionCount, 2);
  assert.equal(snapshot.seasonCombatCount, 2);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.deepEqual(snapshot.bestSeasonResults.map(result => result.competitionId), ["COMP2", "COMP1"]);
});
