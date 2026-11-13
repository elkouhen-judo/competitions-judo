const test = require("node:test");
const assert = require("./helpers/relaxed-assert");

const createCombatsRepository = require("../core/repositories/combats.repository");
const createCombatScoresRepository = require("../core/repositories/combat-scores.repository");
const createCompetitionsRepository = require("../core/repositories/competitions.repository");
const createClubsRepository = require("../core/repositories/clubs.repository");
const createClubCompetitionsRepository = require("../core/repositories/club-competitions.repository");
const createInvitationsRepository = require("../core/repositories/invitations.repository");
const createJudokasRepository = require("../core/repositories/judokas.repository");
const createParentLinksRepository = require("../core/repositories/parent-links.repository");
const { toCanonicalCombat, toCanonicalCombatScore, toCombatReadModelsWithJudokas } = require("../core/services/domain-adapters");
const { createCombat } = require("../core/domain/competitions/combat");

function createRepositoryDeps(calls, options = {}) {
  const { selectOneResult = null, selectResult = [], pageResult = { rows: [], total: 0 } } = options;
  return {
    eqFilter: (field, value) => `${field}=eq.${value}`,
    supabaseDelete: async (table, query) => calls.push(["delete", table, query]),
    supabaseInsert: async (table, payload) => {
      calls.push(["insert", table, payload]);
      return payload;
    },
    supabaseInsertMany: async (table, payloads) => {
      calls.push(["insertMany", table, payloads]);
      return payloads;
    },
    supabaseSelectPage: async (table, query, limit) => {
      calls.push(["selectPage", table, query, limit]);
      return pageResult;
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
        etape: "",
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
        etape: "",
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
        etape: "",
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
        etape: "",
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
        etape: "",
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

  const inserted = await combatScoresRepository.replaceForCombat("CB1", [
    { category: "Tachi-waza", technique: "Seoi-nage", neWazaType: "", value: "Ippon" },
    { category: "Ne-waza", technique: "", neWazaType: "Hon-gesa-gatame", value: "Waza-ari" }
  ], [
    { category: "Tachi-waza", technique: "Uchi-mata", neWazaType: "", value: "Waza-ari" }
  ]);

  // ECRIT-1 : une suppression, puis une seule insertion pour tous les points.
  assert.deepEqual(calls, [
    ["delete", "combat_scores", "id_combat=eq.CB1"],
    [
      "insertMany",
      "combat_scores",
      [
        {
          id_combat_score: "CB1_S0",
          id_combat: "CB1",
          categorie: "Tachi-waza",
          technique: "Seoi-nage",
          type_ne_waza: "",
          valeur: "Ippon",
          ordre: 0,
          camp: "JUDOKA"
        },
        {
          id_combat_score: "CB1_S1",
          id_combat: "CB1",
          categorie: "Ne-waza",
          technique: "",
          type_ne_waza: "Hon-gesa-gatame",
          valeur: "Waza-ari",
          ordre: 1,
          camp: "JUDOKA"
        },
        {
          id_combat_score: "CB1_C0",
          id_combat: "CB1",
          categorie: "Tachi-waza",
          technique: "Uchi-mata",
          type_ne_waza: "",
          valeur: "Waza-ari",
          ordre: 0,
          camp: "ADVERSAIRE"
        }
      ]
    ]
  ]);
  assert.equal(inserted.length, 3);
});

test("combat scores repository clears the scores of a combat saved without points", async () => {
  const calls = [];
  const combatScoresRepository = createCombatScoresRepository(createRepositoryDeps(calls));

  await combatScoresRepository.replaceForCombat("CB1", []);

  assert.deepEqual(calls, [
    ["delete", "combat_scores", "id_combat=eq.CB1"],
    ["insertMany", "combat_scores", []]
  ]);
});

test("COMBAT-CHRONO : le rang global du point est écrit dans ordre, tous camps confondus", async () => {
  const calls = [];
  const combatScoresRepository = createCombatScoresRepository(createRepositoryDeps(calls));

  await combatScoresRepository.replaceForCombat(
    "CB1",
    [
      { category: "Tachi-waza", technique: "Seoi-nage", neWazaType: "", value: "Waza-ari", order: 0 },
      { category: "", technique: "", neWazaType: "", value: "Yuko", order: 2 }
    ],
    [{ category: "Tachi-waza", technique: "Uchi-mata", neWazaType: "", value: "Waza-ari", order: 1 }]
  );

  const inserted = calls
    .filter((call) => call[0] === "insertMany")
    .flatMap((call) => call[2])
    .map((row) => [row.camp, row.ordre, row.categorie]);
  assert.deepEqual(inserted, [
    ["JUDOKA", 0, "Tachi-waza"],
    ["JUDOKA", 2, ""],
    ["ADVERSAIRE", 1, "Tachi-waza"]
  ]);
  assert.deepEqual(toCanonicalCombatScore({ categorie: "", technique: "", type_ne_waza: "", valeur: "Yuko", ordre: 2 }), {
    category: "",
    technique: "",
    neWazaType: "",
    value: "Yuko",
    order: 2
  });
});

test("combats repository reads combats with their scores, in batches for several competitions", async () => {
  const calls = [];
  const combatsRepository = createCombatsRepository(createRepositoryDeps(calls));
  const competitionIds = Array.from({ length: 205 }, (_, index) => `COMP${index + 1}`);
  const withScores = "select=*,combat_scores(*)&combat_scores.order=ordre.asc&order=created_at.asc,id_combat.asc";

  // DETAIL-1 : les combats d'une compétition et leurs points en une requête.
  await combatsRepository.listByCompetitionWithScores("COMP1");
  // COACH-2 : 205 compétitions = 3 lots, et non 205 requêtes.
  await combatsRepository.listByCompetitionIdsWithScores([...competitionIds, "COMP1", ""]);
  await combatsRepository.listByCompetitionIds(["COMP1", "COMP2"]);
  // DETAIL-2 : les suggestions ne lisent que l'adversaire, sa garde et les techniques.
  await combatsRepository.listSuggestionsByJudoka("JUDO1");
  await combatsRepository.listByCompetitionIdsWithScores([]);

  assert.deepEqual(calls, [
    ["select", "combats", `${withScores}&id_competition=eq.COMP1`],
    ["select", "combats", `${withScores}&id_competition=in.(${competitionIds.slice(0, 100).join(",")})`],
    ["select", "combats", `${withScores}&id_competition=in.(${competitionIds.slice(100, 200).join(",")})`],
    ["select", "combats", `${withScores}&id_competition=in.(${competitionIds.slice(200).join(",")})`],
    ["select", "combats", "select=*&id_competition=in.(COMP1,COMP2)&order=created_at.asc,id_combat.asc"],
    [
      "select",
      "combats",
      "select=adversaire,garde_adversaire,combat_scores(categorie,technique,type_ne_waza,camp)&id_judoka=eq.JUDO1&order=created_at.asc,id_combat.asc"
    ]
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
      name: { firstName: "Hugo", lastName: "Durand" },
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
        prenom: "Hugo",
        nom: "Durand",
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
    name: { firstName: "Hugo", lastName: "Durand" }
  });

  assert.deepEqual(calls, [
    [
      "patch",
      "judokas",
      "id_judoka=eq.JUDO2",
      {
        profile_type: "JUDOKA",
        role: "NORMAL",
        prenom: "Hugo",
        nom: "Durand"
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

  await judokasRepository.getByEmail(" Hugo+Test@Example.com ");
  await judokasRepository.getByName(" Aïcha ", " O'Brien ");
  await judokasRepository.getById("JUDO1");

  assert.deepEqual(calls, [
    ["selectOne", "judokas", `select=*&email=ilike.${encodeURIComponent("Hugo+Test@Example.com")}`],
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
  await competitionsRepository.detachAllFromClubCompetition("CLUB1");
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
    ["patch", "competitions", "club_competition_id=eq.CLUB1", { club_competition_id: null }],
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

  await invitationsRepository.getByEmail(" parent@example.com ");
  await invitationsRepository.removeByEmail(" parent@example.com ");

  const encoded = encodeURIComponent("parent@example.com");
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
    ["select", "parent_judokas", "select=id_judoka&id_parent=eq.PARENT1&order=id_judoka.asc"]
  ]);
  assert.deepEqual(links, [{ id_judoka: "CHILD1" }]);
});

test("CTX-1 : judokas repository reads the account with coached clubs and children in one request", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(
    createRepositoryDeps(calls, {
      selectOneResult: {
        id_judoka: "COACH1",
        email: "coach@example.com",
        role: "COACH",
        coach_clubs: [{ id_club: "NANTES" }, { id_club: "RENNES" }, { id_club: "NANTES" }],
        parent_judokas: [{ id_judoka: "CHILD1" }]
      }
    })
  );

  const identity = await judokasRepository.getIdentityByEmail(" coach+test@example.com ");

  assert.deepEqual(calls, [
    [
      "selectOne",
      "judokas",
      `select=*,coach_clubs(id_club),parent_judokas!parent_judokas_id_parent_fkey(id_judoka)&email=ilike.${encodeURIComponent("coach+test@example.com")}`
    ]
  ]);
  assert.deepEqual(identity, {
    user: { id_judoka: "COACH1", email: "coach@example.com", role: "COACH" },
    coachClubIds: ["NANTES", "RENNES"],
    childJudokaIds: ["CHILD1"]
  });

  const unknown = createJudokasRepository(createRepositoryDeps([]));
  assert.equal(await unknown.getIdentityByEmail("ghost@example.com"), null);
  // Une ligne sans lien (colonnes embarquées vides) donne des listes vides.
  const alone = createJudokasRepository(
    createRepositoryDeps([], { selectOneResult: { id_judoka: "JUDO1", coach_clubs: "", parent_judokas: [] } })
  );
  assert.deepEqual(await alone.getIdentityByEmail("judoka@example.com"), {
    user: { id_judoka: "JUDO1" },
    coachClubIds: [],
    childJudokaIds: []
  });
});

test("PAGE-3 : judokas repository reads a bounded page, by cursor, with the search sent to the server", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(
    createRepositoryDeps(calls, { pageResult: { rows: [{ id_judoka: "JUDO1" }], total: 42 } })
  );
  const order = "order=nom.asc,prenom.asc,id_judoka.asc";
  const quoted = (value) => encodeURIComponent(`"${value}"`);

  const first = await judokasRepository.listPage({ limit: 10 });
  await judokasRepository.listPage({ search: " du%pont_ ", limit: 10 });
  const next = await judokasRepository.listPage({
    search: "dup",
    after: { nom: "DUPONT, Jr", prenom: "Léo", id_judoka: "JUDO7" },
    limit: 10
  });

  assert.deepEqual(first, { rows: [{ id_judoka: "JUDO1" }], total: 42 });
  assert.deepEqual(next, { rows: [{ id_judoka: "JUDO1" }], total: 42 });
  // Chaque mot doit se trouver dans le nom, le prénom ou l'e-mail ; % et _ ne sont pas des jokers.
  const word = (value) => {
    const pattern = quoted(`*${value}*`);
    return `or(nom.ilike.${pattern},prenom.ilike.${pattern},email.ilike.${pattern})`;
  };
  const search = `and=(${word("dup")})`;
  const nom = quoted("DUPONT, Jr");
  const prenom = quoted("Léo");
  const id = quoted("JUDO7");
  assert.deepEqual(calls, [
    ["selectPage", "judokas", `select=*&${order}`, 10],
    ["selectPage", "judokas", `select=*&and=(${word("du")},${word("pont")})&${order}`, 10],
    [
      "selectPage",
      "judokas",
      `select=*&${search}&or=(nom.gt.${nom},and(nom.eq.${nom},prenom.gt.${prenom}),and(nom.eq.${nom},prenom.eq.${prenom},id_judoka.gt.${id}))&${order}`,
      10
    ],
    // Le total porte sur la recherche entière, pas sur la suite du curseur.
    ["selectPage", "judokas", `select=id_judoka&${search}`, 1]
  ]);
});

test("judokas repository batches id lookups and counts a club without listing it", async () => {
  const calls = [];
  const judokasRepository = createJudokasRepository(
    createRepositoryDeps(calls, { pageResult: { rows: [{ id_judoka: "JUDO1" }], total: 37 } })
  );
  const ids = Array.from({ length: 150 }, (_, index) => `JUDO${index + 1}`);
  const order = "order=nom.asc,prenom.asc,id_judoka.asc";

  await judokasRepository.listByIds(ids);
  assert.deepEqual(await judokasRepository.listByIds([]), []);
  await judokasRepository.listByClubIds(["NANTES", "NANTES", "RENNES"]);
  const count = await judokasRepository.countByClub("NANTES");

  assert.equal(count, 37);
  assert.deepEqual(calls, [
    ["select", "judokas", `select=*&id_judoka=in.(${ids.slice(0, 100).join(",")})&${order}`],
    ["select", "judokas", `select=*&id_judoka=in.(${ids.slice(100).join(",")})&${order}`],
    ["select", "judokas", `select=*&club_id=in.(NANTES,RENNES)&${order}`],
    ["selectPage", "judokas", "select=id_judoka&club_id=eq.NANTES", 1]
  ]);
});

test("PAGE-4 : competitions repository filters a coach scope by club, not by a list of judoka ids", async () => {
  const calls = [];
  const deps = createRepositoryDeps(calls);
  const rowsByQuery = (query) =>
    query.includes("judokas!inner")
      ? [
          { id_competition: "C2", id_judoka: "JUDO1", date: "2026-10-02", judokas: { club_id: "NANTES" }, combats: [{ resultat: "Victoire" }] },
          { id_competition: "C1", id_judoka: "COACH1", date: "2026-09-12", judokas: { club_id: "NANTES" }, combats: [] }
        ]
      : [
          { id_competition: "C1", id_judoka: "COACH1", date: "2026-09-12", combats: [] },
          { id_competition: "C3", id_judoka: "COACH1", date: "2026-11-20", combats: [] }
        ];
  deps.supabaseSelect = async (table, query) => {
    calls.push(["select", table, query]);
    return rowsByQuery(query);
  };
  const competitionsRepository = createCompetitionsRepository(deps);
  const order = "order=date.desc,id_competition.asc";

  const rows = await competitionsRepository.listInScopeWithResults({
    clubIds: ["NANTES", "RENNES"],
    judokaIds: ["COACH1"],
    dateFrom: "2026-09-01"
  });

  assert.deepEqual(calls, [
    [
      "select",
      "competitions",
      `select=*,combats(resultat),judokas!inner(club_id)&judokas.club_id=in.(NANTES,RENNES)&date=gte.2026-09-01&${order}`
    ],
    ["select", "competitions", `select=*,combats(resultat)&id_judoka=in.(COACH1)&date=gte.2026-09-01&${order}`]
  ]);
  // Les deux lectures sont fusionnées sans doublon, triées par date décroissante, sans la jointure.
  assert.deepEqual(rows, [
    { id_competition: "C3", id_judoka: "COACH1", date: "2026-11-20", combats: [] },
    { id_competition: "C2", id_judoka: "JUDO1", date: "2026-10-02", combats: [{ resultat: "Victoire" }] },
    { id_competition: "C1", id_judoka: "COACH1", date: "2026-09-12", combats: [] }
  ]);

  calls.length = 0;
  await competitionsRepository.listInScope({
    judokaIds: ["PARENT1", "CHILD1"],
    dateFrom: "2025-09-01",
    dateTo: "2026-08-31",
    ageCategory: "Cadet"
  });
  assert.deepEqual(calls, [
    [
      "select",
      "competitions",
      `select=*&id_judoka=in.(PARENT1,CHILD1)&date=gte.2025-09-01&date=lte.2026-08-31&categorie_age=eq.Cadet&${order}`
    ]
  ]);

  // Un périmètre vide ne lit rien.
  calls.length = 0;
  assert.deepEqual(await competitionsRepository.listInScope({}), []);
  assert.deepEqual(calls, []);
});

test("PAGE-2 : competitions repository reads the oldest date of a scope without listing it", async () => {
  const calls = [];
  const deps = createRepositoryDeps(calls);
  deps.supabaseSelectOne = async (table, query) => {
    calls.push(["selectOne", table, query]);
    return query.includes("judokas!inner") ? { date: "2023-10-07" } : { date: "2024-01-13" };
  };
  const competitionsRepository = createCompetitionsRepository(deps);

  const oldest = await competitionsRepository.getOldestDate({ clubIds: ["NANTES"], judokaIds: ["COACH1"] });

  assert.equal(oldest, "2023-10-07");
  assert.deepEqual(calls, [
    ["selectOne", "competitions", "select=date,judokas!inner(club_id)&judokas.club_id=in.(NANTES)&order=date.asc"],
    ["selectOne", "competitions", "select=date&id_judoka=in.(COACH1)&order=date.asc"]
  ]);

  const empty = createCompetitionsRepository(createRepositoryDeps([]));
  assert.equal(await empty.getOldestDate({ judokaIds: ["JUDO1"] }), "");
});

test("ECRIT-3 : competitions repository writes club participations in one insert and one filtered patch", async () => {
  const calls = [];
  const competitionsRepository = createCompetitionsRepository(createRepositoryDeps(calls));
  const participation = (ownerJudokaId) => ({
    ownerJudokaId,
    clubCompetitionId: "CLUB1",
    draft: { name: "Tournoi", competitionDate: "2026-06-11", ageCategory: "Minime", weightCategory: "", level: "Régional" },
    result: ""
  });

  await competitionsRepository.insertMany([
    { competition: participation("J1"), idCompetition: "COMP1" },
    { competition: participation("J2"), idCompetition: "COMP2" }
  ]);
  await competitionsRepository.updateClubCompetitionFields("CLUB1", {
    name: "Tournoi 2",
    competitionDate: "2026-06-12",
    ageCategory: "Cadet",
    level: ""
  });

  const record = (id, owner) => ({
    id_competition: id,
    id_judoka: owner,
    club_competition_id: "CLUB1",
    nom: "Tournoi",
    date: "2026-06-11",
    categorie_age: "Minime",
    categorie_poids: "",
    niveau: "Régional",
    classement: ""
  });
  assert.deepEqual(calls, [
    ["insertMany", "competitions", [record("COMP1", "J1"), record("COMP2", "J2")]],
    [
      "patch",
      "competitions",
      "club_competition_id=eq.CLUB1",
      { nom: "Tournoi 2", date: "2026-06-12", categorie_age: "Cadet", niveau: "" }
    ]
  ]);
});

test("INIT-1 : clubs and club competitions repositories filter by the coach's clubs in the query", async () => {
  const calls = [];
  const deps = createRepositoryDeps(calls, { pageResult: { rows: [], total: 4 } });
  const clubsRepository = createClubsRepository(deps);
  const clubCompetitionsRepository = createClubCompetitionsRepository(deps);

  await clubsRepository.listByIds(["NANTES", "RENNES", "NANTES"]);
  assert.deepEqual(await clubsRepository.listByIds([]), []);
  await clubCompetitionsRepository.listByClubIds(["NANTES"], "2026-09-01");
  await clubCompetitionsRepository.listByClubIds(["NANTES"], "2025-09-01", "2026-08-31");
  assert.deepEqual(await clubCompetitionsRepository.listByClubIds([]), []);
  assert.equal(await clubCompetitionsRepository.countByClub("NANTES"), 4);

  assert.deepEqual(calls, [
    ["select", "clubs", "select=id_club,nom&id_club=in.(NANTES,RENNES)&order=nom.asc,id_club.asc"],
    [
      "select",
      "club_competitions",
      "select=*&club_id=in.(NANTES)&date=gte.2026-09-01&order=date.desc,id_club_competition.asc"
    ],
    [
      "select",
      "club_competitions",
      "select=*&club_id=in.(NANTES)&date=gte.2025-09-01&date=lte.2026-08-31&order=date.desc,id_club_competition.asc"
    ],
    ["selectPage", "club_competitions", "select=id_club_competition&club_id=eq.NANTES", 1]
  ]);
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
    [{ judokaId: "JUDO1", firstName: "Hugo", lastName: "Durand", handedness: "Gaucher" }]
  );

  assert.equal(combat.judokaDisplayName, "Hugo Durand");
  assert.equal(combat.judokaHandedness, "Gaucher");
});

test("COMBAT-SCORE : le score officiel est écrit sur 6 colonnes, effacé avec null, conservé s'il est absent", async () => {
  const calls = [];
  const combatsRepository = createCombatsRepository(createRepositoryDeps(calls));
  const base = {
    competitionId: "COMP1",
    judokaId: "JUDO1",
    combatId: "CB1",
    opponent: "Lee",
    result: "Victoire",
    victoryType: "Décision"
  };

  await combatsRepository.update("CB1", createCombat({
    ...base,
    officialScore: { judoka: { ippon: 1, wazaAri: 0, yuko: 2 }, opponent: { ippon: 0, wazaAri: 1, yuko: 0 } }
  }));
  await combatsRepository.update("CB1", createCombat({ ...base, officialScore: null }));
  await combatsRepository.update("CB1", createCombat(base));

  const [scored, cleared, untouched] = calls.map((call) => call[3]);
  assert.deepEqual(
    [
      scored.score_judoka_ippon,
      scored.score_judoka_wazaari,
      scored.score_judoka_yuko,
      scored.score_adversaire_ippon,
      scored.score_adversaire_wazaari,
      scored.score_adversaire_yuko
    ],
    [1, 0, 2, 0, 1, 0]
  );
  assert.equal(cleared.score_judoka_ippon, null);
  assert.equal(cleared.score_adversaire_yuko, null);
  // COMBAT-SHIDO : les shidos suivent le score (0 par défaut, null si le score est effacé).
  assert.deepEqual([scored.score_judoka_shido, scored.score_adversaire_shido], [0, 0]);
  assert.equal(cleared.score_judoka_shido, null);
  assert.equal("score_judoka_ippon" in untouched, false);
});

test("COMBAT-SCORE : la lecture reconstruit le score officiel, null si les colonnes sont vides", () => {
  const row = {
    id_combat: "CB1",
    id_judoka: "JUDO1",
    id_competition: "COMP1",
    adversaire: "Lee",
    resultat: "Victoire",
    type_victoire: "Décision",
    deroule: ""
  };
  assert.equal(toCanonicalCombat(row).officialScore, null);
  // Une ligne relue par l'API REST porte "" à la place de null : le score reste « non renseigné ».
  const emptyColumns = Object.fromEntries(
    ["ippon", "wazaari", "yuko", "shido"].flatMap((value) => [
      [`score_judoka_${value}`, ""],
      [`score_adversaire_${value}`, ""]
    ])
  );
  assert.equal(toCanonicalCombat({ ...row, ...emptyColumns }).officialScore, null);
  assert.deepEqual(
    toCanonicalCombat({
      ...row,
      score_judoka_ippon: 1,
      score_judoka_wazaari: 0,
      score_judoka_yuko: 2,
      score_adversaire_ippon: 0,
      score_adversaire_wazaari: 1,
      score_adversaire_yuko: 0
    }).officialScore,
    { judoka: { ippon: 1, wazaAri: 0, yuko: 2, shido: 0 }, opponent: { ippon: 0, wazaAri: 1, yuko: 0, shido: 0 } }
  );
  // COMBAT-SHIDO : les shidos sont relus avec le score.
  assert.deepEqual(
    toCanonicalCombat({
      ...row,
      score_judoka_ippon: 0,
      score_judoka_wazaari: 1,
      score_judoka_yuko: 0,
      score_adversaire_ippon: 0,
      score_adversaire_wazaari: 0,
      score_adversaire_yuko: 0,
      score_judoka_shido: 1,
      score_adversaire_shido: 2
    }).officialScore,
    { judoka: { ippon: 0, wazaAri: 1, yuko: 0, shido: 1 }, opponent: { ippon: 0, wazaAri: 0, yuko: 0, shido: 2 } }
  );
});

test("SCORE-VIDE : un score entièrement nul n'est ni relu ni enregistré comme renseigné", async () => {
  const zeroColumns = Object.fromEntries(
    ["ippon", "wazaari", "yuko", "shido"].flatMap((value) => [
      [`score_judoka_${value}`, 0],
      [`score_adversaire_${value}`, 0]
    ])
  );
  const row = { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "Victoire" };
  assert.equal(toCanonicalCombat({ ...row, ...zeroColumns }).officialScore, null);
  // Un seul shido suffit à rendre le score utile.
  assert.notEqual(toCanonicalCombat({ ...row, ...zeroColumns, score_adversaire_shido: 1 }).officialScore, null);

  const calls = [];
  const combatsRepository = createCombatsRepository(createRepositoryDeps(calls));
  const zero = { ippon: 0, wazaAri: 0, yuko: 0, shido: 0 };
  await combatsRepository.update(
    "CB1",
    createCombat({
      competitionId: "COMP1",
      judokaId: "JUDO1",
      combatId: "CB1",
      opponent: "Lee",
      result: "Victoire",
      victoryType: "Décision",
      officialScore: { judoka: zero, opponent: zero }
    })
  );
  assert.equal(calls[0][3].score_judoka_ippon, null);
  assert.equal(calls[0][3].score_adversaire_shido, null);
});
