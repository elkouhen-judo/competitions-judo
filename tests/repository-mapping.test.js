const test = require("node:test");
const assert = require("node:assert/strict");

const createCombatsRepository = require("../core/repositories/combats.repository");
const createCompetitionsRepository = require("../core/repositories/competitions.repository");
const createInvitationsRepository = require("../core/repositories/invitations.repository");
const createJudokasRepository = require("../core/repositories/judokas.repository");

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
  await competitionsRepository.insert({
    ownerJudokaId: "JUDO1",
    draft: {
      name: "Tournoi",
      competitionDate: "2026-06-11",
      ageCategory: "",
      weightCategory: "",
      result: ""
    }
  }, "COMP1");
  await combatsRepository.insert({
    judokaId: "JUDO1",
    competitionId: "COMP1",
    draft: {
      opponent: "",
      result: "V",
      victoryType: "",
      notes: ""
    }
  }, "CB1");
  await invitationsRepository.insert({
    email: "parent@example.com",
    invited_profile_type: "PARENT",
    invited_by: "ADMIN1"
  });

  assert.deepEqual(calls, [
    ["insert", "judokas", {
      id_judoka: "JUDO1",
      email: "child@example.com",
      prenom: "Aya",
      nom: "Martin",
      profile_type: "JUDOKA",
      role: "NORMAL"
    }],
    ["patch", "judokas", "id_judoka=eq.JUDO1", {
      email: null,
      prenom: "Aya",
      nom: "Martin"
    }],
    ["insert", "competitions", {
      id_competition: "COMP1",
      id_judoka: "JUDO1",
      nom: "Tournoi",
      date: "2026-06-11",
      categorie_age: "",
      categorie_poids: "",
      classement: ""
    }],
    ["insert", "combats", {
      id_combat: "CB1",
      id_judoka: "JUDO1",
      id_competition: "COMP1",
      adversaire: "",
      resultat: "V",
      type_victoire: "",
      deroule: ""
    }],
    ["insert", "access_invitations", {
      email: "parent@example.com",
      invited_profile_type: "PARENT",
      invited_by: "ADMIN1"
    }]
  ]);
});
