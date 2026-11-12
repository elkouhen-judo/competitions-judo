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
const createCoachDashboardService = require("../core/services/coach-dashboard.service");
const createProfileService = require("../core/services/profile.service");
const createRegistrationService = require("../core/services/registration.service");
const createUserContextService = require("../core/services/user-context.service");
const createAdminService = require("../core/services/admin.service");
const { createEmail } = require("../core/domain/access/email");
const { createProfileType } = require("../core/domain/access/profile-type");
const {
  createHandedness,
  createWeightCategory,
  createYearInCategory
} = require("../core/domain/category-reference");
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
        date: "2026-06-11",
        categorie_age: "Cadet"
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
        resultat: "V",
        type_victoire: "Ippon"
      }),
    /judoka de la compétition/
  );
  assert.deepEqual(inserted, []);
});

test("coach creates a club competition with linked judoka participations", async () => {
  const insertedClubEvents = [];
  const insertedCompetitions = [];
  let insertManyCalls = 0;
  let competitionIdCounter = 0;
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      insert: async (event) => insertedClubEvents.push(event),
      getById: async () => null
    },
    competitionsRepository: {
      // ECRIT-3 : les participations partent en un seul envoi.
      insertMany: async (rows) => {
        insertManyCalls += 1;
        rows.forEach(({ competition, idCompetition }) =>
          insertedCompetitions.push([idCompetition, competition])
        );
        return rows.map(({ competition, idCompetition }) => ({
          id_competition: idCompetition,
          id_judoka: competition.ownerJudokaId,
          club_competition_id: competition.clubCompetitionId,
          nom: competition.name,
          date: competition.competitionDate
        }));
      },
      listByClubCompetition: async () => []
    },
    judokasRepository: {
      listByIds: async (ids) =>
        ids.map((id) => ({ id_judoka: id, prenom: `P${id}`, nom: "TEST", categorie_age: "Minime", club_id: "NANTES" }))
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "CLUB1",
    buildCompetitionId: () => `COMP${(competitionIdCounter += 1)}`,
    createClubCompetition,
    createCompetition
  });

  const result = await service.methods.saveClubCompetition("coach@example.com", {
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    ageCategory: "Minime",
    level: "Régional",
    participantJudokaIds: ["J1", "J2"]
  });

  assert.equal(result.clubCompetitionId, "CLUB1");
  assert.equal(insertedClubEvents.length, 1);
  assert.equal(insertManyCalls, 1);
  assert.equal(insertedCompetitions.length, 2);
  assert.deepEqual(
    insertedCompetitions.map((row) => row[0]),
    ["COMP1", "COMP2"]
  );
  // ECRIT-2 : l'écriture renvoie la compétition club et ses participations.
  assert.deepEqual(result.clubCompetition, {
    clubCompetitionId: "CLUB1",
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    clubId: "NANTES"
  });
  assert.deepEqual(
    result.competitions.map((competition) => [competition.competitionId, competition.ownerJudokaId]),
    [
      ["COMP1", "J1"],
      ["COMP2", "J2"]
    ]
  );
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].ownerJudokaId),
    ["J1", "J2"]
  );
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].ageCategory),
    ["Minime", "Minime"]
  );
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].weightCategory),
    ["", ""]
  );
  assert.deepEqual(
    insertedCompetitions.map((row) => row[1].level),
    ["Régional", "Régional"]
  );
});

test("editing a club competition resynchronizes existing linked participations", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", club_id: "NANTES" }),
      update: async (id, event) => calls.push(["updateClub", id, event])
    },
    competitionsRepository: {
      listByClubCompetition: async () => [
        {
          id_competition: "COMP1",
          id_judoka: "J1",
          club_competition_id: "CLUB1",
          nom: "Ancien tournoi",
          date: "2026-06-01",
          categorie_age: "Minime",
          categorie_poids: "-46kg",
          niveau: "Départemental",
          classement: "2e"
        }
      ],
      updateClubCompetitionFields: async (id, fields) => calls.push(["updateFields", id, fields]),
      update: async () => {
        throw new Error("Unexpected per-participation update");
      },
      insertMany: async (rows) => {
        calls.push(["insertMany", rows.length]);
        return [];
      }
    },
    judokasRepository: {
      listByIds: async (ids) =>
        ids.map((id) => ({ id_judoka: id, prenom: `P${id}`, nom: "TEST", categorie_age: "Minime", club_id: "NANTES" }))
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "CLUB1",
    buildCompetitionId: () => "COMP_NEW",
    createClubCompetition,
    createCompetition
  });

  const result = await service.methods.saveClubCompetition("coach@example.com", {
    clubCompetitionId: "CLUB1",
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    ageCategory: "Minime",
    level: "National",
    participantJudokaIds: ["J1"]
  });

  assert.equal(result.success, true);
  assert.deepEqual(calls[0], [
    "updateClub",
    "CLUB1",
    {
      clubCompetitionId: "CLUB1",
      name: "Tournoi Nantes",
      competitionDate: "2026-06-14",
      ageCategory: "Minime",
      level: "National",
      clubId: "NANTES",
      participantJudokaIds: ["J1"]
    }
  ]);
  // ECRIT-3 : une seule requête, filtrée sur la compétition club, propage les champs hérités.
  // Elle n'écrit ni la catégorie de poids ni le classement, qui restent ceux de la participation.
  assert.deepEqual(calls[1], [
    "updateFields",
    "CLUB1",
    {
      name: "Tournoi Nantes",
      competitionDate: "2026-06-14",
      ageCategory: "Minime",
      level: "National"
    }
  ]);
  assert.deepEqual(calls[2], ["insertMany", 0]);
  assert.equal(calls.length, 3);
  assert.equal(result.competitions.length, 1);
  const [participation] = result.competitions;
  assert.equal(participation.competitionId, "COMP1");
  assert.equal(participation.clubCompetitionId, "CLUB1");
  assert.equal(participation.ownerJudokaId, "J1");
  assert.equal(participation.name, "Tournoi Nantes");
  assert.equal(participation.competitionDate, "2026-06-14");
  assert.equal(participation.ageCategory, "Minime");
  assert.equal(participation.weightCategory, "-46kg");
  assert.equal(participation.level, "National");
  assert.equal(participation.result, "2e");
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
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
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
        level: "Régional",
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
          categorie_age: id === "J1" ? "Minime" : "Cadet",
          club_id: "NANTES"
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
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
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
        level: "Régional",
        participantJudokaIds: ["J1", "J2"]
      }),
    /catégorie d'âge/
  );
});

test("detaching a participant from a club competition that has not started yet deletes the individual competition", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14", club_id: "NANTES" })
    },
    competitionsRepository: {
      getById: async () => ({
        id_competition: "COMP1",
        id_judoka: "J1",
        club_competition_id: "CLUB1",
        nom: "Tournoi",
        date: "2026-06-14"
      }),
      remove: async (id) => calls.push(["remove", id])
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    getCurrentDate: () => "2026-06-01"
  });

  const result = await service.methods.detachClubCompetitionParticipant(
    "coach@example.com",
    "CLUB1",
    "COMP1"
  );

  assert.deepEqual(calls, [["remove", "COMP1"]]);
  assert.match(result.message, /n'a pas encore eu lieu/);
});

test("editing a finished club competition still allows adding participants (late entry)", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", club_id: "NANTES" }),
      update: async (id, event) => calls.push(["updateClub", id, event])
    },
    competitionsRepository: {
      listByClubCompetition: async () => [
        {
          id_competition: "COMP1",
          id_judoka: "J1",
          club_competition_id: "CLUB1",
          nom: "Tournoi Nantes",
          date: "2026-06-14",
          categorie_age: "Minime",
          niveau: "National",
          classement: ""
        }
      ],
      updateClubCompetitionFields: async (id, fields) => calls.push(["updateFields", id, fields]),
      insertMany: async (rows) => {
        rows.forEach(({ competition, idCompetition }) =>
          calls.push(["insertCompetition", idCompetition, competition])
        );
        return [];
      }
    },
    judokasRepository: {
      listByIds: async (ids) =>
        ids.map((id) => ({ id_judoka: id, prenom: `P${id}`, nom: "TEST", categorie_age: "Minime", club_id: "NANTES" }))
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "CLUB1",
    buildCompetitionId: () => "COMP_NEW",
    createClubCompetition,
    createCompetition,
    getCurrentDate: () => "2026-06-20"
  });

  await service.methods.saveClubCompetition("coach@example.com", {
    clubCompetitionId: "CLUB1",
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    ageCategory: "Minime",
    level: "National",
    participantJudokaIds: ["J2"]
  });
  const inserted = calls.filter(([kind]) => kind === "insertCompetition");
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0][2].ownerJudokaId, "J2");
});

test("finished club competition blocks detaching a participant with combats", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14", club_id: "NANTES" })
    },
    competitionsRepository: {
      getById: async () => ({
        id_competition: "COMP2",
        id_judoka: "J2",
        club_competition_id: "CLUB1",
        nom: "Tournoi",
        date: "2026-06-14"
      }),
      remove: async (id) => calls.push(["remove", id])
    },
    combatsRepository: {
      listByCompetitionIds: async () => [{ id_combat: "K1", id_competition: "COMP2" }]
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    getCurrentDate: () => "2026-06-14"
  });

  await assert.rejects(
    () => service.methods.detachClubCompetitionParticipant("coach@example.com", "CLUB1", "COMP2"),
    /ne peut pas être retiré/
  );
  assert.deepEqual(calls, []);
});

test("finished club competition allows detaching an empty participation", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14", club_id: "NANTES" })
    },
    competitionsRepository: {
      getById: async () => ({
        id_competition: "COMP2",
        id_judoka: "J2",
        club_competition_id: "CLUB1",
        nom: "Tournoi",
        date: "2026-06-14"
      }),
      remove: async (id) => calls.push(["remove", id])
    },
    combatsRepository: {
      listByCompetitionIds: async () => []
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    getCurrentDate: () => "2026-06-14"
  });

  const result = await service.methods.detachClubCompetitionParticipant("coach@example.com", "CLUB1", "COMP2");
  assert.deepEqual(calls, [["remove", "COMP2"]]);
  assert.match(result.message, /sans combat ni classement/);
});

test("deleting a club competition detaches linked individual competitions", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14", club_id: "NANTES" }),
      remove: async (id) => calls.push(["removeClub", id])
    },
    competitionsRepository: {
      // ECRIT-3 : toutes les participations sont détachées en une requête.
      detachAllFromClubCompetition: async (id) => calls.push(["detachAll", id])
    },
    userContextService: {
      getDomainUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        domainUser: toCanonicalJudoka({
          id_judoka: "COACH1",
          profile_type: "JUDOKA",
          role: "COACH"
        }),
        managedJudokaScope: createManagedJudokaScope([]),
        coachClubIds: ["NANTES"]
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition
  });

  const result = await service.methods.deleteClubCompetition("coach@example.com", "CLUB1");

  assert.deepEqual(calls, [
    ["detachAll", "CLUB1"],
    ["removeClub", "CLUB1"]
  ]);
  assert.match(result.message, /sans supprimer les compétitions et combats/);
});

test("getCoachDashboard rejects an admin requester", async () => {
  const { service } = createTestCoachDashboardService({
    getDomainUserContext: domainContextFor("ADMIN1", "ADMIN")
  });

  await assert.rejects(
    () => service.methods.getCoachDashboard("admin@example.com", {}),
    /réservé aux coachs/
  );
});

function createTestCompetitionsService({
  competitionsByCompetitionId = {},
  combatsByCompetitionId = {},
  combatScoresByCombatId = {},
  getDomainUserContext
} = {}) {
  const calls = {
    inserted: [],
    updated: [],
    updatedResult: [],
    coachObjective: [],
    coachReview: [],
    removed: [],
    combatReads: [],
    suggestionReads: []
  };

  const service = createCompetitionsService({
    combatsRepository: {
      // DETAIL-1 : les combats d'une compétition se lisent avec leurs points, en une requête.
      listByCompetitionWithScores: async (id) => {
        calls.combatReads.push(id);
        return (combatsByCompetitionId[id] || []).map((combat) => ({
          ...combat,
          combat_scores: combatScoresByCombatId[combat.id_combat] || []
        }));
      },
      // DETAIL-2 : adversaires et techniques d'un judoka, pour les suggestions de saisie.
      listSuggestionsByJudoka: async (judokaId) => {
        calls.suggestionReads.push(judokaId);
        return Object.values(combatsByCompetitionId)
          .flat()
          .filter((combat) => String(combat.id_judoka) === String(judokaId))
          .map((combat) => ({
            adversaire: combat.adversaire,
            combat_scores: combatScoresByCombatId[combat.id_combat] || []
          }));
      }
    },
    competitionsRepository: {
      getById: async (id) => competitionsByCompetitionId[id] || null,
      existsForJudoka: async (idJudoka, name, competitionDate, excludedCompetitionId) =>
        Object.values(competitionsByCompetitionId).find(
          (competition) =>
            String(competition.id_judoka) === String(idJudoka) &&
            String(competition.nom || "") === String(name || "") &&
            String(competition.date || "") === String(competitionDate || "") &&
            String(competition.id_competition || "") !== String(excludedCompetitionId || "")
        ) || null,
      insert: async (draft, idCompetition) => {
        calls.inserted.push({ draft, idCompetition });
        const row = { ...draft, competitionId: idCompetition };
        competitionsByCompetitionId[idCompetition] = row;
        return row;
      },
      update: async (idCompetition, draft) => {
        calls.updated.push({ idCompetition, draft });
        return {
          ...competitionsByCompetitionId[idCompetition],
          nom: draft.name,
          date: draft.competitionDate
        };
      },
      updateResult: async (idCompetition, finalization) => {
        calls.updatedResult.push({ idCompetition, finalization });
        return { ...competitionsByCompetitionId[idCompetition], classement: finalization.result };
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
    canManageCombatFor: permissions.canManageCombatFor,
    canManageCompetition: permissions.canManageCompetition,
    assertCanAccessCompetition: permissions.assertCanAccessCompetition,
    assertCanManageCompetition: permissions.assertCanManageCompetition,
    resolveJudokaDataAccess: permissions.resolveJudokaDataAccess,
    resolveCompetitionOwnerId: permissions.resolveCompetitionOwnerId,
    buildCompetitionId: () => "COMP_NEW",
    createCompetition,
    createPersistedCompetition
  });

  return { service, calls };
}

function domainContextFor(idJudoka, role, extras = {}) {
  return async () => ({
    judokas: extras.judokas || [],
    domainUser:
      extras.domainUser || toCanonicalJudoka({ id_judoka: idJudoka, profile_type: "JUDOKA", role }),
    managedJudokaScope: extras.managedJudokaScope || createManagedJudokaScope([])
  });
}

test("saveCompetition creates a new competition owned by the requesting judoka", async () => {
  const { service, calls } = createTestCompetitionsService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.saveCompetition("judoka@example.com", {
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    ageCategory: "Cadet"
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Compétition créée.");
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].idCompetition, "COMP_NEW");
  assert.equal(calls.inserted[0].draft.ownerJudokaId, "JUDO1");
  // ECRIT-2 : l'écriture renvoie la compétition enregistrée.
  assert.equal(result.competition.competitionId, "COMP_NEW");
  assert.equal(result.competition.ownerJudokaId, "JUDO1");
});

test("saveCompetition lets the owner edit their own competition", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.saveCompetition("judoka@example.com", {
    competitionId: "COMP1",
    name: "Tournoi Nantes 2",
    competitionDate: "2026-06-15",
    ageCategory: "Cadet"
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Compétition modifiée.");
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].idCompetition, "COMP1");
  assert.equal(calls.updated[0].draft.name, "Tournoi Nantes 2");
  assert.equal(result.competition.competitionId, "COMP1");
  assert.equal(result.competition.name, "Tournoi Nantes 2");
  assert.equal(result.competition.competitionDate, "2026-06-15");
});

test("saveCompetition preserves club-inherited fields on a linked participant competition", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        club_competition_id: "CLUB1",
        nom: "Tournoi club",
        date: "2026-06-14",
        categorie_age: "Cadet",
        categorie_poids: "",
        niveau: "Régional",
        classement: ""
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.saveCompetition("judoka@example.com", {
    competitionId: "COMP1",
    name: "Nom modifié côté judoka",
    competitionDate: "2026-06-20",
    ageCategory: "Junior",
    weightCategory: "-60kg",
    level: "National"
  });

  assert.equal(result.success, true);
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].draft.name, "Tournoi club");
  assert.equal(calls.updated[0].draft.competitionDate, "2026-06-14");
  assert.equal(calls.updated[0].draft.ageCategory, "Cadet");
  assert.equal(calls.updated[0].draft.weightCategory, "-60kg");
  assert.equal(calls.updated[0].draft.level, "Régional");
  assert.equal(calls.updated[0].draft.clubCompetitionId, "CLUB1");
});

test("saveCompetition lets the owner add age and weight categories to a legacy competition", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "",
        categorie_poids: ""
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.saveCompetition("judoka@example.com", {
    competitionId: "COMP1",
    name: "Tournoi Nantes 2",
    competitionDate: "2026-06-15",
    ageCategory: "Cadet",
    weightCategory: "-50kg"
  });

  assert.equal(result.success, true);
  assert.equal(result.message, "Compétition modifiée.");
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].idCompetition, "COMP1");
  assert.equal(calls.updated[0].draft.ageCategory, "Cadet");
  assert.equal(calls.updated[0].draft.weightCategory, "-50kg");
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

test("saveCompetition rejects duplicate standalone competitions for the same judoka", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi Nantes",
        date: "2026-06-14",
        categorie_age: "Cadet",
        club_competition_id: null
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () =>
      service.methods.saveCompetition("judoka@example.com", {
        name: "Tournoi Nantes",
        competitionDate: "2026-06-14",
        ageCategory: "Cadet"
      }),
    /déjà une compétition individuelle/
  );
});

test("finalizeCompetition records the final ranking for the competition owner", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
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
  assert.equal(result.message, "Classement enregistré.");
  assert.equal(result.competition.competitionId, "COMP1");
  assert.equal(result.competition.result, "1er");
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

test("finalizeCompetition rejects an admin requester", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
    },
    getDomainUserContext: domainContextFor("ADMIN1", "ADMIN")
  });

  await assert.rejects(
    () => service.methods.finalizeCompetition("admin@example.com", "COMP1", "1er"),
    /Finalisation de cette compétition non autorisée/
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
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.saveCoachReview("judoka@example.com", "COMP1", "Bilan"),
    /Seul un coach/
  );
});

test("saveCoachReview rejects an admin", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
    },
    getDomainUserContext: domainContextFor("ADMIN1", "ADMIN")
  });

  await assert.rejects(
    () => service.methods.saveCoachReview("admin@example.com", "COMP1", "Bilan"),
    /Seul un coach/
  );
});

// Le compte et ses liens, tels que `getIdentity` les renvoie, déduits d'un contexte de test.
function identityFromContext(context) {
  const domainUser = context.domainUser || {};
  return {
    user: context.user || {
      id_judoka: domainUser.judokaId,
      profile_type: domainUser.profileType,
      role: domainUser.accessRole
    },
    coachClubIds: context.coachClubIds || [],
    childJudokaIds: []
  };
}

function createTestCoachDashboardService({
  competitionRows = [],
  combatsByCompetitionId = {},
  combatScoresByCombatId = {},
  getCurrentDate,
  judokaRows = [],
  getDomainUserContext
} = {}) {
  const calls = { scopes: [], combatBatches: [] };
  // Par défaut, tous les judokas des jeux de données appartiennent aux clubs du coach.
  const getContext = async (email) => {
    const context = await getDomainUserContext(email);
    const ownerRows = competitionRows.map((row) => ({ id_judoka: row.id_judoka }));
    const judokas = context.judokas && context.judokas.length ? context.judokas : [...judokaRows, ...ownerRows];
    return { ...context, judokas };
  };
  const service = createCoachDashboardService({
    combatsRepository: {
      // COACH-2 : les combats se lisent par lots, avec leurs points.
      listByCompetitionIdsWithScores: async (ids) => {
        calls.combatBatches.push(ids);
        return ids.flatMap((id) =>
          (combatsByCompetitionId[id] || []).map((combat) => ({
            ...combat,
            combat_scores: combatScoresByCombatId[combat.id_combat] || []
          }))
        );
      }
    },
    competitionsRepository: {
      // COACH-1 : le périmètre et les filtres partent dans la requête.
      listInScope: async (scope) => {
        calls.scopes.push(scope);
        return competitionRows.filter(
          (row) =>
            (!scope.dateFrom || String(row.date || "") >= scope.dateFrom) &&
            (!scope.dateTo || String(row.date || "") <= scope.dateTo) &&
            (!scope.ageCategory || String(row.categorie_age || "") === scope.ageCategory)
        );
      }
    },
    getCurrentDate,
    userContextService: {
      getIdentity: async (email) => identityFromContext(await getContext(email)),
      getDomainUserContext: getContext
    }
  });

  return { service, calls };
}

test("getCoachDashboard computes stats filtered by competition and age category", async () => {
  const { service } = createTestCoachDashboardService({
    competitionRows: [
      {
        id_competition: "COMP1",
        club_competition_id: "CLUB1",
        date: "2026-02-10",
        categorie_age: "Cadet",
        niveau: "Départemental",
        classement: "1er"
      },
      {
        id_competition: "COMP1_BIS",
        club_competition_id: "CLUB1",
        nom: "Compétition club",
        date: "2026-02-10",
        categorie_age: "Cadet",
        niveau: "Départemental",
        classement: ""
      },
      {
        id_competition: "COMP2",
        date: "2026-03-15",
        categorie_age: "Minime",
        niveau: "National",
        classement: "3e"
      }
    ],
    combatsByCompetitionId: {
      COMP1: [
        {
          id_combat: "CB1",
          id_judoka: "JUDO1",
          id_competition: "COMP1",
          resultat: "Victoire",
          type_victoire: "Ippon",
          garde_adversaire: "Droitier"
        },
        {
          id_combat: "CB2",
          id_judoka: "JUDO2",
          id_competition: "COMP1",
          resultat: "Défaite",
          type_victoire: "Hansoku-make",
          garde_adversaire: "Gaucher"
        }
      ],
      COMP2: [
        {
          id_combat: "CB3",
          id_judoka: "JUDO1",
          id_competition: "COMP2",
          resultat: "Victoire",
          type_victoire: "Ippon",
          garde_adversaire: "Droitier"
        }
      ]
    },
    combatScoresByCombatId: {
      CB1: [{ id_combat: "CB1", categorie: "Tachi-waza", technique: "Seoi-nage", valeur: "Ippon" }]
    },
    judokaRows: [
      { id_judoka: "JUDO1", genre: "Homme", annee_categorie: "1", lateralite: "Droitier" },
      { id_judoka: "JUDO2", genre: "Femme", annee_categorie: "2", lateralite: "Gaucher" }
    ],
    getDomainUserContext: domainContextFor("COACH1", "COACH")
  });

  const allResult = await service.methods.getCoachDashboard("coach@example.com", {});
  assert.equal(allResult.stats.totalCombats, 3);
  assert.equal(allResult.stats.analyzedCompetitions, 2);
  assert.deepEqual(allResult.availableCompetitions, [
    {
      competitionId: "COMP1",
      competitionIds: ["COMP1", "COMP1_BIS"],
      name: "Compétition",
      competitionDate: "2026-02-10"
    },
    {
      competitionId: "COMP2",
      competitionIds: ["COMP2"],
      name: "Compétition",
      competitionDate: "2026-03-15"
    }
  ]);
  assert.equal(allResult.availableCompetitions.length, 2);
  assert.deepEqual(
    allResult.stats.byLateralMatchup.map(({ matchup, combats, victories, victoryRate }) => ({
      matchup,
      combats,
      victories,
      victoryRate
    })),
    [
      { matchup: "opposite", combats: 0, victories: 0, victoryRate: 0 },
      { matchup: "same", combats: 3, victories: 2, victoryRate: 67 }
    ]
  );
  assert.deepEqual(allResult.stats.judokasByGender, [
    { gender: "Homme", judokaCount: 1 },
    { gender: "Femme", judokaCount: 1 }
  ]);
  assert.deepEqual(allResult.stats.judokasByHandedness, [
    { handedness: "Droitier", judokaCount: 1 },
    { handedness: "Gaucher", judokaCount: 1 }
  ]);
  assert.deepEqual(
    allResult.stats.victoriesByDecisionType.find((entry) => entry.decisionType === "Ippon"),
    { decisionType: "Ippon", count: 2, total: 2, rate: 100 }
  );
  assert.deepEqual(allResult.stats.podiumsByLevel, [
    {
      level: "Départemental",
      podiums: [
        { place: "1er", label: "🥇", count: 1 },
        { place: "2e", label: "🥈", count: 0 },
        { place: "3e", label: "🥉", count: 0 }
      ]
    },
    {
      level: "Régional",
      podiums: [
        { place: "1er", label: "🥇", count: 0 },
        { place: "2e", label: "🥈", count: 0 },
        { place: "3e", label: "🥉", count: 0 }
      ]
    },
    {
      level: "National",
      podiums: [
        { place: "1er", label: "🥇", count: 0 },
        { place: "2e", label: "🥈", count: 0 },
        { place: "3e", label: "🥉", count: 1 }
      ]
    },
    {
      level: "International",
      podiums: [
        { place: "1er", label: "🥇", count: 0 },
        { place: "2e", label: "🥈", count: 0 },
        { place: "3e", label: "🥉", count: 0 }
      ]
    }
  ]);

  const ageFiltered = await service.methods.getCoachDashboard("coach@example.com", {
    ageCategory: "Cadet"
  });
  assert.equal(ageFiltered.stats.totalCombats, 2);
  assert.equal(ageFiltered.stats.analyzedCompetitions, 1);
  assert.equal(ageFiltered.stats.tachiWazaIpponVictories, 1);
  assert.deepEqual(ageFiltered.stats.podiumsByLevel[0], {
    level: "Départemental",
    podiums: [
      { place: "1er", label: "🥇", count: 1 },
      { place: "2e", label: "🥈", count: 0 },
      { place: "3e", label: "🥉", count: 0 }
    ]
  });
  assert.deepEqual(ageFiltered.availableCompetitions, [
    {
      competitionId: "COMP1",
      competitionIds: ["COMP1", "COMP1_BIS"],
      name: "Compétition",
      competitionDate: "2026-02-10"
    }
  ]);

  const competitionFiltered = await service.methods.getCoachDashboard("coach@example.com", {
    competitionIds: ["COMP2"]
  });
  assert.equal(competitionFiltered.stats.totalCombats, 1);
  assert.equal(competitionFiltered.stats.analyzedCompetitions, 1);
  assert.equal(competitionFiltered.stats.victories, 1);
  assert.equal(competitionFiltered.availableCompetitions.length, 2);

  const exactDateFiltered = await service.methods.getCoachDashboard("coach@example.com", {
    dateFrom: "2026-03-15",
    dateTo: "2026-03-15"
  });
  assert.equal(exactDateFiltered.stats.totalCombats, 1);
  assert.equal(exactDateFiltered.stats.analyzedCompetitions, 1);
  assert.equal(exactDateFiltered.stats.victories, 1);
  assert.deepEqual(exactDateFiltered.availableCompetitions, [
    {
      competitionId: "COMP2",
      competitionIds: ["COMP2"],
      name: "Compétition",
      competitionDate: "2026-03-15"
    }
  ]);

  const dateRangeFiltered = await service.methods.getCoachDashboard("coach@example.com", {
    dateFrom: "2026-02-01",
    dateTo: "2026-02-28"
  });
  assert.equal(dateRangeFiltered.stats.totalCombats, 2);
  assert.equal(dateRangeFiltered.stats.analyzedCompetitions, 1);
  assert.deepEqual(dateRangeFiltered.availableCompetitions, [
    {
      competitionId: "COMP1",
      competitionIds: ["COMP1", "COMP1_BIS"],
      name: "Compétition",
      competitionDate: "2026-02-10"
    }
  ]);

  await assert.rejects(
    () =>
      service.methods.getCoachDashboard("coach@example.com", {
        dateFrom: "2026-03-16",
        dateTo: "2026-03-15"
      }),
    /date de début doit être antérieure ou égale/
  );
});

test("searchCombats defaults to 50 results when no limit is given, and respects an explicit limit", async () => {
  const combatRows = Array.from({ length: 60 }, (_, index) => ({
    id_combat: `CB${index}`,
    id_judoka: "JUDO1",
    id_competition: "COMP1",
    adversaire: "Léo Dupont",
    resultat: "Victoire",
    type_victoire: "Ippon"
  }));
  const { service } = createTestCoachDashboardService({
    competitionRows: [{ id_competition: "COMP1", nom: "Tournoi Nantes", date: "2026-06-14" }],
    combatsByCompetitionId: { COMP1: combatRows },
    judokaRows: [{ id_judoka: "JUDO1", prenom: "Aya", nom: "Durand" }],
    getDomainUserContext: domainContextFor("COACH1", "COACH")
  });

  const defaultResult = await service.methods.searchCombats("coach@example.com", {});
  assert.equal(defaultResult.matches.length, 50);

  const explicitResult = await service.methods.searchCombats("coach@example.com", {}, 5);
  assert.equal(explicitResult.matches.length, 5);
});

test("searchCombats returns structured matches for a coach and is reserved to coaches", async () => {
  const { service } = createTestCoachDashboardService({
    competitionRows: [
      { id_competition: "COMP1", nom: "Tournoi régional", date: "2026-06-19", niveau: "Régional" }
    ],
    combatsByCompetitionId: {
      COMP1: [
        {
          id_combat: "CB1",
          id_judoka: "JUDO1",
          id_competition: "COMP1",
          adversaire: "Léo Dupont",
          resultat: "Victoire",
          type_victoire: "Ippon"
        },
        {
          id_combat: "CB2",
          id_judoka: "JUDO2",
          id_competition: "COMP1",
          adversaire: "Noa Martin",
          resultat: "Défaite",
          type_victoire: "Ippon"
        }
      ]
    },
    judokaRows: [
      { id_judoka: "JUDO1", prenom: "Aya", nom: "Durand" },
      { id_judoka: "JUDO2", prenom: "Nina", nom: "Bernard" }
    ],
    getDomainUserContext: domainContextFor("COACH1", "COACH")
  });

  const { matches } = await service.methods.searchCombats("coach@example.com", {
    result: "Victoire"
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].judokaName, "Aya Durand");

  const judokaService = createTestCoachDashboardService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  }).service;
  await assert.rejects(
    () => judokaService.methods.searchCombats("judoka@example.com", {}),
    /réservée aux coachs/
  );
});

test("getCoachDashboard rejects a non-coach requester", async () => {
  const { service } = createTestCoachDashboardService({
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.getCoachDashboard("judoka@example.com", {}),
    /réservé aux coachs/
  );
});

test("deleteCompetition removes the competition when authorized", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
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

// La règle « un coach voit les compétitions des judokas de ses clubs, un judoka les siennes »
// est portée par le périmètre de `getInitialData` : voir tests/loading-performance.test.js.
test("getCompetitionDetail only returns the combats of judokas in the requester's scope", async () => {
  const { service, calls } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi A", date: "2026-06-14" }
    },
    combatsByCompetitionId: {
      COMP1: [
        { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "Victoire" },
        { id_combat: "CB2", id_judoka: "JUDO2", id_competition: "COMP1", resultat: "Défaite" }
      ]
    },
    getDomainUserContext: domainContextFor("COACH2", "COACH", {
      // Coach d'un club où seul JUDO1 est licencié : le combat de JUDO2 n'apparaît pas.
      managedJudokaScope: createManagedJudokaScope(["JUDO1"])
    })
  });

  const coachDetail = await service.methods.getCompetitionDetail("coach@example.com", "COMP1");
  assert.deepEqual(
    coachDetail.combats.map((combat) => combat.combatId),
    ["CB1"]
  );
  // DETAIL-1 : une seule lecture des combats ; DETAIL-2 : aucune lecture de suggestions.
  assert.deepEqual(calls.combatReads, ["COMP1"]);
  assert.deepEqual(calls.suggestionReads, []);
  assert.equal("combatSuggestions" in coachDetail, false);

  const { service: judokaService } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi A", date: "2026-06-14" }
    },
    combatsByCompetitionId: {
      COMP1: [
        { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "Victoire" },
        { id_combat: "CB2", id_judoka: "JUDO2", id_competition: "COMP1", resultat: "Défaite" }
      ]
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });
  const judokaDetail = await judokaService.methods.getCompetitionDetail("judoka@example.com", "COMP1");
  assert.deepEqual(
    judokaDetail.combats.map((combat) => combat.combatId),
    ["CB1"]
  );
});

test("getCompetitionDetail does not return the combats of a refused competition", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO2", nom: "Tournoi", date: "2026-06-14" }
    },
    combatsByCompetitionId: {
      COMP1: [{ id_combat: "CB1", id_judoka: "JUDO2", id_competition: "COMP1", resultat: "Victoire" }]
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  await assert.rejects(
    () => service.methods.getCompetitionDetail("judoka@example.com", "COMP1"),
    /Accès refusé/
  );
});

test("getCompetitionDetail splits scored and conceded points read with the combat", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "JUDO1", nom: "Tournoi", date: "2026-06-14" }
    },
    combatsByCompetitionId: {
      COMP1: [{ id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "Victoire" }]
    },
    combatScoresByCombatId: {
      CB1: [
        { id_combat: "CB1", categorie: "Tachi-waza", technique: "Uchi-mata", valeur: "Waza-ari", ordre: 0, camp: "JUDOKA" },
        { id_combat: "CB1", categorie: "Tachi-waza", technique: "O-soto-gari", valeur: "Yuko", ordre: 1, camp: "ADVERSAIRE" }
      ]
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const detail = await service.methods.getCompetitionDetail("judoka@example.com", "COMP1");

  assert.deepEqual(detail.combats[0].scores.map((score) => score.technique), ["Uchi-mata"]);
  assert.deepEqual(detail.combats[0].concededScores.map((score) => score.technique), ["O-soto-gari"]);
});

test("getCombatSuggestions ranks opponents and scored techniques of a judoka the requester manages", async () => {
  const combat = (id, opponent) => ({
    id_combat: id,
    id_judoka: "JUDO1",
    id_competition: "COMP1",
    adversaire: opponent,
    resultat: "Victoire"
  });
  const { service, calls } = createTestCompetitionsService({
    combatsByCompetitionId: {
      COMP1: [combat("CB1", "Léo Dupont"), combat("CB2", " Léo Dupont "), combat("CB3", "Noa Martin"), combat("CB4", "")]
    },
    combatScoresByCombatId: {
      CB1: [
        { categorie: "Tachi-waza", technique: "Uchi-mata", type_ne_waza: "", camp: "JUDOKA" },
        { categorie: "Tachi-waza", technique: "O-soto-gari", type_ne_waza: "", camp: "ADVERSAIRE" }
      ],
      CB2: [{ categorie: "Tachi-waza", technique: "Uchi-mata", type_ne_waza: "", camp: "" }],
      CB3: [{ categorie: "Ne-waza", technique: "", type_ne_waza: "Immobilisation", camp: "JUDOKA" }]
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const suggestions = await service.methods.getCombatSuggestions("judoka@example.com", "JUDO1");

  assert.deepEqual(suggestions.opponents, ["Léo Dupont", "Noa Martin"]);
  // Les techniques subies (camp ADVERSAIRE) ne sont pas proposées.
  assert.deepEqual(suggestions.techniques, ["Uchi-mata", "Immobilisation"]);
  assert.deepEqual(calls.suggestionReads, ["JUDO1"]);
});

test("getCombatSuggestions reads nothing for a judoka the requester cannot manage", async () => {
  const { service, calls } = createTestCompetitionsService({
    combatsByCompetitionId: {
      COMP1: [{ id_combat: "CB1", id_judoka: "JUDO2", adversaire: "Léo Dupont", resultat: "Victoire" }]
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  assert.deepEqual(await service.methods.getCombatSuggestions("judoka@example.com", "JUDO2"), {
    opponents: [],
    techniques: []
  });
  assert.deepEqual(await service.methods.getCombatSuggestions("judoka@example.com", ""), {
    opponents: [],
    techniques: []
  });
  assert.deepEqual(calls.suggestionReads, []);
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
      judokas: [{ id_judoka: "JUDO1", prenom: "Hugo", nom: "durand" }],
      managedJudokaScope: createManagedJudokaScope(["JUDO1"])
    })
  });

  const detail = await service.methods.getCompetitionDetail("coach@example.com", "COMP1");

  assert.equal(detail.combats[0].judokaDisplayName, "Hugo DURAND");
  assert.deepEqual(detail.combats[0].scores, [
    { category: "Tachi-waza", technique: "Seoi-nage", neWazaType: "", value: "Ippon" }
  ]);
  assert.equal(detail.isCoach, true);
  assert.equal(detail.canManageCompetition, true);
  assert.equal(detail.hasInheritedClubCompetitionFields, false);
});

test("getCompetitionDetail refuses a coach for a judoka outside their clubs", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: { id_competition: "COMP1", id_judoka: "OTHER_CLUB_JUDOKA", nom: "Tournoi", date: "2026-06-14" }
    },
    getDomainUserContext: domainContextFor("COACH1", "COACH", {
      managedJudokaScope: createManagedJudokaScope(["JUDO1"])
    })
  });

  await assert.rejects(
    () => service.methods.getCompetitionDetail("coach@example.com", "COMP1"),
    /Accès refusé/
  );
});

test("getCompetitionDetail exposes inherited club competition fields", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        club_competition_id: "CLUB1",
        nom: "Tournoi club",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const detail = await service.methods.getCompetitionDetail("judoka@example.com", "COMP1");

  assert.equal(detail.hasInheritedClubCompetitionFields, true);
});

test("getCompetitionDetail exposes coach objective to a parent in managed scope", async () => {
  const { service } = createTestCompetitionsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "CHILD1",
        nom: "Tournoi",
        date: "2026-06-14",
        coach_objective: "Travailler le ne-waza"
      }
    },
    getDomainUserContext: domainContextFor("PARENT1", "NORMAL", {
      domainUser: toCanonicalJudoka({
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL"
      }),
      managedJudokaScope: createManagedJudokaScope(["PARENT1", "CHILD1"])
    })
  });

  const detail = await service.methods.getCompetitionDetail("parent@example.com", "COMP1");

  assert.equal(detail.isParent, true);
  assert.equal(detail.canEditCompetition, true);
  assert.equal(detail.competition.coachObjective, "Travailler le ne-waza");
});

function createTestCombatsService({
  competitionsByCompetitionId = {},
  combatsById = {},
  getDomainUserContext
} = {}) {
  const calls = { inserted: [], updated: [], removed: [], scores: [] };
  // Ligne telle que la base la renvoie après l'écriture d'un combat.
  const toCombatRow = (combat, idCombat) => ({
    id_combat: idCombat,
    id_judoka: combat.judokaId,
    id_competition: combat.competitionId,
    adversaire: combat.draft.opponent,
    resultat: combat.draft.result,
    type_victoire: combat.draft.victoryType
  });

  const service = createCombatsService({
    combatsRepository: {
      getById: async (id) => combatsById[id] || null,
      insert: async (draft, idCombat) => {
        calls.inserted.push({ draft, idCombat });
        return toCombatRow(draft, idCombat);
      },
      update: async (idCombat, draft) => {
        calls.updated.push({ idCombat, draft });
        return toCombatRow(draft, idCombat);
      },
      remove: async (idCombat) => calls.removed.push(idCombat)
    },
    combatScoresRepository: {
      replaceForCombat: async (idCombat, scores, concededScores = []) => {
        calls.scores.push({ idCombat, scores });
        const toRow = (camp) => (score, index) => ({
          id_combat: idCombat,
          categorie: score.category,
          technique: score.technique,
          type_ne_waza: score.neWazaType,
          valeur: score.value,
          ordre: index,
          camp
        });
        return [...scores.map(toRow("JUDOKA")), ...concededScores.map(toRow("ADVERSAIRE"))];
      }
    },
    competitionsRepository: {
      getById: async (id) => competitionsByCompetitionId[id] || null
    },
    userContextService: { getDomainUserContext },
    normalizeLastName,
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
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
    },
    getDomainUserContext: domainContextFor("JUDO1", "NORMAL")
  });

  const result = await service.methods.ajouterCombat("judoka@example.com", {
    id_competition: "COMP1",
    id_judoka: "JUDO1",
    resultat: "V",
    type_victoire: "Ippon",
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
    { category: "Ne-waza", technique: "", neWazaType: "Hon-gesa-gatame", value: "Ippon" }
  ]);
  assert.deepEqual(calls.scores, [
    {
      idCombat: "CB_NEW",
      scores: [{ category: "Ne-waza", technique: "", neWazaType: "Hon-gesa-gatame", value: "Ippon" }]
    }
  ]);
  // ECRIT-2 : l'écriture renvoie le combat enregistré, tel que la fiche l'affiche.
  assert.equal(result.competitionId, "COMP1");
  assert.equal(result.combat.combatId, "CB_NEW");
  assert.equal(result.combat.judokaId, "JUDO1");
  assert.equal(result.combat.opponent, "Lee");
  assert.equal(result.combat.result, "Victoire");
  assert.deepEqual(result.combat.scores, [
    { category: "Ne-waza", technique: "", neWazaType: "Hon-gesa-gatame", value: "Ippon", order: 0 }
  ]);
  assert.deepEqual(result.combat.concededScores, []);
});

test("updateCombat re-validates ownership of both the existing and the incoming combat", async () => {
  const { service, calls } = createTestCombatsService({
    competitionsByCompetitionId: {
      COMP1: {
        id_competition: "COMP1",
        id_judoka: "JUDO1",
        nom: "Tournoi",
        date: "2026-06-14",
        categorie_age: "Cadet"
      }
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
    resultat: "D",
    type_victoire: "Ippon"
  });

  assert.equal(result.success, true);
  assert.equal(calls.updated.length, 1);
  assert.equal(calls.updated[0].idCombat, "CB1");
  assert.equal(calls.updated[0].draft.result, "Défaite");
  assert.equal(result.combat.combatId, "CB1");
  assert.equal(result.combat.result, "Défaite");
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

test("deleteCombat rejects an admin requester", async () => {
  const { service } = createTestCombatsService({
    combatsById: {
      CB1: { id_combat: "CB1", id_judoka: "JUDO1", id_competition: "COMP1", resultat: "V" }
    },
    getDomainUserContext: domainContextFor("ADMIN1", "ADMIN")
  });

  await assert.rejects(
    () => service.methods.deleteCombat("admin@example.com", "CB1"),
    /Suppression de ce combat non autorisée/
  );
});

function createTestProfileService({
  competitionsByJudoka = {},
  combatsByJudoka = {},
  getAccessibleJudokaProfile
} = {}) {
  const service = createProfileService({
    combatsRepository: { listByJudoka: async (id) => combatsByJudoka[id] || [] },
    competitionsRepository: { listByJudoka: async (id) => competitionsByJudoka[id] || [] },
    buildJudokaProfileSnapshot,
    userContextService: { getAccessibleJudokaProfile },
    getCompetitionCategoryLabel,
    getCurrentSeasonBounds,
    isDateWithinSeason
  });

  return { service };
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
        email: "judoka@example.com",
        invited_profile_type: "JUDOKA"
      })
    },
    createEmail,
    supabaseRpc: async (method, payload) => {
      calls.push([method, payload]);
      return { success: true };
    }
  });

  await service.methods.registerProfile(" judoka@example.com ", {
    firstName: "Hugo",
    lastName: "Durand"
  });

  assert.deepEqual(calls, [
    [
      "register_profile",
      {
        p_email: "judoka@example.com",
        p_type: "JUDOKA",
        p_prenom: "Hugo",
        p_nom: "Durand",
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
  parentLinksByParent = {},
  clubIdsByCoach = {},
  { memoizeInRequest, reads = [] } = {}
) {
  return createUserContextService({
    judokasRepository: {
      // CTX-1 : le compte, les clubs coachés et les enfants rattachés arrivent en une requête.
      getIdentityByEmail: async (email) => {
        reads.push(["identity", email]);
        const user = judokasByEmail[String(email || "").toLowerCase()] || null;
        return user
          ? {
              user,
              coachClubIds: clubIdsByCoach[user.id_judoka] || [],
              childJudokaIds: parentLinksByParent[user.id_judoka] || []
            }
          : null;
      },
      listAll: async () => {
        reads.push(["listAll"]);
        return Object.values(judokasById);
      },
      getById: async (idJudoka) => judokasById[idJudoka] || null,
      listByIds: async (ids) => {
        reads.push(["listByIds", ids]);
        return ids.map((id) => judokasById[id]).filter(Boolean);
      },
      listByClubIds: async (clubIds) => {
        reads.push(["listByClubIds", clubIds]);
        return Object.values(judokasById).filter((judoka) => clubIds.includes(String(judoka.club_id || "")));
      }
    },
    memoizeInRequest,
    normalizeEmail,
    assertCanAccessJudokaProfile: permissions.assertCanAccessJudokaProfile,
    createManagedJudokaScope,
    isAdmin: permissions.isAdmin,
    isCoach: permissions.isCoach,
    isParent: permissions.isParent
  });
}

test("CTX-1 : le contexte coûte 2 lectures au plus et n'est calculé qu'une fois par appel", async () => {
  const coach = { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH", email: "coach@example.com" };
  const reads = [];
  const memo = new Map();
  const service = createTestUserContextService(
    { "coach@example.com": coach },
    { JUDO1: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL", club_id: "NANTES" } },
    {},
    { COACH1: ["NANTES"] },
    {
      reads,
      memoizeInRequest: (key, load) => {
        if (!memo.has(key)) {
          memo.set(key, load());
        }
        return memo.get(key);
      }
    }
  );

  const identity = await service.getIdentity(" Coach@Example.com ");
  assert.deepEqual(identity.coachClubIds, ["NANTES"]);
  assert.equal((await service.getCurrentUser("coach@example.com")).id_judoka, "COACH1");
  const first = await service.getDomainUserContext("coach@example.com");
  const second = await service.getCurrentUserContext("COACH@example.com");

  assert.deepEqual(reads, [
    ["identity", "coach@example.com"],
    ["listByClubIds", ["NANTES"]]
  ]);
  assert.deepEqual(first.judokas.map((judoka) => judoka.id_judoka), ["COACH1", "JUDO1"]);
  assert.equal(second.user.id_judoka, "COACH1");
});

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

test("getCurrentUserContext limits a coach to the judokas of the clubs they coach", async () => {
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
      JUDO1: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL", club_id: "NANTES" },
      JUDO2: { id_judoka: "JUDO2", profile_type: "JUDOKA", role: "NORMAL", club_id: "RENNES" },
      JUDO3: { id_judoka: "JUDO3", profile_type: "JUDOKA", role: "NORMAL", club_id: "ANGERS" },
      NOCLUB: { id_judoka: "NOCLUB", profile_type: "JUDOKA", role: "NORMAL" }
    },
    {},
    { COACH1: ["NANTES", "RENNES"] }
  );

  const context = await service.getCurrentUserContext("coach@example.com");

  assert.deepEqual(context.judokas.map((judoka) => judoka.id_judoka).sort(), ["COACH1", "JUDO1", "JUDO2"]);
  assert.deepEqual(context.coachClubIds, ["NANTES", "RENNES"]);
  assert.equal(context.managedJudokaScope.includes("JUDO1"), true);
  assert.equal(context.managedJudokaScope.includes("JUDO3"), false);
  assert.equal(context.managedJudokaScope.includes("NOCLUB"), false);
});

test("getCurrentUserContext gives a coach without club only their own profile", async () => {
  const service = createTestUserContextService(
    { "coach@example.com": { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH", email: "coach@example.com" } },
    { JUDO1: { id_judoka: "JUDO1", profile_type: "JUDOKA", role: "NORMAL", club_id: "NANTES" } }
  );

  const context = await service.getCurrentUserContext("coach@example.com");

  assert.deepEqual(context.judokas.map((judoka) => judoka.id_judoka), ["COACH1"]);
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
      CHILD1: { id_judoka: "CHILD1", profile_type: "JUDOKA", role: "NORMAL", prenom: "Hugo" }
    },
    { PARENT1: ["CHILD1"] }
  );

  const { user, target } = await service.getAccessibleJudokaProfile("parent@example.com", "CHILD1");

  assert.equal(user.id_judoka, "PARENT1");
  assert.equal(target.prenom, "Hugo");
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
  const calls = {
    inserted: [],
    removedUsers: [],
    removedCompetitionsByJudoka: [],
    invitations: [],
    links: [],
    updated: [],
    removedInvitations: [],
    clubAssignments: [],
    coachClubs: [],
    pages: [],
    lookups: {
      allJudokas: 0,
      currentUser: [],
      judokaByEmail: [],
      judokaByName: [],
      invitationByEmail: [],
      linksByParent: []
    }
  };
  const adminUser = { id_judoka: "ADMIN1", profile_type: "JUDOKA", role: "ADMIN" };

  const service = createAdminService({
    clubsRepository: {
      listAll: async () => [{ id_club: "NANTES", nom: "Judo Club Nantes" }],
      listClubIdsByCoach: async () => [],
      replaceCoachClubs: async (idCoach, clubIds) => calls.coachClubs.push([idCoach, clubIds])
    },
    competitionsRepository: {
      listByJudoka: async (idJudoka) => [],
      removeByJudoka: async (idJudoka) => calls.removedCompetitionsByJudoka.push(idJudoka)
    },
    invitationsRepository: {
      getByEmail: async (email) => {
        calls.lookups.invitationByEmail.push(email);
        return invitationsByEmail[String(email || "").toLowerCase()] || null;
      },
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
      getByEmail: async (email) => {
        calls.lookups.judokaByEmail.push(email);
        return judokasByEmail[String(email || "").toLowerCase()] || null;
      },
      getByName: async (prenom, nom) => {
        calls.lookups.judokaByName.push(`${prenom}|${nom}`);
        return judokasByName[`${prenom}|${nom}`.toLowerCase()] || null;
      },
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
      listAll: async () => {
        calls.lookups.allJudokas += 1;
        return Object.values(judokasByEmail);
      },
      // PAGE-3 : une page triée par nom, lue après un curseur, et le total de la recherche.
      listPage: async ({ search, after, limit }) => {
        calls.pages.push({ search, after, limit });
        const key = (row) => [String(row.nom || ""), String(row.prenom || ""), String(row.id_judoka || "")];
        const compare = (a, b) => {
          const [ka, kb] = [key(a), key(b)];
          return ka[0].localeCompare(kb[0]) || ka[1].localeCompare(kb[1]) || ka[2].localeCompare(kb[2]);
        };
        const needle = String(search || "").toLowerCase();
        const matching = Object.values(judokasByEmail)
          .filter((row) => !needle || `${row.nom} ${row.prenom} ${row.email}`.toLowerCase().includes(needle))
          .sort(compare);
        const rest = after ? matching.filter((row) => compare(row, after) > 0) : matching;
        return { rows: rest.slice(0, limit), total: matching.length };
      },
      listAdmins: async () =>
        Object.values(judokasByEmail).filter((judoka) => judoka.role === "ADMIN"),
      update: async (idJudoka, changes) => {
        calls.updated.push({ idJudoka, changes });
        return null;
      },
      setClub: async (idJudoka, idClub) => calls.clubAssignments.push([idJudoka, idClub]),
      remove: async (idJudoka) => {
        calls.removedUsers.push(idJudoka);
        return null;
      }
    },
    parentLinksRepository: {
      insert: async (link) => {
        calls.links.push(link);
        return link;
      },
      listByParent: async (idParent) => {
        calls.lookups.linksByParent.push(idParent);
        return [];
      }
    },
    userContextService: {
      getCurrentUser: async (email) => {
        calls.lookups.currentUser.push(email);
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
    createHandedness,
    createWeightCategory,
    createYearInCategory,
    getCurrentDate: () => "2026-06-21",
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
      "parent@example.com": {
        email: "parent@example.com",
        invited_profile_type: "PARENT",
        invited_by: "ADMIN1"
      }
    }
  );

  const management = await service.methods.getAdminsManagement("admin@example.com");

  assert.equal(management.accessInvitations.length, 1);
  assert.equal(management.accessInvitations[0].email, "parent@example.com");
  assert.equal(management.accessInvitations[0].invitedProfileType, "PARENT");
});

function buildUsersByEmail(count) {
  const users = {
    "admin@example.com": {
      id_judoka: "ADMIN1",
      profile_type: "JUDOKA",
      role: "ADMIN",
      email: "admin@example.com",
      prenom: "Ada",
      nom: "AAA"
    }
  };
  for (let index = 1; index <= count; index += 1) {
    const rank = String(index).padStart(2, "0");
    users[`judoka${rank}@example.com`] = {
      id_judoka: `JUDO${rank}`,
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: `judoka${rank}@example.com`,
      prenom: `Prenom${rank}`,
      nom: `NOM${rank}`
    };
  }
  return users;
}

test("PAGE-3 : getAdminsManagement renvoie une page de 10 utilisateurs et le total, sans lire tous les judokas", async () => {
  const { service, calls } = createTestAdminService(buildUsersByEmail(24));

  const management = await service.methods.getAdminsManagement("admin@example.com");

  assert.equal(management.users.length, 10);
  assert.equal(management.totalUsers, 25);
  assert.equal(management.users[0].judokaId, "ADMIN1");
  assert.deepEqual(management.nextCursor, { lastName: "NOM09", firstName: "Prenom09", judokaId: "JUDO09" });
  assert.deepEqual(management.admins.map((admin) => admin.judokaId), ["ADMIN1"]);
  assert.deepEqual(calls.pages, [{ search: "", after: null, limit: 10 }]);
  assert.equal(calls.lookups.allJudokas, 0);
});

test("PAGE-3 : getUsersPage lit la page suivante par curseur et envoie la recherche au serveur", async () => {
  const { service, calls } = createTestAdminService(buildUsersByEmail(24));

  const first = await service.methods.getUsersPage("admin@example.com");
  const second = await service.methods.getUsersPage("admin@example.com", { after: first.nextCursor });
  const third = await service.methods.getUsersPage("admin@example.com", { after: second.nextCursor });

  assert.deepEqual(calls.pages[1], {
    search: "",
    after: { nom: "NOM09", prenom: "Prenom09", id_judoka: "JUDO09" },
    limit: 10
  });
  assert.equal(second.users[0].judokaId, "JUDO10");
  assert.equal(second.totalUsers, 25);
  assert.deepEqual(third.users.map((user) => user.judokaId), ["JUDO20", "JUDO21", "JUDO22", "JUDO23", "JUDO24"]);
  // Toutes les pages réunies couvrent l'effectif, sans doublon.
  const ids = [...first.users, ...second.users, ...third.users].map((user) => user.judokaId);
  assert.equal(new Set(ids).size, 25);

  const searched = await service.methods.getUsersPage("admin@example.com", { search: "  nom07 " });
  assert.equal(calls.pages[3].search, "nom07");
  assert.deepEqual(searched.users.map((user) => user.judokaId), ["JUDO07"]);
  assert.equal(searched.totalUsers, 1);
  assert.equal(calls.lookups.allJudokas, 0);
});

test("PAGE-3 : getUsersPage est réservé aux admins", async () => {
  const { service, calls } = createTestAdminService(buildUsersByEmail(3));

  await assert.rejects(
    () => service.methods.getUsersPage("judoka01@example.com"),
    /réservée aux admins/
  );
  assert.deepEqual(calls.pages, []);
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
      "parent@example.com": {
        email: "parent@example.com",
        invited_profile_type: "PARENT",
        invited_by: "ADMIN1"
      }
    }
  );

  const result = await service.methods.deleteAccessInvitation(
    "admin@example.com",
    "parent@example.com"
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls.removedInvitations, ["parent@example.com"]);
});

test("parent can update category and belt color for a linked child profile", async () => {
  const saved = [];
  const service = createAdminService({
    invitationsRepository: {},
    judokasRepository: {
      getById: async (idJudoka) => ({ id_judoka: idJudoka, genre: "" }),
      saveJudokaInfo: async (
        idJudoka,
        ageCategory,
        weightCategory,
        beltColor,
        gender,
        yearInCategory,
        handedness
      ) => {
        saved.push({
          idJudoka,
          ageCategory,
          weightCategory,
          beltColor,
          gender,
          yearInCategory,
          handedness
        });
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
    createHandedness,
    createWeightCategory,
    createYearInCategory,
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
    "Orange",
    "Homme",
    "1",
    "Gaucher"
  );

  assert.equal(result.success, true);
  assert.deepEqual(saved, [
    {
      idJudoka: "CHILD1",
      ageCategory: "Minime",
      weightCategory: "-50kg",
      beltColor: "Orange",
      gender: "Homme",
      yearInCategory: "1",
      handedness: "Gaucher"
    }
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
    createHandedness,
    createWeightCategory,
    createYearInCategory,
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

test("admin cannot update an unrelated judoka sports profile", async () => {
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
        user: { id_judoka: "ADMIN1", profile_type: "JUDOKA", role: "ADMIN" },
        judokas: [],
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    buildJudokaId: buildTestJudokaIdGenerator(),
    cleanText,
    createEmail,
    createJudoka,
    createManagedChild,
    createProfileType,
    createHandedness,
    createWeightCategory,
    createYearInCategory,
    normalizeEmail: (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
  });

  await assert.rejects(
    () => service.methods.saveJudokaInfo("admin@example.com", "OTHER", "Minime", "", "Orange"),
    /Modification de profil non autorisée/
  );
});

test("importUsersCsv links a judoka without email to an already-registered parent", async () => {
  const { service, calls } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Hugo,Durand,,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.deepEqual(
    { success: summary.success, imported: summary.imported, failed: summary.failed },
    { success: true, imported: 1, failed: 0 }
  );
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.name.firstName, "Hugo");
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "JUDO_TEST_1" }]);
});

test("importUsersCsv links a judoka with email to an already-registered parent", async () => {
  const { service, calls } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.deepEqual(
    { success: summary.success, imported: summary.imported, failed: summary.failed },
    { success: true, imported: 1, failed: 0 }
  );
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accountEmail, "judoka@example.com");
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "JUDO_TEST_1" }]);
});

test("importUsersCsv activates an existing named judoka with imported sports profile fields", async () => {
  const { service, calls } = createTestAdminService(
    {},
    {},
    {
      "hugo|durand": {
        id_judoka: "CHILD1",
        profile_type: "JUDOKA",
        role: "NORMAL",
        email: "",
        prenom: "Hugo",
        nom: "Durand"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,couleur_ceinture,genre,anneeCategorie,lateralite\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,Minime,Orange,Homme,1,Droitier\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [
    {
      idJudoka: "CHILD1",
      changes: {
        accountEmail: "judoka@example.com",
        profileType: "JUDOKA",
        ageCategory: "Minime",
        beltColor: "Orange",
        gender: "Homme",
        yearInCategory: "1",
        handedness: "Droitier"
      }
    }
  ]);
});

test("importUsersCsv links an existing judoka account to an already-registered parent", async () => {
  const { service, calls } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com"
    },
    "judoka@example.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "judoka@example.com",
      prenom: "Hugo",
      nom: "Durand"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted.length, 0);
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "CHILD1" }]);
});

test("importUsersCsv rejects a row referencing a parent with neither an account nor an invitation", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Nina,Durand,,parent@example.com\n";

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
      "parent@example.com": {
        email: "parent@example.com",
        invited_profile_type: "PARENT"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Nina,Durand,,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(summary.imported, 1);
  assert.match(summary.results[0].message, /en attente de la première connexion/);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].extras.pending_parent_email, "parent@example.com");
  assert.equal(calls.links.length, 0);
});

test("importUsersCsv reuses an existing judoka identified by first and last name instead of duplicating it", async () => {
  const { service, calls } = createTestAdminService(
    {
      "parent@example.com": {
        id_judoka: "PARENT1",
        profile_type: "PARENT",
        role: "NORMAL",
        email: "parent@example.com"
      }
    },
    {},
    {
      "hugo|durand": {
        id_judoka: "JUDO_EXISTING",
        profile_type: "JUDOKA",
        nom: "Durand",
        prenom: "Hugo"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Hugo,Durand,,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.match(summary.results[0].message, /rattaché au parent/);
  assert.equal(calls.inserted.length, 0);
  assert.deepEqual(calls.links, [{ id_parent: "PARENT1", id_judoka: "JUDO_EXISTING" }]);
});

test("importUsersCsv re-importing the same name twice does not create a duplicate profile", async () => {
  const judokasByName = {};
  const { service, calls } = createTestAdminService({}, {}, judokasByName);

  const csv = "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Hugo,Durand,,\n";

  const first = await service.methods.importUsersCsv("admin@example.com", csv);
  assert.equal(calls.inserted.length, 1);
  judokasByName["hugo|durand"] = {
    id_judoka: calls.inserted[0].judoka.judokaId,
    profile_type: "JUDOKA",
    prenom: "Hugo",
    nom: "Durand"
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
    "PARENT,Claire,Durand,parent@example.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.invitations.length, 0);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accountEmail, "parent@example.com");
  assert.equal(calls.inserted[0].judoka.profileType, "PARENT");
});

test("importUsersCsv creates a direct judoka account profile from an email row", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Hugo,Durand,judoka@example.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.invitations.length, 0);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].judoka.accountEmail, "judoka@example.com");
  assert.equal(calls.inserted[0].judoka.profileType, "JUDOKA");
});

test("importUsersCsv links children to a parent created earlier in the same CSV", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Claire,Durand,parent@example.com,\n" +
    "JUDOKA,Hugo,Durand,,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(summary.imported, 2);
  assert.equal(calls.links.length, 1);
  assert.equal(calls.links[0].id_parent, calls.inserted[0].judoka.judokaId);
});

test("importUsersCsv reuses per-file lookups for repeated parent links", async () => {
  const { service, calls } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com",
      prenom: "Claire",
      nom: "Durand"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Hugo,Durand,,parent@example.com\n" +
    "JUDOKA,Nina,Durand,,parent@example.com\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.links.length, 2);
  assert.deepEqual(calls.lookups.judokaByEmail, ["parent@example.com"]);
  assert.deepEqual(calls.lookups.linksByParent, ["PARENT1"]);
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
    "PARENT,Claire,Durand,parent@example.com,,COACH\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.match(summary.results[0].message, /Un profil PARENT ne peut pas être COACH/);
  assert.equal(calls.inserted.length, 0);
});

test("importUsersCsv assigns an age category to a judoka created with an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,Minime\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.categorie_age, "Minime");
});

test("importUsersCsv assigns a belt color to a judoka created with an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,couleur_ceinture\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,Minime,Orange\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.couleur_ceinture, "Orange");
});

test("importUsersCsv assigns an age category to a managed judoka without an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Nina,Durand,,,,Minime\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.categorie_age, "Minime");
});

test("importUsersCsv assigns a belt color to a managed judoka without an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,couleur_ceinture\n" +
    "JUDOKA,Nina,Durand,,,,Minime,Jaune\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.couleur_ceinture, "Jaune");
});

test("importUsersCsv assigns gender and year in category to a judoka created with an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,genre,anneeCategorie\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,Minime,Homme,1\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.genre, "Homme");
  assert.equal(calls.inserted[0].extras.annee_categorie, "1");
});

test("importUsersCsv assigns handedness to a judoka created with an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,genre,anneeCategorie,lateralite\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,Minime,Homme,1,Gaucher\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.lateralite, "Gaucher");
});

test("importUsersCsv assigns gender and year in category to a managed judoka without an account email", async () => {
  const { service, calls } = createTestAdminService({});

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,genre,anneeCategorie\n" +
    "JUDOKA,Nina,Durand,,,,Minime,Femme,2\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted[0].extras.genre, "Femme");
  assert.equal(calls.inserted[0].extras.annee_categorie, "2");
});

test("importUsersCsv updates an existing judoka's role and age category instead of failing the row", async () => {
  const { service, calls } = createTestAdminService({
    "judoka@example.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "judoka@example.com",
      prenom: "Hugo",
      nom: "Durand",
      categorie_age: "Minime"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,COACH,Cadet\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(summary.failed, 0);
  assert.equal(calls.inserted.length, 0);
  assert.deepEqual(calls.updated, [
    { idJudoka: "CHILD1", changes: { accessRole: "COACH", ageCategory: "Cadet" } }
  ]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing judoka's gender and year in category", async () => {
  const { service, calls } = createTestAdminService({
    "judoka@example.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "judoka@example.com",
      prenom: "Hugo",
      nom: "Durand",
      categorie_age: "Cadet",
      genre: "",
      annee_categorie: ""
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,genre,anneeCategorie\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,Cadet,Homme,2\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [
    { idJudoka: "CHILD1", changes: { gender: "Homme", yearInCategory: "2" } }
  ]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing judoka's belt color", async () => {
  const { service, calls } = createTestAdminService({
    "judoka@example.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "judoka@example.com",
      prenom: "Hugo",
      nom: "Durand",
      couleur_ceinture: ""
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,couleur_ceinture\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,,Marron\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [{ idJudoka: "CHILD1", changes: { beltColor: "Marron" } }]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing judoka's handedness", async () => {
  const { service, calls } = createTestAdminService({
    "judoka@example.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "judoka@example.com",
      prenom: "Hugo",
      nom: "Durand",
      lateralite: ""
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,genre,anneeCategorie,lateralite\n" +
    "JUDOKA,Hugo,Durand,judoka@example.com,,,,,,Droitier\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [{ idJudoka: "CHILD1", changes: { handedness: "Droitier" } }]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv re-importing an existing judoka without changes leaves their role untouched", async () => {
  const { service, calls } = createTestAdminService({
    "judoka@example.com": {
      id_judoka: "CHILD1",
      profile_type: "JUDOKA",
      role: "COACH",
      email: "judoka@example.com",
      prenom: "Hugo",
      nom: "Durand",
      categorie_age: "Minime"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Hugo,Durand,judoka@example.com,\n";

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
      "nina|durand": {
        id_judoka: "CHILD2",
        profile_type: "JUDOKA",
        prenom: "Nina",
        nom: "Durand",
        categorie_age: "Minime"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Nina,Durand,,,,Cadet\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [{ idJudoka: "CHILD2", changes: { ageCategory: "Cadet" } }]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing managed judoka's role when re-imported by name", async () => {
  const { service, calls } = createTestAdminService(
    {},
    {},
    {
      "nina|durand": {
        id_judoka: "CHILD2",
        profile_type: "JUDOKA",
        role: "COACH",
        prenom: "Nina",
        nom: "Durand",
        categorie_age: "Minime"
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory\n" +
    "JUDOKA,Nina,Durand,,,NORMAL,Cadet\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [
    { idJudoka: "CHILD2", changes: { accessRole: "NORMAL", ageCategory: "Cadet" } }
  ]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing managed judoka's gender and year in category when re-imported by name", async () => {
  const { service, calls } = createTestAdminService(
    {},
    {},
    {
      "nina|durand": {
        id_judoka: "CHILD2",
        profile_type: "JUDOKA",
        prenom: "Nina",
        nom: "Durand",
        categorie_age: "Minime",
        genre: "",
        annee_categorie: ""
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,genre,anneeCategorie\n" +
    "JUDOKA,Nina,Durand,,,,Minime,Femme,1\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [
    { idJudoka: "CHILD2", changes: { gender: "Femme", yearInCategory: "1" } }
  ]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing managed judoka's belt color when re-imported by name", async () => {
  const { service, calls } = createTestAdminService(
    {},
    {},
    {
      "nina|durand": {
        id_judoka: "CHILD2",
        profile_type: "JUDOKA",
        prenom: "Nina",
        nom: "Durand",
        couleur_ceinture: ""
      }
    }
  );

  const csv =
    "profileType,prenom,nom,email,parentEmail,role,ageCategory,couleur_ceinture\n" +
    "JUDOKA,Nina,Durand,,,,,Jaune\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.deepEqual(calls.updated, [{ idJudoka: "CHILD2", changes: { beltColor: "Jaune" } }]);
  assert.match(summary.results[0].message, /mis à jour/);
});

test("importUsersCsv updates an existing PARENT row instead of failing it", async () => {
  const { service, calls } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com",
      prenom: "Claire",
      nom: "Durand"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Claire,Durand,parent@example.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, true);
  assert.equal(calls.inserted.length, 0);
  assert.match(summary.results[0].message, /aucune modification/);
});

test("importUsersCsv rejects a PARENT row whose email belongs to a different person", async () => {
  const { service } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com",
      prenom: "Sophie",
      nom: "Martin"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Claire,Durand,parent@example.com,\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.success, false);
  assert.match(summary.results[0].message, /correspond déjà à un autre profil parent/);
});

test("importUsersCsv rejects a PARENT row whose email belongs to a JUDOKA account", async () => {
  const { service } = createTestAdminService({
    "parent@example.com": {
      id_judoka: "JUDO1",
      profile_type: "JUDOKA",
      role: "NORMAL",
      email: "parent@example.com",
      prenom: "Claire",
      nom: "Durand"
    }
  });

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" +
    "PARENT,Claire,Durand,parent@example.com,\n";

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
    "parent@example.com": {
      id_judoka: "PARENT1",
      profile_type: "PARENT",
      role: "NORMAL",
      email: "parent@example.com",
      prenom: "Claire",
      nom: "Durand"
    }
  });

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.imported, 4);
  assert.equal(summary.failed, 0);
  assert.equal(calls.links.length, 2);
  assert.ok(calls.links.every((link) => link.id_parent === "PARENT1"));
  assert.deepEqual(
    calls.inserted.map((call) => call.extras && call.extras.couleur_ceinture),
    ["Orange", "Jaune", "Marron"]
  );
  // Colonne club : les trois judokas rejoignent le Judo Club Nantes, et le coach coache ce club.
  assert.equal(calls.clubAssignments.length, 3);
  assert.ok(calls.clubAssignments.every(([, idClub]) => idClub === "NANTES"));
  assert.equal(calls.coachClubs.length, 1);
  assert.deepEqual(calls.coachClubs[0][1], ["NANTES"]);
});

test("importUsersCsv rejects an unknown club or a club on a parent row without writing", async () => {
  const { service, calls } = createTestAdminService();
  const csv =
    "profileType,prenom,nom,email,parentEmail,club\n" +
    "JUDOKA,Lina,Martin,,,Club Fantôme\n" +
    "PARENT,Sophie,Martin,sophie.martin@example.com,,Judo Club Nantes\n";

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.failed, 2);
  assert.match(summary.results[0].message, /Club inconnu : Club Fantôme/);
  assert.match(summary.results[1].message, /PARENT n'appartient pas à un club/);
  assert.deepEqual(calls.inserted, []);
  assert.deepEqual(calls.clubAssignments, []);
});
