const test = require("node:test");
const assert = require("./helpers/relaxed-assert");

const permissions = require("../core/domain/access/permission-policy");
const { createJudoka, createManagedChild } = require("../core/domain/access/judoka");
const { createManagedJudokaScope } = require("../core/domain/access/managed-judoka-scope");
const {
  createCompetition,
  createPersistedCompetition
} = require("../core/domain/competitions/competition");
const { createClubCompetition } = require("../core/domain/competitions/club-competition");
const { updateCombat } = require("../core/domain/competitions/combat");
const createCombatsService = require("../core/services/combats.service");
const createClubCompetitionsService = require("../core/services/club-competitions.service");
const createCompetitionsService = require("../core/services/competitions.service");
const createAiAnalysisService = require("../core/services/ai-analysis.service");
const createProfileService = require("../core/services/profile.service");
const createRegistrationService = require("../core/services/registration.service");
const createUserContextService = require("../core/services/user-context.service");
const createAdminService = require("../core/services/admin.service");
const { createEmail } = require("../core/domain/access/email");
const { createProfileType } = require("../core/domain/access/profile-type");
const { toCanonicalJudoka } = require("../core/services/domain-adapters");
const { normalizeLastName, normalizeEmail } = require("../core/shared/text");
const { buildJudokaProfileSnapshot } = require("../core/domain/season-statistics");
const { getCompetitionCategoryLabel } = require("../core/domain/competition-results");
const { getCurrentSeasonBounds, isDateWithinSeason } = require("../core/domain/season");

function buildTestJudokaIdGenerator() {
  let count = 0;
  return () => `JUDO_TEST_${(count += 1)}`;
}

const cleanText = (value) => String(value || "").trim();

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
      listByIds: async (ids) =>
        ids.map((id) => ({ id_judoka: id, prenom: `P${id}`, nom: "TEST", categorie_age: "Minime" }))
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
    ageCategory: "Minime",
    participantJudokaIds: ["J1", "J2"]
  });

  assert.equal(result.clubCompetitionId, "CLUB1");
  assert.equal(insertedClubEvents.length, 1);
  assert.equal(insertedCompetitions.length, 2);
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].ownerJudokaId),
    ["J1", "J2"]
  );
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].ageCategory),
    ["Minime", "Minime"]
  );
});

test("admin cannot create a club competition", async () => {
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      insert: async () => {
        throw new Error("Unexpected insert");
      },
      getById: async () => null
    },
    competitionsRepository: {
      insert: async () => {
        throw new Error("Unexpected insert");
      },
      listByClubCompetition: async () => []
    },
    judokasRepository: {
      listByIds: async () => []
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "ADMIN1", profile_type: "JUDOKA", role: "ADMIN" },
        domainUser: toCanonicalJudoka({
          id_judoka: "ADMIN1",
          profile_type: "JUDOKA",
          role: "ADMIN"
        }),
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "CLUB1",
    buildCompetitionId: () => "COMP1",
    createClubCompetition,
    createCompetition
  });

  await assert.rejects(
    () =>
      service.methods.saveClubCompetition("admin@example.com", {
        name: "Tournoi Nantes",
        competitionDate: "2026-06-14",
        ageCategory: "Minime",
        participantJudokaIds: ["J1"]
      }),
    /réservée aux coachs/
  );
});

test("coach cannot add a judoka outside the club competition age category", async () => {
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      insert: async () => {
        throw new Error("Unexpected insert");
      },
      getById: async () => null
    },
    competitionsRepository: {
      insert: async () => {
        throw new Error("Unexpected insert");
      },
      listByClubCompetition: async () => []
    },
    judokasRepository: {
      listByIds: async (ids) =>
        ids.map((id) => ({
          id_judoka: id,
          prenom: `P${id}`,
          nom: "TEST",
          categorie_age: id === "J1" ? "Minime" : "Cadet"
        }))
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
    buildCompetitionId: () => "COMP1",
    createClubCompetition,
    createCompetition
  });

  await assert.rejects(
    () =>
      service.methods.saveClubCompetition("coach@example.com", {
        name: "Tournoi Nantes",
        competitionDate: "2026-06-14",
        ageCategory: "Minime",
        participantJudokaIds: ["J1", "J2"]
      }),
    /catégorie d'âge/
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

function createTestCompetitionsService({
  competitionsByCompetitionId = {},
  combatsByCompetitionId = {},
  combatScoresByCombatId = {},
  getDomainUserContext,
  generateCompetitionAnalysis = async () => null
} = {}) {
  const calls = {
    inserted: [],
    updated: [],
    updatedResult: [],
    coachObjective: [],
    coachReview: [],
    removed: [],
    aiAnalysis: []
  };

  const service = createCompetitionsService({
    combatsRepository: {
      listByCompetition: async (id) => combatsByCompetitionId[id] || [],
      listByCompetitionAndJudoka: async (id, judokaId) =>
        (combatsByCompetitionId[id] || []).filter(
          (combat) => String(combat.id_judoka) === String(judokaId)
        ),
      listByCompetitionAndJudokaIds: async (id, ids) =>
        (combatsByCompetitionId[id] || []).filter((combat) =>
          ids.map(String).includes(String(combat.id_judoka))
        )
    },
    combatScoresRepository: {
      listByCombatIds: async (ids) =>
        ids.flatMap((idCombat) => combatScoresByCombatId[idCombat] || [])
    },
    competitionsRepository: {
      listAll: async () => Object.values(competitionsByCompetitionId),
      listByJudoka: async (idJudoka) =>
        Object.values(competitionsByCompetitionId).filter(
          (competition) => String(competition.id_judoka) === String(idJudoka)
        ),
      listByJudokaIds: async (ids) =>
        Object.values(competitionsByCompetitionId).filter((competition) =>
          ids.map(String).includes(String(competition.id_judoka))
        ),
      getById: async (id) => competitionsByCompetitionId[id] || null,
      insert: async (draft, idCompetition) => {
        calls.inserted.push({ draft, idCompetition });
        const row = { ...draft, competitionId: idCompetition };
        competitionsByCompetitionId[idCompetition] = row;
        return row;
      },
      update: async (idCompetition, draft) => {
        calls.updated.push({ idCompetition, draft });
        return null;
      },
      updateResult: async (idCompetition, finalization) => {
        calls.updatedResult.push({ idCompetition, finalization });
        return null;
      },
      updateCoachObjective: async (idCompetition, objective) => {
        calls.coachObjective.push({ idCompetition, objective });
        return null;
      },
      updateCoachReview: async (idCompetition, review) => {
        calls.coachReview.push({ idCompetition, review });
        return null;
      },
      remove: async (idCompetition) => calls.removed.push(idCompetition)
    },
    userContextService: { getDomainUserContext },
    normalizeLastName,
    canManageCompetition: permissions.canManageCompetition,
    assertCanAccessCompetition: permissions.assertCanAccessCompetition,
    assertCanManageCompetition: permissions.assertCanManageCompetition,
    resolveJudokaDataAccess: permissions.resolveJudokaDataAccess,
    resolveCompetitionOwnerId: permissions.resolveCompetitionOwnerId,
    buildCompetitionId: () => "COMP_NEW",
    createCompetition,
    createPersistedCompetition,
    generateCompetitionAnalysis: async (idCompetition) => {
      calls.aiAnalysis.push(idCompetition);
      return generateCompetitionAnalysis(idCompetition);
    }
  });

  return { service, calls };
}

function domainContextFor(idJudoka, role, extras = {}) {
  return async () => ({
    judokas: extras.judokas || [],
    domainUser: toCanonicalJudoka({ id_judoka: idJudoka, profile_type: "JUDOKA", role }),
    managedJudokaScope: extras.managedJudokaScope || createManagedJudokaScope([])
  });
}

test("saveCompetition creates a new competition owned by the requesting judoka", async () => {
  const { service, calls } = createTestCompetitionsService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.saveCompetition("judoka@example.com", {
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14"
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Compétition créée.");
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].idCompetition, "COMP_NEW");
  assert.equal(calls.inserted[0].draft.ownerJudokaId, "JUDO1");
});

test("saveCompetition lets the owner edit their own competition", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.saveCompetition("judoka@example.com", {
    competitionId: "COMP1",
    name: "Tournoi Nantes 2",
    competitionDate: "2026-06-15"
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Compétition modifiée.");
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].idCompetition, "COMP1");
  assert.equal(calls.updated[0].draft.name, "Tournoi Nantes 2");
});

test("saveCompetition rejects editing a competition owned by another judoka", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "OTHER", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () =>
      service.methods.saveCompetition("judoka@example.com", {
        competitionId: "COMP1",
        name: "Tournoi Nantes 2",
        competitionDate: "2026-06-15"
      }),
    /Modification de cette compétition non autorisée/
  );
});

test("finalizeCompetition records the final ranking for the competition owner", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.finalizeCompetition("judoka@example.com", "COMP1", "1er");

  assert.equal(result.success, true);
  assert.deepEqual(calls.updatedResult, [
    {
      idCompetition: "COMP1",
      finalization: { competitionId: "COMP1", ownerJudokaId: "JUDO1", result: "1er" }
    }
  ]);
  assert.deepEqual(calls.aiAnalysis, ["COMP1"]);
});

test("finalizeCompetition still succeeds when AI analysis generation fails", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL"),
    generateCompetitionAnalysis: async () => {
      throw new Error("Erreur Groq 500 : indisponible");
    }
  });

  const result = await service.methods.finalizeCompetition("judoka@example.com", "COMP1", "1er");

  assert.equal(result.success, true);
  assert.equal(result.message, "Classement enregistré.");
  assert.deepEqual(calls.aiAnalysis, ["COMP1"]);
});

test("finalizeCompetition requires a competition id", async () => {
  const { service } = createTestCompetitionsService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.finalizeCompetition("judoka@example.com", "", "1er"),
    /Compétition obligatoire/
  );
});

test("saveCoachObjective lets a coach record an objective", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("COACH1", "COACH")
  });

  const result = await service.methods.saveCoachObjective(
    "coach@example.com",
    "COMP1",
    "Travailler le ne-waza"
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls.coachObjective, [
    { idCompetition: "COMP1", objective: "Travailler le ne-waza" }
  ]);
});

test("saveCoachReview rejects a normal judoka", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.saveCoachReview("judoka@example.com", "COMP1", "Bilan"),
    /Seul un coach ou administrateur/
  );
});

function createTestAiAnalysisService({
  competitionsByCompetitionId = {},
  combatsByCompetitionId = {},
  combatScoresByCombatId = {},
  groqResponse = "Analyse générée."
} = {}) {
  const calls = { prompts: [], persisted: [] };

  const service = createAiAnalysisService({
    combatsRepository: {
      listByCompetition: async (id) => combatsByCompetitionId[id] || []
    },
    combatScoresRepository: {
      listByCombatIds: async (ids) =>
        ids.flatMap((idCombat) => combatScoresByCombatId[idCombat] || [])
    },
    competitionsRepository: {
      getById: async (id) => competitionsByCompetitionId[id] || null,
      updateAiAnalysis: async (idCompetition, analysis) => {
        calls.persisted.push({ idCompetition, analysis });
        return null;
      }
    },
    groqClient: {
      generateChatCompletion: async (messages) => {
        calls.prompts.push(messages);
        return groqResponse;
      }
    }
  });

  return { service, calls };
}

test("generateCompetitionAnalysis builds a French prompt from the competition and its combats, then persists the result", async () => {
  const { service, calls } = createTestAiAnalysisService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi de Nantes",
        date: "2026-06-14",
        categorie_age: "Minime",
        categorie_poids: "-50kg",
        niveau: "Régional",
        classement: "1er"
      }
    },
    combatsByCompetitionId: {
      COMP1: [
        {
          id_combat: "CMB1",
          id_judoka: "JUDO1",
          id_competition: "COMP1",
          adversaire: "Léo Dupont",
          garde_adversaire: "Gaucher",
          resultat: "Victoire",
          type_victoire: "Ippon",
          deroule: "Bon Seoi-nage"
        }
      ]
    },
    combatScoresByCombatId: {
      CMB1: [
        { id_combat: "CMB1", categorie: "Tachi-waza", technique: "Seoi-nage", valeur: "Ippon" }
      ]
    }
  });

  const analysis = await service.generateCompetitionAnalysis("COMP1");

  assert.equal(analysis, "Analyse générée.");
  assert.equal(calls.prompts.length, 1);
  assert.equal(calls.prompts[0][0].role, "system");
  assert.match(calls.prompts[0][0].content, /analyste technique spécialisé en judo jeunesse/);
  assert.equal(calls.prompts[0][1].role, "user");
  assert.match(calls.prompts[0][1].content, /Tournoi de Nantes/);
  assert.match(calls.prompts[0][1].content, /Léo Dupont/);
  assert.match(calls.prompts[0][1].content, /Gaucher/);
  assert.match(calls.prompts[0][1].content, /Seoi-nage \(Ippon\)/);
  assert.deepEqual(calls.persisted, [{ idCompetition: "COMP1", analysis: "Analyse générée." }]);
});

test("generateCompetitionAnalysis does nothing for an unknown competition", async () => {
  const { service, calls } = createTestAiAnalysisService();

  const analysis = await service.generateCompetitionAnalysis("MISSING");

  assert.equal(analysis, null);
  assert.equal(calls.prompts.length, 0);
  assert.equal(calls.persisted.length, 0);
});

test("generateCompetitionAnalysis skips persistence when Groq returns an empty response", async () => {
  const { service, calls } = createTestAiAnalysisService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    groqResponse: ""
  });

  const analysis = await service.generateCompetitionAnalysis("COMP1");

  assert.equal(analysis, null);
  assert.equal(calls.persisted.length, 0);
});

test("deleteCompetition removes the competition when authorized", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.deleteCompetition("judoka@example.com", "COMP1");

  assert.equal(result.success, true);
  assert.deepEqual(calls.removed, ["COMP1"]);
});

test("deleteCompetition rejects when the competition does not exist", async () => {
  const { service } = createTestCompetitionsService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.deleteCompetition("judoka@example.com", "MISSING"),
    /introuvable/
  );
});

test("getCompetitionsForUser returns every competition for a coach but only owned ones for a judoka", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi A", date: "2026-06-14" },
      COMP2: { id_competition: "COMP2", id_judoka: "JUDO2", nom: "Tournoi B", date: "2026-06-15" }
    }
  });

  const coachResults = await service.getCompetitionsForUser(
    { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
    createManagedJudokaScope([])
  );
  assert.equal(coachResults.length, 2);

  const judokaResults = await service.getCompetitionsForUser(
    { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" },
    createManagedJudokaScope([])
  );
  assert.deepEqual(
    judokaResults.map((competition) => competition.competitionId),
    ["COMP1"]
  );
});

test("getCompetitionDetail enriches combats with judoka display names, scores, and exposes management flags", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    combatsByCompetitionId: {
      COMP1: [{ id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "V" }]
    },
    combatScoresByCombatId: {
      CB1: [{ id_combat: "CB1", categorie: "Tachi-waza", technique: "Seoi-nage", valeur: "Ippon" }]
    },
    getDomainUserContext: domainContextFor("COACH1", "COACH", {
      judokas: [{ id_judoka: "JUDO1", prenom: "Ali", nom: "el kouhen" }]
    })
  });

  const detail = await service.methods.getCompetitionDetail("coach@example.com", "COMP1");

  assert.equal(detail.combats[0].judokaDisplayName, "Ali EL KOUHEN");
  assert.deepEqual(detail.combats[0].scores, [
    { category: "Tachi-waza", technique: "Seoi-nage", neWazaType: "", value: "Ippon" }
  ]);
  assert.equal(detail.isCoach, true);
  assert.equal(detail.canManageCompetition, true);
});

function createTestCombatsService({
  competitionsByCompetitionId = {},
  combatsById = {},
  getDomainUserContext
} = {}) {
  const calls = { inserted: [], updated: [], removed: [], scores: [] };

  const service = createCombatsService({
    combatsRepository: {
      getById: async (id) => combatsById[id] || null,
      insert: async (draft, idCombat) => {
        calls.inserted.push({ draft, idCombat });
        return draft;
      },
      update: async (idCombat, draft) => {
        calls.updated.push({ idCombat, draft });
        return draft;
      },
      remove: async (idCombat) => calls.removed.push(idCombat)
    },
    combatScoresRepository: {
      replaceForCombat: async (idCombat, scores) => {
        calls.scores.push({ idCombat, scores });
        return scores;
      }
    },
    competitionsRepository: {
      getById: async (id) => competitionsByCompetitionId[id] || null
    },
    userContextService: { getDomainUserContext },
    assertCanManageCombatFor: permissions.assertCanManageCombatFor,
    createCombatUpdate: updateCombat,
    createPersistedCompetition,
    buildCombatId: () => "CB_NEW"
  });

  return { service, calls };
}

test("ajouterCombat records a combat the judoka is allowed to manage", async () => {
  const { service, calls } = createTestCombatsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.ajouterCombat("judoka@example.com", {
    id_competition: "COMP1",
    id_judoka: "JUDO1",
    resultat: "V",
    adversaire: "Lee",
    garde_adversaire: "gaucher",
    scores: [{ category: "ne waza", neWazaType: "osaekomi", value: "ippon" }]
  });

  assert.equal(result.success, true);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].idCombat, "CB_NEW");
  assert.equal(calls.inserted[0].draft.opponent, "Lee");
  assert.equal(calls.inserted[0].draft.opponentStance, "Gaucher");
  assert.equal(calls.inserted[0].draft.result, "Victoire");
  assert.deepEqual(calls.inserted[0].draft.scores, [
    { category: "Ne-waza", technique: "", neWazaType: "Osaekomi", value: "Ippon" }
  ]);
  assert.deepEqual(calls.scores, [
    {
      idCombat: "CB_NEW",
      scores: [{ category: "Ne-waza", technique: "", neWazaType: "Osaekomi", value: "Ippon" }]
    }
  ]);
});

test("updateCombat re-validates ownership of both the existing and the incoming combat", async () => {
  const { service, calls } = createTestCombatsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    combatsById: {
      CB1: { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "V" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.updateCombat("judoka@example.com", {
    id_combat: "CB1",
    id_competition: "COMP1",
    id_judoka: "JUDO1",
    resultat: "D"
  });

  assert.equal(result.success, true);
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].idCombat, "CB1");
  assert.equal(calls.updated[0].draft.result, "Défaite");
});

test("updateCombat rejects moving a combat to a judoka outside the requester's scope", async () => {
  const { service } = createTestCombatsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    combatsById: {
      CB1: { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "V" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () =>
      service.methods.updateCombat("judoka@example.com", {
        id_combat: "CB1",
        id_competition: "COMP1",
        id_judoka: "OTHER",
        resultat: "D"
      }),
    /Modification de ce combat non autorisée/
  );
});

test("deleteCombat removes the combat when the requester can manage it", async () => {
  const { service, calls } = createTestCombatsService({
    combatsById: {
      CB1: { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "V" }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.deleteCombat("judoka@example.com", "CB1");

  assert.equal(result.success, true);
  assert.deepEqual(calls.removed, ["CB1"]);
});

test("deleteCombat requires a combat id", async () => {
  const { service } = createTestCombatsService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.deleteCombat("judoka@example.com", ""),
    /Combat obligatoire/
  );
});

function createTestProfileService({
  competitionsByJudoka = {},
  combatsByJudoka = {},
  getAccessibleJudokaProfile
} = {}) {
  const calls = { savedNotes: [] };

  const service = createProfileService({
    combatsRepository: { listByJudoka: async (id) => combatsByJudoka[id] || [] },
    competitionsRepository: { listByJudoka: async (id) => competitionsByJudoka[id] || [] },
    judokasRepository: {
      saveCoachNotes: async (idJudoka, notes) => calls.savedNotes.push({ idJudoka, notes })
    },
    buildJudokaProfileSnapshot,
    userContextService: { getAccessibleJudokaProfile },
    getCompetitionCategoryLabel,
    getCurrentSeasonBounds,
    isDateWithinSeason
  });

  return { service, calls };
}

test("getJudokaProfile builds a season snapshot from the judoka's competitions and combats", async () => {
  const { service } = createTestProfileService({
    competitionsByJudoka: {
      JUDO1: [
        {
          id_competition: "COMP1",
          id_judoka: "JUDO1",
          nom: "Tournoi",
          date: "2026-02-01",
          categorie_age: "Cadet",
          categorie_poids: "-55kg",
          classement: "1er"
        }
      ]
    },
    combatsByJudoka: {
      JUDO1: [{ id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "V" }]
    },
    getAccessibleJudokaProfile: async () => ({
      user: { id_judoka: "JUDO1", role: "NORMAL" },
      target: { id_judoka: "JUDO1", prenom: "Aya", nom: "Martin" }
    })
  });

  const profile = await service.methods.getJudokaProfile("judoka@example.com", "JUDO1", 2025);

  assert.equal(profile.judoka.firstName, "Aya");
  assert.equal(profile.seasonCompetitionCount, 1);
  assert.equal(profile.seasonWins, 1);
  assert.equal("coachNotes" in profile, false);
});

test("getJudokaProfile exposes coach notes only when the requester is a coach", async () => {
  const { service } = createTestProfileService({
    getAccessibleJudokaProfile: async () => ({
      user: { id_judoka: "COACH1", role: "COACH" },
      target: { id_judoka: "JUDO1", prenom: "Aya", nom: "Martin", notes_coach: "Bon potentiel" }
    })
  });

  const profile = await service.methods.getJudokaProfile("coach@example.com", "JUDO1", 2025);

  assert.equal(profile.coachNotes, "Bon potentiel");
});

test("getJudokaProfile hides coach notes from a non-coach requester", async () => {
  const { service } = createTestProfileService({
    getAccessibleJudokaProfile: async () => ({
      user: { id_judoka: "JUDO1", role: "NORMAL" },
      target: { id_judoka: "JUDO1", prenom: "Aya", nom: "Martin", notes_coach: "Bon potentiel" }
    })
  });

  const profile = await service.methods.getJudokaProfile("judoka@example.com", "JUDO1", 2025);

  assert.equal("coachNotes" in profile, false);
});

test("saveCoachNotes persists notes when the requester is a coach", async () => {
  const { service, calls } = createTestProfileService({
    getAccessibleJudokaProfile: async () => ({
      user: { id_judoka: "COACH1", role: "COACH" },
      target: { id_judoka: "JUDO1" }
    })
  });

  const result = await service.methods.saveCoachNotes(
    "coach@example.com",
    "JUDO1",
    "Bon potentiel"
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls.savedNotes, [{ idJudoka: "JUDO1", notes: "Bon potentiel" }]);
});

test("saveCoachNotes rejects a non-coach requester", async () => {
  const { service } = createTestProfileService({
    getAccessibleJudokaProfile: async () => ({
      user: { id_judoka: "JUDO1", role: "NORMAL" },
      target: { id_judoka: "JUDO1" }
    })
  });

  await assert.rejects(
    () => service.methods.saveCoachNotes("judoka@example.com", "JUDO1", "Bon potentiel"),
    /Réservé au coach/
  );
});

test("registerProfile rejects a user without a pending invitation", async () => {
  const service = createRegistrationService({
    adminService: { getAccessInvitation: async () => null },
    createEmail,
    supabaseRpc: async () => {
      throw new Error("Unexpected RPC call");
    }
  });

  await assert.rejects(
    () => service.methods.registerProfile("nobody@example.com"),
    /Accès non autorisé\. Une invitation est requise/
  );
});

test("registerProfile calls register_profile with the invited profile type and a normalized email", async () => {
  const calls = [];
  const service = createRegistrationService({
    adminService: {
      getAccessInvitation: async () => ({
        email: "ali.elkouhen@gmail.com",
        invited_profile_type: "JUDOKA"
      })
    },
    createEmail,
    supabaseRpc: async (method, payload) => {
      calls.push([method, payload]);
      return { success: true };
    }
  });

  await service.methods.registerProfile(" Ali.ElKouhen@Gmail.com ", {
    firstName: "Ali",
    lastName: "El Kouhen"
  });

  assert.deepEqual(calls, [
    [
      "register_profile",
      {
        p_email: "ali.elkouhen@gmail.com",
        p_type: "JUDOKA",
        p_prenom: "Ali",
        p_nom: "El Kouhen",
        p_children: []
      }
    ]
  ]);
});

test("registerProfile defaults to JUDOKA and empty names when the invitation/profile omit them", async () => {
  const calls = [];
  const service = createRegistrationService({
    adminService: { getAccessInvitation: async () => ({ email: "x@example.com" }) },
    createEmail,
    supabaseRpc: async (method, payload) => {
      calls.push([method, payload]);
      return { success: true };
    }
  });

  await service.methods.registerProfile("x@example.com");

  assert.deepEqual(calls[0][1], {
    p_email: "x@example.com",
    p_type: "JUDOKA",
    p_prenom: "",
    p_nom: "",
    p_children: []
  });
});

function createTestUserContextService(
  judokasByEmail = {},
  judokasById = {},
  parentLinksByParent = {}
) {
  return createUserContextService({
    judokasRepository: {
      getByEmail: async (email) => judokasByEmail[String(email || "").toLowerCase()] || null,
      listAll: async () => Object.values(judokasById),
      getById: async (idJudoka) => judokasById[idJudoka] || null,
      listByIds: async (ids) => ids.map((id) => judokasById[id]).filter(Boolean)
    },
    parentLinksRepository: {
      listByParent: async (idParent) =>
        (parentLinksByParent[idParent] || []).map((idJudoka) => ({ id_judoka: idJudoka }))
    },
    normalizeEmail,
    assertCanAccessJudokaProfile: permissions.assertCanAccessJudokaProfile,
    createManagedJudokaScope,
    isAdmin: permissions.isAdmin,
    isCoach: permissions.isCoach,
    isParent: permissions.isParent
  });
}

test("getCurrentUserContext gives a normal judoka an empty managed scope", async () => {
  const service = createTestUserContextService({
    "judoka@example.com": {
      id_judoka: "JUDO1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "judoka@example.com"
    }
  });

  const context = await service.getCurrentUserContext("judoka@example.com");

  assert.equal(context.user.id_judoka, "JUDO1");
  assert.deepEqual(context.judokas, []);
  assert.deepEqual(context.managedJudokaScope.toIds(), []);
});

test("getCurrentUserContext rejects an email with no matching account", async () => {
  const service = createTestUserContextService({});

  await assert.rejects(
    () => service.getCurrentUserContext("ghost@example.com"),
    /Accès refusé pour/
  );
});

test("getCurrentUserContext gives a coach visibility into every judoka", async () => {
  const service = createTestUserContextService(
    {
      "coach@example.com": {
        id_judoka: "COACH1",
        profile_type: "JUDOKA",
        role: "COACH",
        email: "coach@example.com"
      }
    },
    {
      COACH1: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
      JUDO1: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" }
    }
  );

  const context = await service.getCurrentUserContext("coach@example.com");

  assert.deepEqual(context.judokas.map((judoka) => judoka.id_judoka).sort(), ["COACH1", "JUDO1"]);
});

test("getCurrentUserContext builds a managed scope for a parent including themself and their children", async () => {
  const service = createTestUserContextService(
    {
      "parent@example.com": {
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL",
        email: "parent@example.com"
      }
    },
    { CHILD1: { id_judoka: "CHILD1", profile_type: "JUDOKA", role: "NORMAL" } },
    { PARENT1: ["CHILD1"] }
  );

  const context = await service.getCurrentUserContext("parent@example.com");

  assert.deepEqual(
    context.judokas.map((judoka) => judoka.id_judoka),
    ["PARENT1", "CHILD1"]
  );
  assert.deepEqual(context.managedJudokaScope.toIds(), ["PARENT1", "CHILD1"]);
});

test("getCurrentUserContext does not duplicate the parent when the link query already includes them", async () => {
  const service = createTestUserContextService(
    {
      "parent@example.com": {
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL",
        email: "parent@example.com"
      }
    },
    {
      PARENT1: { id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" },
      CHILD1: { id_judoka: "CHILD1", profile_type: "JUDOKA", role: "NORMAL" }
    },
    { PARENT1: ["PARENT1", "CHILD1"] }
  );

  const context = await service.getCurrentUserContext("parent@example.com");

  assert.deepEqual(
    context.judokas.map((judoka) => judoka.id_judoka),
    ["PARENT1", "CHILD1"]
  );
});

test("getAccessibleJudokaProfile lets a parent access a managed child's profile", async () => {
  const service = createTestUserContextService(
    {
      "parent@example.com": {
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL",
        email: "parent@example.com"
      }
    },
    {
      PARENT1: { id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" },
      CHILD1: { id_judoka: "CHILD1", profile_type: "JUDOKA", role: "NORMAL", prenom: "Ali" }
    },
    { PARENT1: ["CHILD1"] }
  );

  const { user, target } = await service.getAccessibleJudokaProfile("parent@example.com", "CHILD1");

  assert.equal(user.id_judoka, "PARENT1");
  assert.equal(target.prenom, "Ali");
});

test("getAccessibleJudokaProfile rejects a judoka trying to access a profile outside their scope", async () => {
  const service = createTestUserContextService(
    {
      "judoka@example.com": {
        id_judoka: "JUDO1",
        profile_type: "JUDOKA",
        role: "NORMAL",
        email: "judoka@example.com"
      }
    },
    {
      JUDO1: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" },
      OTHER: { id_judoka: "OTHER", profile_type: "JUDOKA", role: "NORMAL" }
    }
  );

  await assert.rejects(
    () => service.getAccessibleJudokaProfile("judoka@example.com", "OTHER"),
    /Accès refusé/
  );
});

test("getAccessibleJudokaProfile rejects when the target judoka does not exist", async () => {
  const service = createTestUserContextService(
    {
      "judoka@example.com": {
        id_judoka: "JUDO1",
        profile_type: "JUDOKA",
        role: "NORMAL",
        email: "judoka@example.com"
      }
    },
    { JUDO1: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL" } }
  );

  await assert.rejects(
    () => service.getAccessibleJudokaProfile("judoka@example.com", "MISSING"),
    /Judoka introuvable/
  );
});

function createTestAdminService(judokasByEmail = {}, invitationsByEmail = {}, judokasByName = {}) {
  const calls = { inserted: [], invitations: [], links: [], updated: [], removedInvitations: [] };
  const adminUser = { id_judoka: "ADMIN1", profile_type: "JUDOKA", role: "ADMIN" };

  const service = createAdminService({
    invitationsRepository: {
      getByEmail: async (email) => invitationsByEmail[String(email || "").toLowerCase()] || null,
      insert: async (invitation) => {
        calls.invitations.push(invitation);
        return invitation;
      },
      listAll: async () => Object.values(invitationsByEmail),
      removeByEmail: async (email) => {
        calls.removedInvitations.push(email);
        delete invitationsByEmail[String(email || "").toLowerCase()];
      }
    },
    judokasRepository: {
      getByEmail: async (email) => judokasByEmail[String(email || "").toLowerCase()] || null,
      getByName: async (prenom, nom) => judokasByName[`${prenom}|${nom}`.toLowerCase()] || null,
      insert: async (judoka, extras) => {
        calls.inserted.push({ judoka, extras });
        const row = {
          id_judoka: String(judoka.judokaId || ""),
          email: judoka.accountEmail || "",
          prenom: judoka.name.firstName,
          nom: judoka.name.lastName,
          profile_type: judoka.profileType,
          role: judoka.accessRole,
          pending_parent_email: extras && extras.pending_parent_email
        };
        if (row.email) {
          judokasByEmail[String(row.email).toLowerCase()] = row;
        }
        judokasByName[`${row.prenom}|${row.nom}`.toLowerCase()] = row;
        return judoka;
      },
      listAll: async () => Object.values(judokasByEmail),
      listAdmins: async () =>
        Object.values(judokasByEmail).filter((judoka) => judoka.role === "ADMIN"),
      update: async (idJudoka, changes) => {
        calls.updated.push({ idJudoka, changes });
        return null;
      }
    },
    parentLinksRepository: {
      insert: async (link) => {
        calls.links.push(link);
        return link;
      },
      listByParent: async () => []
    },
    userContextService: {
      getCurrentUser: async (email) => {
        if (email === "admin@example.com") return adminUser;
        return judokasByEmail[String(email || "").toLowerCase()] || null;
      }
    },
    buildJudokaId: buildTestJudokaIdGenerator(),
    cleanText,
    createEmail,
    createJudoka,
    createManagedChild,
    createProfileType,
    normalizeEmail: (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
  });

  return { service, calls };
}

test("getAdminsManagement lists pending invitations alongside registered users so invited parents stay visible", async () => {
  const { service } = createTestAdminService(
    {
      "admin@example.com": {
        id_judoka: "ADMIN1",
        profile_type: "JUDOKA",
        role: "ADMIN",
        email: "admin@example.com"
      }
    },
    {
      "christine.elkouhen@gmail.com": {
        email: "christine.elkouhen@gmail.com",
        invited_profile_type: "PARENT",
        invited_by: "ADMIN1"
      }
    }
  );

  const management = await service.methods.getAdminsManagement("admin@example.com");

  assert.equal(management.accessInvitations.length, 1);
  assert.equal(management.accessInvitations[0].email, "christine.elkouhen@gmail.com");
  assert.equal(management.accessInvitations[0].invitedProfileType, "PARENT");
});

test("deleteAccessInvitation cancels a pending invitation", async () => {
  const { service, calls } = createTestAdminService(
    {
      "admin@example.com": {
        id_judoka: "ADMIN1",
        profile_type: "JUDOKA",
        role: "ADMIN",
        email: "admin@example.com"
      }
    },
    {
      "christine.elkouhen@gmail.com": {
        email: "christine.elkouhen@gmail.com",
        invited_profile_type: "PARENT",
        invited_by: "ADMIN1"
      }
    }
  );

  const result = await service.methods.deleteAccessInvitation(
    "admin@example.com",
    "christine.elkouhen@gmail.com"
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls.removedInvitations, ["christine.elkouhen@gmail.com"]);
});

test("parent can update category and belt color for a linked child profile", async () => {
  const saved = [];
  const service = createAdminService({
    invitationsRepository: {},
    judokasRepository: {
      saveJudokaInfo: async (idJudoka, ageCategory, weightCategory, beltColor) => {
        saved.push({ idJudoka, ageCategory, weightCategory, beltColor });
      }
    },
    parentLinksRepository: {},
    userContextService: {
      getCurrentUserContext: async () => ({
        user: { id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" },
        judokas: [],
        managedJudokaScope: createManagedJudokaScope(["PARENT1", "CHILD1"])
      })
    },
    buildJudokaId: buildTestJudokaIdGenerator(),
    cleanText,
    createEmail,
    createJudoka,
    createManagedChild,
    createProfileType,
    normalizeEmail: (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
  });

  const result = await service.methods.saveJudokaInfo(
    "parent@example.com",
    "CHILD1",
    "Minime",
    "-50kg",
    "Orange"
  );

  assert.equal(result.success, true);
  assert.deepEqual(saved, [
    { idJudoka: "CHILD1", ageCategory: "Minime", weightCategory: "-50kg", beltColor: "Orange" }
  ]);
});

test("parent cannot update an unrelated judoka profile", async () => {
  const service = createAdminService({
    invitationsRepository: {},
    judokasRepository: {
      saveJudokaInfo: async () => {
        throw new Error("Unexpected save");
      }
    },
    parentLinksRepository: {},
    userContextService: {
      getCurrentUserContext: async () => ({
        user: { id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" },
        judokas: [],
        managedJudokaScope: createManagedJudokaScope(["PARENT1", "CHILD1"])
      })
    },
    buildJudokaId: buildTestJudokaIdGenerator(),
    cleanText,
    createEmail,
    createJudoka,
    createManagedChild,
    createProfileType,
    normalizeEmail: (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
  });

  await assert.rejects(
    () => service.methods.saveJudokaInfo("parent@example.com", "OTHER", "Minime", "", "Orange"),
    /Modification de profil non autorisée/
  );
});

test("importUsersCsv links a judoka without email to an already-registered parent", async () => {
  const { service, calls } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Ali,El Kouhen,,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.deepEqual(
    { success: summary.success, imported: summary.imported, failed: summary.failed },
    { success: true, imported: 1, failed: 0 }
  );
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.name.firstName, "Ali");
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "JUDO_TEST_1" }]);
});

test("importUsersCsv links a judoka with email to an already-registered parent", async () => {
  const { service, calls } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.deepEqual(
    { success: summary.success, imported: summary.imported, failed: summary.failed },
    { success: true, imported: 1, failed: 0 }
  );
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accountEmail, "ali.elkouhen@gmail.com");
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "JUDO_TEST_1" }]);
});

test("importUsersCsv links an existing judoka account to an already-registered parent", async () => {
  const { service, calls } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com"
    },
    "ali.elkouhen@gmail.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "ali.elkouhen@gmail.com",
      prenom: "Ali",
      nom: "El Kouhen"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted.length, 0);
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "CHILD1" }]);
});

test("importUsersCsv rejects a row referencing a parent with neither an account nor an invitation", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Rayane,El Kouhen,,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.equal(summary.imported, 0);
  assert.equal(summary.failed, 1);
  assert.match(summary.results[0].message, /Aucune invitation ni compte PARENT trouvé/);
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.links.length, 0);
});

test("importUsersCsv creates a pending-linked judoka when the parent only has an invitation so far", async () => {
  const { service, calls } = createTestAdminService(
    {},
    {
      "christine.elkouhen@gmail.com": {
        email: "christine.elkouhen@gmail.com",
        invited_profile_type: "PARENT"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Rayane,El Kouhen,,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(summary.imported, 1);
  assert.match(summary.results[0].message, /en attente de la première connexion/);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].extras.pending_parent_email, "christine.elkouhen@gmail.com");
  assert.equal(calls.links.length, 0);
});

test("importUsersCsv reuses an existing judoka identified by first and last name instead of duplicating it", async () => {
  const { service, calls } = createTestAdminService(
    {
      "christine.elkouhen@gmail.com": {
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL",
        email: "christine.elkouhen@gmail.com"
      }
    },
    {},
    {
      "ali|el kouhen": {
        id_judoka: "JUDO_EXISTING",
        profile_type: "JUDOKA",
        nom: "El Kouhen",
        prenom: "Ali"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Ali,El Kouhen,,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.match(summary.results[0].message, /rattaché au parent/);
  assert.equal(calls.inserted.length, 0);
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "JUDO_EXISTING" }]);
});

test("importUsersCsv re-importing the same name twice does not create a duplicate profile", async () => {
  const judokasByName = {};
  const { service, calls } = createTestAdminService({}, {}, judokasByName);

  const csv = "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Ali,El Kouhen,,\n";

  const first = await service.methods.importUsersCsv("admin@example.com", csv);
  assert.equal(calls.inserted.length, 1);
  judokasByName["ali|el kouhen"] = {
    id_judoka: calls.inserted[0].judoka.judokaId,
    profile_type: "JUDOKA",
    prenom: "Ali",
    nom: "El Kouhen"
  };

  const second = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(calls.inserted.length, 1);
  assert.match(second.results[0].message, /aucune modification/);
});

test("importUsersCsv creates a direct parent account profile from an email row", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Christine,El Kouhen,christine.elkouhen@gmail.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.invitations.length, 0);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accountEmail, "christine.elkouhen@gmail.com");
  assert.equal(calls.inserted[0].judoka.profileType, "PARENT");
});

test("importUsersCsv creates a direct judoka account profile from an email row", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.invitations.length, 0);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accountEmail, "ali.elkouhen@gmail.com");
  assert.equal(calls.inserted[0].judoka.profileType, "JUDOKA");
});

test("importUsersCsv links children to a parent created earlier in the same CSV", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Christine,El Kouhen,christine.elkouhen@gmail.com,\n" +
    "JUDOKA,Ali,El Kouhen,,christine.elkouhen@gmail.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(summary.imported, 2);
  assert.equal(calls.links.length, 1);
  assert.equal(calls.links[0].id_parent, calls.inserted[0].judoka.judokaId);
});

test("importUsersCsv grants the COACH role to a judoka row with an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Karim,Haddad,karim.haddad@example.com,,COACH,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accessRole, "COACH");
});

test("importUsersCsv rejects a COACH role without an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv = "profileType,prenom,nom,email,parentEmail,role\n" + "JUDOKA,Karim,Haddad,,,COACH\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.match(summary.results[0].message, /Un coach doit avoir un email/);
  assert.equal(calls.inserted.length, 0);
});

test("importUsersCsv rejects a COACH role on a PARENT row", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role\n" +
    "PARENT,Christine,El Kouhen,christine.elkouhen@gmail.com,,COACH\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.match(summary.results[0].message, /Un profil PARENT ne peut pas être COACH/);
  assert.equal(calls.inserted.length, 0);
});

test("importUsersCsv assigns an age category to a judoka created with an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,,,Minime\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.categorie_age, "Minime");
});

test("importUsersCsv assigns an age category to a managed judoka without an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Rayane,El Kouhen,,,,Minime\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.categorie_age, "Minime");
});

test("importUsersCsv updates an existing judoka's role and age category instead of failing the row", async () => {
  const { service, calls } = createTestAdminService({
    "ali.elkouhen@gmail.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "ali.elkouhen@gmail.com",
      prenom: "Ali",
      nom: "El Kouhen",
      categorie_age: "Minime"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,,COACH,Cadet\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(summary.failed, 0);
  assert.equal(calls.inserted.length, 0);
  assert.deepEqual(calls.updated, [
    { idJudoka: "CHILD1", changes: { accessRole: "COACH", ageCategory: "Cadet" } }
  ]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv re-importing an existing judoka without changes leaves their role untouched", async () => {
  const { service, calls } = createTestAdminService({
    "ali.elkouhen@gmail.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "COACH",
      email: "ali.elkouhen@gmail.com",
      prenom: "Ali",
      nom: "El Kouhen",
      categorie_age: "Minime"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.updated.length, 0);
  assert.match(summary.results[0].message, /aucune modification/);
});

test("importUsersCsv updates an existing managed judoka's age category when re-imported by name", async () => {
  const { service, calls } = createTestAdminService(
    {},
    {},
    {
      "rayane|el kouhen": {
        id_judoka: "CHILD2",
        profile_type: "JUDOKA",
        prenom: "Rayane",
        nom: "El Kouhen",
        categorie_age: "Minime"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Rayane,El Kouhen,,,,Cadet\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [{ idJudoka: "CHILD2", changes: { ageCategory: "Cadet" } }]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing PARENT row instead of failing it", async () => {
  const { service, calls } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com",
      prenom: "Christine",
      nom: "El Kouhen"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Christine,El Kouhen,christine.elkouhen@gmail.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted.length, 0);
  assert.match(summary.results[0].message, /aucune modification/);
});

test("importUsersCsv rejects a PARENT row whose email belongs to a different person", async () => {
  const { service } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com",
      prenom: "Sophie",
      nom: "Martin"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Christine,El Kouhen,christine.elkouhen@gmail.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.match(summary.results[0].message, /correspond déjà à un autre profil parent/);
});

test("importUsersCsv rejects a PARENT row whose email belongs to a JUDOKA account", async () => {
  const { service } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "JUDO1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com",
      prenom: "Christine",
      nom: "El Kouhen"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Christine,El Kouhen,christine.elkouhen@gmail.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.match(summary.results[0].message, /n'est pas un profil PARENT/);
});

test("importUsersCsv processes the bundled sample file: children link, the already-registered parent is updated", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const csv = fs.readFileSync(
    path.join(__dirname, "..", "assets", "sample-users-import.csv"),
    "utf8"
  );

  const { service, calls } = createTestAdminService({
    "christine.elkouhen@gmail.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "christine.elkouhen@gmail.com",
      prenom: "Christine",
      nom: "El Kouhen"
    }
  });

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.imported, 4);
  assert.equal(summary.failed, 0);
  assert.equal(calls.links.length, 2);
  assert.ok(calls.links.every((link) => link.id_parent === "PARENT1"));
});
