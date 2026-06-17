const test = require("node:test");
const assert = require("node:assert/strict");

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
const createAdminService = require("../core/services/admin.service");
const { createEmail } = require("../core/domain/access/email");
const { createProfileType } = require("../core/domain/access/profile-type");
const { toCanonicalJudoka } = require("../core/services/domain-adapters");

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
      getByName: async (prenom, nom) =>
        judokasByName[`${prenom}|${nom}`.toLowerCase()] || null,
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
      "admin@example.com": { id_judoka: "ADMIN1", profile_type: "JUDOKA", role: "ADMIN", email: "admin@example.com" }
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
      "admin@example.com": { id_judoka: "ADMIN1", profile_type: "JUDOKA", role: "ADMIN", email: "admin@example.com" }
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
      "ali|el kouhen": { id_judoka: "JUDO_EXISTING", profile_type: "JUDOKA", nom: "El Kouhen", prenom: "Ali" }
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

  const csv =
    "profileType,prenom,nom,email,parentEmail\n" + "JUDOKA,Ali,El Kouhen,,\n";

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
    "profileType,prenom,nom,email,parentEmail\n" +
    "JUDOKA,Ali,El Kouhen,ali.elkouhen@gmail.com,\n";

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

test("importUsersCsv processes the bundled sample file: children link, the already-registered parent is rejected", async () => {
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
      email: "christine.elkouhen@gmail.com"
    }
  });

  const summary = await service.methods.importUsersCsv("admin@example.com", csv);

  assert.equal(summary.imported, 2);
  assert.equal(summary.failed, 1);
  assert.equal(calls.links.length, 2);
  assert.ok(calls.links.every((link) => link.id_parent === "PARENT1"));
});
