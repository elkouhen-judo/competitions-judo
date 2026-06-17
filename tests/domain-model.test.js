const test = require("node:test");
const assert = require("./helpers/relaxed-assert");

const permissions = require("../core/domain/access/permission-policy");
const { createJudoka, createManagedChild } = require("../core/domain/access/judoka");
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
const {
  createOpponentStance,
  normalizeOpponentStance
} = require("../core/domain/competitions/opponent-stance");
const {
  createCombatScoreCategory,
  normalizeCombatScoreCategory
} = require("../core/domain/competitions/combat-score-category");
const {
  createTachiWazaTechnique,
  normalizeTachiWazaTechnique
} = require("../core/domain/competitions/tachi-waza-technique");
const {
  createNeWazaType,
  normalizeNeWazaType
} = require("../core/domain/competitions/ne-waza-type");
const {
  createCombatScoreValue,
  normalizeCombatScoreValue
} = require("../core/domain/competitions/combat-score-value");
const {
  createCombatScore,
  createCombatScores
} = require("../core/domain/competitions/combat-score");
const { createCompetitionRanking } = require("../core/domain/competition-results");
const { buildJudokaProfileSnapshot } = require("../core/domain/season-statistics");
const { getCurrentSeasonBounds, isDateWithinSeason } = require("../core/domain/season");
const {
  normalizeRole,
  createRole,
  isCoachRole,
  isAdminRole
} = require("../core/domain/access/role");
const {
  normalizeProfileType,
  createProfileType,
  isParentProfileType
} = require("../core/domain/access/profile-type");
const { createPersonName, createOptionalPersonName } = require("../core/domain/access/person-name");

test("permission policy derives access from immutable profile type and role", () => {
  const scope = createManagedJudokaScope(["PARENT1", "CHILD1"]);
  assert.equal(permissions.isParent({ profileType: "PARENT", accessRole: "NORMAL" }), true);
  assert.equal(permissions.isAdmin({ profileType: "JUDOKA", accessRole: "ADMIN" }), true);
  assert.equal(permissions.isCoach({ profileType: "JUDOKA", accessRole: "COACH" }), true);
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

test("judoka domain creates managed child records with invariants", () => {
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

  assert.throws(() => createManagedChild({ firstName: "", lastName: "Martin" }), /Prénom et nom/);
});

test("judoka domain handles admin role lifecycle", () => {
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
    opponentStance: "gaucher",
    result: "v",
    victoryType: "Ippon",
    scores: [{ category: "ne waza", neWazaType: "osaekomi", value: "ippon" }],
    notes: "Bon rythme"
  });

  assert.equal(combat.judokaId, "JUDO123");
  assert.equal(combat.competitionId, "COMP123");
  assert.equal(combat.opponent, "Lee");
  assert.equal(combat.opponentStance, "Gaucher");
  assert.equal(combat.result, "Victoire");
  assert.equal(combat.draft.result, "Victoire");
  assert.equal(combat.victoryType, "Ippon");
  assert.deepEqual(combat.scores, [
    { category: "Ne-waza", technique: "", neWazaType: "Osaekomi", value: "Ippon" }
  ]);
  assert.equal(combat.notes, "Bon rythme");
  assert.equal("id_judoka" in combat, false);
  assert.equal("id_competition" in combat, false);
  assert.equal("adversaire" in combat, false);
  assert.equal("garde_adversaire" in combat, false);
  assert.equal("resultat" in combat, false);
  assert.equal("type_victoire" in combat, false);
  assert.equal("categorie_technique" in combat, false);
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
  assert.equal(updatedCombat.opponentStance, "");
  assert.equal(updatedCombat.result, "Défaite");
  assert.equal(updatedCombat.victoryType, "");
  assert.deepEqual(updatedCombat.scores, []);
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

test("opponent stance domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeOpponentStance("droitier"), "Droitier");
  assert.equal(normalizeOpponentStance("Droite"), "Droitier");
  assert.equal(normalizeOpponentStance("gaucher"), "Gaucher");
  assert.equal(normalizeOpponentStance("Gauche"), "Gaucher");
  assert.equal(normalizeOpponentStance("inconnu"), "");

  assert.equal(createOpponentStance(""), "");
  assert.equal(createOpponentStance(undefined), "");
  assert.equal(createOpponentStance("Gaucher"), "Gaucher");
  assert.throws(() => createOpponentStance("ambidextre"), /Garde de l'adversaire invalide/);
});

test("combat score category domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeCombatScoreCategory("tachi waza"), "Tachi-waza");
  assert.equal(normalizeCombatScoreCategory("TachiWaza"), "Tachi-waza");
  assert.equal(normalizeCombatScoreCategory("ne waza"), "Ne-waza");
  assert.equal(normalizeCombatScoreCategory("newaza"), "Ne-waza");
  assert.equal(normalizeCombatScoreCategory("inconnu"), "");

  assert.equal(createCombatScoreCategory("Tachi-waza"), "Tachi-waza");
  assert.throws(() => createCombatScoreCategory(""), /Catégorie de prise invalide/);
  assert.throws(() => createCombatScoreCategory("inconnu"), /Catégorie de prise invalide/);
});

test("tachi-waza technique domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeTachiWazaTechnique("seoi-nage"), "Seoi-nage");
  assert.equal(normalizeTachiWazaTechnique("O Soto Gari"), "O-soto-gari");
  assert.equal(normalizeTachiWazaTechnique("inconnu"), "");

  assert.equal(createTachiWazaTechnique(""), "");
  assert.equal(createTachiWazaTechnique(undefined), "");
  assert.equal(createTachiWazaTechnique("uchi-mata"), "Uchi-mata");
  assert.throws(
    () => createTachiWazaTechnique("uchi mata inconnu"),
    /Nom de la prise Tachi-waza invalide/
  );
});

test("ne-waza type domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeNeWazaType("cle"), "Clé");
  assert.equal(normalizeNeWazaType("Étranglement"), "Étranglement");
  assert.equal(normalizeNeWazaType("osaekomi"), "Osaekomi");
  assert.equal(normalizeNeWazaType("inconnu"), "");

  assert.equal(createNeWazaType(""), "");
  assert.equal(createNeWazaType(undefined), "");
  assert.equal(createNeWazaType("Clé"), "Clé");
  assert.throws(() => createNeWazaType("inconnu"), /Type de prise Ne-waza invalide/);
});

test("combat score value domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeCombatScoreValue("ippon"), "Ippon");
  assert.equal(normalizeCombatScoreValue("waza ari"), "Waza-ari");
  assert.equal(normalizeCombatScoreValue("yuko"), "Yuko");
  assert.equal(normalizeCombatScoreValue("inconnu"), "");

  assert.equal(createCombatScoreValue("Ippon"), "Ippon");
  assert.throws(() => createCombatScoreValue("inconnu"), /Valeur de la prise invalide/);
});

test("combat score domain enforces the conditional sub-field per category", () => {
  assert.deepEqual(
    createCombatScore({ category: "Tachi-waza", technique: "Seoi-nage", value: "Ippon" }),
    {
      category: "Tachi-waza",
      technique: "Seoi-nage",
      neWazaType: "",
      value: "Ippon"
    }
  );
  assert.deepEqual(
    createCombatScore({ category: "Ne-waza", neWazaType: "Osaekomi", value: "Waza-ari" }),
    {
      category: "Ne-waza",
      technique: "",
      neWazaType: "Osaekomi",
      value: "Waza-ari"
    }
  );

  assert.throws(
    () => createCombatScore({ category: "Tachi-waza", value: "Ippon" }),
    /Nom de la prise obligatoire pour une prise Tachi-waza/
  );
  assert.throws(
    () => createCombatScore({ category: "Ne-waza", value: "Ippon" }),
    /Type de prise obligatoire pour une prise Ne-waza/
  );

  assert.deepEqual(createCombatScores("not-an-array"), []);
  assert.deepEqual(createCombatScores(undefined), []);
  assert.equal(
    createCombatScores([
      { category: "Tachi-waza", technique: "Uchi-mata", value: "Yuko" },
      { category: "Ne-waza", neWazaType: "Clé", value: "Ippon" }
    ]).length,
    2
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

test("season domain computes the September-to-August season window with correct boundaries", () => {
  assert.deepEqual(getCurrentSeasonBounds(new Date(2026, 7, 31)), {
    start: "2025-09-01",
    end: "2026-08-31",
    label: "2025-2026"
  });
  assert.deepEqual(getCurrentSeasonBounds(new Date(2026, 8, 1)), {
    start: "2026-09-01",
    end: "2027-08-31",
    label: "2026-2027"
  });
  assert.deepEqual(getCurrentSeasonBounds(new Date(2026, 0, 15)), {
    start: "2025-09-01",
    end: "2026-08-31",
    label: "2025-2026"
  });
  assert.deepEqual(getCurrentSeasonBounds(new Date(2026, 11, 31)), {
    start: "2026-09-01",
    end: "2027-08-31",
    label: "2026-2027"
  });

  const bounds = getCurrentSeasonBounds();
  assert.match(bounds.label, /^\d{4}-\d{4}$/);
  assert.equal(bounds.start.endsWith("-09-01"), true);
  assert.equal(bounds.end.endsWith("-08-31"), true);
  assert.equal(Number(bounds.end.slice(0, 4)), Number(bounds.start.slice(0, 4)) + 1);
});

test("season domain treats the season window as inclusive on both ends", () => {
  const bounds = { start: "2025-09-01", end: "2026-08-31", label: "2025-2026" };
  assert.equal(isDateWithinSeason("2025-09-01", bounds), true);
  assert.equal(isDateWithinSeason("2026-08-31", bounds), true);
  assert.equal(isDateWithinSeason("2025-08-31", bounds), false);
  assert.equal(isDateWithinSeason("2026-09-01", bounds), false);
  assert.equal(isDateWithinSeason("", bounds), false);
  assert.equal(isDateWithinSeason(undefined, bounds), false);
});

test("role domain normalizes, validates and classifies access roles", () => {
  assert.equal(normalizeRole("  coach "), "COACH");
  assert.equal(normalizeRole(""), "NORMAL");
  assert.equal(normalizeRole(undefined), "NORMAL");
  assert.equal(createRole("admin"), "ADMIN");
  assert.equal(createRole(""), "NORMAL");
  assert.throws(() => createRole("SUPERADMIN"), /Rôle invalide/);
  assert.equal(isCoachRole("coach"), true);
  assert.equal(isCoachRole("NORMAL"), false);
  assert.equal(isAdminRole("Admin"), true);
  assert.equal(isAdminRole(""), false);
});

test("profile type domain normalizes, validates and classifies profile types", () => {
  assert.equal(normalizeProfileType(" parent "), "PARENT");
  assert.equal(normalizeProfileType(""), "JUDOKA");
  assert.equal(createProfileType("judoka"), "JUDOKA");
  assert.equal(createProfileType(""), "JUDOKA");
  assert.throws(() => createProfileType("COACH"), /Type de profil invalide/);
  assert.equal(isParentProfileType("parent"), true);
  assert.equal(isParentProfileType(""), false);
});

test("person name domain trims parts, requires both names and builds a display name", () => {
  const name = createPersonName({ firstName: " Aya ", lastName: " Martin " });
  assert.equal(name.firstName, "Aya");
  assert.equal(name.lastName, "Martin");
  assert.equal(name.displayName(), "Aya Martin");
  assert.throws(() => createPersonName({ firstName: "", lastName: "Martin" }), /Prénom et nom/);
  assert.throws(() => createPersonName({}), /Prénom et nom/);
});

test("optional person name allows missing parts without throwing", () => {
  const empty = createOptionalPersonName();
  assert.equal(empty.firstName, "");
  assert.equal(empty.lastName, "");
  assert.equal(empty.displayName(), "");
  const partial = createOptionalPersonName({ firstName: " Aya " });
  assert.equal(partial.displayName(), "Aya");
});
