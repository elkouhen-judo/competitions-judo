const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../core/domain/access/permission-policy");
const {
  createJudoka,
  createManagedChild,
  decideManagedChildRemoval
} = require("../core/domain/access/judoka");
const { createManagedJudokaScope } = require("../core/domain/access/managed-judoka-scope");
const {
  createCompetition,
  createPersistedCompetition
} = require("../core/domain/competitions/competition");
const { createClubCompetition } = require("../core/domain/competitions/club-competition");
const { updateCombat } = require("../core/domain/competitions/combat");
const createChildrenService = require("../core/services/children.service");
const createCombatsService = require("../core/services/combats.service");
const createClubCompetitionsService = require("../core/services/club-competitions.service");
const { toCanonicalJudoka } = require("../core/services/domain-adapters");

test("children service fully removes an unlinked child with no sports data", async () => {
  const calls = [];
  const service = createChildrenService({
    combatsRepository: {
      existsForJudoka: async () => null
    },
    competitionsRepository: {
      existsForJudoka: async () => null
    },
    judokasRepository: {
      remove: async (idJudoka) => calls.push(["removeJudoka", idJudoka])
    },
    parentLinksRepository: {
      getOtherByJudoka: async () => null,
      remove: async (idParent, idJudoka) => calls.push(["removeLink", idParent, idJudoka])
    },
    userContextService: {
      getCurrentUser: async () => ({
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL"
      }),
      getManagedChild: async () => ({
        id_judoka: "CHILD1",
        email: null,
        profile_type: "JUDOKA",
        role: "NORMAL"
      })
    },
    assertCanManageChildrenProfile: permissions.assertCanManageChildrenProfile,
    createJudoka,
    createManagedChild,
    decideManagedChildRemoval,
    isParent: permissions.isParent
  });

  const result = await service.methods.deleteManagedChild("parent@example.com", "CHILD1");

  assert.deepEqual(result, { success: true, message: "Enfant supprimé." });
  assert.deepEqual(calls, [
    ["removeLink", "PARENT1", "CHILD1"],
    ["removeJudoka", "CHILD1"]
  ]);
});

test("combats service rejects a combat attached to another judoka competition", async () => {
  const inserted = [];
  const service = createCombatsService({
    combatsRepository: {
      insert: async (payload) => inserted.push(payload)
    },
    competitionsRepository: {
      getById: async () => ({
        id_competition: "COMP1",
        id_judoka: "OTHER",
        nom: "Tournoi",
        date: "2026-06-11"
      })
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" },
        domainUser: toCanonicalJudoka({
          id_judoka: "JUDO1",
          profile_type: "JUDOKA",
          role: "NORMAL"
        }),
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    assertCanManageCombatFor: permissions.assertCanManageCombatFor,
    createPersistedCompetition,
    updateCombat,
    buildCombatId: () => "CB1"
  });

  await assert.rejects(
    () =>
      service.methods.ajouterCombat("judoka@example.com", {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        resultat: "V"
      }),
    /judoka de la compétition/
  );
  assert.deepEqual(inserted, []);
});

test("coach creates a club competition with linked judoka participations", async () => {
  const insertedClubEvents = [];
  const insertedCompetitions = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      insert: async (event) => insertedClubEvents.push(event),
      getById: async () => null
    },
    competitionsRepository: {
      insert: async (competition, idCompetition) =>
        insertedCompetitions.push([idCompetition, competition]),
      listByClubCompetition: async () => []
    },
    judokasRepository: {
      listByIds: async (ids) => ids.map((id) => ({ id_judoka: id, prenom: `P${id}`, nom: "TEST" }))
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "CLUB1",
    buildCompetitionId: () => `COMP${insertedCompetitions.length + 1}`,
    createClubCompetition,
    createCompetition
  });

  const result = await service.methods.saveClubCompetition("coach@example.com", {
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    participantJudokaIds: ["J1", "J2"]
  });

  assert.equal(result.clubCompetitionId, "CLUB1");
  assert.equal(insertedClubEvents.length, 1);
  assert.equal(insertedCompetitions.length, 2);
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].ownerJudokaId),
    ["J1", "J2"]
  );
});

test("detaching a club participant keeps the individual competition", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14" })
    },
    competitionsRepository: {
      getById: async () => ({
        id_competition: "COMP1",
        id_judoka: "J1",
        club_competition_id: "CLUB1",
        nom: "Tournoi",
        date: "2026-06-14"
      }),
      detachFromClubCompetition: async (id) => calls.push(["detach", id])
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition
  });

  const result = await service.methods.detachClubCompetitionParticipant(
    "coach@example.com",
    "CLUB1",
    "COMP1"
  );

  assert.deepEqual(calls, [["detach", "COMP1"]]);
  assert.match(result.message, /sans supprimer ses résultats/);
});

test("deleting a club competition removes the linked individual competitions", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14" }),
      remove: async (id) => calls.push(["removeClub", id])
    },
    competitionsRepository: {
      listByClubCompetition: async () => [
        { id_competition: "COMP1", id_judoka: "J1" },
        { id_competition: "COMP2", id_judoka: "J2" }
      ],
      remove: async (id) => calls.push(["removeCompetition", id])
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition
  });

  const result = await service.methods.deleteClubCompetition("coach@example.com", "CLUB1");

  assert.deepEqual(calls, [
    ["removeCompetition", "COMP1"],
    ["removeCompetition", "COMP2"],
    ["removeClub", "CLUB1"]
  ]);
  assert.match(result.message, /compétitions et combats des judokas associés/);
});
