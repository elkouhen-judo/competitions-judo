const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../core/domain/access/permission-policy");
const { createJudoka, createManagedChild, decideManagedChildRemoval } = require("../core/domain/access/judoka");
const { assertCompetitionCanContainCombat } = require("../core/domain/competitions/competition");
const { createCombat, updateCombat } = require("../core/domain/competitions/combat");
const createChildrenService = require("../core/services/children.service");
const createCombatsService = require("../core/services/combats.service");

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
      remove: async idJudoka => calls.push(["removeJudoka", idJudoka])
    },
    parentLinksRepository: {
      getOtherByJudoka: async () => null,
      remove: async (idParent, idJudoka) => calls.push(["removeLink", idParent, idJudoka])
    },
    userContextService: {
      getCurrentUser: async () => ({ id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" }),
      getManagedChild: async () => ({ id_judoka: "CHILD1", email: null, profile_type: "JUDOKA", role: "NORMAL" })
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
      insert: async payload => inserted.push(payload)
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
      getCurrentUserContext: async () => ({
        user: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" },
        managedJudokaIds: []
      })
    },
    assertCompetitionCanContainCombat,
    canManageCombatFor: permissions.canManageCombatFor,
    createCombat,
    updateCombat,
    buildCombatId: () => "CB1"
  });

  await assert.rejects(
    () => service.methods.ajouterCombat("judoka@example.com", {
      id_competition: "COMP1",
      id_judoka: "JUDO1",
      resultat: "V"
    }),
    /judoka de la compétition/
  );
  assert.deepEqual(inserted, []);
});
