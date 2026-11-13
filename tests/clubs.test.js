const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../core/domain/access/permission-policy");
const { createManagedJudokaScope } = require("../core/domain/access/managed-judoka-scope");
const { createCompetition } = require("../core/domain/competitions/competition");
const { createClubCompetition } = require("../core/domain/competitions/club-competition");
const createClubCompetitionsService = require("../core/services/club-competitions.service");
const createClubsService = require("../core/services/clubs.service");
const createCoachDashboardService = require("../core/services/coach-dashboard.service");
const { toCanonicalJudoka } = require("../core/services/domain-adapters");

// Coach des clubs NANTES et RENNES ; ANGERS est un club qu'il ne coache pas.
function coachContext(extras = {}) {
  return async () => ({
    user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
    domainUser: toCanonicalJudoka({ id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" }),
    judokas: extras.judokas || [],
    managedJudokaScope: createManagedJudokaScope(extras.scope || []),
    coachClubIds: extras.coachClubIds || ["NANTES", "RENNES"]
  });
}

function adminContext({ coach = false } = {}) {
  const user = {
    id_judoka: "ADMIN1",
    profile_type: "JUDOKA",
    role: coach ? "COACH" : "NORMAL",
    is_admin: true
  };
  return async () => ({ user, domainUser: toCanonicalJudoka(user) });
}

function createClubCompetitionsServiceFor({ events = {}, judokas = {}, calls = [], context = coachContext() } = {}) {
  return createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async (id) => events[id] || null,
      insert: async (event) => calls.push(["insertClub", event]),
      update: async (id, event) => calls.push(["updateClub", id, event]),
      remove: async (id) => calls.push(["removeClub", id])
    },
    competitionsRepository: {
      listByClubCompetition: async () => [],
      insertMany: async (rows) => {
        rows.forEach(({ competition }) => calls.push(["insertCompetition", competition]));
        return [];
      },
      updateClubCompetitionFields: async () => {},
      getById: async () => null,
      remove: async () => {},
      detachAllFromClubCompetition: async () => {}
    },
    judokasRepository: {
      // INSCR-2 : les judokas des jeux de données sont inscrits pour la saison en cours.
      listByIds: async (ids) => ids.map((id) => judokas[id] && { saison_inscription: 2026, ...judokas[id] }).filter(Boolean)
    },
    userContextService: { getDomainUserContext: context },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "EVENT_NEW",
    buildCompetitionId: () => "COMP_NEW",
    createClubCompetition,
    createCompetition,
    getCurrentDate: () => "2026-06-01"
  });
}

const baseEvent = {
  name: "Tournoi",
  competitionDate: "2026-09-26",
  ageCategory: "Cadet",
  level: "National"
};

test("a coach creates a club competition in one of their clubs with that club's judokas", async () => {
  const calls = [];
  const service = createClubCompetitionsServiceFor({
    calls,
    judokas: { J1: { id_judoka: "J1", categorie_age: "Cadet", club_id: "RENNES" } }
  });

  await service.methods.saveClubCompetition("coach@example.com", {
    ...baseEvent,
    clubId: "RENNES",
    participantJudokaIds: ["J1"]
  });

  const inserted = calls.find(([kind]) => kind === "insertClub");
  assert.equal(inserted[1].clubId, "RENNES");
});

test("a coach of a single club does not have to choose the club", async () => {
  const calls = [];
  const service = createClubCompetitionsServiceFor({
    calls,
    context: coachContext({ coachClubIds: ["NANTES"] }),
    judokas: { J1: { id_judoka: "J1", categorie_age: "Cadet", club_id: "NANTES" } }
  });

  await service.methods.saveClubCompetition("coach@example.com", { ...baseEvent, participantJudokaIds: ["J1"] });

  assert.equal(calls.find(([kind]) => kind === "insertClub")[1].clubId, "NANTES");
});

test("a coach of several clubs must choose the club", async () => {
  const service = createClubCompetitionsServiceFor({
    judokas: { J1: { id_judoka: "J1", categorie_age: "Cadet", club_id: "NANTES" } }
  });

  await assert.rejects(
    () => service.methods.saveClubCompetition("coach@example.com", { ...baseEvent, participantJudokaIds: ["J1"] }),
    /Club de la compétition obligatoire/
  );
});

test("a coach cannot create a club competition for a club they do not coach", async () => {
  const calls = [];
  const service = createClubCompetitionsServiceFor({
    calls,
    judokas: { J1: { id_judoka: "J1", categorie_age: "Cadet", club_id: "ANGERS" } }
  });

  await assert.rejects(
    () =>
      service.methods.saveClubCompetition("coach@example.com", {
        ...baseEvent,
        clubId: "ANGERS",
        participantJudokaIds: ["J1"]
      }),
    /introuvable/
  );
  assert.deepEqual(calls, []);
});

test("a coach cannot enter a judoka from another club", async () => {
  const calls = [];
  const service = createClubCompetitionsServiceFor({
    calls,
    judokas: {
      J1: { id_judoka: "J1", categorie_age: "Cadet", club_id: "NANTES" },
      J2: { id_judoka: "J2", categorie_age: "Cadet", club_id: "RENNES" }
    }
  });

  await assert.rejects(
    () =>
      service.methods.saveClubCompetition("coach@example.com", {
        ...baseEvent,
        clubId: "NANTES",
        participantJudokaIds: ["J1", "J2"]
      }),
    /club de la compétition/
  );
  assert.deepEqual(calls, []);
});

test("a coach cannot open, edit or delete another club's competition", async () => {
  const calls = [];
  const service = createClubCompetitionsServiceFor({
    calls,
    events: {
      ANGERS_EVENT: { id_club_competition: "ANGERS_EVENT", nom: "Tournoi", date: "2026-09-26", club_id: "ANGERS" },
      NO_CLUB_EVENT: { id_club_competition: "NO_CLUB_EVENT", nom: "Tournoi", date: "2026-09-26", club_id: null }
    }
  });

  for (const id of ["ANGERS_EVENT", "NO_CLUB_EVENT"]) {
    await assert.rejects(() => service.methods.getClubCompetitionDetail("coach@example.com", id), /introuvable/);
    await assert.rejects(() => service.methods.deleteClubCompetition("coach@example.com", id), /introuvable/);
    await assert.rejects(
      () => service.methods.saveClubCompetition("coach@example.com", { ...baseEvent, clubCompetitionId: id }),
      /introuvable/
    );
  }
  assert.deepEqual(calls, []);
});

test("coach statistics only cover judokas of the coach's clubs, and can be narrowed to one club", async () => {
  const competitionRows = [
    { id_competition: "C_NANTES", id_judoka: "J_NANTES", date: "2026-02-10", categorie_age: "Cadet" },
    { id_competition: "C_RENNES", id_judoka: "J_RENNES", date: "2026-02-11", categorie_age: "Cadet" },
    { id_competition: "C_ANGERS", id_judoka: "J_ANGERS", date: "2026-02-12", categorie_age: "Cadet" }
  ];
  const combat = (id, judoka, competition) => ({
    id_combat: id,
    id_judoka: judoka,
    id_competition: competition,
    resultat: "Victoire",
    type_victoire: "Ippon"
  });
  const combatsByCompetitionId = {
    C_NANTES: [combat("K1", "J_NANTES", "C_NANTES")],
    C_RENNES: [combat("K2", "J_RENNES", "C_RENNES")],
    C_ANGERS: [combat("K3", "J_ANGERS", "C_ANGERS")]
  };
  const judokas = [
    { id_judoka: "J_NANTES", club_id: "NANTES" },
    { id_judoka: "J_RENNES", club_id: "RENNES" }
  ];
  const scopes = [];
  const context = coachContext({ judokas });
  const service = createCoachDashboardService({
    // STAT-17 : le dépôt renvoie ici plus que le périmètre demandé : le service ne doit garder que
    // les compétitions et les combats des judokas des clubs du coach.
    combatsRepository: {
      listByCompetitionIdsWithScores: async (ids) =>
        ids.flatMap((id) => (combatsByCompetitionId[id] || []).map((row) => ({ ...row, combat_scores: [] }))),
      listCoachDashboardData: async (scope) => {
        scopes.push(scope);
        return {
          competitions: competitionRows,
          combats: Object.values(combatsByCompetitionId).flat().map((row) => ({ ...row, combat_scores: [] }))
        };
      }
    },
    competitionsRepository: {
      listInScope: async () => competitionRows
    },
    userContextService: {
      getDomainUserContext: context,
      getIdentity: async () => {
        const { user, coachClubIds } = await context();
        return { user, coachClubIds, childJudokaIds: [] };
      }
    }
  });

  const all = await service.methods.getCoachDashboard("coach@example.com", {});
  assert.equal(all.stats.totalCombats, 2);
  assert.deepEqual(all.availableCompetitions.map((c) => c.competitionId).sort(), ["C_NANTES", "C_RENNES"]);
  // COACH-1 : le périmètre part dans la requête (clubs du coach et lui-même).
  assert.deepEqual(scopes[0], { clubIds: ["NANTES", "RENNES"], judokaIds: ["COACH1"] });

  // STAT-20 : le club de Rennes n'a qu'un judoka : seul le volume est donné.
  const rennes = await service.methods.getCoachDashboard("coach@example.com", { clubId: "RENNES" });
  assert.equal(rennes.stats, null);
  assert.deepEqual(rennes.withheld, { analyzedCompetitions: 1, totalCombats: 1 });
  assert.deepEqual(scopes[1], { clubIds: ["RENNES"] });

  await assert.rejects(
    () => service.methods.getCoachDashboard("coach@example.com", { clubId: "ANGERS" }),
    /Club introuvable/
  );

  const search = await service.methods.searchCombats("coach@example.com", {});
  assert.deepEqual(search.matches.map((match) => match.judokaId).sort(), ["J_NANTES", "J_RENNES"]);
});

function createClubsServiceFor({ context = adminContext(), clubs = [], links = [], judokas = [], competitionsByClub = {}, calls = [] } = {}) {
  return createClubsService({
    clubsRepository: {
      listAll: async () => clubs,
      getById: async (id) => clubs.find((club) => club.id_club === id) || null,
      insert: async (club) => calls.push(["insert", club]),
      rename: async (id, nom) => calls.push(["rename", id, nom]),
      remove: async (id) => calls.push(["remove", id]),
      listCoachLinks: async () => links,
      replaceCoachClubs: async (idCoach, clubIds) => calls.push(["replaceCoachClubs", idCoach, clubIds])
    },
    clubCompetitionsRepository: { countByClub: async (id) => competitionsByClub[id] || 0 },
    judokasRepository: {
      getById: async (id) => judokas.find((judoka) => judoka.id_judoka === id) || null,
      listCoaches: async () => judokas.filter((judoka) => judoka.role === "COACH"),
      countByClub: async (id) => judokas.filter((judoka) => judoka.club_id === id).length,
      setClub: async (id, clubId) => calls.push(["setClub", id, clubId])
    },
    // Le contrôle d'accès des clubs ne lit que le compte (getIdentity), pas le périmètre.
    userContextService: {
      getIdentity: async (email) => {
        const { user } = await context(email);
        return { user, coachClubIds: [], childJudokaIds: [] };
      }
    },
    isAdmin: permissions.isAdmin,
    buildClubId: () => "CLUB_NEW"
  });
}

test("only an admin manages clubs; a coach who is also admin can", async () => {
  const coachOnly = createClubsServiceFor({ context: coachContext() });
  await assert.rejects(() => coachOnly.methods.saveClub("coach@example.com", { name: "Judo Club Nantes" }), /admins/);
  await assert.rejects(() => coachOnly.methods.getClubsManagement("coach@example.com"), /admins/);

  const calls = [];
  const coachAdmin = createClubsServiceFor({ context: adminContext({ coach: true }), calls });
  await coachAdmin.methods.saveClub("alex@example.com", { name: "  Judo Club   Nantes " });
  assert.deepEqual(calls, [["insert", { id_club: "CLUB_NEW", nom: "Judo Club Nantes" }]]);
});

test("club names are unique regardless of case", async () => {
  const service = createClubsServiceFor({ clubs: [{ id_club: "NANTES", nom: "Judo Club Nantes" }] });
  await assert.rejects(() => service.methods.saveClub("admin@example.com", { name: "judo club nantes" }), /déjà/);
});

test("a club can only be deleted when it has no judoka, no coach and no competition", async () => {
  const clubs = [{ id_club: "NANTES", nom: "Nantes" }, { id_club: "EMPTY", nom: "Vide" }];
  const calls = [];
  const service = createClubsServiceFor({
    clubs,
    calls,
    judokas: [{ id_judoka: "J1", club_id: "NANTES" }],
    links: [{ id_coach: "COACH1", id_club: "NANTES" }]
  });

  await assert.rejects(() => service.methods.deleteClub("admin@example.com", "NANTES"), /sans judoka/);
  await service.methods.deleteClub("admin@example.com", "EMPTY");
  assert.deepEqual(calls, [["remove", "EMPTY"]]);

  const withCompetition = createClubsServiceFor({ clubs, competitionsByClub: { EMPTY: 1 } });
  await assert.rejects(() => withCompetition.methods.deleteClub("admin@example.com", "EMPTY"), /sans compétition/);
});

test("clubs can only be assigned to coaches, and only existing clubs", async () => {
  const calls = [];
  const service = createClubsServiceFor({
    calls,
    clubs: [{ id_club: "NANTES", nom: "Nantes" }],
    judokas: [
      { id_judoka: "COACH1", role: "COACH", profile_type: "JUDOKA" },
      { id_judoka: "J1", role: "NORMAL", profile_type: "JUDOKA" }
    ]
  });

  await service.methods.setCoachClubs("admin@example.com", "COACH1", ["NANTES", "NANTES"]);
  assert.deepEqual(calls, [["replaceCoachClubs", "COACH1", ["NANTES"]]]);
  await assert.rejects(() => service.methods.setCoachClubs("admin@example.com", "J1", ["NANTES"]), /Coach introuvable/);
  await assert.rejects(() => service.methods.setCoachClubs("admin@example.com", "COACH1", ["GHOST"]), /Club introuvable/);

  await service.methods.setJudokaClub("admin@example.com", "J1", "NANTES");
  await service.methods.setJudokaClub("admin@example.com", "J1", null);
  assert.deepEqual(calls.slice(1), [["setClub", "J1", "NANTES"], ["setClub", "J1", null]]);
});

test("permission policy keeps admin rights separate from the coach role", () => {
  const coachAdmin = { accessRole: "COACH", adminAccess: true, judokaId: "C" };
  const scope = createManagedJudokaScope(["J1"]);
  assert.equal(permissions.isAdmin(coachAdmin), true);
  assert.equal(permissions.isCoach(coachAdmin), true);
  assert.equal(permissions.canManageCombatFor(coachAdmin, "J1", scope), true);
  assert.equal(permissions.canManageCombatFor(coachAdmin, "J2", scope), false);
  assert.equal(permissions.canManageCombatFor({ accessRole: "ADMIN" }, "J1", scope), false);
});

test("club management reads only coaches and per-club counts, never the whole judoka list", async () => {
  const service = createClubsServiceFor({
    clubs: [{ id_club: "NANTES", nom: "Nantes" }, { id_club: "RENNES", nom: "Rennes" }],
    links: [{ id_coach: "COACH1", id_club: "NANTES" }],
    judokas: [
      { id_judoka: "COACH1", role: "COACH", profile_type: "JUDOKA", prenom: "Alex", nom: "Coach", email: "alex@example.com" },
      { id_judoka: "J1", role: "NORMAL", profile_type: "JUDOKA", club_id: "NANTES" },
      { id_judoka: "J2", role: "NORMAL", profile_type: "JUDOKA", club_id: "NANTES" }
    ]
  });

  const management = await service.methods.getClubsManagement("admin@example.com");

  assert.deepEqual(management.clubs, [
    { clubId: "NANTES", name: "Nantes", coachIds: ["COACH1"], judokaCount: 2 },
    { clubId: "RENNES", name: "Rennes", coachIds: [], judokaCount: 0 }
  ]);
  assert.deepEqual(management.coaches.map((coach) => coach.judokaId), ["COACH1"]);
});
