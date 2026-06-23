const test = require("node:test");
const assert = require("./helpers/relaxed-assert");

const createCombatsRepository = require("../core/repositories/combats.repository");
const createCombatScoresRepository = require("../core/repositories/combat-scores.repository");
const createCompetitionsRepository = require("../core/repositories/competitions.repository");
const createClubCompetitionsRepository = require("../core/repositories/club-competitions.repository");
const createInvitationsRepository = require("../core/repositories/invitations.repository");
const createJudokasRepository = require("../core/repositories/judokas.repository");
const createParentLinksRepository = require("../core/repositories/parent-links.repository");
const { toCanonicalCombat, toCombatReadModelsWithJudokas } = require("../core/services/domain-adapters");

function createRepositoryDeps(calls, options = {}) {
  const { selectOneResult = null, selectResult = [] } = options;
  return {
    eqFilter: (field, value) => `${field}=eq.${value}`,
    supabaseDelete: async (table, query) => calls.push(["delete", table, query]),
    supabaseInsert: async (table, payload) => {
      calls.push(["insert", table, payload]);
      return payload;
    },
    supabasePatch: async (table, query, payload) => {
      calls.push(["patch", table, query, payload]);
      return payload;
    },
    supabaseSelect: async (table, query) => {
      calls.push(["select", table, query]);
      return selectResult;
    },
    supabaseSelectOne: async (table, query) => {
      calls.push(["selectOne", table, query]);
      return selectOneResult;
    }
  };
}

test("repositories map domain objects to supabase records", async () => {
  const calls = [];
  const deps = createRepositoryDeps(calls);
  const judokasRepository = createJudokasRepository(deps);
  const competitionsRepository = createCompetitionsRepository(deps);
  const combatsRepository = createCombatsRepository(deps);
  const invitationsRepository = createInvitationsRepository(deps);

  await judokasRepository.insert({
    judokaId: "JUDO1",
    accountEmail: "child@example.com",
    name: {
      firstName: "Aya",
      lastName: "Martin"
    },
    profileType: "JUDOKA",
    accessRole: "NORMAL",
    hasDirectAccount: () => true
  });
  await competitionsRepository.insert(
    {
      ownerJudokaId: "JUDO1",
      draft: {
        name: "Tournoi",
        competitionDate: "2026-06-11",
        ageCategory: "",
        weightCategory: "",
        level: "",
        result: ""
      }
    },
    "COMP1"
  );
  await combatsRepository.insert(
    {
      judokaId: "JUDO1",
      competitionId: "COMP1",
      draft: {
        opponent: "",
        opponentStance: "",
        result: "V",
        victoryType: "",
        scores: [],
        notes: ""
      }
    },
    "CB1"
  );
  await invitationsRepository.insert({
    email: "parent@example.com",
    invited_profile_type: "PARENT",
    invited_by: "ADMIN1"
  });

  assert.deepEqual(calls, [
    [
      "insert",
      "judokas",
      {
        id_judoka: "JUDO1",
        email: "child@example.com",
        prenom: "Aya",
        nom: "Martin",
        profile_type: "JUDOKA",
        role: "NORMAL"
      }
    ],
    [
      "insert",
      "competitions",
      {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        club_competition_id: null,
        nom: "Tournoi",
        date: "2026-06-11",
        categorie_age: "",
        categorie_poids: "",
        niveau: "",
        classement: ""
      }
    ],
    [
      "insert",
      "combats",
      {
        id_combat: "CB1",
        id_judoka: "JUDO1",
        id_competition: "COMP1",
        adversaire: "",
        garde_adversaire: "",
        resultat: "V",
        type_victoire: "",
        deroule: ""
      }
    ],
    [
      "insert",
      "access_invitations",
      {
        email: "parent@example.com",
        invited_profile_type: "PARENT",
        invited_by: "ADMIN1"
      }
    ]
  ]);
});

test("combats repository retries legacy result codes when the remote constraint is outdated", async () => {
  const calls = [];
  let insertAttempts = 0;
  let patchAttempts = 0;
  const combatsRepository = createCombatsRepository({
    eqFilter: (field, value) => `${field}=eq.${value}`,
    supabaseDelete: async () => {},
    supabaseInsert: async (table, payload) => {
      calls.push(["insert", table, payload]);
      insertAttempts += 1;
      if (insertAttempts === 1) {
        throw new Error(
          'Erreur Supabase 400 sur combats : {"code":"23514","message":"new row for relation \\"combats\\" violates check constraint \\"combats_resultat_check\\""}'
        );
      }
      return payload;
    },
    supabasePatch: async (table, query, payload) => {
      calls.push(["patch", table, query, payload]);
      patchAttempts += 1;
      if (patchAttempts === 1) {
        throw new Error(
          'Erreur Supabase 400 sur combats : {"code":"23514","message":"new row for relation \\"combats\\" violates check constraint \\"combats_resultat_check\\""}'
        );
      }
      return payload;
    },
    supabaseSelect: async () => [],
    supabaseSelectOne: async () => null
  });

  await combatsRepository.insert(
    {
      judokaId: "JUDO1",
      competitionId: "COMP1",
      draft: {
        opponent: "Lee",
        opponentStance: "",
        result: "Victoire",
        victoryType: "Ippon",
        scores: [],
        notes: ""
      }
    },
    "CB1"
  );

  await combatsRepository.update("CB1", {
    judokaId: "JUDO1",
    competitionId: "COMP1",
    draft: {
      opponent: "Lee",
      opponentStance: "",
      result: "Défaite",
      victoryType: "Décision",
      scores: [],
      notes: ""
    }
  });

  assert.deepEqual(calls, [
    [
      "insert",
      "combats",
      {
        id_combat: "CB1",
        id_judoka: "JUDO1",
        id_competition: "COMP1",
        adversaire: "Lee",
        garde_adversaire: "",
        resultat: "Victoire",
        type_victoire: "Ippon",
        deroule: ""
      }
    ],
    [
      "insert",
      "combats",
      {
        id_combat: "CB1",
        id_judoka: "JUDO1",
        id_competition: "COMP1",
        adversaire: "Lee",
        garde_adversaire: "",
        resultat: "V",
        type_victoire: "Ippon",
        deroule: ""
      }
    ],
    [
      "patch",
      "combats",
      "id_combat=eq.CB1",
      {
        id_judoka: "JUDO1",
        id_competition: "COMP1",
        adversaire: "Lee",
        garde_adversaire: "",
        resultat: "Défaite",
        type_victoire: "Décision",
        deroule: ""
      }
    ],
    [
      "patch",
      "combats",
      "id_combat=eq.CB1",
      {
        id_judoka: "JUDO1",
        id_competition: "COMP1",
        adversaire: "Lee",
        garde_adversaire: "",
        resultat: "D",
        type_victoire: "Décision",
        deroule: ""
      }
    ]
  ]);
});

test("combat scores repository replaces a combat's scores with deterministic ids and preserves order", async () => {
  const calls = [];
  const combatScoresRepository = createCombatScoresRepository(createRepositoryDeps(calls));

  await combatScoresRepository.replaceForCombat("CB1", [
    { category: "Tachi-waza", technique: "Seoi-nage", neWazaType: "", value: "Ippon" },
    { category: "Ne-waza", technique: "", neWazaType: "Hon-gesa-gatame", value: "Waza-ari" }
  ]);

  assert.deepEqual(calls, [
    ["delete", "combat_scores", "id_combat=eq.CB1"],
    [
      "insert",
      "combat_scores",
      {
        id_combat_score: "CB1_S0",
        id_combat: "CB1",
        categorie: "Tachi-waza",
        technique: "Seoi-nage",
        type_ne_waza: "",
        valeur: "Ippon",
        ordre: 0
      }
    ],
    [
      "insert",
      "combat_scores",
      {
        id_combat_score: "CB1_S1",
        id_combat: "CB1",
        categorie: "Ne-waza",
        technique: "",
        type_ne_waza: "Hon-gesa-gatame",
        valeur: "Waza-ari",
        ordre: 1
      }
    ]
  ]);
});

test("combat scores repository batches score lookup by combat ids", async () => {
  const calls = [];
  const combatScoresRepository = createCombatScoresRepository(createRepositoryDeps(calls));
  const combatIds = Array.from({ length: 205 }, (_, index) => `CB${index + 1}`);

  await combatScoresRepository.listByCombatIds([...combatIds, "CB1", ""]);

  assert.deepEqual(calls, [
    ["select", "combat_scores", `select=*&id_combat=in.(${combatIds.slice(0, 100).join(",")})&order=ordre.asc`],
    ["select", "combat_scores", `select=*&id_combat=in.(${combatIds.slice(100, 200).join(",")})&order=ordre.asc`],
    ["select", "combat_scores", `select=*&id_combat=in.(${combatIds.slice(200).join(",")})&order=ordre.asc`]
  ]);
});

test("repositories map club competitions and participation links", async () => {
  const calls = [];
  const clubRepository = createClubCompetitionsRepository(createRepositoryDeps(calls));

  await clubRepository.insert({
    clubCompetitionId: "CLUB1",
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    ageCategory: "Minime",
    level: "Régional"
  });

  assert.deepEqual(calls[0], [
    "insert",
    "club_competitions",
    {
      id_club_competition: "CLUB1",
      nom: "Tournoi Nantes",
      date: "2026-06-14",
      categorie_age: "Minime",
      niveau: "Régional"
    }
  ]);
});

test("judokas repository maps update changes, including the age category", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(createRepositoryDeps(calls));

  await judokasRepository.update("JUDO1", {
    accountEmail: "new@example.com",
    accessRole: "COACH",
    ageCategory: "Cadet",
    weightCategory: "-55kg",
    pendingParentEmail: "parent@example.com"
  });

  assert.deepEqual(calls, [
    [
      "patch",
      "judokas",
      "id_judoka=eq.JUDO1",
      {
        email: "new@example.com",
        role: "COACH",
        categorie_age: "Cadet",
        categorie_poids: "-55kg",
        pending_parent_email: "parent@example.com"
      }
    ]
  ]);
});

test("judokas repository maps sports profile extras and update changes", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(createRepositoryDeps(calls));

  await judokasRepository.insert(
    {
      judokaId: "JUDO1",
      accountEmail: "",
      name: { firstName: "Ali", lastName: "El Kouhen" },
      profileType: "JUDOKA",
      accessRole: "NORMAL"
    },
    { couleur_ceinture: "Orange", genre: "Homme", annee_categorie: "1", lateralite: "Droitier" }
  );

  await judokasRepository.update("JUDO1", {
    beltColor: "Marron",
    gender: "Femme",
    yearInCategory: "2",
    handedness: "Gaucher"
  });

  assert.deepEqual(calls, [
    [
      "insert",
      "judokas",
      {
        id_judoka: "JUDO1",
        email: "",
        prenom: "Ali",
        nom: "El Kouhen",
        profile_type: "JUDOKA",
        role: "NORMAL",
        couleur_ceinture: "Orange",
        genre: "Homme",
        annee_categorie: "1",
        lateralite: "Droitier"
      }
    ],
    [
      "patch",
      "judokas",
      "id_judoka=eq.JUDO1",
      {
        couleur_ceinture: "Marron",
        genre: "Femme",
        annee_categorie: "2",
        lateralite: "Gaucher"
      }
    ]
  ]);
});

test("judokas repository update accepts the snake_case role/profileType/name aliases used for name-based activation", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(createRepositoryDeps(calls));

  await judokasRepository.update("JUDO2", {
    profile_type: "JUDOKA",
    role: "NORMAL",
    name: { firstName: "Ali", lastName: "El Kouhen" }
  });

  assert.deepEqual(calls, [
    [
      "patch",
      "judokas",
      "id_judoka=eq.JUDO2",
      {
        profile_type: "JUDOKA",
        role: "NORMAL",
        prenom: "Ali",
        nom: "El Kouhen"
      }
    ]
  ]);
});

test("judokas repository update prefers camelCase aliases over snake_case ones when both are provided", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(createRepositoryDeps(calls));

  await judokasRepository.update("JUDO3", {
    accountEmail: "camel@example.com",
    email: "snake@example.com",
    accessRole: "ADMIN",
    role: "NORMAL"
  });

  assert.deepEqual(calls, [
    ["patch", "judokas", "id_judoka=eq.JUDO3", { email: "camel@example.com", role: "ADMIN" }]
  ]);
});

test("judokas repository builds case-insensitive, url-encoded lookup queries", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(createRepositoryDeps(calls));

  await judokasRepository.getByEmail(" Ali+Test@Example.com ");
  await judokasRepository.getByName(" Aïcha ", " O'Brien ");
  await judokasRepository.getById("JUDO1");

  assert.deepEqual(calls, [
    ["selectOne", "judokas", `select=*&email=ilike.${encodeURIComponent("Ali+Test@Example.com")}`],
    [
      "selectOne",
      "judokas",
      `select=*&prenom=ilike.${encodeURIComponent("Aïcha")}&nom=ilike.${encodeURIComponent("O'Brien")}`
    ],
    ["selectOne", "judokas", "select=*&id_judoka=eq.JUDO1"]
  ]);
});

test("competitions repository maps update, finalization and coach annotation patches", async () => {
  const calls = [];
  const competitionsRepository = createCompetitionsRepository(createRepositoryDeps(calls));

  await competitionsRepository.update("COMP1", {
    ownerJudokaId: "JUDO1",
    clubCompetitionId: "CLUB1",
    draft: {
      name: "Tournoi",
      competitionDate: "2026-06-11",
      ageCategory: "Minime",
      weightCategory: "-50kg",
      level: "Régional"
    },
    result: "1er"
  });
  await competitionsRepository.updateResult("COMP1", {
    competitionId: "COMP1",
    ownerJudokaId: "JUDO1",
    result: "2e"
  });
  await competitionsRepository.updateCoachObjective("COMP1", "Travailler le ne-waza");
  await competitionsRepository.updateCoachReview("COMP1", "Bon combat");
  await competitionsRepository.detachFromClubCompetition("COMP1");
  await competitionsRepository.remove("COMP2");
  await competitionsRepository.removeByJudoka("JUDO1");

  assert.deepEqual(calls, [
    [
      "patch",
      "competitions",
      "id_competition=eq.COMP1",
      {
        id_judoka: "JUDO1",
        club_competition_id: "CLUB1",
        nom: "Tournoi",
        date: "2026-06-11",
        categorie_age: "Minime",
        categorie_poids: "-50kg",
        niveau: "Régional",
        classement: "1er"
      }
    ],
    ["patch", "competitions", "id_competition=eq.COMP1", { classement: "2e" }],
    [
      "patch",
      "competitions",
      "id_competition=eq.COMP1",
      { coach_objective: "Travailler le ne-waza" }
    ],
    ["patch", "competitions", "id_competition=eq.COMP1", { coach_review: "Bon combat" }],
    ["patch", "competitions", "id_competition=eq.COMP1", { club_competition_id: null }],
    ["delete", "competitions", "id_competition=eq.COMP2"],
    ["delete", "competitions", "id_judoka=eq.JUDO1"]
  ]);
});

test("club competitions repository maps update without overwriting the id and removes events", async () => {
  const calls = [];
  const clubRepository = createClubCompetitionsRepository(createRepositoryDeps(calls));

  await clubRepository.update("CLUB1", {
    name: "Tournoi Nantes 2",
    competitionDate: "2026-06-15",
    ageCategory: "Cadet",
    level: "National"
  });
  await clubRepository.remove("CLUB1");

  assert.deepEqual(calls, [
    [
      "patch",
      "club_competitions",
      "id_club_competition=eq.CLUB1",
      {
        nom: "Tournoi Nantes 2",
        date: "2026-06-15",
        categorie_age: "Cadet",
        niveau: "National"
      }
    ],
    ["delete", "club_competitions", "id_club_competition=eq.CLUB1"]
  ]);
});

test("invitations repository builds case-insensitive lookup and delete queries", async () => {
  const calls = [];
  const invitationsRepository = createInvitationsRepository(createRepositoryDeps(calls));

  await invitationsRepository.getByEmail(" Christine.ElKouhen@Gmail.com ");
  await invitationsRepository.removeByEmail(" Christine.ElKouhen@Gmail.com ");

  const encoded = encodeURIComponent("Christine.ElKouhen@Gmail.com");
  assert.deepEqual(calls, [
    ["selectOne", "access_invitations", `select=*&email=ilike.${encoded}`],
    ["delete", "access_invitations", `email=ilike.${encoded}`]
  ]);
});

test("parent links repository inserts links and lists managed judoka ids by parent", async () => {
  const calls = [];
  const parentLinksRepository = createParentLinksRepository(
    createRepositoryDeps(calls, { selectResult: [{ id_judoka: "CHILD1" }] })
  );

  await parentLinksRepository.insert({ id_parent: "PARENT1", id_judoka: "CHILD1" });
  const links = await parentLinksRepository.listByParent("PARENT1");

  assert.deepEqual(calls, [
    ["insert", "parent_judokas", { id_parent: "PARENT1", id_judoka: "CHILD1" }],
    ["select", "parent_judokas", "select=id_judoka&id_parent=eq.PARENT1"]
  ]);
  assert.deepEqual(links, [{ id_judoka: "CHILD1" }]);
});

test("combat read models normalize legacy result codes", () => {
  assert.equal(toCanonicalCombat({ resultat: "V" }).result, "Victoire");
  assert.equal(toCanonicalCombat({ resultat: "D" }).result, "Défaite");
  assert.equal(toCanonicalCombat({ resultat: "E" }).result, "Egalité");
  assert.equal(toCanonicalCombat({ resultat: "Disqualification" }).result, "Défaite");
});

test("combat read models expose judoka handedness for metric quality indicators", () => {
  const [combat] = toCombatReadModelsWithJudokas(
    [{ id_combat: "CB1", id_judoka: "JUDO1", resultat: "Victoire" }],
    [{ judokaId: "JUDO1", firstName: "Ali", lastName: "El Kouhen", handedness: "Gaucher" }]
  );

  assert.equal(combat.judokaDisplayName, "Ali El Kouhen");
  assert.equal(combat.judokaHandedness, "Gaucher");
});
