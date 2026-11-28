// CLUBADM : l'admin d'un club gère les accès de ses clubs, et seulement d'eux.
const test = require("node:test");
const assert = require("./helpers/relaxed-assert");

const permissions = require("../core/domain/access/permission-policy");
const { createJudoka, createManagedChild } = require("../core/domain/access/judoka");
const { createEmail } = require("../core/domain/access/email");
const { createProfileType } = require("../core/domain/access/profile-type");
const {
  createHandedness,
  createWeightCategory,
  createYearInCategory
} = require("../core/domain/category-reference");
const createAdminService = require("../core/services/admin.service");
const createClubsService = require("../core/services/clubs.service");

const cleanText = (value) => String(value || "").trim();
const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function person(id, extra = {}) {
  return {
    id_judoka: id,
    email: "",
    prenom: id,
    nom: "Test",
    profile_type: "JUDOKA",
    role: "NORMAL",
    is_admin: false,
    club_id: null,
    club_ids: [],
    ...extra
  };
}

// Nantes est administré par CA1 ; Rezé ne l'est pas. D1 est inscrit dans les deux, Rezé principal.
function createStore() {
  const judokas = [
    person("ADMIN1", { email: "admin@example.com", role: "ADMIN" }),
    person("CA1", { email: "ca@example.com" }),
    person("N1", { email: "n1@example.com", club_id: "NANTES", club_ids: ["NANTES"] }),
    person("N2", {
      club_id: "NANTES",
      club_ids: ["NANTES"],
      pending_parent_email: "pn@example.com"
    }),
    person("R1", {
      email: "r1@example.com",
      club_id: "REZE",
      club_ids: ["REZE"],
      pending_parent_email: "pr@example.com"
    }),
    person("D1", {
      email: "d1@example.com",
      role: "COACH",
      club_id: "REZE",
      club_ids: ["REZE", "NANTES"]
    }),
    person("S1", { email: "s1@example.com" }),
    person("P1", { email: "p1@example.com", profile_type: "PARENT" }),
    person("P2", { email: "p2@example.com", profile_type: "PARENT" }),
    person("C1", { email: "c1@example.com", role: "COACH" }),
    person("C2", { email: "c2@example.com", role: "COACH" })
  ];
  return {
    judokas,
    clubs: [
      { id_club: "NANTES", nom: "Judo Club Nantes" },
      { id_club: "REZE", nom: "Judo Club Rezé" }
    ],
    coachLinks: [
      { id_coach: "C1", id_club: "NANTES" },
      { id_coach: "C1", id_club: "REZE" },
      { id_coach: "C2", id_club: "REZE" },
      { id_coach: "D1", id_club: "REZE" }
    ],
    adminLinks: [{ id_admin: "CA1", id_club: "NANTES" }],
    parentLinks: [
      { id_parent: "P1", id_judoka: "N2" },
      { id_parent: "P2", id_judoka: "R1" }
    ],
    invitations: [
      { email: "pn@example.com", invited_profile_type: "PARENT", invited_by: "ADMIN1" },
      { email: "pr@example.com", invited_profile_type: "PARENT", invited_by: "ADMIN1" }
    ],
    calls: []
  };
}

function createRepositories(store) {
  const byId = (id) => store.judokas.find((row) => row.id_judoka === String(id)) || null;
  const byEmail = (email) =>
    store.judokas.find((row) => row.email && row.email.toLowerCase() === normalizeEmail(email)) ||
    null;
  let nextId = 1;
  const judokasRepository = {
    getById: async (id) => byId(id),
    getByEmail: async (email) => byEmail(email),
    getByName: async (prenom, nom) =>
      store.judokas.find(
        (row) =>
          row.prenom.toLowerCase() === prenom.toLowerCase() &&
          row.nom.toLowerCase() === nom.toLowerCase()
      ) || null,
    listByIds: async (ids) =>
      store.judokas.filter((row) => ids.map(String).includes(row.id_judoka)),
    listByClubIds: async (ids) =>
      store.judokas.filter((row) => row.club_ids.some((id) => ids.includes(id))),
    listCoaches: async () => store.judokas.filter((row) => row.role === "COACH"),
    listAdmins: async () => store.judokas.filter((row) => row.role === "ADMIN" || row.is_admin),
    countByClub: async (id) => store.judokas.filter((row) => row.club_ids.includes(id)).length,
    listPage: async (options) => {
      store.calls.push(["listPage", options]);
      const scope = options.scope;
      const rows = store.judokas.filter(
        (row) =>
          !scope ||
          row.club_ids.some((id) => scope.clubIds.includes(id)) ||
          scope.judokaIds.includes(row.id_judoka)
      );
      return { rows, total: rows.length };
    },
    insert: async (judoka, extras = {}) => {
      const row = person(judoka.judokaId || `NEW${nextId++}`, {
        // Un enfant géré porte son nom dans `name` ({ firstName, lastName }).
        prenom: judoka.firstName || (judoka.name && judoka.name.firstName) || "",
        nom: judoka.lastName || (judoka.name && judoka.name.lastName) || "",
        email: judoka.accountEmail || "",
        profile_type: judoka.profileType || "JUDOKA",
        ...extras
      });
      store.judokas.push(row);
      return row;
    },
    update: async (id, changes) => {
      store.calls.push(["update", id, changes]);
      const row = byId(id);
      if (row && changes.accessRole) row.role = changes.accessRole;
      return row;
    },
    setClubs: async (id, clubIds, mainClubId) => {
      store.calls.push(["setClubs", id, clubIds, mainClubId]);
      const row = byId(id);
      row.club_ids = clubIds;
      row.club_id = mainClubId;
    },
    setRegistrationSeason: async (id, season) => store.calls.push(["season", id, season]),
    setAdminFlag: async (id, value) => store.calls.push(["adminFlag", id, value]),
    remove: async (id) => store.calls.push(["removeUser", id])
  };
  const clubsRepository = {
    listAll: async () => store.clubs,
    listByIds: async (ids) => store.clubs.filter((club) => ids.includes(club.id_club)),
    getById: async (id) => store.clubs.find((club) => club.id_club === id) || null,
    insert: async (club) => store.calls.push(["insertClub", club]),
    rename: async (id, nom) => store.calls.push(["rename", id, nom]),
    remove: async (id) => store.calls.push(["removeClub", id]),
    listCoachLinks: async () => store.coachLinks,
    listClubIdsByCoach: async (id) =>
      store.coachLinks.filter((link) => link.id_coach === id).map((link) => link.id_club),
    replaceCoachClubs: async (id, clubIds) => {
      store.calls.push(["replaceCoachClubs", id, clubIds]);
      store.coachLinks = [
        ...store.coachLinks.filter((link) => link.id_coach !== id),
        ...clubIds.map((idClub) => ({ id_coach: id, id_club: idClub }))
      ];
    },
    listAdminLinks: async (ids) =>
      ids === undefined
        ? store.adminLinks
        : store.adminLinks.filter((link) => ids.includes(link.id_club)),
    addClubAdmin: async (idAdmin, idClub) => store.calls.push(["addClubAdmin", idAdmin, idClub]),
    removeClubAdmin: async (idAdmin, idClub) =>
      store.calls.push(["removeClubAdmin", idAdmin, idClub])
  };
  const userContextService = {
    getCurrentUser: async (email) => byEmail(email),
    getJudokaById: async (id) => byId(id),
    getIdentity: async (email) => {
      const user = byEmail(email);
      if (!user) return null;
      return {
        user,
        coachClubIds: store.coachLinks
          .filter((l) => l.id_coach === user.id_judoka)
          .map((l) => l.id_club),
        childJudokaIds: store.parentLinks
          .filter((l) => l.id_parent === user.id_judoka)
          .map((l) => l.id_judoka),
        adminClubIds: store.adminLinks
          .filter((l) => l.id_admin === user.id_judoka)
          .map((l) => l.id_club)
      };
    }
  };
  return { judokasRepository, clubsRepository, userContextService };
}

function createServices(store = createStore()) {
  const { judokasRepository, clubsRepository, userContextService } = createRepositories(store);
  const admin = createAdminService({
    clubsRepository,
    competitionsRepository: { listByJudoka: async () => [], removeByJudoka: async () => {} },
    invitationsRepository: {
      getByEmail: async (email) =>
        store.invitations.find((i) => i.email === normalizeEmail(email)) || null,
      listAll: async () => store.invitations,
      removeByEmail: async (email) => store.calls.push(["removeInvitation", email])
    },
    judokasRepository,
    parentLinksRepository: {
      listByParent: async (id) => store.parentLinks.filter((link) => link.id_parent === id),
      listByChildren: async (ids) =>
        store.parentLinks.filter((link) => ids.includes(link.id_judoka)),
      insert: async (link) => store.calls.push(["link", link])
    },
    userContextService,
    buildJudokaId: (() => {
      let n = 0;
      return () => `IMPORT${++n}`;
    })(),
    cleanText,
    createEmail,
    createJudoka,
    createManagedChild,
    createProfileType,
    createHandedness,
    createWeightCategory,
    createYearInCategory,
    getCurrentDate: () => "2026-11-28",
    normalizeEmail
  });
  const clubs = createClubsService({
    clubsRepository,
    clubCompetitionsRepository: { countByClub: async () => 0 },
    judokasRepository,
    userContextService,
    isAdmin: permissions.isAdmin,
    buildClubId: () => "CLUB_NEW"
  });
  return { admin: admin.methods, clubs: clubs.methods, store };
}

test("CLUBADM-001 : sans droit admin ni club administré, la gestion des accès est refusée", async () => {
  const { admin, clubs } = createServices();
  await assert.rejects(() => admin.getUsersPage("n1@example.com"), /réservée aux admins/);
  await assert.rejects(() => clubs.getClubsManagement("n1@example.com"), /réservée aux admins/);
});

test("CLUBADM-002 : l'admin du club ne lit que son club, ses parents et ses coachs", async () => {
  const { admin, store } = createServices();
  const page = await admin.getUsersPage("ca@example.com");
  const [, options] = store.calls.find(([name]) => name === "listPage");
  assert.deepEqual(options.scope.clubIds, ["NANTES"]);
  assert.deepEqual([...options.scope.judokaIds].sort(), ["C1", "P1"]);
  assert.deepEqual(page.users.map((user) => user.judokaId).sort(), ["C1", "D1", "N1", "N2", "P1"]);
  await assert.rejects(
    () => admin.getUsersPage("ca@example.com", { filter: "noClub" }),
    /admin global/
  );
});

test("CLUBADM-002 : l'admin global garde une lecture sans périmètre", async () => {
  const { admin, store } = createServices();
  await admin.getUsersPage("admin@example.com", { filter: "noClub" });
  const [, options] = store.calls.find(([name]) => name === "listPage");
  assert.equal(options.scope, undefined);
});

test("CLUBADM-002 : l'admin du club ne voit et n'annule que les invitations de son club", async () => {
  const { admin, store } = createServices();
  const management = await admin.getAdminsManagement("ca@example.com");
  assert.equal(management.isGlobalAdmin, false);
  assert.deepEqual(management.admins, []);
  assert.deepEqual(
    management.accessInvitations.map((invitation) => invitation.email),
    ["pn@example.com"]
  );
  await admin.deleteAccessInvitation("ca@example.com", "pn@example.com");
  await assert.rejects(
    () => admin.deleteAccessInvitation("ca@example.com", "pr@example.com"),
    /introuvable/
  );
  assert.deepEqual(
    store.calls.filter(([name]) => name === "removeInvitation"),
    [["removeInvitation", "pn@example.com"]]
  );
});

test("CLUBADM-004 : l'admin du club nomme coach un judoka de son club, pour son club seulement", async () => {
  const { admin, store } = createServices();
  await admin.grantCoachRole("ca@example.com", "N1");
  assert.deepEqual(
    store.calls.filter(([name]) => name === "update"),
    [["update", "N1", { accessRole: "COACH" }]]
  );
  assert.deepEqual(
    store.calls.filter(([name]) => name === "replaceCoachClubs"),
    [["replaceCoachClubs", "N1", ["NANTES"]]]
  );
  await assert.rejects(() => admin.grantCoachRole("ca@example.com", "R1"), /hors de vos clubs/);
});

test("CLUBADM-004 : un coach d'un autre club inscrit chez nous coache en plus notre club", async () => {
  const { admin, store } = createServices();
  const result = await admin.grantCoachRole("ca@example.com", "D1");
  assert.match(result.message, /votre club/);
  assert.deepEqual(
    store.calls.filter(([name]) => name === "update"),
    []
  );
  assert.deepEqual(
    store.calls.filter(([name]) => name === "replaceCoachClubs"),
    [["replaceCoachClubs", "D1", ["REZE", "NANTES"]]]
  );
});

test("CLUBADM-004 : retirer un coach ne lui enlève que les clubs de l'admin", async () => {
  const { admin, store } = createServices();
  const result = await admin.revokeCoachRole("ca@example.com", "C1");
  assert.match(result.message, /ne coache plus votre club/);
  assert.deepEqual(
    store.calls.filter(([name]) => name === "replaceCoachClubs"),
    [["replaceCoachClubs", "C1", ["REZE"]]]
  );
  assert.deepEqual(
    store.calls.filter(([name]) => name === "update"),
    []
  );
  await assert.rejects(
    () => admin.revokeCoachRole("ca@example.com", "C2"),
    /ne coache pas vos clubs/
  );
});

test("CLUBADM-001 : les droits de l'admin global restent hors de portée d'un admin de club", async () => {
  const { admin, clubs } = createServices();
  await assert.rejects(
    () => admin.grantAdminRole("ca@example.com", "n1@example.com"),
    /réservée aux admins/
  );
  await assert.rejects(() => admin.deleteUser("ca@example.com", "N1"), /réservée aux admins/);
  await assert.rejects(() => clubs.deleteClub("ca@example.com", "NANTES"), /admin global/);
  await assert.rejects(
    () => clubs.setCoachClubs("ca@example.com", "C1", ["NANTES"]),
    /admin global/
  );
  await assert.rejects(
    () => clubs.addClubAdmin("ca@example.com", "NANTES", "n1@example.com"),
    /admin global/
  );
  await assert.rejects(
    () => clubs.saveClub("ca@example.com", { name: "Nouveau club" }),
    /admin global/
  );
});

test("CLUBADM-003 : l'import d'un admin de club rattache chaque judoka à son club", async () => {
  const { admin, store } = createServices();
  const csv = [
    "prenom,nom,email,profiletype,club",
    "Lina,Nouvelle,,JUDOKA,",
    "Rémi,Rezéen,r1@example.com,JUDOKA,",
    "Sam,Ailleurs,,JUDOKA,Judo Club Rezé"
  ].join("\n");
  const result = await admin.importUsersCsv("ca@example.com", csv, 2026);
  assert.equal(result.imported, 1);
  assert.match(result.results[1].message, /inscrit dans un autre club/);
  assert.match(result.results[2].message, /Club de la ligne différent/);
  const lina = store.judokas.find((row) => row.id_judoka === "IMPORT1");
  assert.deepEqual(lina.club_ids, ["NANTES"]);
  assert.equal(store.judokas.find((row) => row.id_judoka === "R1").club_ids.join(), "REZE");
});

test("CLUBADM-003 : un admin de club n'importe que pour un club qu'il administre", async () => {
  const { admin } = createServices();
  await assert.rejects(
    () => admin.importUsersCsv("ca@example.com", "prenom,nom\nA,B", 2026, "REZE"),
    /clubs que vous administrez/
  );
});

test("CLUBADM-005 : l'admin du club voit et renomme son club seulement", async () => {
  const { clubs, store } = createServices();
  const management = await clubs.getClubsManagement("ca@example.com");
  assert.equal(management.isGlobalAdmin, false);
  assert.deepEqual(
    management.clubs.map((club) => club.clubId),
    ["NANTES"]
  );
  assert.deepEqual(
    management.coaches.map((coach) => coach.judokaId),
    ["C1"]
  );
  await clubs.saveClub("ca@example.com", { clubId: "NANTES", name: "JC Nantes" });
  await assert.rejects(
    () => clubs.saveClub("ca@example.com", { clubId: "REZE", name: "X" }),
    /hors de vos clubs/
  );
  assert.deepEqual(
    store.calls.filter(([name]) => name === "rename"),
    [["rename", "NANTES", "JC Nantes"]]
  );
});

test("CLUBADM-006 : l'admin du club ne change que ses clubs dans les clubs d'un judoka", async () => {
  const { clubs, store } = createServices();
  // D1 : Rezé principal, Nantes en second. L'admin de Nantes ne peut retirer que Nantes.
  await clubs.setJudokaClubs("ca@example.com", "D1", [], null);
  await clubs.setJudokaClubs("ca@example.com", "N1", ["NANTES", "REZE"], "REZE");
  await assert.rejects(
    () => clubs.setJudokaClubs("ca@example.com", "R1", ["NANTES"], "NANTES"),
    /hors de vos clubs/
  );
  assert.deepEqual(
    store.calls.filter(([name]) => name === "setClubs"),
    [
      ["setClubs", "D1", ["REZE"], "REZE"],
      ["setClubs", "N1", ["NANTES"], "NANTES"]
    ]
  );
});

test("CLUBADM-001 : l'admin global nomme et retire l'admin d'un club par son e-mail", async () => {
  const { clubs, store } = createServices();
  await clubs.addClubAdmin("admin@example.com", "REZE", "P2@example.com");
  await assert.rejects(
    () => clubs.addClubAdmin("admin@example.com", "NANTES", "ca@example.com"),
    /déjà ce club/
  );
  await assert.rejects(
    () => clubs.addClubAdmin("admin@example.com", "NANTES", "ghost@example.com"),
    /Aucun compte/
  );
  await clubs.removeClubAdmin("admin@example.com", "NANTES", "CA1");
  assert.deepEqual(
    store.calls.filter(([name]) => /ClubAdmin/.test(name)),
    [
      ["addClubAdmin", "P2", "REZE"],
      ["removeClubAdmin", "CA1", "NANTES"]
    ]
  );
  const management = await clubs.getClubsManagement("admin@example.com");
  assert.deepEqual(management.clubs.find((club) => club.clubId === "NANTES").adminIds, ["CA1"]);
  assert.deepEqual(
    management.clubAdmins.map((person) => person.judokaId),
    ["CA1"]
  );
});
