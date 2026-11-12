const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../core/domain/access/permission-policy");
const { createCompetition, createPersistedCompetition } = require("../core/domain/competitions/competition");
const { updateCombat } = require("../core/domain/competitions/combat");
const { createManagedJudokaScope } = require("../core/domain/access/managed-judoka-scope");
const createCombatsService = require("../core/services/combats.service");
const createCompetitionsService = require("../core/services/competitions.service");
const { toCanonicalJudoka } = require("../core/services/domain-adapters");
const { normalizeLastName } = require("../core/shared/text");

test("le cycle de vie d'une compétition d'Hugo enregistre 3 combats puis la valide", async () => {
  const competitionRows = new Map();
  const combatRows = new Map();
  const combatScores = new Map();
  let combatSequence = 0;

  const domainUser = toCanonicalJudoka({
    id_judoka: "ALI1",
    profile_type: "JUDOKA",
    role: "NORMAL",
    prenom: "Hugo",
    nom: "Test"
  });
  const userContextService = {
    getDomainUserContext: async () => ({
      domainUser,
      judokas: [],
      managedJudokaScope: createManagedJudokaScope([])
    })
  };

  const competitionsRepository = {
    existsForJudoka: async (judokaId, name, date) =>
      [...competitionRows.values()].find(
        (competition) =>
          competition.id_judoka === judokaId &&
          competition.nom === name &&
          competition.date === date
      ) || null,
    getById: async (id) => competitionRows.get(id) || null,
    insert: async (competition, id) => {
      const row = {
        id_competition: id,
        id_judoka: competition.ownerJudokaId,
        nom: competition.draft.name,
        date: competition.draft.competitionDate,
        categorie_age: competition.draft.ageCategory,
        categorie_poids: competition.draft.weightCategory,
        niveau: competition.draft.level,
        classement: competition.result || ""
      };
      competitionRows.set(id, row);
      return row;
    },
    updateResult: async (id, finalization) => {
      const row = competitionRows.get(id);
      row.classement = finalization.result;
      return row;
    }
  };

  const competitionsService = createCompetitionsService({
    combatsRepository: {
      listByCompetitionWithScores: async (id) =>
        [...combatRows.values()]
          .filter((combat) => combat.id_competition === id)
          .map((combat) => ({ ...combat, combat_scores: [] })),
      listSuggestionsByJudoka: async () => []
    },
    competitionsRepository,
    userContextService,
    normalizeLastName,
    canManageCombatFor: permissions.canManageCombatFor,
    canManageCompetition: permissions.canManageCompetition,
    assertCanAccessCompetition: permissions.assertCanAccessCompetition,
    assertCanManageCompetition: permissions.assertCanManageCompetition,
    resolveJudokaDataAccess: permissions.resolveJudokaDataAccess,
    resolveCompetitionOwnerId: permissions.resolveCompetitionOwnerId,
    buildCompetitionId: () => "COMP_ALI_2026_08_29",
    createCompetition,
    createPersistedCompetition
  });

  const combatsService = createCombatsService({
    combatsRepository: {
      getById: async (id) => combatRows.get(id) || null,
      insert: async (combat, id) => {
        const row = {
          id_combat: id,
          id_competition: combat.competitionId,
          id_judoka: combat.judokaId,
          resultat: combat.result,
          type_victoire: combat.victoryType,
          adversaire: combat.opponent,
          garde_adversaire: combat.opponentStance,
          notes: combat.notes
        };
        combatRows.set(id, row);
        return row;
      }
    },
    combatScoresRepository: {
      replaceForCombat: async (id, scores) => {
        combatScores.set(id, scores);
        return [];
      }
    },
    competitionsRepository,
    userContextService,
    normalizeLastName,
    assertCanManageCombatFor: permissions.assertCanManageCombatFor,
    createCombatUpdate: updateCombat,
    createPersistedCompetition,
    buildCombatId: () => `COMBAT_ALI_${++combatSequence}`
  });

  const creation = await competitionsService.methods.saveCompetition("hugo@example.com", {
    name: "Tournoi d'été",
    competitionDate: "2026-08-29",
    ageCategory: "Senior",
    level: "Régional"
  });

  assert.equal(creation.success, true);
  assert.equal(creation.competitionId, "COMP_ALI_2026_08_29");
  assert.equal(competitionRows.get(creation.competitionId).id_judoka, "ALI1");
  assert.equal(competitionRows.get(creation.competitionId).date, "2026-08-29");

  const combats = [
    { result: "Victoire", victoryType: "Ippon", opponent: "Judo 1" },
    { result: "Défaite", victoryType: "Décision", opponent: "Judo 2" },
    { result: "Egalité", victoryType: "Hiki wake", opponent: "Judo 3" }
  ];

  for (const combat of combats) {
    const result = await combatsService.methods.ajouterCombat("hugo@example.com", {
      competitionId: creation.competitionId,
      judokaId: "ALI1",
      ...combat
    });
    assert.equal(result.success, true);
    // ECRIT-2 : l'écriture renvoie le combat enregistré, sans relire la compétition.
    assert.equal(result.competitionId, creation.competitionId);
    assert.equal(result.combat.combatId, `COMBAT_ALI_${combatSequence}`);
  }

  const detail = await competitionsService.methods.getCompetitionDetail(
    "hugo@example.com",
    creation.competitionId
  );
  assert.equal(detail.combats.length, 3);

  const storedCombats = [...combatRows.values()];
  assert.equal(storedCombats.length, 3);
  assert.ok(storedCombats.every((combat) => combat.id_competition === creation.competitionId));
  assert.ok(storedCombats.every((combat) => combat.id_judoka === "ALI1"));

  const finalization = await competitionsService.methods.finalizeCompetition(
    "hugo@example.com",
    creation.competitionId,
    "1er"
  );

  assert.equal(finalization.success, true);
  assert.equal(competitionRows.get(creation.competitionId).classement, "1er");
});
