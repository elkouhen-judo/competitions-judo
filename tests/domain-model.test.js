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
const {
  computeCoachDashboardStats,
  computeWithheldScope,
  isGroupScope
} = require("../core/domain/coach-dashboard-statistics");
const {
  createWeightCategory,
  createYearInCategory,
  createHandedness,
  getValidYearsInCategory,
  getWeightCategoriesFor
} = require("../core/domain/category-reference");
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

  // Un coach accède aux judokas de ses clubs (portés par son managedJudokaScope), pas aux autres.
  const coach = { judokaId: "COACH1", profileType: "JUDOKA", accessRole: "COACH" };
  const coachClubScope = createManagedJudokaScope(["CLUB_JUDOKA"]);
  const coachAccess = permissions.resolveJudokaDataAccess(coach, coachClubScope);
  assert.equal(coachAccess.kind, "MANAGED");
  assert.equal(coachAccess.canManageJudoka("CLUB_JUDOKA"), true);
  assert.equal(coachAccess.canManageJudoka("OTHER"), false);
  assert.equal(permissions.canManageCompetition(coach, { ownerJudokaId: "CLUB_JUDOKA" }, coachClubScope), true);
  assert.equal(permissions.canManageCompetition(coach, { ownerJudokaId: "OTHER" }, coachClubScope), false);
  assert.equal(permissions.canManageCombatFor(coach, "CLUB_JUDOKA", coachClubScope), true);
  assert.equal(permissions.canManageCombatFor(coach, "OTHER", coachClubScope), false);
  assert.doesNotThrow(() => permissions.assertCanAccessJudokaProfile(coach, "CLUB_JUDOKA", coachClubScope));
  assert.throws(() => permissions.assertCanAccessJudokaProfile(coach, "OTHER", coachClubScope), /Accès refusé/);
});

test("club competition domain normalizes event details and participant ids", () => {
  const event = createClubCompetition({
    clubCompetitionId: "CLUB1",
    name: " Tournoi Nantes ",
    competitionDate: "2026-06-14",
    ageCategory: " minime ",
    level: " Régional ",
    participantJudokaIds: ["J1", "J2", "J1"]
  });

  assert.equal(event.clubCompetitionId, "CLUB1");
  assert.equal(event.name, "Tournoi Nantes");
  assert.equal(event.competitionDate, "2026-06-14");
  assert.equal(event.ageCategory, "Minime");
  assert.equal(event.level, "Régional");
  assert.equal("weightCategory" in event, false);
  assert.deepEqual(event.participantJudokaIds, ["J1", "J2"]);
  assert.throws(
    () => createClubCompetition({ name: "", competitionDate: "2026-06-14" }),
    /Nom et date obligatoires/
  );
  assert.throws(
    () =>
      createClubCompetition({
        name: "Tournoi",
        competitionDate: "2026-06-14",
        ageCategory: "Minime"
      }),
    /Niveau de compétition obligatoire/
  );
  assert.throws(() => createClubCompetitionParticipantIds([]), /Au moins un judoka/);
});

test("competition domain carries optional club competition link", () => {
  const competition = createCompetition(
    {
      name: "Tournoi Nantes",
      competitionDate: "2026-06-14",
      clubCompetitionId: "CLUB1",
      ageCategory: "Cadet"
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
    permissions.canManageCompetition(coach, { ownerJudokaId: "J1" }, createManagedJudokaScope(["J1"])),
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
  assert.equal(competition.weightCategory, "-55kg");
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

  const minimalCompetition = createCompetition(
    { name: "Tournoi regional", competitionDate: "2026-06-11", ageCategory: "Cadet" },
    "JUDO123"
  );
  assert.equal(minimalCompetition.weightCategory, "");
  assert.equal(minimalCompetition.result, "");
  assert.throws(
    () => createCompetition({ name: "Tournoi regional", competitionDate: "2026-06-11" }, "JUDO123"),
    /Catégorie d'âge obligatoire/
  );

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
  assert.throws(
    () =>
      createCompetition(
        {
          name: "Tournoi",
          competitionDate: "2026-06-11",
          ageCategory: "Cadet",
          weightCategory: "-23kg"
        },
        "JUDO123"
      ),
    /Catégorie de poids invalide/
  );
  assert.throws(
    () =>
      createCompetition(
        {
          name: "Tournoi",
          competitionDate: "2026-06-11",
          ageCategory: "Cadet",
          level: "Interclub"
        },
        "JUDO123"
      ),
    /Niveau de compétition invalide/
  );
  assert.equal(createCompetitionRanking(" Non classé "), "Non classé");
});

test("competition domain enforces combat ownership", () => {
  const competition = {
    competitionId: "COMP123",
    ownerJudokaId: "JUDO123",
    name: "Tournoi regional",
    competitionDate: "2026-06-11",
    ageCategory: "Cadet"
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
    { category: "Ne-waza", technique: "", neWazaType: "Hon-gesa-gatame", value: "Ippon" }
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
    result: "D",
    victoryType: "Ippon"
  });
  assert.equal(updatedCombat.combatId, "CB123");
  assert.equal(updatedCombat.judokaId, "JUDO123");
  assert.equal(updatedCombat.competitionId, "COMP123");
  assert.equal(updatedCombat.opponent, "");
  assert.equal(updatedCombat.opponentStance, "");
  assert.equal(updatedCombat.result, "Défaite");
  assert.equal(updatedCombat.victoryType, "Ippon");
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
    () => createCombat({ judokaId: "JUDO123", competitionId: "COMP123", result: "Victoire" }),
    /Le type de décision est obligatoire/
  );
  assert.throws(
    () => createCombat({ judokaId: "JUDO123", competitionId: "COMP123", result: "Défaite" }),
    /Le type de décision est obligatoire/
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
  assert.throws(() => createOpponentStance("ambidextre"), /Adversaire droitier\/gaucher invalide/);
});

test("combat score category domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeCombatScoreCategory("tachi waza"), "Tachi-waza");
  assert.equal(normalizeCombatScoreCategory("TachiWaza"), "Tachi-waza");
  assert.equal(normalizeCombatScoreCategory("ne waza"), "Ne-waza");
  assert.equal(normalizeCombatScoreCategory("newaza"), "Ne-waza");
  assert.equal(normalizeCombatScoreCategory("inconnu"), "");

  assert.equal(createCombatScoreCategory("Tachi-waza"), "Tachi-waza");
  assert.throws(() => createCombatScoreCategory(""), /Catégorie de technique invalide/);
  assert.throws(() => createCombatScoreCategory("inconnu"), /Catégorie de technique invalide/);
});

test("tachi-waza technique domain normalizes known aliases and accepts free text", () => {
  assert.equal(normalizeTachiWazaTechnique("seoi-nage"), "Seoi-nage");
  assert.equal(normalizeTachiWazaTechnique("O Soto Gari"), "O-soto-gari");
  assert.equal(normalizeTachiWazaTechnique("Uchi mata spécial"), "Uchi mata spécial");

  assert.equal(createTachiWazaTechnique(""), "");
  assert.equal(createTachiWazaTechnique(undefined), "");
  assert.equal(createTachiWazaTechnique("uchi-mata"), "Uchi-mata");
  assert.equal(createTachiWazaTechnique("uchi mata inconnu"), "uchi mata inconnu");
});

test("ne-waza type domain normalizes known aliases and accepts free text", () => {
  assert.equal(normalizeNeWazaType("cle"), "Juji-gatame");
  assert.equal(normalizeNeWazaType("Clé"), "Juji-gatame");
  assert.equal(normalizeNeWazaType("Étranglement"), "Hadaka-jime");
  assert.equal(normalizeNeWazaType("Hadaka-jime"), "Hadaka-jime");
  assert.equal(normalizeNeWazaType("osaekomi"), "Hon-gesa-gatame");
  assert.equal(normalizeNeWazaType("Osaekomi"), "Hon-gesa-gatame");
  assert.equal(normalizeNeWazaType("technique inconnue"), "technique inconnue");

  assert.equal(createNeWazaType(""), "");
  assert.equal(createNeWazaType(undefined), "");
  assert.equal(createNeWazaType("Juji-gatame"), "Juji-gatame");
  assert.equal(createNeWazaType("technique inconnue"), "technique inconnue");
});

test("combat score value domain normalizes aliases and rejects unknown values", () => {
  assert.equal(normalizeCombatScoreValue("ippon"), "Ippon");
  assert.equal(normalizeCombatScoreValue("waza ari"), "Waza-ari");
  assert.equal(normalizeCombatScoreValue("yuko"), "Yuko");
  assert.equal(normalizeCombatScoreValue("inconnu"), "");

  assert.equal(createCombatScoreValue("Ippon"), "Ippon");
  assert.throws(() => createCombatScoreValue("inconnu"), /Point marqué invalide/);
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
    createCombatScore({ category: "Ne-waza", neWazaType: "Hon-gesa-gatame", value: "Waza-ari" }),
    {
      category: "Ne-waza",
      technique: "",
      neWazaType: "Hon-gesa-gatame",
      value: "Waza-ari"
    }
  );

  // COMBAT-TECH-OPT : un point sans technique (voire sans catégorie) est conservé, à préciser plus tard.
  assert.deepEqual(createCombatScore({ category: "Tachi-waza", value: "Ippon" }), {
    category: "Tachi-waza",
    technique: "",
    neWazaType: "",
    value: "Ippon"
  });
  assert.deepEqual(createCombatScore({ value: "Yuko" }), { category: "", technique: "", neWazaType: "", value: "Yuko" });
  assert.throws(() => createCombatScore({ category: "Debout ?", value: "Ippon" }), /Catégorie de technique invalide/);
  assert.throws(() => createCombatScore({ category: "Ne-waza" }), /Point marqué invalide/);
  // COMBAT-CHRONO : le rang du point dans le combat est conservé.
  assert.equal(createCombatScore({ value: "Yuko", order: 3 }).order, 3);
  // Ancien libellé erroné ramené au nom de la technique.
  assert.equal(
    createCombatScore({ category: "Tachi-waza", technique: "Sasae-tsurikomi-goshi", value: "Yuko" }).technique,
    "Sasae-tsurikomi-ashi"
  );

  assert.deepEqual(createCombatScores("not-an-array"), []);
  assert.deepEqual(createCombatScores(undefined), []);
  assert.equal(
    createCombatScore({ category: "Tachi-waza", technique: "Technique inventée", value: "Yuko" }).technique,
    "Technique inventée"
  );
  assert.equal(
    createCombatScores([
      { category: "Tachi-waza", technique: "Uchi-mata", value: "Yuko" },
      { category: "Ne-waza", neWazaType: "Juji-gatame", value: "Ippon" }
    ]).length,
    2
  );
  assert.equal(
    createCombatScore({ category: "Ne-waza", neWazaType: "Technique au sol inventée", value: "Yuko" }).neWazaType,
    "Technique au sol inventée"
  );
});

test("coach dashboard statistics domain computes victory, tachi-waza ippon, ne-waza ippon and breakdown rates", () => {
  const combats = [
    {
      judokaId: "JUDO1",
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      result: "Victoire",
      victoryType: "Ippon",
      scores: [{ category: "Tachi-waza", technique: "Seoi-nage", value: "Ippon" }],
      opponentStance: "Droitier",
      competitionLevel: "Départemental"
    },
    {
      judokaId: "JUDO2",
      judokaGender: "Femme",
      judokaHandedness: "Gaucher",
      result: "Victoire",
      victoryType: "Ippon",
      scores: [{ category: "Ne-waza", neWazaType: "Hon-gesa-gatame", value: "Ippon" }],
      opponentStance: "Gaucher",
      competitionLevel: "National"
    },
    {
      judokaId: "JUDO1",
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      result: "Défaite",
      victoryType: "Hansoku-make",
      scores: [],
      opponentStance: "Droitier",
      competitionLevel: "Départemental"
    },
    {
      judokaId: "JUDO3",
      judokaGender: "",
      judokaHandedness: "",
      result: "Défaite",
      victoryType: "Ippon",
      scores: [],
      opponentStance: "",
      competitionLevel: ""
    },
    {
      judokaId: "JUDO4",
      judokaGender: "Homme",
      judokaHandedness: "Ambidextre",
      result: "Victoire",
      victoryType: "Décision",
      scores: [],
      opponentStance: "Inconnue",
      competitionLevel: "International"
    },
    {
      judokaId: "JUDO5",
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      result: "Victoire",
      victoryType: "Forfait",
      scores: [],
      opponentStance: "Droitier",
      competitionLevel: "Régional"
    }
  ];

  const competitions = [
    { competitionId: "COMP1", level: "Départemental", result: "1er" },
    { competitionId: "COMP2", level: "National", result: "1er" },
    { competitionId: "COMP3", level: "Régional", result: "2e" },
    { competitionId: "COMP4", level: "International", result: "5e" },
    { competitionId: "COMP5", level: "International", result: "" }
  ];

  assert.deepEqual(computeCoachDashboardStats(combats, competitions), {
    analyzedCompetitions: 5,
    totalCombats: 6,
    victories: 4,
    defeats: 2,
    draws: 0,
    victoryRate: 67,
    // STAT-2 : parmi les victoires avec un point Ippon, debout ou au sol.
    ipponVictories: { total: 2, standing: 1, ground: 1 },
    victoriesByDecisionType: [
      { decisionType: "Ippon", count: 2, total: 4, rate: 50 },
      { decisionType: "Waza-ari", count: 0, total: 4, rate: 0 },
      { decisionType: "Yuko", count: 0, total: 4, rate: 0 },
      { decisionType: "Décision", count: 1, total: 4, rate: 25 },
      { decisionType: "Hansoku-make", count: 0, total: 4, rate: 0 },
      { decisionType: "Forfait", count: 1, total: 4, rate: 25 }
    ],
    defeatsByDecisionType: [
      { decisionType: "Ippon", count: 1, total: 2, rate: 50 },
      { decisionType: "Waza-ari", count: 0, total: 2, rate: 0 },
      { decisionType: "Yuko", count: 0, total: 2, rate: 0 },
      { decisionType: "Décision", count: 0, total: 2, rate: 0 },
      { decisionType: "Hansoku-make", count: 1, total: 2, rate: 50 },
      { decisionType: "Forfait", count: 0, total: 2, rate: 0 }
    ],
    // STAT-10 : garde du judoka contre garde de l'adversaire ; garde inconnue ou ambidextre exclue.
    byLateralMatchup: [
      { judokaHandedness: "Droitier", opponentStance: "Droitier", label: "Droitier contre droitier", combats: 3, victories: 2 },
      { judokaHandedness: "Droitier", opponentStance: "Gaucher", label: "Droitier contre gaucher", combats: 0, victories: 0 },
      { judokaHandedness: "Gaucher", opponentStance: "Droitier", label: "Gaucher contre droitier", combats: 0, victories: 0 },
      { judokaHandedness: "Gaucher", opponentStance: "Gaucher", label: "Gaucher contre gaucher", combats: 1, victories: 1 }
    ],
    engagedJudokas: 5,
    judokasByHandedness: [
      { handedness: "Droitier", judokaCount: 2 },
      { handedness: "Gaucher", judokaCount: 1 }
    ],
    dataQualityIssues: [
      { criterion: "judokaHandedness", label: "Droitier/gaucher du judoka non renseigné", count: 1, total: 6, rate: 17, unit: "combat" },
      { criterion: "opponentStance", label: "Droitier/gaucher de l'adversaire non renseigné", count: 1, total: 6, rate: 17, unit: "combat" },
      { criterion: "victoryType", label: "Fin du combat non renseignée", count: 0, total: 6, rate: 0, unit: "combat" },
      { criterion: "scores", label: "Points marqués non renseignés", count: 0, total: 6, rate: 0, unit: "combat" },
      // STAT-14 : le niveau se compte par compétition (5 compétitions, toutes avec un niveau).
      { criterion: "competitionLevel", label: "Niveau de compétition non renseigné", count: 0, total: 5, rate: 0, unit: "competition" },
      { criterion: "inconsistentIppon", label: "Ippon à vérifier", count: 0, total: 6, rate: 0, unit: "combat" }
    ],
    podiumsByLevel: [
      {
        level: "Départemental",
        podiums: [
          { place: "1er", label: "🥇", count: 1 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 1
      },
      {
        level: "Régional",
        podiums: [
          { place: "1er", label: "🥇", count: 0 },
          { place: "2e", label: "🥈", count: 1 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 1
      },
      {
        level: "National",
        podiums: [
          { place: "1er", label: "🥇", count: 1 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 1
      },
      {
        level: "International",
        podiums: [
          { place: "1er", label: "🥇", count: 0 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 1
      }
    ],
    topWinTechniques: [
      { technique: "Hon-gesa-gatame", count: 1 },
      { technique: "Seoi-nage", count: 1 }
    ],
    topDefeatTechniques: [],
    // STAT-16 : dans l'ordre des niveaux, puis le niveau non renseigné.
    byLevel: [
      { key: "Départemental", label: "Départemental", combats: 2, victories: 1, defeats: 1 },
      { key: "Régional", label: "Régional", combats: 1, victories: 1, defeats: 0 },
      { key: "National", label: "National", combats: 1, victories: 1, defeats: 0 },
      { key: "International", label: "International", combats: 1, victories: 1, defeats: 0 },
      { key: "", label: "Niveau non renseigné", combats: 1, victories: 0, defeats: 1 }
    ],
    byMonth: [],
    // STAT-6 : aucun point n'a de rang, aucun combat n'est compté.
    scoreHolding: { counted: 0, scoredFirst: 0, wonAfterScoringFirst: 0, lostAfterLeading: 0, wonAfterTrailing: 0 },
    groundShare: { scored: { ground: 1, counted: 2 }, conceded: { ground: 0, counted: 0 } },
    discipline: { scoredCombats: 0, shidosReceived: 0, hansokuMakeDefeats: 1 }
  });

  assert.deepEqual(computeCoachDashboardStats([]), {
    analyzedCompetitions: 0,
    totalCombats: 0,
    victories: 0,
    defeats: 0,
    draws: 0,
    victoryRate: 0,
    ipponVictories: { total: 0, standing: 0, ground: 0 },
    victoriesByDecisionType: [
      { decisionType: "Ippon", count: 0, total: 0, rate: 0 },
      { decisionType: "Waza-ari", count: 0, total: 0, rate: 0 },
      { decisionType: "Yuko", count: 0, total: 0, rate: 0 },
      { decisionType: "Décision", count: 0, total: 0, rate: 0 },
      { decisionType: "Hansoku-make", count: 0, total: 0, rate: 0 },
      { decisionType: "Forfait", count: 0, total: 0, rate: 0 }
    ],
    defeatsByDecisionType: [
      { decisionType: "Ippon", count: 0, total: 0, rate: 0 },
      { decisionType: "Waza-ari", count: 0, total: 0, rate: 0 },
      { decisionType: "Yuko", count: 0, total: 0, rate: 0 },
      { decisionType: "Décision", count: 0, total: 0, rate: 0 },
      { decisionType: "Hansoku-make", count: 0, total: 0, rate: 0 },
      { decisionType: "Forfait", count: 0, total: 0, rate: 0 }
    ],
    byLateralMatchup: [
      { judokaHandedness: "Droitier", opponentStance: "Droitier", label: "Droitier contre droitier", combats: 0, victories: 0 },
      { judokaHandedness: "Droitier", opponentStance: "Gaucher", label: "Droitier contre gaucher", combats: 0, victories: 0 },
      { judokaHandedness: "Gaucher", opponentStance: "Droitier", label: "Gaucher contre droitier", combats: 0, victories: 0 },
      { judokaHandedness: "Gaucher", opponentStance: "Gaucher", label: "Gaucher contre gaucher", combats: 0, victories: 0 }
    ],
    engagedJudokas: 0,
    // STAT-20 : la garde ne se ventile qu'à partir de 5 judokas.
    judokasByHandedness: [],
    dataQualityIssues: [
      { criterion: "judokaHandedness", label: "Droitier/gaucher du judoka non renseigné", count: 0, total: 0, rate: 0, unit: "combat" },
      { criterion: "opponentStance", label: "Droitier/gaucher de l'adversaire non renseigné", count: 0, total: 0, rate: 0, unit: "combat" },
      { criterion: "victoryType", label: "Fin du combat non renseignée", count: 0, total: 0, rate: 0, unit: "combat" },
      { criterion: "scores", label: "Points marqués non renseignés", count: 0, total: 0, rate: 0, unit: "combat" },
      { criterion: "competitionLevel", label: "Niveau de compétition non renseigné", count: 0, total: 0, rate: 0, unit: "competition" },
      { criterion: "inconsistentIppon", label: "Ippon à vérifier", count: 0, total: 0, rate: 0, unit: "combat" }
    ],
    podiumsByLevel: [
      {
        level: "Départemental",
        podiums: [
          { place: "1er", label: "🥇", count: 0 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 0
      },
      {
        level: "Régional",
        podiums: [
          { place: "1er", label: "🥇", count: 0 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 0
      },
      {
        level: "National",
        podiums: [
          { place: "1er", label: "🥇", count: 0 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 0
      },
      {
        level: "International",
        podiums: [
          { place: "1er", label: "🥇", count: 0 },
          { place: "2e", label: "🥈", count: 0 },
          { place: "3e", label: "🥉", count: 0 }
        ],
        rankedParticipations: 0
      }
    ],
    topWinTechniques: [],
    topDefeatTechniques: [],
    byLevel: [],
    byMonth: [],
    scoreHolding: { counted: 0, scoredFirst: 0, wonAfterScoringFirst: 0, lostAfterLeading: 0, wonAfterTrailing: 0 },
    groundShare: { scored: { ground: 0, counted: 0 }, conceded: { ground: 0, counted: 0 } },
    discipline: { scoredCombats: 0, shidosReceived: 0, hansokuMakeDefeats: 0 }
  });
});

test("coach dashboard statistics list judoka results, combats to complete and conceded techniques", () => {
  const combat = (combatId, judokaId, competitionId, result, extra = {}) => ({
    combatId,
    judokaId,
    competitionId,
    opponent: `Adversaire ${combatId}`,
    opponentStance: "Droitier",
    judokaGender: "Homme",
    judokaHandedness: "Droitier",
    competitionLevel: "Régional",
    result,
    victoryType: "Décision",
    scores: [],
    concededScores: [],
    ...extra
  });
  const combats = [
    combat("CB1", "JUDO1", "COMP1", "Victoire", {
      concededScores: [{ category: "Tachi-waza", technique: "O-goshi", value: "Yuko" }]
    }),
    combat("CB2", "JUDO1", "COMP1", "Défaite", {
      opponentStance: "",
      concededScores: [
        { category: "Tachi-waza", technique: "Uchi-mata", value: "Waza-ari" },
        { category: "Ne-waza", neWazaType: "Kesa-gatame", value: "Ippon" }
      ]
    }),
    combat("CB3", "JUDO2", "COMP2", "Défaite", {
      concededScores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon" }]
    })
  ];
  const competitions = [
    { competitionId: "COMP1", ownerJudokaId: "JUDO1", name: "Open de Rennes", level: "Régional", result: "3e" },
    { competitionId: "COMP2", ownerJudokaId: "JUDO2", name: "Open de Rennes", level: "Régional", result: "5e" },
    { competitionId: "COMP3", ownerJudokaId: "JUDO3", name: "Tournoi d'Angers", level: "Régional", result: "1er" }
  ];

  const stats = computeCoachDashboardStats(combats, competitions);

  // STAT-18 : aucune ligne par judoka.
  assert.equal("byJudoka" in stats, false);
  // Les saisies à compléter ne donnent que des décomptes, sans liste de combats ni de compétitions.
  assert.deepEqual(stats.dataQualityIssues.find((entry) => entry.criterion === "opponentStance"), {
    criterion: "opponentStance",
    label: "Droitier/gaucher de l'adversaire non renseigné",
    count: 1,
    total: 3,
    rate: 33,
    unit: "combat"
  });
  // TDB-5 : les techniques subies, de la plus fréquente à la moins fréquente.
  // STAT-4 : seules les techniques des défaites ; O-goshi, concédé dans une victoire, n'y est pas.
  assert.deepEqual(stats.topDefeatTechniques, [
    { technique: "Uchi-mata", count: 2 },
    { technique: "Kesa-gatame", count: 1 }
  ]);
  // Les points subis ne comptent jamais dans les techniques qui gagnent.
  assert.deepEqual(stats.topWinTechniques, []);
});

test("coach dashboard statistics counts linked club competition participations once", () => {
  const competitions = [
    { competitionId: "COMP1", clubCompetitionId: "CLUB1", level: "Départemental", result: "1er" },
    { competitionId: "COMP2", clubCompetitionId: "CLUB1", level: "Départemental", result: "2e" },
    { competitionId: "COMP3", clubCompetitionId: "", level: "Régional", result: "3e" }
  ];

  assert.equal(computeCoachDashboardStats([], competitions).analyzedCompetitions, 2);
});

// STAT-21 : hors fiche d'un judoka, aucune clé qui désigne un judoka ou un adversaire.
const NOMINATIVE_KEYS = ["judokaId", "ownerJudokaId", "judokaName", "opponent", "firstName", "lastName", "name", "email", "accountEmail"];

function findNominativeKeys(value, path = "stats") {
  if (Array.isArray(value)) return value.flatMap((item, index) => findNominativeKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(NOMINATIVE_KEYS.includes(key) ? [`${path}.${key}`] : []),
    ...findNominativeKeys(child, `${path}.${key}`)
  ]);
}

function nominativeFixture() {
  const combat = (combatId, judokaId, competitionId, result, extra = {}) => ({
    combatId,
    judokaId,
    competitionId,
    opponent: `Adversaire ${combatId}`,
    opponentStance: "",
    judokaHandedness: "",
    competitionLevel: "",
    result,
    victoryType: "",
    stage: "Poule",
    scores: [],
    concededScores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon", order: 0 }],
    ...extra
  });
  return {
    combats: [
      combat("CB1", "J1", "P1", "Victoire", { victoryType: "Ippon" }),
      combat("CB2", "J2", "P2", "Défaite"),
      combat("CB3", "J2", "P2", "Défaite"),
      combat("CB4", "J3", "P3", "Victoire", { victoryType: "Waza-ari" })
    ],
    competitions: [
      { competitionId: "P1", clubCompetitionId: "CC1", ownerJudokaId: "J1", name: "Coupe de Nantes", level: "", result: "1er", competitionDate: "2026-10-04" },
      { competitionId: "P2", clubCompetitionId: "CC1", ownerJudokaId: "J2", name: "Coupe de Nantes", level: "", result: "3e", competitionDate: "2026-10-04" },
      { competitionId: "P3", clubCompetitionId: "", ownerJudokaId: "J3", name: "Open de Rennes", level: "", result: "2e", competitionDate: "2026-12-06" }
    ]
  };
}

test("STAT-21 : les statistiques du coach ne contiennent aucune donnée nominative", () => {
  const { combats, competitions } = nominativeFixture();
  const stats = computeCoachDashboardStats(combats, competitions);

  assert.deepEqual(findNominativeKeys(stats), []);
  const serialized = JSON.stringify(stats);
  ["J1", "J2", "J3", "Adversaire CB"].forEach((needle) => assert.equal(serialized.includes(needle), false, needle));
  // Le contrôle détecte bien une clé nominative.
  assert.deepEqual(findNominativeKeys({ rows: [{ judokaId: "J1" }] }), ["stats.rows[0].judokaId"]);
});

test("saisies à compléter : décomptes seuls, le niveau compté une fois par compétition club", () => {
  const { combats, competitions } = nominativeFixture();
  const issues = computeCoachDashboardStats(combats, competitions).dataQualityIssues;

  assert.deepEqual(
    issues.map(({ criterion, count, total, unit }) => [criterion, count, total, unit]),
    [
      ["judokaHandedness", 4, 4, "combat"],
      ["opponentStance", 4, 4, "combat"],
      ["victoryType", 2, 4, "combat"],
      ["scores", 2, 4, "combat"],
      ["competitionLevel", 2, 2, "competition"],
      ["inconsistentIppon", 1, 4, "combat"]
    ]
  );
  issues.forEach((entry) => assert.equal("competitions" in entry || "combats" in entry, false));
});

test("STAT-22 : « Évolution » compte le podium d'un mois sans combat saisi", () => {
  const combats = [
    { combatId: "CB1", judokaId: "J1", competitionId: "P1", result: "Victoire" },
    { combatId: "CB2", judokaId: "J2", competitionId: "P2", result: "Défaite" }
  ];
  const competitions = [
    { competitionId: "P1", ownerJudokaId: "J1", level: "Régional", result: "1er", competitionDate: "2026-10-04" },
    { competitionId: "P2", ownerJudokaId: "J2", level: "Régional", result: "", competitionDate: "2026-10-04" },
    { competitionId: "P3", ownerJudokaId: "J2", level: "Régional", result: "3e", competitionDate: "2026-12-06" },
    { competitionId: "P4", ownerJudokaId: "J1", level: "Régional", result: "2e", competitionDate: "" }
  ];

  const stats = computeCoachDashboardStats(combats, competitions);

  assert.deepEqual(stats.byMonth, [
    { month: "2026-10", combats: 2, victories: 1, defeats: 1, podiums: 1 },
    { month: "2026-12", combats: 0, victories: 0, defeats: 0, podiums: 1 }
  ]);
  // Seul le podium sans date reste hors des mois.
  const podiumTile = stats.podiumsByLevel.reduce(
    (sum, level) => sum + level.podiums.reduce((total, podium) => total + podium.count, 0),
    0
  );
  assert.equal(stats.byMonth.reduce((sum, entry) => sum + entry.podiums, 0), podiumTile - 1);
});

test("STAT-20 : statistiques de groupe dès 2 judokas, garde de l'effectif dès 5", () => {
  const fight = (judokaId, judokaHandedness = "Droitier") => ({ judokaId, judokaHandedness, result: "Victoire" });
  const owned = (ownerJudokaId) => ({ ownerJudokaId, result: "1er", level: "Régional" });

  // Ceux qui ont combattu décident, quelles que soient les compétitions retenues.
  assert.equal(isGroupScope([fight("J1"), fight("J1")], [owned("J1"), owned("J2")]), false);
  assert.equal(isGroupScope([fight("J1"), fight("J2")], [owned("J1"), owned("J2")]), true);
  // Sans combat, les podiums d'un seul judoka resteraient nominatifs.
  assert.equal(isGroupScope([], [owned("J1"), owned("J1")]), false);
  assert.equal(isGroupScope([], [owned("J1"), owned("J2")]), true);
  assert.equal(isGroupScope([], []), true);
  assert.deepEqual(computeWithheldScope([fight("J1"), fight("J1")], [{ competitionId: "P1" }, { competitionId: "P2" }]), {
    analyzedCompetitions: 2,
    totalCombats: 2
  });

  const four = ["J1", "J2", "J3", "J4"].map((id, index) => fight(id, index ? "Droitier" : "Gaucher"));
  assert.deepEqual(computeCoachDashboardStats(four).judokasByHandedness, []);
  assert.deepEqual(computeCoachDashboardStats([...four, fight("J5")]).judokasByHandedness, [
    { handedness: "Droitier", judokaCount: 4 },
    { handedness: "Gaucher", judokaCount: 1 }
  ]);
});

test("coach dashboard statistics read rounds, months, score holding, ground share and discipline", () => {
  const point = (value, order, category = "Tachi-waza") => ({ category, technique: "Uchi-mata", neWazaType: "Kesa-gatame", value, order });
  const score = (shido) => ({
    judoka: { ippon: 0, wazaAri: 0, yuko: 0, shido },
    opponent: { ippon: 0, wazaAri: 0, yuko: 0, shido: 0 }
  });
  const combats = [
    // Mène (Yuko), puis subit un Ippon : perdu après avoir mené.
    { combatId: "CB1", judokaId: "J1", competitionId: "C1", stage: "1/4", result: "Défaite", victoryType: "Ippon", officialScore: score(2),
      scores: [point("Yuko", 0)], concededScores: [point("Ippon", 1, "Ne-waza")] },
    // Mené (Waza-ari), puis marque un Ippon : gagné après avoir été mené.
    { combatId: "CB2", judokaId: "J1", competitionId: "C1", stage: "Poule", result: "Victoire", victoryType: "Ippon", officialScore: score(1),
      scores: [point("Ippon", 1, "Ne-waza")], concededScores: [point("Waza-ari", 0)] },
    // Marque le premier et gagne.
    { combatId: "CB3", judokaId: "J1", competitionId: "C2", competitionLevel: "Régional", stage: "1/4", result: "Victoire", victoryType: "Waza-ari", officialScore: null,
      scores: [point("Waza-ari", 0)], concededScores: [] },
    // Points sans rang (combat ancien) : non compté dans la tenue du score ; défaite par Hansoku-make.
    { combatId: "CB4", judokaId: "J1", competitionId: "C2", competitionLevel: "Régional", stage: "", result: "Défaite", victoryType: "Hansoku-make", officialScore: score(3),
      scores: [{ category: "", technique: "", neWazaType: "", value: "Yuko" }], concededScores: [] }
  ];
  const competitions = [
    { competitionId: "C1", clubCompetitionId: "CLUB1", ownerJudokaId: "J1", competitionDate: "2026-10-04", level: "", result: "2e", name: "Open" },
    { competitionId: "C1B", clubCompetitionId: "CLUB1", ownerJudokaId: "J2", competitionDate: "2026-10-04", level: "", result: "", name: "Open" },
    { competitionId: "C2", ownerJudokaId: "J1", competitionDate: "2026-11-15", level: "Régional", result: "5e", name: "Coupe" }
  ];

  const stats = computeCoachDashboardStats(combats, competitions);

  // Le tour reste saisi sur le combat, mais aucune statistique par tour n'est calculée.
  assert.equal("byStage" in stats, false);
  // STAT-6 : CB4 n'a pas de rang ; CB1, CB2, CB3 sont lus point après point.
  assert.deepEqual(stats.scoreHolding, {
    counted: 3,
    scoredFirst: 2,
    wonAfterScoringFirst: 1,
    lostAfterLeading: 1,
    wonAfterTrailing: 1
  });
  // STAT-7 : le Yuko sans catégorie n'est pas compté.
  assert.deepEqual(stats.groundShare, { scored: { ground: 1, counted: 3 }, conceded: { ground: 1, counted: 2 } });
  // STAT-8 : 6 shidos sur 3 combats au score renseigné ; une défaite par Hansoku-make.
  assert.deepEqual(stats.discipline, { scoredCombats: 3, shidosReceived: 6, hansokuMakeDefeats: 1 });
  // STAT-12 : un mois par mois de compétition avec des combats.
  assert.deepEqual(stats.byMonth, [
    { month: "2026-10", combats: 2, victories: 1, defeats: 1, podiums: 1 },
    { month: "2026-11", combats: 2, victories: 1, defeats: 1, podiums: 0 }
  ]);
  // STAT-14 : la compétition club sans niveau compte une fois, sur 2 compétitions.
  const levelIssue = stats.dataQualityIssues.find((entry) => entry.criterion === "competitionLevel");
  assert.equal(levelIssue.count, 1);
  assert.equal(levelIssue.total, 2);
  // STAT-11 : participations classées par niveau.
  assert.equal(stats.podiumsByLevel.find((entry) => entry.level === "Régional").rankedParticipations, 1);
  // STAT-16 : la compétition sans niveau regroupe ses combats sur une ligne à part.
  assert.deepEqual(stats.byLevel.map((line) => [line.label, line.combats]), [
    ["Régional", 2],
    ["Niveau non renseigné", 2]
  ]);
});

test("coach dashboard statistics domain only counts an ippon victory when the scoring ippon matches the category", () => {
  const combats = [
    {
      judokaId: "JUDO1",
      result: "Victoire",
      victoryType: "Waza-ari",
      scores: [{ category: "Tachi-waza", technique: "Seoi-nage", value: "Waza-ari" }]
    },
    {
      judokaId: "JUDO2",
      result: "Victoire",
      victoryType: "Ippon",
      scores: [
        { category: "Ne-waza", neWazaType: "Hon-gesa-gatame", value: "Waza-ari" },
        { category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon" }
      ]
    }
  ];

  const stats = computeCoachDashboardStats(combats);

  // STAT-2 : une seule victoire avec un point Ippon, marqué debout.
  assert.deepEqual(stats.ipponVictories, { total: 1, standing: 1, ground: 0 });
});

test("coach dashboard statistics domain flags an ippon decision with no matching ippon score as inconsistent", () => {
  const combats = [
    {
      judokaId: "JUDO1",
      result: "Victoire",
      victoryType: "Ippon",
      scores: []
    },
    {
      judokaId: "JUDO2",
      result: "Victoire",
      victoryType: "Ippon",
      scores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon" }]
    },
    {
      judokaId: "JUDO3",
      result: "Défaite",
      victoryType: "Ippon",
      scores: []
    }
  ];

  const issue = computeCoachDashboardStats(combats).dataQualityIssues.find(
    (entry) => entry.criterion === "inconsistentIppon"
  );

  assert.deepEqual(issue, {
    criterion: "inconsistentIppon",
    label: "Ippon à vérifier",
    count: 1,
    total: 3,
    rate: 33,
    unit: "combat"
  });
});

test("coach dashboard statistics domain ranks the top 3 winning techniques, ignoring losses and unscored wins", () => {
  const combats = [
    { result: "Victoire", scores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon" }] },
    { result: "Victoire", scores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Waza-ari" }] },
    { result: "Victoire", scores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Yuko" }] },
    { result: "Victoire", scores: [{ category: "Ne-waza", neWazaType: "Hon-gesa-gatame", value: "Ippon" }] },
    { result: "Victoire", scores: [{ category: "Ne-waza", neWazaType: "Hon-gesa-gatame", value: "Waza-ari" }] },
    { result: "Victoire", scores: [{ category: "Tachi-waza", technique: "Seoi-nage", value: "Ippon" }] },
    { result: "Défaite", scores: [{ category: "Tachi-waza", technique: "O-soto-gari", value: "Ippon" }] },
    { result: "Victoire", scores: [] }
  ];

  assert.deepEqual(computeCoachDashboardStats(combats).topWinTechniques, [
    { technique: "Uchi-mata", count: 3 },
    { technique: "Hon-gesa-gatame", count: 2 },
    { technique: "Seoi-nage", count: 1 }
  ]);
});

test("category reference domain validates judoka handedness", () => {
  assert.equal(createHandedness("Droitier"), "Droitier");
  assert.equal(createHandedness(" Gaucher "), "Gaucher");
  assert.equal(createHandedness(""), "");
  assert.throws(() => createHandedness("Ambidextre"), /Garde invalide/);
});

test("category reference domain reuses the Senior weight scale for Vétéran", () => {
  assert.deepEqual(
    getWeightCategoriesFor("Vétéran", "Homme"),
    getWeightCategoriesFor("Senior", "Homme")
  );
  assert.deepEqual(
    getWeightCategoriesFor("Vétéran", "Femme"),
    getWeightCategoriesFor("Senior", "Femme")
  );
  assert.equal(createWeightCategory("-90kg", "Vétéran", "Homme"), "-90kg");
  assert.throws(
    () => createWeightCategory("-999kg", "Vétéran", "Homme"),
    /Catégorie de poids invalide/
  );
});

test("category reference domain has no official weight divisions for Poussinet/Poussin", () => {
  assert.equal(getWeightCategoriesFor("Poussinet"), null);
  assert.equal(getWeightCategoriesFor("Poussin"), null);
  assert.equal(createWeightCategory("", "Poussinet", "Homme"), "");
  assert.throws(
    () => createWeightCategory("-30kg", "Poussinet", "Homme"),
    /Catégorie de poids indisponible/
  );
});

test("category reference domain limits année dans la catégorie per age category", () => {
  assert.deepEqual(getValidYearsInCategory("Minime"), ["1", "2"]);
  assert.deepEqual(getValidYearsInCategory("Cadet"), ["1", "2", "3"]);
  assert.equal(getValidYearsInCategory("Senior"), null);
  assert.equal(getValidYearsInCategory("Vétéran"), null);
  assert.equal(createYearInCategory("3", "Cadet"), "3");
  assert.throws(() => createYearInCategory("3", "Minime"), /Année dans la catégorie invalide/);
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
  assert.deepEqual(snapshot.victoriesByDecisionType, [
    { decisionType: "Ippon", count: 1, total: 1, rate: 100 },
    { decisionType: "Waza-ari", count: 0, total: 1, rate: 0 },
    { decisionType: "Yuko", count: 0, total: 1, rate: 0 },
    { decisionType: "Décision", count: 0, total: 1, rate: 0 },
    { decisionType: "Hansoku-make", count: 0, total: 1, rate: 0 },
    { decisionType: "Forfait", count: 0, total: 1, rate: 0 }
  ]);
  assert.deepEqual(snapshot.defeatsByDecisionType, [
    { decisionType: "Ippon", count: 0, total: 1, rate: 0 },
    { decisionType: "Waza-ari", count: 0, total: 1, rate: 0 },
    { decisionType: "Yuko", count: 0, total: 1, rate: 0 },
    { decisionType: "Décision", count: 1, total: 1, rate: 100 },
    { decisionType: "Hansoku-make", count: 0, total: 1, rate: 0 },
    { decisionType: "Forfait", count: 0, total: 1, rate: 0 }
  ]);
  assert.equal(snapshot.competitionResults[0].competitionId, "COMP2");
  assert.equal(snapshot.competitionResults[0].combatRecord.label, "1V · 0D · 1N");
  assert.deepEqual(snapshot.competitionResults[0].resultBadge, {
    label: "podium",
    className: "rank-gold"
  });
  assert.equal(snapshot.lastCompetition.weightCategory, "-55 kg");
  assert.deepEqual(snapshot.topWinTechniques, []);
});

test("season statistics domain ranks the judoka's top winning techniques for the season", () => {
  const snapshot = buildJudokaProfileSnapshot({
    judoka: { judokaId: "JUDO123", firstName: "Aya", lastName: "Martin" },
    competitions: [
      {
        competitionId: "COMP1",
        name: "Tournoi A",
        competitionDate: "2026-02-01",
        ageCategory: "Cadet",
        weightCategory: "-55 kg",
        result: "1er"
      }
    ],
    combats: [
      {
        combatId: "CB1",
        competitionId: "COMP1",
        result: "V",
        victoryType: "Ippon",
        scores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon" }]
      },
      {
        combatId: "CB2",
        competitionId: "COMP1",
        result: "V",
        victoryType: "Ippon",
        scores: [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Ippon" }]
      },
      {
        combatId: "CB3",
        competitionId: "COMP1",
        result: "V",
        victoryType: "Ippon",
        scores: [{ category: "Ne-waza", neWazaType: "Hon-gesa-gatame", value: "Ippon" }]
      },
      {
        combatId: "CB4",
        competitionId: "COMP1",
        result: "D",
        victoryType: "Ippon",
        scores: [{ category: "Tachi-waza", technique: "O-soto-gari", value: "Ippon" }]
      }
    ],
    getCompetitionCategoryLabel: (competition) =>
      [competition.ageCategory, competition.weightCategory].filter(Boolean).join(" - "),
    getCurrentSeasonBounds: () => ({ start: "2025-09-01", end: "2026-08-31", label: "2025-2026" }),
    isDateWithinSeason: (dateValue, bounds) => dateValue >= bounds.start && dateValue <= bounds.end
  });

  assert.deepEqual(snapshot.topWinTechniques, [
    { technique: "Uchi-mata", count: 2 },
    { technique: "Hon-gesa-gatame", count: 1 }
  ]);
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
  const findDefeatEntry = (decisionType) =>
    snapshot.defeatsByDecisionType.find((entry) => entry.decisionType === decisionType);
  assert.equal(findDefeatEntry("Ippon").count, 1);
  assert.equal(findDefeatEntry("Décision").count, 0);
  assert.equal(findDefeatEntry("Hansoku-make").count, 1);
  assert.equal(findDefeatEntry("Forfait").count, 1);
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

test("normalizeBeltColor ramène la casse et les accents à la couleur proposée", () => {
  const { normalizeBeltColor } = require("../core/domain/access/belt-color");
  assert.equal(normalizeBeltColor("marron"), "Marron");
  assert.equal(normalizeBeltColor(" blanc - jaune "), "Blanc-Jaune");
  assert.equal(normalizeBeltColor("NOIR 1ER DAN"), "Noir 1er Dan");
  assert.equal(normalizeBeltColor("Rouge"), "Rouge");
  assert.equal(normalizeBeltColor(null), "");
});

test("combat round is optional, normalized and validated", () => {
  const { createCombatStage, getCombatStageOrder } = require("../core/domain/competitions/combat-stage");
  assert.equal(createCombatStage(""), "");
  assert.equal(createCombatStage("1/4 de finale"), "1/4");
  assert.equal(createCombatStage("demi-finale"), "1/2");
  assert.equal(createCombatStage("repechage"), "Repêchage");
  assert.equal(createCombatStage("Place de 3"), "Place de 3");
  assert.throws(() => createCombatStage("Quart de poule"), /Étape du combat invalide/);
  assert.ok(getCombatStageOrder("Poule") < getCombatStageOrder("1/8"));
  assert.ok(getCombatStageOrder("1/2") < getCombatStageOrder("Finale"));

  const combat = createCombat({
    competitionId: "COMP1",
    judokaId: "J1",
    stage: "1/8",
    result: "Victoire",
    victoryType: "Ippon"
  });
  assert.equal(combat.stage, "1/8");
  assert.equal(combat.draft.stage, "1/8");
  assert.equal(createCombat({ competitionId: "COMP1", judokaId: "J1", result: "Egalité" }).stage, "");
});

test("tani-otoshi is a standing technique distinct from tai-otoshi", () => {
  const { TACHI_WAZA_TECHNIQUES, normalizeTachiWazaTechnique } = require("../core/domain/competitions/tachi-waza-technique");
  assert.ok(TACHI_WAZA_TECHNIQUES.includes("Tani-otoshi"));
  assert.equal(normalizeTachiWazaTechnique("tani otoshi"), "Tani-otoshi");
  assert.equal(normalizeTachiWazaTechnique("tai otoshi"), "Tai-otoshi");
});

test("a combat keeps the opponent's points (conceded scores) apart from the judoka's points", () => {
  const { createCombat } = require("../core/domain/competitions/combat");
  const combat = createCombat({
    competitionId: "COMP1",
    judokaId: "JUDO1",
    result: "Défaite",
    victoryType: "Ippon",
    scores: [{ category: "Tachi-waza", technique: "Seoi-nage", value: "Waza-ari" }],
    concededScores: [{ category: "Tachi-waza", technique: "uchi mata", value: "Ippon" }]
  });
  assert.deepEqual(combat.scores, [{ category: "Tachi-waza", technique: "Seoi-nage", neWazaType: "", value: "Waza-ari" }]);
  assert.deepEqual(combat.draft.concededScores, [{ category: "Tachi-waza", technique: "Uchi-mata", neWazaType: "", value: "Ippon" }]);
  assert.deepEqual(createCombat({ competitionId: "COMP1", judokaId: "JUDO1", result: "Victoire", victoryType: "Décision" }).concededScores, []);
});

test("COMBAT-SCORE : le score officiel IWY - IWY est facultatif, borné et distingue vide et inchangé", () => {
  const base = {
    competitionId: "COMP1",
    judokaId: "JUDO1",
    opponent: "Lee",
    result: "Victoire",
    victoryType: "Décision"
  };

  const scored = createCombat({
    ...base,
    officialScore: { judoka: { ippon: 0, wazaAri: 1, yuko: 2 }, opponent: { ippon: 0, wazaAri: 0, yuko: 1 } }
  });
  assert.deepEqual(scored.officialScore, {
    judoka: { ippon: 0, wazaAri: 1, yuko: 2, shido: 0 },
    opponent: { ippon: 0, wazaAri: 0, yuko: 1, shido: 0 }
  });
  // Valeur manquante dans un camp : 0.
  assert.deepEqual(createCombat({ ...base, officialScore: { judoka: { yuko: 1 } } }).officialScore, {
    judoka: { ippon: 0, wazaAri: 0, yuko: 1, shido: 0 },
    opponent: { ippon: 0, wazaAri: 0, yuko: 0, shido: 0 }
  });
  // COMBAT-SHIDO : shidos de 0 à 3 ; un Ippon par camp au plus.
  assert.equal(createCombat({ ...base, officialScore: { judoka: { shido: 3 }, opponent: {} } }).officialScore.judoka.shido, 3);
  assert.throws(
    () => createCombat({ ...base, officialScore: { judoka: { shido: 4 }, opponent: {} } }),
    /Shido doit être un entier entre 0 et 3/
  );
  assert.throws(
    () => createCombat({ ...base, officialScore: { judoka: { ippon: 2 }, opponent: {} } }),
    /Ippon doit être un entier entre 0 et 1/
  );
  assert.equal(createCombat({ ...base, officialScore: null }).officialScore, null);
  assert.equal(createCombat(base).officialScore, undefined);
  assert.throws(
    () => createCombat({ ...base, officialScore: { judoka: { wazaAri: 10 }, opponent: {} } }),
    /entre 0 et 9/
  );
  assert.throws(
    () => createCombat({ ...base, officialScore: { judoka: { yuko: -1 }, opponent: {} } }),
    /entre 0 et 9/
  );
  assert.throws(
    () => createCombat({ ...base, officialScore: { judoka: { wazaAri: 1.5 }, opponent: {} } }),
    /entre 0 et 9/
  );
});

test("INSCR-2 : saison d'une date et inscription pour une compétition", () => {
  const { getSeasonStartYear, isRegisteredForCompetitionDate, formatSeasonLabel } = require("../core/domain/season");
  assert.equal(getSeasonStartYear("2026-08-31"), 2025);
  assert.equal(getSeasonStartYear("2026-09-01"), 2026);
  assert.equal(getSeasonStartYear(""), null);
  assert.equal(formatSeasonLabel(2026), "2026-2027");
  // Inscrit en 2026 : compétitions jusqu'à la saison 2026-2027.
  assert.equal(isRegisteredForCompetitionDate(2026, "2027-05-01"), true);
  assert.equal(isRegisteredForCompetitionDate(2026, "2025-10-01"), true);
  assert.equal(isRegisteredForCompetitionDate(2026, "2027-09-01"), false);
  assert.equal(isRegisteredForCompetitionDate(null, "2026-10-01"), false);
  assert.equal(isRegisteredForCompetitionDate(undefined, "2026-10-01"), false);
  // Date illisible : laissée aux autres contrôles.
  assert.equal(isRegisteredForCompetitionDate(null, ""), true);
});
