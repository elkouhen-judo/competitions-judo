// CONV : convocation d'une compétition club et réponse de présence des familles.
const test = require("node:test");
const assert = require("./helpers/relaxed-assert");

const permissions = require("../core/domain/access/permission-policy");
const { createManagedJudokaScope } = require("../core/domain/access/managed-judoka-scope");
const {
  createCompetition,
  createPersistedCompetition
} = require("../core/domain/competitions/competition");
const { createClubCompetition } = require("../core/domain/competitions/club-competition");
const createCompetitionsService = require("../core/services/competitions.service");
const { toCanonicalCompetition, toCanonicalJudoka } = require("../core/services/domain-adapters");
const { normalizeLastName } = require("../core/shared/text");

const EVENT = {
  id_club_competition: "CC1",
  nom: "Interclubs",
  date: "2026-12-06",
  club_id: "NANTES",
  lieu: "Gymnase du Breil, Nantes",
  date_limite_reponse: "2026-12-01",
  message_convocation: "Judogi blanc et licence."
};

function participation(extra = {}) {
  return {
    id_competition: "COMP1",
    id_judoka: "CHILD1",
    club_competition_id: "CC1",
    nom: "Interclubs",
    date: "2026-12-06",
    categorie_age: "Minime",
    presence: "",
    ...extra
  };
}

function parentContext() {
  return async () => ({
    judokas: [],
    domainUser: toCanonicalJudoka({ id_judoka: "PARENT1", profile_type: "PARENT", role: "NORMAL" }),
    managedJudokaScope: createManagedJudokaScope(["CHILD1"]),
    coachClubIds: []
  });
}

function judokaContext(id) {
  return async () => ({
    judokas: [],
    domainUser: toCanonicalJudoka({ id_judoka: id, profile_type: "JUDOKA", role: "NORMAL" }),
    managedJudokaScope: createManagedJudokaScope([]),
    coachClubIds: []
  });
}

function coachContext(clubIds = ["NANTES"]) {
  return async () => ({
    judokas: [],
    domainUser: toCanonicalJudoka({ id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" }),
    managedJudokaScope: createManagedJudokaScope(["CHILD1"]),
    coachClubIds: clubIds
  });
}

function createService({
  competition = participation(),
  event = EVENT,
  getDomainUserContext,
  today
}) {
  const calls = { presence: [] };
  const service = createCompetitionsService({
    combatsRepository: {
      listByCompetitionWithScores: async () => [],
      listSuggestionsByJudoka: async () => []
    },
    competitionsRepository: {
      // CONV-003 : la participation est lue avec sa compétition club embarquée.
      getById: async (id) =>
        competition && competition.id_competition === id
          ? { ...competition, club_competitions: competition.club_competition_id ? event : null }
          : null,
      updatePresence: async (id, presence) => {
        calls.presence.push({ id, presence });
        return { ...competition, presence };
      }
    },
    userContextService: { getDomainUserContext },
    normalizeLastName,
    canManageCombatFor: permissions.canManageCombatFor,
    canManageCompetition: permissions.canManageCompetition,
    assertCanAccessCompetition: permissions.assertCanAccessCompetition,
    assertCanManageCompetition: permissions.assertCanManageCompetition,
    resolveJudokaDataAccess: permissions.resolveJudokaDataAccess,
    resolveCompetitionOwnerId: permissions.resolveCompetitionOwnerId,
    createCompetition,
    createPersistedCompetition,
    getCurrentDate: () => today
  });
  return { service, calls };
}

test("CONV-001 : la convocation d'une compétition club est facultative", () => {
  const event = createClubCompetition({
    name: "Interclubs",
    competitionDate: "2026-12-06",
    ageCategory: "Minime",
    level: "Départemental"
  });
  assert.equal(event.place, "");
  assert.equal(event.responseDeadline, "");
  assert.equal(event.convocationMessage, "");
});

test("CONV-001 : lieu, date limite et message sont enregistrés nettoyés", () => {
  const event = createClubCompetition({
    name: "Interclubs",
    competitionDate: "2026-12-06",
    ageCategory: "Minime",
    level: "Départemental",
    place: "  Gymnase du Breil  ",
    responseDeadline: "2026-12-06",
    convocationMessage: " Judogi blanc. "
  });
  assert.equal(event.place, "Gymnase du Breil");
  assert.equal(event.responseDeadline, "2026-12-06");
  assert.equal(event.convocationMessage, "Judogi blanc.");
});

test("CONV-001 : la date limite ne peut pas tomber après la compétition", () => {
  assert.throws(
    () =>
      createClubCompetition({
        name: "Interclubs",
        competitionDate: "2026-12-06",
        ageCategory: "Minime",
        level: "Départemental",
        responseDeadline: "2026-12-07"
      }),
    /au plus tard le jour de la compétition/
  );
  assert.throws(
    () =>
      createClubCompetition({
        name: "Interclubs",
        competitionDate: "2026-12-06",
        ageCategory: "Minime",
        level: "Départemental",
        responseDeadline: "06/12/2026"
      }),
    /Date limite de réponse invalide/
  );
});

test("CONV-003 : la participation lue porte sa convocation et sa réponse", () => {
  const competition = toCanonicalCompetition({
    ...participation({ presence: "PRESENT" }),
    club_competitions: {
      lieu: EVENT.lieu,
      date_limite_reponse: EVENT.date_limite_reponse,
      message_convocation: EVENT.message_convocation
    }
  });
  assert.equal(competition.presence, "PRESENT");
  assert.deepEqual(competition.convocation, {
    place: "Gymnase du Breil, Nantes",
    responseDeadline: "2026-12-01",
    message: "Judogi blanc et licence."
  });
  assert.equal(toCanonicalCompetition({ ...participation(), presence: "PEUT-ETRE" }).presence, "");
  assert.equal(
    toCanonicalCompetition(participation({ club_competition_id: null })).convocation,
    null
  );
});

test("CONV-002 : un parent confirme la présence de son enfant avant la date limite", async () => {
  const { service, calls } = createService({
    getDomainUserContext: parentContext(),
    today: "2026-12-01"
  });
  const result = await service.methods.savePresence("parent@example.com", "COMP1", "PRESENT");
  assert.deepEqual(calls.presence, [{ id: "COMP1", presence: "PRESENT" }]);
  assert.equal(result.message, "Présence confirmée.");
  assert.equal(result.competition.presence, "PRESENT");
  assert.equal(result.competition.convocation.place, "Gymnase du Breil, Nantes");
});

test("CONV-002 : un judoka répond pour lui-même", async () => {
  const { service, calls } = createService({
    getDomainUserContext: judokaContext("CHILD1"),
    today: "2026-11-28"
  });
  const result = await service.methods.savePresence("judoka@example.com", "COMP1", "ABSENT");
  assert.deepEqual(calls.presence, [{ id: "COMP1", presence: "ABSENT" }]);
  assert.equal(result.message, "Absence enregistrée.");
});

test("CONV-002 : un parent ne répond pas pour un judoka qui n'est pas son enfant", async () => {
  const { service, calls } = createService({
    competition: participation({ id_judoka: "OTHER" }),
    getDomainUserContext: parentContext(),
    today: "2026-11-28"
  });
  await assert.rejects(
    () => service.methods.savePresence("parent@example.com", "COMP1", "PRESENT"),
    /Réponse de présence non autorisée/
  );
  assert.equal(calls.presence.length, 0);
});

test("CONV-002 : après la date limite, la famille ne peut plus répondre", async () => {
  const { service, calls } = createService({
    getDomainUserContext: parentContext(),
    today: "2026-12-02"
  });
  await assert.rejects(
    () => service.methods.savePresence("parent@example.com", "COMP1", "ABSENT"),
    /date limite de réponse est passée/
  );
  assert.equal(calls.presence.length, 0);
});

test("CONV-002 : sans date limite, la famille répond jusqu'au jour de la compétition inclus", async () => {
  const event = { ...EVENT, date_limite_reponse: null };
  const open = createService({ event, getDomainUserContext: parentContext(), today: "2026-12-06" });
  await open.service.methods.savePresence("parent@example.com", "COMP1", "PRESENT");
  assert.equal(open.calls.presence.length, 1);

  const closed = createService({
    event,
    getDomainUserContext: parentContext(),
    today: "2026-12-07"
  });
  await assert.rejects(
    () => closed.service.methods.savePresence("parent@example.com", "COMP1", "PRESENT"),
    /date limite de réponse est passée/
  );
});

test("CONV-002 : le coach du club corrige une réponse après la date limite", async () => {
  const { service, calls } = createService({
    getDomainUserContext: coachContext(),
    today: "2026-12-06"
  });
  await service.methods.savePresence("coach@example.com", "COMP1", "ABSENT");
  assert.deepEqual(calls.presence, [{ id: "COMP1", presence: "ABSENT" }]);
});

test("CONV-002 : un coach d'un autre club garde la date limite des familles", async () => {
  const { service } = createService({
    getDomainUserContext: coachContext(["REZE"]),
    today: "2026-12-06"
  });
  await assert.rejects(
    () => service.methods.savePresence("coach@example.com", "COMP1", "ABSENT"),
    /date limite de réponse est passée/
  );
});

test("CONV-002 : une participation détachée ou une réponse invalide est refusée", async () => {
  const detached = createService({
    competition: participation({ club_competition_id: null }),
    getDomainUserContext: parentContext(),
    today: "2026-11-28"
  });
  await assert.rejects(
    () => detached.service.methods.savePresence("parent@example.com", "COMP1", "PRESENT"),
    /n'attend pas de réponse de présence/
  );

  const { service, calls } = createService({
    getDomainUserContext: parentContext(),
    today: "2026-11-28"
  });
  await assert.rejects(
    () => service.methods.savePresence("parent@example.com", "COMP1", "PEUT-ETRE"),
    /Réponse de présence invalide/
  );
  assert.equal(calls.presence.length, 0);
});

test("CONV-003 : le détail d'une compétition embarque sa convocation", async () => {
  const { service } = createService({ getDomainUserContext: parentContext(), today: "2026-11-28" });
  const detail = await service.methods.getCompetitionDetail("parent@example.com", "COMP1");
  assert.equal(detail.competition.convocation.message, "Judogi blanc et licence.");
  assert.equal(detail.competition.presence, "");
});

const createClubCompetitionsService = require("../core/services/club-competitions.service");

function createDeletionService(eventDate) {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      getById: async () => ({ ...EVENT, date: eventDate }),
      remove: async (id) => calls.push(["removeClub", id])
    },
    competitionsRepository: {
      detachAllFromClubCompetition: async (id) => calls.push(["detachAll", id]),
      removeAllFromClubCompetition: async (id) => calls.push(["removeAll", id])
    },
    userContextService: { getDomainUserContext: coachContext() },
    canManageClubCompetition: permissions.canManageClubCompetition,
    getCurrentDate: () => "2026-11-28"
  });
  return { service, calls };
}

test("COMP-018 : supprimer une compétition club à venir la supprime chez les judokas", async () => {
  const { service, calls } = createDeletionService("2026-11-29");
  const result = await service.methods.deleteClubCompetition("coach@example.com", "CC1");
  assert.deepEqual(calls, [
    ["removeAll", "CC1"],
    ["removeClub", "CC1"]
  ]);
  assert.equal(result.participationsDeleted, true);
  assert.match(result.message, /y compris chez les judokas/);
});

test("COMP-018 : dès le jour J, la suppression garde les participations détachées", async () => {
  const { service, calls } = createDeletionService("2026-11-28");
  const result = await service.methods.deleteClubCompetition("coach@example.com", "CC1");
  assert.deepEqual(calls, [
    ["detachAll", "CC1"],
    ["removeClub", "CC1"]
  ]);
  assert.equal(result.participationsDeleted, false);
});
