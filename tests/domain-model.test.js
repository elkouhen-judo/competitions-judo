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
  assert.equal(permissions.isParent({ profile_type: "PARENT", role: "NORMAL" }), true);
  assert.equal(permissions.isAdmin({ profile_type: "JUDOKA", role: "ADMIN" }), true);
  assert.equal(permissions.canManageChildrenProfile({ profile_type: "JUDOKA", role: "ADMIN" }), false);
  assert.doesNotThrow(() => permissions.assertCanAccessJudokaProfile(
    { id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" },
    "CHILD1",
    scope
  ));
  assert.deepEqual(scope.toIds(), ["PARENT1", "CHILD1"]);
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

  assert.equal(child.judokaId, "JUDO123");
  assert.equal(child.accountEmail, "child@example.com");
  assert.equal(child.profileType, "JUDOKA");
  assert.equal(child.accessRole, "NORMAL");
  assert.equal("id_judoka" in child, false);
  assert.equal("email" in child, false);
  assert.equal("profile_type" in child, false);
  assert.equal("role" in child, false);

  const updatedChild = updateManagedChild({
    email: "",
    prenom: "Aya",
    nom: "Martin"
  });

  assert.equal(updatedChild.accountEmail, null);
  assert.equal(updatedChild.name.firstName, "Aya");
  assert.equal(updatedChild.name.lastName, "Martin");
  assert.equal("email" in updatedChild, false);
  assert.equal("prenom" in updatedChild, false);
  assert.equal("nom" in updatedChild, false);

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

  assert.deepEqual(normalUser.grantAdminRole(), { accessRole: "ADMIN" });
  assert.deepEqual(admin.revokeAdminRole("JUDOOTHER"), { accessRole: "NORMAL" });
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

  const defaultCompetition = createCompetition({ nom: "Tournoi regional", date: "2026-06-11" }, "JUDO123");
  assert.equal(defaultCompetition.ageCategory, "");
  assert.equal(defaultCompetition.weightCategory, "");
  assert.equal(defaultCompetition.seasonResult, "");

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
    id_combat: "CB123",
    id_judoka: "JUDO123",
    id_competition: "COMP123",
    resultat: "D"
  });
  assert.equal(updatedCombat.combatId, "CB123");
  assert.equal(updatedCombat.judokaId, "JUDO123");
  assert.equal(updatedCombat.competitionId, "COMP123");
  assert.equal(updatedCombat.opponent, "");
  assert.equal(updatedCombat.result, "D");
  assert.equal(updatedCombat.victoryType, "");
  assert.equal(updatedCombat.notes, "");

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

test("season statistics keep latest competition details and normalize combat results", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { id_judoka: "JUDO123", prenom: "Aya", nom: "Martin" },
    competitions: [
      {
        id_competition: "COMP3",
        nom: "Tournoi C",
        date: "2026-03-10",
        categorie_age: "Junior",
        categorie_poids: "-57 kg",
        classement: "Non classé"
      },
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
      { id_combat: "CB2", id_competition: "COMP2", resultat: "v" },
      { id_combat: "CB1", id_competition: "COMP1", resultat: "d" }
    ],
    getCompetitionCategoryLabel: competition => [competition.categorie_age, competition.categorie_poids].filter(Boolean).join(" - "),
    getCompetitionResultRank: value => ({ "1er": 1, "3e": 3 }[String(value || "").toLowerCase()] || Number.POSITIVE_INFINITY),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.seasonCompetitionCount, 3);
  assert.equal(snapshot.seasonCombatCount, 2);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.equal(snapshot.lastCompetition.id_competition, "COMP3");
  assert.equal(snapshot.lastCompetition.category, "Junior - -57 kg");
  assert.equal(snapshot.lastCompetition.weightCategory, "-57 kg");
  assert.deepEqual(snapshot.bestSeasonResults.map(result => result.id_competition), ["COMP2", "COMP1"]);
});

test("season statistics fall back to the latest season with competition data", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { id_judoka: "JUDO123", prenom: "Aya", nom: "Martin" },
    competitions: [
      {
        id_competition: "COMP2",
        nom: "Tournoi B",
        date: "2025-02-01",
        categorie_age: "Cadet",
        categorie_poids: "-55 kg",
        classement: "1er"
      },
      {
        id_competition: "COMP1",
        nom: "Tournoi A",
        date: "2024-10-01",
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
  assert.deepEqual(snapshot.bestSeasonResults.map(result => result.id_competition), ["COMP2", "COMP1"]);
});
