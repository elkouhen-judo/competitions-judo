const test = require("node:test");
const assert = require("node:assert/strict");

const { createSupabaseRest } = require("../core/infra/supabase-rest.js");
const createFfjudoEventsRepository = require("../core/repositories/ffjudo-events.repository");

test("supabase rest: upserts rows in batches of 500 with merge-duplicates", async () => {
  const calls = [];
  const rest = createSupabaseRest({
    supabaseRequest: async (table, query, options) => {
      calls.push({ table, query, options });
      return null;
    }
  });
  const rows = Array.from({ length: 1001 }, (_, index) => ({ event_key: `k${index}` }));
  await rest.supabaseUpsertMany("ffjudo_events", rows, "event_key");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].query, "on_conflict=event_key");
  assert.equal(calls[0].options.method, "post");
  assert.equal(calls[0].options.prefer, "resolution=merge-duplicates,return=minimal");
  assert.deepEqual(
    calls.map((call) => call.options.payload.length),
    [500, 500, 1]
  );
  await rest.supabaseUpsertMany("ffjudo_events", [], "event_key");
  assert.equal(calls.length, 3);
});

function createDeps(calls, selectResult = []) {
  return {
    eqFilter: (field, value) => `${field}=eq.${value}`,
    supabaseSelect: async (table, query) => {
      calls.push(["select", table, query]);
      return selectResult;
    },
    supabaseSelectOne: async (table, query) => {
      calls.push(["selectOne", table, query]);
      return selectResult[0] || null;
    },
    supabaseInsert: async (table, payload) => {
      calls.push(["insert", table, payload]);
      return payload;
    },
    supabaseUpsertMany: async (table, payloads, onConflict) =>
      calls.push(["upsertMany", table, payloads, onConflict]),
    supabaseDelete: async (table, query) => calls.push(["delete", table, query])
  };
}

test("ffjudo events repository: upserts on event_key", async () => {
  const calls = [];
  const rows = [{ event_key: "fed:1" }];
  await createFfjudoEventsRepository(createDeps(calls)).upsertEvents(rows);
  assert.deepEqual(calls, [["upsertMany", "ffjudo_events", rows, "event_key"]]);
});

test("ffjudo events repository: deletes keys in batches of 100", async () => {
  const calls = [];
  const keys = Array.from({ length: 250 }, (_, index) => `fed:${index}`);
  await createFfjudoEventsRepository(createDeps(calls)).deleteEvents(keys);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(([kind, table]) => kind === "delete" && table === "ffjudo_events"));
  assert.match(calls[0][2], /^event_key=in\.\(/);
  await createFfjudoEventsRepository(createDeps(calls)).deleteEvents([]);
  assert.equal(calls.length, 3);
});

test("ffjudo events repository: lists upcoming events with a stable order", async () => {
  const calls = [];
  await createFfjudoEventsRepository(createDeps(calls)).listUpcoming("2026-11-22");
  assert.equal(calls[0][1], "ffjudo_events");
  assert.match(calls[0][2], /date_debut=gte\.2026-11-22/);
  assert.match(calls[0][2], /order=date_debut\.asc,titre\.asc,event_key\.asc/);
});

test("ffjudo events repository: lists future keys with their sources", async () => {
  const calls = [];
  await createFfjudoEventsRepository(createDeps(calls)).listFutureEventKeys("2026-11-22");
  assert.match(
    calls[0][2],
    /^select=event_key,sources&date_debut=gte\.2026-11-22&order=event_key\.asc$/
  );
});

test("ffjudo events repository: records runs and reads the last successful one", async () => {
  const calls = [];
  const run = { started_at: "a", finished_at: "b", status: "ok", sources: {}, event_count: 1 };
  const repository = createFfjudoEventsRepository(createDeps(calls, [run]));
  await repository.insertRun(run);
  const last = await repository.getLastSuccessfulRun();
  assert.deepEqual(calls[0], ["insert", "ffjudo_sync_runs", run]);
  assert.match(calls[1][2], /status=in\.\(ok,partial\)/);
  assert.match(calls[1][2], /order=finished_at\.desc/);
  assert.equal(last, run);
});

const fs = require("node:fs");
const path = require("node:path");
const {
  createFfjudoSyncService,
  LIGUE_SOURCES,
  NATIONAL_FIRST_PAGE,
  REQUEST_DELAY_MS,
  SYNC_BUDGET_MS,
  mergeNationalIntoLigue
} = require("../core/services/ffjudo-sync.service");

const fixturesDir = path.join(__dirname, "fixtures", "ffjudo");
const ligueFixture = fs.readFileSync(path.join(fixturesDir, "ligue-pays-de-la-loire.html"), "utf8");
const nationalFixture = fs.readFileSync(path.join(fixturesDir, "national-page-1.html"), "utf8");
const NOW = new Date("2026-11-22T03:00:00.000Z");

function createFakeRepository(existing = []) {
  const calls = { upserts: [], deletes: [], runs: [] };
  return {
    calls,
    upsertEvents: async (rows) => calls.upserts.push(rows),
    listFutureEventKeys: async () => existing,
    deleteEvents: async (keys) => calls.deletes.push(keys),
    listUpcoming: async () => [],
    insertRun: async (run) => calls.runs.push(run),
    getLastSuccessfulRun: async () => null
  };
}

function createSync({
  failing = [],
  existing = [],
  unrecognised = [],
  secondsPerFetch = 0,
  repositoryOverrides = {}
} = {}) {
  const repository = { ...createFakeRepository(existing), ...repositoryOverrides };
  let elapsedMs = 0;
  const fetched = [];
  const timeline = [];
  const service = createFfjudoSyncService({
    repository,
    fetchText: async (url) => {
      fetched.push(url);
      timeline.push(`fetch ${url}`);
      elapsedMs += secondsPerFetch * 1000;
      if (failing.some((part) => url.includes(part))) throw new Error("HTTP 500");
      if (unrecognised.some((part) => url.includes(part)))
        return "<html><body>Nouveau site</body></html>";
      return url.includes("www.ffjudo.com") ? nationalFixture : ligueFixture;
    },
    sleep: async (ms) => timeline.push(`sleep ${ms}`),
    now: () => new Date(NOW.getTime() + elapsedMs)
  });
  return { service, repository, fetched, timeline };
}

test("sync: reads the three ligues then every national page", async () => {
  const { service, fetched } = createSync();
  await service.runSync();
  assert.deepEqual(fetched, [
    ...LIGUE_SOURCES,
    NATIONAL_FIRST_PAGE,
    "https://www.ffjudo.com/evenements/agenda/2",
    "https://www.ffjudo.com/evenements/agenda/3",
    "https://www.ffjudo.com/evenements/agenda/4"
  ]);
});

test("sync: waits between requests", async () => {
  const { service, timeline } = createSync();
  await service.runSync();
  assert.equal(REQUEST_DELAY_MS, 1000);
  timeline.forEach((entry, index) => {
    if (index > 0 && entry.startsWith("fetch")) assert.equal(timeline[index - 1], "sleep 1000");
  });
  assert.ok(timeline[0].startsWith("fetch"));
});

test("sync: merges duplicates across ligues", async () => {
  const { service, repository } = createSync();
  await service.runSync();
  const rows = repository.calls.upserts.flat();
  assert.equal(new Set(rows.map((row) => row.event_key)).size, rows.length);
  const federal = rows.find((row) => row.event_key === "fed:1143");
  assert.deepEqual(federal.sources.sort(), LIGUE_SOURCES.map((url) => new URL(url).host).sort());
});

test("sync: sets ligue and snake_case columns on each row", async () => {
  const { service, repository } = createSync();
  await service.runSync();
  const rows = repository.calls.upserts.flat();
  const federal = rows.find((row) => row.event_key === "fed:1143");
  assert.equal(federal.ligue, "Auvergne-Rhône-Alpes");
  assert.equal(federal.date_debut, "2026-11-22");
  assert.equal(federal.synced_at, NOW.toISOString());
  const national = rows.find((row) => row.event_key.startsWith("nat:"));
  assert.equal(national.ligue, "National");
  assert.equal(national.inscription_cloture, null);
});

test("sync: keeps events of a failed source", async () => {
  const existing = [
    { event_key: "loc:judo-bretagne.ffjudo.com:9", sources: ["judo-bretagne.ffjudo.com"] },
    {
      event_key: "fed:999",
      sources: ["judo-bretagne.ffjudo.com", "pays-de-la-loire-judo.ffjudo.com"]
    }
  ];
  const { service, repository } = createSync({ failing: ["judo-bretagne"], existing });
  const report = await service.runSync();
  assert.equal(report.status, "partial");
  assert.equal(report.sources["judo-bretagne.ffjudo.com"].status, "error");
  assert.equal(report.sources["judo-bretagne.ffjudo.com"].error, "HTTP 500");
  assert.deepEqual(repository.calls.deletes.flat(), []);
});

test("sync: deletes vanished future events when all their sources succeeded", async () => {
  const existing = [
    { event_key: "fed:999", sources: ["judo-bretagne.ffjudo.com"] },
    { event_key: "fed:1143", sources: ["judo-bretagne.ffjudo.com"] }
  ];
  const { service, repository } = createSync({ existing });
  await service.runSync();
  assert.deepEqual(repository.calls.deletes.flat(), ["fed:999"]);
});

test("sync: records a run without contacts", async () => {
  const { service, repository } = createSync();
  const report = await service.runSync();
  assert.equal(report.status, "ok");
  assert.equal(repository.calls.runs.length, 1);
  const run = repository.calls.runs[0];
  assert.equal(run.status, "ok");
  assert.equal(run.started_at, NOW.toISOString());
  assert.equal(run.event_count, report.eventCount);
  assert.equal(run.sources["www.ffjudo.com"].count > 0, true);
  assert.doesNotMatch(
    JSON.stringify([run, repository.calls.upserts]),
    /"contact|Contact Fictif|0600000000|example\.invalid/i
  );
});

test("sync: all sources fail", async () => {
  const { service, repository } = createSync({ failing: ["ffjudo.com"] });
  const report = await service.runSync();
  assert.equal(report.status, "error");
  assert.deepEqual(repository.calls.upserts, []);
  assert.deepEqual(repository.calls.deletes, []);
  assert.equal(repository.calls.runs[0].status, "error");
});

test("sync: a failed national page keeps national events", async () => {
  const existing = [{ event_key: "nat:ancien:2026-12-01", sources: ["www.ffjudo.com"] }];
  const { service, repository } = createSync({ failing: ["agenda/3"], existing });
  const report = await service.runSync();
  assert.equal(report.sources["www.ffjudo.com"].status, "error");
  assert.deepEqual(repository.calls.deletes.flat(), []);
});

const { createFfjudoSyncHandler } = require("../api/ffjudo-sync.js");

function createResponse() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function createHandler(report = { status: "ok", eventCount: 3, sources: {} }) {
  const runs = [];
  const handler = createFfjudoSyncHandler({
    getCronSecret: () => "secret-de-test",
    runSync: async () => {
      runs.push(1);
      return report;
    }
  });
  return { handler, runs };
}

test("sync endpoint: rejects a request without the cron secret", async () => {
  const { handler, runs } = createHandler();
  const res = createResponse();
  await handler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Non autorisé." });
  assert.equal(runs.length, 0);
});

test("sync endpoint: rejects a wrong secret", async () => {
  const { handler, runs } = createHandler();
  const res = createResponse();
  await handler({ method: "GET", headers: { authorization: "Bearer autre-secret" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(runs.length, 0);
});

test("sync endpoint: runs the sync with the right secret", async () => {
  const report = { status: "ok", eventCount: 3, sources: {} };
  const { handler, runs } = createHandler(report);
  const res = createResponse();
  await handler({ method: "GET", headers: { authorization: "Bearer secret-de-test" } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, report);
  assert.equal(runs.length, 1);
});

test("sync endpoint: answers 500 when every source failed", async () => {
  const report = { status: "error", eventCount: 0, sources: {} };
  const { handler } = createHandler(report);
  const res = createResponse();
  await handler({ method: "GET", headers: { authorization: "Bearer secret-de-test" } }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, report);
});

test("sync endpoint: refuses when no cron secret is configured", async () => {
  const handler = createFfjudoSyncHandler({ getCronSecret: () => "", runSync: async () => ({}) });
  const res = createResponse();
  await handler({ method: "GET", headers: { authorization: "Bearer " } }, res);
  assert.equal(res.statusCode, 401);
});

const createFfjudoAgendaService = require("../core/services/ffjudo-agenda.service");

function createAgenda({
  identity = { user: { id_judoka: "c1", role: "COACH" } },
  rows = [],
  lastRun = null
} = {}) {
  const calls = [];
  const service = createFfjudoAgendaService({
    repository: {
      listUpcoming: async (fromDate) => {
        calls.push(["listUpcoming", fromDate]);
        return rows;
      },
      getLastSuccessfulRun: async () => {
        calls.push(["getLastSuccessfulRun"]);
        return lastRun;
      }
    },
    userContextService: { getIdentity: async () => identity },
    isCoach: (user) => user.role === "COACH",
    now: () => new Date("2026-11-22T23:30:00.000Z")
  });
  return { service, calls };
}

const agendaRow = {
  event_key: "fed:1454",
  titre: "TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES 2026",
  date_debut: "2026-11-23",
  date_fin: "",
  inscription_ouverture: "2026-10-17",
  inscription_cloture: "2026-11-17",
  type_evenement: "COMPETITION",
  lieu: "DOJO DU CROISSANT",
  ville: "NANTES",
  code_postal: "44300",
  proprietaire: "Comité LOIRE ATLANTIQUE JUD",
  ligue: "Pays de la Loire",
  source_url: "https://pays-de-la-loire-judo.ffjudo.com/evenement/tournoi/18",
  site_web: "https://www.cd44judo.fr/",
  sources: ["pays-de-la-loire-judo.ffjudo.com"],
  synced_at: "2026-11-22T04:00:00.000Z"
};

test("agenda: lists upcoming events from today in Paris for a coach", async () => {
  const { service, calls } = createAgenda({
    rows: [agendaRow],
    lastRun: { finished_at: "2026-11-22T04:00:08.000Z", status: "ok" }
  });
  const agenda = await service.methods.getFfjudoEvents("coach@example.com");
  assert.deepEqual(
    calls.find((call) => call[0] === "listUpcoming"),
    ["listUpcoming", "2026-11-23"]
  );
  assert.equal(agenda.lastSyncAt, "2026-11-22T04:00:08.000Z");
  assert.deepEqual(agenda.events, [
    {
      eventKey: "fed:1454",
      titre: "TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES 2026",
      dateDebut: "2026-11-23",
      dateFin: "",
      inscriptionCloture: "2026-11-17",
      typeEvenement: "COMPETITION",
      lieu: "DOJO DU CROISSANT",
      ville: "NANTES",
      ligue: "Pays de la Loire",
      proprietaire: "Comité LOIRE ATLANTIQUE JUD",
      sourceUrl: "https://pays-de-la-loire-judo.ffjudo.com/evenement/tournoi/18",
      uvs: [],
      grades: []
    }
  ]);
});

test("agenda: empty last sync when never synchronized", async () => {
  const { service } = createAgenda();
  assert.deepEqual(await service.methods.getFfjudoEvents("coach@example.com"), {
    events: [],
    lastSyncAt: ""
  });
});

test("agenda: rejects an unknown user", async () => {
  const { service, calls } = createAgenda({ identity: null });
  await assert.rejects(
    () => service.methods.getFfjudoEvents("inconnu@example.com"),
    /Accès refusé\./
  );
  assert.deepEqual(calls, []);
});

test("agenda: rejects a profile that is not a coach", async () => {
  const { service, calls } = createAgenda({
    identity: { user: { id_judoka: "j1", role: "NORMAL" } }
  });
  await assert.rejects(
    () => service.methods.getFfjudoEvents("judoka@example.com"),
    /Accès refusé\./
  );
  assert.deepEqual(calls, []);
});

test("review #1: an unrecognised page (HTTP 200) keeps that source's events", async () => {
  const existing = [
    { event_key: "loc:judo-bretagne.ffjudo.com:9", sources: ["judo-bretagne.ffjudo.com"] }
  ];
  const { service, repository } = createSync({ unrecognised: ["judo-bretagne"], existing });
  const report = await service.runSync();
  assert.equal(report.status, "partial");
  assert.equal(report.sources["judo-bretagne.ffjudo.com"].status, "error");
  assert.match(report.sources["judo-bretagne.ffjudo.com"].error, /Gabarit FFJDA non reconnu/);
  assert.deepEqual(repository.calls.deletes.flat(), []);
});

test("review #1: a national page that lost its cards keeps national events", async () => {
  const existing = [{ event_key: "nat:ancien:2026-12-01", sources: ["www.ffjudo.com"] }];
  const { service, repository } = createSync({ unrecognised: ["agenda/2"], existing });
  const report = await service.runSync();
  assert.equal(report.sources["www.ffjudo.com"].status, "ok");
  const { service: broken, repository: brokenRepository } = createSync({
    unrecognised: ["agenda/1"],
    existing
  });
  const brokenReport = await broken.runSync();
  assert.equal(brokenReport.sources["www.ffjudo.com"].status, "error");
  assert.deepEqual(brokenRepository.calls.deletes.flat(), []);
  assert.ok(repository);
});

test("review #3: a national event also published by a ligue is listed once", async () => {
  const { service, repository } = createSync();
  await service.runSync();
  const rows = repository.calls.upserts.flat();
  const nantes = rows.filter(
    (row) => row.date_debut === "2026-11-22" && /NANTES/.test(row.titre) && /CADET/.test(row.titre)
  );
  assert.equal(nantes.length, 1);
  assert.equal(nantes[0].event_key, "fed:1454");
  assert.ok(nantes[0].sources.includes("www.ffjudo.com"));
  assert.ok(
    !rows.some((row) => row.event_key.startsWith("nat:tournoi-label-excellence-cadets-de-nantes"))
  );
});

test("review #3: an ambiguous national event (several ligue events same day and town) stays separate", () => {
  const base = {
    dateFin: "",
    inscriptionOuverture: "",
    inscriptionCloture: "",
    typeEvenement: "",
    lieu: "",
    codePostal: "",
    proprietaire: "",
    sourceUrl: "",
    siteWeb: ""
  };
  const events = [
    {
      ...base,
      eventKey: "fed:1",
      titre: "TOURNOI A",
      dateDebut: "2026-11-15",
      ville: "KAWENI",
      sources: ["judo-bretagne.ffjudo.com"]
    },
    {
      ...base,
      eventKey: "fed:2",
      titre: "TOURNOI B",
      dateDebut: "2026-11-15",
      ville: "KAWENI",
      sources: ["judo-bretagne.ffjudo.com"]
    },
    {
      ...base,
      eventKey: "nat:a:2026-11-15",
      titre: "TOURNOI A (MAYOTTE)",
      dateDebut: "2026-11-15",
      lieu: "KAWENI",
      ville: "",
      sources: ["www.ffjudo.com"]
    }
  ];
  assert.deepEqual(
    mergeNationalIntoLigue(events).map((event) => event.eventKey),
    ["fed:1", "fed:2", "nat:a:2026-11-15"]
  );
});

test("review #4: a persistence failure is still journaled", async () => {
  const { service, repository } = createSync({
    repositoryOverrides: {
      upsertEvents: async () => {
        throw new Error("Erreur Supabase 503 sur ffjudo_events");
      }
    }
  });
  const report = await service.runSync();
  assert.equal(report.status, "error");
  assert.match(report.error, /Erreur Supabase 503/);
  assert.equal(repository.calls.runs.length, 1);
  assert.equal(repository.calls.runs[0].status, "error");
  assert.match(repository.calls.runs[0].sources._persistence.error, /Erreur Supabase 503/);
});

test("review #4: the sync stops fetching once its time budget is spent", async () => {
  assert.equal(SYNC_BUDGET_MS, 40000);
  const { service, fetched, repository } = createSync({ secondsPerFetch: 15 });
  const report = await service.runSync();
  assert.ok(fetched.length <= 3, `fetched ${fetched.length}`);
  assert.equal(report.sources["www.ffjudo.com"].status, "error");
  assert.match(report.sources["www.ffjudo.com"].error, /Délai de synchronisation dépassé/);
  assert.equal(repository.calls.runs.length, 1);
});

test("agenda: a grade session carries the UVs read in its title (AGD-012)", async () => {
  const session = {
    ...agendaRow,
    event_key: "fed:9",
    titre: "Examen UV1/2/3b n°1",
    type_evenement: "PASSAGE DE GRADE"
  };
  const { service } = createAgenda({ rows: [session] });
  const agenda = await service.methods.getFfjudoEvents("coach@example.com");
  assert.deepEqual(agenda.events[0].uvs, ["UV1", "UV2", "UV3"]);
});
