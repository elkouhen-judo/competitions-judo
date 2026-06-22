const test = require("node:test");
const assert = require("node:assert/strict");

const createMcpServerService = require("../core/services/mcp-server.service");

function createClaims(scopes, email = "coach@example.com") {
  return {
    sub: "COACH1",
    email,
    role: "COACH",
    scopes,
    iss: "kiroku",
    aud: "kiroku-mcp",
    iat: 0,
    exp: 0
  };
}

async function callTool(service, claims, name, args) {
  const response = await service.handleRequest(claims, {
    method: "tools/call",
    params: { name, arguments: args }
  });
  return JSON.parse(response.content[0].text);
}

test("mcp-server tools/list exposes the real read tool catalog, including combats.search", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({}),
    getJudokas: async () => []
  });

  const { tools } = await service.handleRequest(
    createClaims([
      "judokas:read",
      "competitions:read",
      "competitions:write",
      "combats:read",
      "combats:write",
      "coach-dashboard:read"
    ]),
    { method: "tools/list" }
  );
  const toolNames = tools.map((tool) => tool.name);

  assert.deepEqual(toolNames, [
    "judokas.search",
    "competitions.search",
    "combats.search",
    "competitions.get",
    "competitions.save",
    "competitions.finalize",
    "combats.save",
    "combats.delete",
    "coach.dashboard"
  ]);

  const combatsSearch = tools.find((tool) => tool.name === "combats.search");
  assert.equal(combatsSearch.inputSchema.properties.filters.properties.result.type, "string");
  assert.equal(combatsSearch.inputSchema.properties.limit.default, 50);
  assert.equal(combatsSearch.inputSchema.properties.limit.maximum, 100);
});

test("mcp-server hides coach dashboard from parent-scoped sports tokens", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({}),
    getJudokas: async () => []
  });

  const { tools } = await service.handleRequest(
    createClaims([
      "judokas:read",
      "competitions:read",
      "competitions:write",
      "combats:read",
      "combats:write"
    ]),
    { method: "tools/list" }
  );
  const toolNames = tools.map((tool) => tool.name);

  assert.equal(toolNames.includes("combats.search"), true);
  assert.equal(toolNames.includes("coach.dashboard"), false);
});

test("mcp-server tools/list only exposes tools allowed by the caller scopes", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({}),
    getJudokas: async () => []
  });

  const adminCatalog = await service.handleRequest(createClaims(["access:read"]), {
    method: "tools/list"
  });
  assert.deepEqual(adminCatalog.tools, []);

  const emptyCatalog = await service.handleRequest(createClaims([]), { method: "tools/list" });
  assert.deepEqual(emptyCatalog.tools, []);
});

test("mcp-server judokas.search filters by attributes and applies limit", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({}),
    getJudokas: async () => [
      { id_judoka: "JUDO1", prenom: "Aya", nom: "Durand", categorie_age: "Minime" },
      { id_judoka: "JUDO2", prenom: "Nina", nom: "Bernard", categorie_age: "Cadet" },
      { id_judoka: "JUDO3", prenom: "Lou", nom: "Petit", categorie_age: "Minime" }
    ]
  });

  const result = await callTool(service, createClaims(["judokas:read"]), "judokas.search", {
    filters: { ageCategory: "Minime" },
    limit: 1
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].firstName, "Aya");
});

test("mcp-server judokas.search defaults to 50 results when no limit is given", async () => {
  const judokaRows = Array.from({ length: 60 }, (_, index) => ({
    id_judoka: `JUDO${index}`,
    prenom: `Judoka${index}`,
    nom: "Test"
  }));
  const service = createMcpServerService({
    methods: /** @type {any} */ ({}),
    getJudokas: async () => judokaRows
  });

  const result = await callTool(service, createClaims(["judokas:read"]), "judokas.search", {});

  assert.equal(result.length, 50);
});

test("mcp-server judokas.search filters by a free-text name, given as a plain string", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({}),
    getJudokas: async () => [
      { id_judoka: "JUDO1", prenom: "Aya", nom: "Durand" },
      { id_judoka: "JUDO2", prenom: "Nina", nom: "Bernard" }
    ]
  });

  const result = await callTool(service, createClaims(["judokas:read"]), "judokas.search", {
    filters: { text: "Mehdi" }
  });

  assert.deepEqual(result, []);

  const matched = await callTool(service, createClaims(["judokas:read"]), "judokas.search", {
    filters: { text: "aya" }
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].firstName, "Aya");
});

test("mcp-server competitions.search filters by level and resolves competitionDate=today", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({
      getInitialData: async () => ({
        competitions: [
          {
            competitionId: "COMP1",
            name: "Tournoi A",
            competitionDate: "2026-06-19",
            level: "Régional"
          },
          {
            competitionId: "COMP2",
            name: "Tournoi B",
            competitionDate: "2026-05-01",
            level: "Régional"
          },
          {
            competitionId: "COMP3",
            name: "Tournoi C",
            competitionDate: "2026-06-19",
            level: "National"
          }
        ]
      })
    }),
    getJudokas: async () => [],
    getCurrentDate: () => "2026-06-19"
  });

  const result = await callTool(
    service,
    createClaims(["competitions:read"]),
    "competitions.search",
    {
      filters: { competitionDate: "today", competitionLevel: "Régional" }
    }
  );

  assert.deepEqual(
    result.map((competition) => competition.competitionId),
    ["COMP1"]
  );
});

test("mcp-server combats.search delegates to RpcMethods.searchCombats with the given filters and limit", async () => {
  const calls = [];
  const service = createMcpServerService({
    methods: /** @type {any} */ ({
      async searchCombats(email, filters, limit) {
        calls.push({ email, filters, limit });
        return { matches: [{ judokaId: "JUDO1", judokaName: "Aya Durand" }] };
      }
    }),
    getJudokas: async () => []
  });

  const result = await callTool(service, createClaims(["combats:read"]), "combats.search", {
    filters: { result: "Victoire" },
    limit: 5
  });

  assert.deepEqual(calls, [
    { email: "coach@example.com", filters: { result: "Victoire" }, limit: 5 }
  ]);
  assert.deepEqual(result, { matches: [{ judokaId: "JUDO1", judokaName: "Aya Durand" }] });
});

test("mcp-server lets parent-scoped tokens read combats through the scoped service", async () => {
  const calls = [];
  const service = createMcpServerService({
    methods: /** @type {any} */ ({
      async searchCombats(email, filters, limit) {
        calls.push({ email, filters, limit });
        return { matches: [{ judokaId: "CHILD1", judokaName: "Aya Durand" }] };
      }
    }),
    getJudokas: async () => []
  });

  const claims = createClaims(
    ["judokas:read", "competitions:read", "competitions:write", "combats:read", "combats:write"],
    "parent@example.com"
  );
  const result = await callTool(service, claims, "combats.search", {
    filters: { text: "Aya" },
    limit: 10
  });

  assert.deepEqual(calls, [{ email: "parent@example.com", filters: { text: "Aya" }, limit: 10 }]);
  assert.deepEqual(result, { matches: [{ judokaId: "CHILD1", judokaName: "Aya Durand" }] });
});

test("mcp-server rejects combats.search when the caller lacks the combats:read scope", async () => {
  const service = createMcpServerService({
    methods: /** @type {any} */ ({ searchCombats: async () => ({ matches: [] }) }),
    getJudokas: async () => []
  });

  await assert.rejects(
    () => callTool(service, createClaims(["judokas:read"]), "combats.search", {}),
    /Portée MCP insuffisante/
  );
});
