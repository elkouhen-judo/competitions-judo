const test = require("node:test");
const assert = require("node:assert/strict");

const createCombatsRepository = require("../core/repositories/combats.repository");
const createCompetitionsRepository = require("../core/repositories/competitions.repository");
const createClubCompetitionsRepository = require("../core/repositories/club-competitions.repository");
const createInvitationsRepository = require("../core/repositories/invitations.repository");
const createJudokasRepository = require("../core/repositories/judokas.repository");
const { toCanonicalCombat } = require("../core/services/domain-adapters");

function createRepositoryDeps(calls) {
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
    supabaseSelect: async () => [],
    supabaseSelectOne: async () => null
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
  await judokasRepository.updateManagedChild("JUDO1", {
    accountEmail: null,
    name: {
      firstName: "Aya",
      lastName: "Martin"
    }
  });
  await competitionsRepository.insert(
    {
      ownerJudokaId: "JUDO1",
      draft: {
        name: "Tournoi",
        competitionDate: "2026-06-11",
        ageCategory: "",
        weightCategory: "",
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
        result: "V",
        victoryType: "",
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
      "patch",
      "judokas",
      "id_judoka=eq.JUDO1",
      {
        email: null,
        prenom: "Aya",
        nom: "Martin"
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
        result: "Victoire",
        victoryType: "Ippon",
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
      result: "Défaite",
      victoryType: "Décision",
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
        resultat: "D",
        type_victoire: "Décision",
        deroule: ""
      }
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
    weightCategory: "-50kg"
  });

  assert.deepEqual(calls[0], [
    "insert",
    "club_competitions",
    {
      id_club_competition: "CLUB1",
      nom: "Tournoi Nantes",
      date: "2026-06-14",
      categorie_age: "Minime",
      categorie_poids: "-50kg"
    }
  ]);
});

test("combat read models normalize legacy result codes", () => {
  assert.equal(toCanonicalCombat({ resultat: "V" }).result, "Victoire");
  assert.equal(toCanonicalCombat({ resultat: "D" }).result, "Défaite");
  assert.equal(toCanonicalCombat({ resultat: "E" }).result, "Egalité");
  assert.equal(toCanonicalCombat({ resultat: "Disqualification" }).result, "Défaite");
});
