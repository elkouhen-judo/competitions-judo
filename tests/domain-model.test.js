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
const {
  createClubCompetition,
  createClubCompetitionParticipantIds
} = require("../core/domain/competitions/club-competition");
const { createCombat, updateCombat } = require("../core/domain/competitions/combat");
const { createCompetitionRanking } = require("../core/domain/competition-results");
const { buildJudokaProfileSnapshot } = require("../core/domain/season-statistics");

test("permission policy derives access from immutable profile type and role", () => {
  const scope = createManagedJudokaScope(["PARENT1", "CHILD1"]);
  assert.equal(permissions.isParent({ profileType: "PARENT", accessRole: "NORMAL" }), true);
  assert.equal(permissions.isAdmin({ profileType: "JUDOKA", accessRole: "ADMIN" }), true);
  assert.equal(permissions.isCoach({ profileType: "JUDOKA", accessRole: "COACH" }), true);
  assert.equal(
    permissions.canManageChildrenProfile({ profileType: "JUDOKA", accessRole: "ADMIN" }),
    false
  );
  const parentAccess = permissions.resolveJudokaDataAccess(
    { judokaId: "PARENT1", profileType: "PARENT", accessRole: "NORMAL" },
    scope
  );
  assert.equal(parentAccess.kind, "MANAGED");
  assert.equal(parentAccess.isManaged(), true);
  assert.equal(parentAccess.canManageJudoka("CHILD1"), true);
  assert.deepEqual(parentAccess.visibleJudokaIds(), ["PARENT1", "CHILD1"]);
  assert.doesNotThrow(() =>
    permissions.assertCanAccessJudokaProfile(
      { judokaId: "PARENT1", profileType: "PARENT", accessRole: "NORMAL" },
      "CHILD1",
      scope
    )
  );
  assert.deepEqual(scope.toIds(), ["PARENT1", "CHILD1"]);
  assert.throws(
    () =>
      permissions.assertCanAccessJudokaProfile(
        { judokaId: "JUDO1", profileType: "JUDOKA", accessRole: "NORMAL" },
        "OTHER",
        createManagedJudokaScope([])
      ),
    /Accès refusé/
  );

  const coachAccess = permissions.resolveJudokaDataAccess(
    { judokaId: "COACH1", profileType: "JUDOKA", accessRole: "COACH" },
    createManagedJudokaScope([])
  );
  assert.equal(coachAccess.kind, "ALL");
  assert.equal(coachAccess.canManageJudoka("OTHER"), true);
  assert.equal(
    permissions.canManageCompetition(
      { judokaId: "COACH1", profileType: "JUDOKA", accessRole: "COACH" },
      { ownerJudokaId: "OTHER" },
      createManagedJudokaScope([])
    ),
    true
  );
  assert.equal(
    permissions.canManageCombatFor(
      { judokaId: "COACH1", profileType: "JUDOKA", accessRole: "COACH" },
      "OTHER",
      createManagedJudokaScope([])
    ),
    true
  );
  assert.doesNotThrow(() =>
    permissions.assertCanAccessJudokaProfile(
      { judokaId: "COACH1", profileType: "JUDOKA", accessRole: "COACH" },
      "OTHER",
      createManagedJudokaScope([])
    )
  );
});

test("club competition domain normalizes event details and participant ids", () => {
  const event = createClubCompetition({
    clubCompetitionId: "CLUB1",
    name: " Tournoi Nantes ",
    competitionDate: "2026-06-14",
    ageCategory: " minime ",
    weightCategory: " -50kg ",
    participantJudokaIds: ["J1", "J2", "J1"]
  });

  assert.equal(event.clubCompetitionId, "CLUB1");
  assert.equal(event.name, "Tournoi Nantes");
  assert.equal(event.competitionDate, "2026-06-14");
  assert.equal(event.ageCategory, "Minime");
  assert.equal(event.weightCategory, "-50kg");
  assert.deepEqual(event.participantJudokaIds, ["J1", "J2"]);
  assert.throws(
    () => createClubCompetition({ name: "", competitionDate: "2026-06-14" }),
    /Nom et date obligatoires/
  );
  assert.throws(() => createClubCompetitionParticipantIds([]), /Au moins un judoka/);
});

test("competition domain carries optional club competition link", () => {
  const competition = createCompetition(
    {
      name: "Tournoi Nantes",
      competitionDate: "2026-06-14",
      clubCompetitionId: "CLUB1"
    },
    "J1"
  );

  assert.equal(competition.clubCompetitionId, "CLUB1");
  assert.equal(
    competition.changeDetails({ name: "Tournoi Nantes 2", competitionDate: "2026-06-15" })
      .clubCompetitionId,
    "CLUB1"
  );
});

test("permission policy grants coach sports management without admin invitations", () => {
  const coach = { judokaId: "C1", profileType: "JUDOKA", accessRole: "COACH" };
  const admin = { judokaId: "A1", profileType: "JUDOKA", accessRole: "ADMIN" };
  assert.equal(permissions.canManageClubCompetition(coach), true);
  assert.equal(
    permissions.canManageCompetition(coach, { ownerJudokaId: "J1" }, createManagedJudokaScope([])),
    true
  );
  assert.equal(permissions.canManageClubCompetition(admin), false);
  assert.equal(
    permissions.canManageCompetition(admin, { ownerJudokaId: "J1" }, createManagedJudokaScope([])),
    false
  );
  assert.equal(permissions.canManageCombatFor(admin, "J1", createManagedJudokaScope([])), false);
  assert.equal(permissions.canManageChildrenProfile(coach), false);
});

test("email value object normalizes and validates addresses", () => {
  assert.equal(createEmail(" User@Example.COM "), "user@example.com");
  assert.equal(createOptionalEmail(""), null);
  assert.throws(() => createEmail("not-an-email"), /Email invalide/);
  assert.throws(
    () => createEmail("", "Email invalide.", "Email obligatoire."),
    /Email obligatoire/
  );
  assert.throws(
    () => createOptionalEmail("child@", "Email de l'enfant invalide."),
    /Email de l'enfant invalide/
  );
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
      child: {
        judokaId: "JUDO123",
        accountEmail: null,
        profileType: "JUDOKA",
        accessRole: "NORMAL"
      },
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
      child: {
        judokaId: "JUDO123",
        accountEmail: "child@example.com",
        profileType: "JUDOKA",
        accessRole: "NORMAL"
      },
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

test("judoka domain accepts coach as a structural role without changing profile type", () => {
  const coach = createJudoka({
    judokaId: "COACH1",
    accountEmail: "coach@example.com",
    profileType: "PARENT",
    accessRole: "COACH"
  });

  assert.equal(coach.profileType, "PARENT");
  assert.equal(coach.accessRole, "COACH");
  assert.equal(coach.isCoach(), true);
  assert.equal(coach.isAdmin(), false);
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
      name: " Tournoi regional ",
      competitionDate: " 2026-06-11 ",
      ageCategory: " Cadet ",
      weightCategory: " -55 kg ",
      result: " 3e "
    },
    "JUDO123"
  );

  assert.equal(competition.competitionId, null);
  assert.equal(competition.ownerJudokaId, "JUDO123");
  assert.equal(competition.name, "Tournoi regional");
  assert.equal(competition.competitionDate, "2026-06-11");
  assert.equal(competition.draft.name, "Tournoi regional");
  assert.equal(competition.draft.competitionDate, "2026-06-11");
  assert.equal("result" in competition.draft, false);
  assert.equal(competition.ageCategory, "Cadet");
  assert.equal(competition.weightCategory, "-55 kg");
  assert.equal(competition.result, "3e");
  assert.deepEqual(competition.finalize(" 2e "), {
    competitionId: null,
    ownerJudokaId: "JUDO123",
    result: "2e"
  });
  assert.equal(
    competition.changeDetails({
      name: "Tournoi modifie",
      competitionDate: "2026-06-12",
      result: "1er"
    }).result,
    "1er"
  );
  assert.throws(() => competition.finalize("podium"), /Classement invalide/);
  assert.equal("id_judoka" in competition, false);
  assert.equal("nom" in competition, false);
  assert.equal("date" in competition, false);
  assert.equal("categorie_age" in competition, false);
  assert.equal("categorie_poids" in competition, false);
  assert.equal("classement" in competition, false);
  assert.equal(typeof competition.assertCanContainCombat, "function");

  const defaultCompetition = createCompetition(
    { name: "Tournoi regional", competitionDate: "2026-06-11" },
    "JUDO123"
  );
  assert.equal(defaultCompetition.ageCategory, "");
  assert.equal(defaultCompetition.weightCategory, "");
  assert.equal(defaultCompetition.result, "");

  const veteranCompetition = createCompetition(
    { name: "Tournoi veteran", competitionDate: "2026-06-11", ageCategory: " veteran " },
    "JUDO123"
  );
  assert.equal(veteranCompetition.ageCategory, "Vétéran");

  assert.throws(
    () => createCompetition({ name: "", competitionDate: "" }, "JUDO123"),
    /Nom et date obligatoires/
  );
  assert.throws(
    () => createCompetition({ name: "   ", competitionDate: "2026-06-11" }, "JUDO123"),
    /Nom et date obligatoires/
  );
  assert.throws(
    () => createCompetition({ name: "Tournoi", competitionDate: "2026-02-31" }, "JUDO123"),
    /Date de compétition invalide/
  );
  assert.throws(
    () =>
      createCompetition(
        { name: "Tournoi", competitionDate: "2026-06-11", ageCategory: "Espoir" },
        "JUDO123"
      ),
    /Catégorie d'âge invalide/
  );
  assert.equal(createCompetitionRanking(" Non classé "), "Non classé");
});

test("competition domain enforces combat ownership", () => {
  const competition = {
    competitionId: "COMP123",
    ownerJudokaId: "JUDO123",
    name: "Tournoi regional",
    competitionDate: "2026-06-11"
  };

  assert.doesNotThrow(() =>
    assertCompetitionCanContainCombat(competition, {
      competitionId: "COMP123",
      judokaId: "JUDO123",
      result: "V"
    })
  );

  assert.throws(
    () =>
      assertCompetitionCanContainCombat(competition, {
        competitionId: "COMP123",
        judokaId: "JUDO999",
        result: "V"
      }),
    /judoka de la compétition/
  );
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
  assert.equal(combat.result, "Victoire");
  assert.equal(combat.draft.result, "Victoire");
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
  assert.equal(updatedCombat.result, "Défaite");
  assert.equal(updatedCombat.victoryType, "");
  assert.equal(updatedCombat.notes, "");

  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Défaite",
      victoryType: "Décision"
    }).victoryType,
    "Décision"
  );
  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Défaite",
      victoryType: "Yuko"
    }).victoryType,
    "Yuko"
  );
  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Victoire",
      victoryType: "Forfait"
    }).victoryType,
    "Forfait"
  );
  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Victoire",
      victoryType: "Pénalité (Hansoku-make / Shido)"
    }).victoryType,
    "Hansoku-make"
  );
  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Défaite",
      victoryType: "Pénalité (Hansoku-make / Shido)"
    }).victoryType,
    "Hansoku-make"
  );
  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Egalité",
      victoryType: "Hiki wake"
    }).victoryType,
    "Hiki wake"
  );
  assert.equal(
    createCombat({
      judokaId: "JUDO123",
      competitionId: "COMP123",
      result: "Egalité"
    }).victoryType,
    "Hiki wake"
  );

  assert.throws(
    () => createCombat({ judokaId: "JUDO123", competitionId: "COMP123", result: "X" }),
    /Résultat invalide/
  );
  assert.throws(
    () =>
      createCombat({
        judokaId: "JUDO123",
        competitionId: "COMP123",
        result: "Victoire",
        victoryType: "Golden score"
      }),
    /Type de décision invalide/
  );
  assert.throws(
    () =>
      createCombat({
        judokaId: "JUDO123",
        competitionId: "COMP123",
        result: "Egalité",
        victoryType: "Décision"
      }),
    /Type de décision incompatible/
  );
  assert.throws(
    () =>
      createCombat({
        judokaId: "JUDO123",
        competitionId: "COMP123",
        result: "Disqualification",
        victoryType: "Hansoku-make"
      }),
    /Résultat invalide/
  );
  assert.throws(
    () =>
      createCombat({
        judokaId: "JUDO123",
        competitionId: "COMP123",
        result: "Victoire",
        victoryType: "Hiki wake"
      }),
    /Type de décision incompatible/
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
        result: "1er"
      },
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2025-10-01",
        ageCategory: "Cadet",
        weightCategory: "-52 kg",
        result: "3e"
      }
    ],
    combats: [
      { combatId: "CB2", competitionId: "COMP2", result: "V", victoryType: "Ippon" },
      { combatId: "CB1", competitionId: "COMP1", result: "D", victoryType: "Décision" },
      { combatId: "CB3", competitionId: "COMP2", result: "E", victoryType: "Hiki wake" }
    ],
    getCompetitionCategoryLabel: (competition) =>
      [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.seasonCompetitionCount, 2);
  assert.equal(snapshot.seasonCombatCount, 3);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.equal(snapshot.seasonDraws, 1);
  assert.equal(snapshot.victoryRate, 33);
  assert.deepEqual(snapshot.combatProfile, {
    victoryIppon: 1,
    victoryDecision: 0,
    lossIppon: 0,
    lossDecision: 1,
    lossPenalty: 0,
    lossForfeit: 0,
    draws: 1,
    penalties: 0,
    forfeits: 0
  });
  assert.equal(snapshot.competitionResults[0].competitionId, "COMP2");
  assert.equal(snapshot.competitionResults[0].combatRecord.label, "1V · 0D · 1N");
  assert.deepEqual(snapshot.competitionResults[0].resultBadge, {
    label: "podium",
    className: "rank-gold"
  });
  assert.equal(snapshot.lastCompetition.weightCategory, "-55 kg");
});

test("season statistics keep latest competition details and normalize combat results", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2025-10-01",
        ageCategory: "Cadet",
        weightCategory: "-52 kg",
        result: "3e"
      },
      {
        competitionId: "COMP3",
        name: "Tournoi C",
        competitionDate: "2026-03-10",
        ageCategory: "Junior",
        weightCategory: "-57 kg",
        result: "Non classé"
      },
      {
        competitionId: "COMP2",
        name: "Tournoi B",
        competitionDate: "2026-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        result: "1er"
      }
    ],
    combats: [
      { combatId: "CB2", competitionId: "COMP2", result: "v", victoryType: "Décision" },
      { combatId: "CB1", competitionId: "COMP1", result: "d", victoryType: "Ippon" },
      { combatId: "CB3", competitionId: "COMP3", result: "d", victoryType: "Hansoku-make" },
      { combatId: "CB4", competitionId: "COMP3", result: "d", victoryType: "Forfait" }
    ],
    getCompetitionCategoryLabel: (competition) =>
      [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.seasonCompetitionCount, 3);
  assert.equal(snapshot.seasonCombatCount, 4);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 3);
  assert.equal(snapshot.seasonDraws, 0);
  assert.equal(snapshot.lastCompetition.competitionId, "COMP3");
  assert.equal(snapshot.lastCompetition.category, "Junior - -57 kg");
  assert.equal(snapshot.lastCompetition.weightCategory, "-57 kg");
  assert.equal(snapshot.combatProfile.lossIppon, 1);
  assert.equal(snapshot.combatProfile.lossDecision, 0);
  assert.equal(snapshot.combatProfile.lossPenalty, 1);
  assert.equal(snapshot.combatProfile.lossForfeit, 1);
  assert.deepEqual(
    snapshot.competitionResults.map((result) => result.competitionId),
    ["COMP3", "COMP2", "COMP1"]
  );
  assert.deepEqual(
    snapshot.competitionResults.map((result) => result.resultBadge.className),
    ["rank-unclassified", "rank-gold", "rank-bronze"]
  );
});

test("season statistics prefer the current season when it contains competition data", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "CURRENT",
        name: "Tournoi saison courante",
        competitionDate: "2026-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        result: "1er"
      },
      {
        competitionId: "LATEST",
        name: "Tournoi nouvelle saison",
        competitionDate: "2026-09-15",
        ageCategory: "Junior",
        weightCategory: "-57 kg",
        result: "3e"
      }
    ],
    combats: [
      { combatId: "CB1", competitionId: "CURRENT", result: "V" },
      { combatId: "CB2", competitionId: "LATEST", result: "D" }
    ],
    getCompetitionCategoryLabel: (competition) =>
      [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCurrentSeasonBounds: (referenceDate) => {
      if (referenceDate && referenceDate.getFullYear() === 2026 && referenceDate.getMonth() >= 8) {
        return { start: "2026-09-01", end: "2027-08-31", label: "2026-2027" };
      }
      return { start: "2025-09-01", end: "2026-08-31", label: "2025-2026" };
    },
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.lastCompetition.competitionId, "CURRENT");
  assert.equal(snapshot.season.label, "2025-2026");
  assert.equal(snapshot.seasonCompetitionCount, 1);
  assert.equal(snapshot.seasonCombatCount, 1);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 0);
  assert.equal(snapshot.seasonDraws, 0);
  assert.deepEqual(
    snapshot.competitionResults.map((result) => result.competitionId),
    ["CURRENT"]
  );
});

test("season statistics fall back to the latest season with competition data", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2024-10-01",
        ageCategory: "Cadet",
        weightCategory: "-52 kg",
        result: "3e"
      },
      {
        competitionId: "COMP2",
        name: "Tournoi B",
        competitionDate: "2025-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        result: "1er"
      }
    ],
    combats: [
      { combatId: "CB2", competitionId: "COMP2", result: "V" },
      { combatId: "CB1", competitionId: "COMP1", result: "D" }
    ],
    getCompetitionCategoryLabel: (competition) =>
      [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCurrentSeasonBounds: (referenceDate) =>
      referenceDate
        ? { start: "2024-09-01", end: "2025-08-31", label: "2024-2025" }
        : { start: "2025-09-01", end: "2026-08-31", label: "2025-2026" },
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.equal(snapshot.season.label, "2024-2025");
  assert.equal(snapshot.seasonCompetitionCount, 2);
  assert.equal(snapshot.seasonCombatCount, 2);
  assert.equal(snapshot.seasonWins, 1);
  assert.equal(snapshot.seasonLosses, 1);
  assert.equal(snapshot.seasonDraws, 0);
  assert.deepEqual(
    snapshot.competitionResults.map((result) => result.competitionId),
    ["COMP2", "COMP1"]
  );
});
