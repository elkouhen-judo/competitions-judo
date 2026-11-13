const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

// Critères d'acceptation de docs/backlog.md (optimisation du chargement), mesurés avec le vrai
// câblage de core/ sur un faux PostgREST en mémoire. Une « étape » est un groupe de requêtes
// Supabase lancées en parallèle.

const SUPABASE_URL = "https://faux-projet.supabase.co";
const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_JWT_SECRET"
];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;
const originalConsoleLog = console.log;

process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.SUPABASE_ANON_KEY = "anon-key";
delete process.env.SUPABASE_JWT_SECRET;

// ---------------------------------------------------------------------------------------------
// Faux PostgREST : tables en mémoire, filtres courants, ressources embarquées, limit/offset,
// en-tête content-range, plafond de lignes par réponse. Chaque requête est notée.
// ---------------------------------------------------------------------------------------------

const MAX_ROWS = 1000;
const signingKey = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = {
  ...signingKey.publicKey.export({ format: "jwk" }),
  kid: "test-key",
  alg: "ES256",
  use: "sig"
};

const db = {};
const requests = [];

const PRIMARY_KEYS = {
  judokas: "id_judoka",
  clubs: "id_club",
  club_competitions: "id_club_competition",
  competitions: "id_competition",
  combats: "id_combat",
  combat_scores: "id_combat_score"
};

const EMBEDS = {
  judokas: {
    coach_clubs: (row) => db.coach_clubs.filter((link) => link.id_coach === row.id_judoka),
    parent_judokas: (row) => db.parent_judokas.filter((link) => link.id_parent === row.id_judoka)
  },
  competitions: {
    combats: (row) => db.combats.filter((combat) => combat.id_competition === row.id_competition),
    judokas: (row) => db.judokas.find((judoka) => judoka.id_judoka === row.id_judoka) || null
  },
  combats: {
    combat_scores: (row) =>
      db.combat_scores
        .filter((score) => score.id_combat === row.id_combat)
        .sort((a, b) => a.ordre - b.ordre)
  }
};

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function unquote(value) {
  const text = String(value);
  return text.startsWith('"') && text.endsWith('"')
    ? text.slice(1, -1).replace(/\\(.)/g, "$1")
    : text;
}

function matchesOperator(actual, expression) {
  const dot = expression.indexOf(".");
  const operator = expression.slice(0, dot);
  const operand = expression.slice(dot + 1);
  const value = actual === null || actual === undefined ? "" : String(actual);
  switch (operator) {
    case "eq":
      return value === unquote(operand);
    case "neq":
      return value !== unquote(operand);
    case "gt":
      return value > unquote(operand);
    case "gte":
      return value >= unquote(operand);
    case "lte":
      return value <= unquote(operand);
    case "in":
      return splitTopLevel(operand.slice(1, -1)).map(unquote).includes(value);
    case "ilike": {
      const needle = unquote(operand).toLowerCase();
      const pattern = needle.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*");
      return new RegExp(`^${pattern}$`).test(value.toLowerCase());
    }
    case "is":
      return operand === "true"
        ? actual === true
        : operand === "null"
          ? actual == null
          : actual === false;
    default:
      throw new Error(`Faux PostgREST : opérateur non géré « ${operator} ».`);
  }
}

// Condition d'un filtre logique : « col.op.valeur », « or(...) » ou « and(...) ».
function matchesLogic(row, expression) {
  const group = /^(or|and)\((.*)\)$/s.exec(expression);
  if (group) {
    const parts = splitTopLevel(group[2]);
    return group[1] === "or"
      ? parts.some((part) => matchesLogic(row, part))
      : parts.every((part) => matchesLogic(row, part));
  }
  const dot = expression.indexOf(".");
  return matchesOperator(row[expression.slice(0, dot)], expression.slice(dot + 1));
}

function matchesFilters(table, row, params) {
  return params.every(([key, value]) => {
    if (["select", "order", "limit", "offset"].includes(key) || key.endsWith(".order")) {
      return true;
    }
    if (key === "or" || key === "and") {
      return matchesLogic(row, `${key}${value}`);
    }
    if (key.includes(".")) {
      // Filtre sur une ressource embarquée en jointure interne (ex. judokas.club_id).
      const [embed, column] = key.split(".");
      const related = EMBEDS[table][embed](row);
      return Boolean(related) && matchesOperator(related[column], value);
    }
    return matchesOperator(row[key], value);
  });
}

function pickColumns(row, columns) {
  if (columns.includes("*")) {
    return { ...row };
  }
  return Object.fromEntries(
    columns.map((column) => [column, row[column] === undefined ? null : row[column]])
  );
}

function project(table, row, select) {
  const columns = [];
  const embeds = [];
  splitTopLevel(select || "*").forEach((part) => {
    const embed = /^([a-z_]+)(?:![a-z_]+)*\((.*)\)$/.exec(part);
    if (embed) embeds.push(embed);
    else columns.push(part);
  });
  const projected = pickColumns(row, columns);
  embeds.forEach(([, name, inner]) => {
    const related = EMBEDS[table][name](row);
    const innerColumns = splitTopLevel(inner);
    projected[name] = Array.isArray(related)
      ? related.map((item) => pickColumns(item, innerColumns))
      : related && pickColumns(related, innerColumns);
  });
  return projected;
}

function sortRows(rows, order) {
  if (!order) return rows;
  const keys = order.split(",").map((part) => part.split("."));
  return [...rows].sort((a, b) => {
    for (const [column, direction] of keys) {
      const [left, right] = [String(a[column] ?? ""), String(b[column] ?? "")];
      if (left !== right) {
        return (left < right ? -1 : 1) * (direction === "desc" ? -1 : 1);
      }
    }
    return 0;
  });
}

function respond(status, body, headers = {}) {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] || null },
    text: async () => text,
    json: async () => JSON.parse(text)
  };
}

function handleRest(method, table, params, payload) {
  if (!db[table]) {
    return respond(404, { message: `Table inconnue : ${table}` });
  }
  const get = (key) => (params.find(([name]) => name === key) || [])[1];
  const matching = db[table].filter((row) => matchesFilters(table, row, params));

  if (method === "GET") {
    const sorted = sortRows(matching, get("order"));
    const offset = Number(get("offset") || 0);
    const limit = Math.min(Number(get("limit") || MAX_ROWS), MAX_ROWS);
    const page = sorted.slice(offset, offset + limit);
    const range = page.length ? `${offset}-${offset + page.length - 1}` : "*";
    return respond(
      200,
      page.map((row) => project(table, row, get("select"))),
      { "content-range": `${range}/${sorted.length}` }
    );
  }
  if (method === "POST") {
    const rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({
      created_at: new Date().toISOString(),
      ...row
    }));
    // Comme Postgres, une clé primaire en double fait échouer tout l'envoi.
    const primaryKey = PRIMARY_KEYS[table];
    if (primaryKey) {
      const keys = [...db[table], ...rows].map((row) => row[primaryKey]);
      if (new Set(keys).size !== keys.length) {
        return respond(409, {
          code: "23505",
          message: `duplicate key value violates unique constraint "${table}_pkey"`
        });
      }
    }
    db[table].push(...rows);
    return respond(201, rows);
  }
  if (method === "PATCH") {
    matching.forEach((row) => Object.assign(row, payload));
    return respond(200, matching);
  }
  if (method === "DELETE") {
    db[table] = db[table].filter((row) => !matching.includes(row));
    return respond(204);
  }
  return respond(405, { message: "Méthode non gérée." });
}

// STAT-17 : même lecture que la fonction SQL coach_dashboard_data (supabase/migrations).
function handleRpc(name, payload = {}) {
  if (name !== "coach_dashboard_data") {
    return respond(404, { message: `Fonction inconnue : ${name}` });
  }
  const clubIds = payload.p_club_ids || [];
  const judokaIds = payload.p_judoka_ids || [];
  const competitionIds = payload.p_competition_ids || [];
  const competitions = db.competitions
    .filter((row) => {
      const owner = db.judokas.find((judoka) => judoka.id_judoka === row.id_judoka);
      return (
        (clubIds.includes(owner && owner.club_id) || judokaIds.includes(row.id_judoka)) &&
        (!payload.p_date_from || row.date >= payload.p_date_from) &&
        (!payload.p_date_to || row.date <= payload.p_date_to) &&
        (!payload.p_age_category || row.categorie_age === payload.p_age_category)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id_competition.localeCompare(b.id_competition));
  const scopedIds = new Set(competitions.map((row) => row.id_competition));
  const combats = db.combats
    .filter(
      (row) =>
        scopedIds.has(row.id_competition) &&
        (!competitionIds.length || competitionIds.includes(row.id_competition))
    )
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id_combat.localeCompare(b.id_combat))
    .map((row) => ({ ...row, combat_scores: EMBEDS.combats.combat_scores(row) }));
  return respond(200, { competitions, combats });
}

async function fakeFetch(input, init = {}) {
  const url = new URL(String(input));
  const method = String(init.method || "GET").toUpperCase();
  const payload = init.body ? JSON.parse(init.body) : undefined;
  const query = decodeURIComponent(url.search.slice(1));
  const params = url.search
    .slice(1)
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
    });
  const table = url.pathname.startsWith("/rest/v1/") ? url.pathname.slice("/rest/v1/".length) : "";
  const request = { method, path: url.pathname, table, query, payload };
  requests.push(request);

  // La réponse arrive au tour suivant : les requêtes lancées ensemble se chevauchent.
  await new Promise((resolve) => setImmediate(resolve));

  if (url.pathname === "/auth/v1/.well-known/jwks.json") {
    return respond(200, { keys: [jwk] });
  }
  if (!table) {
    return respond(404, { message: "Chemin inconnu." });
  }
  if (table.startsWith("rpc/")) {
    return handleRpc(table.slice("rpc/".length), payload);
  }
  return handleRest(method, table, params, payload);
}

global.fetch = fakeFetch;

const { methods } = require("../core");
const { runInRequestScope } = require("../core/infra/request-scope.js");
const { createSupabaseRest, LIST_PAGE_SIZE } = require("../core/infra/supabase-rest.js");
const { getCurrentSeasonBounds } = require("../core/domain/season");
const rpcHandler = require("../api/rpc.js");

test.after(() => {
  global.fetch = originalFetch;
  console.log = originalConsoleLog;
  ENV_KEYS.forEach((key) => {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  });
});

// ---------------------------------------------------------------------------------------------
// Jeu de données : un coach de NANTES et RENNES, un club ANGERS qu'il ne coache pas.
// ---------------------------------------------------------------------------------------------

const season = getCurrentSeasonBounds();
const seasonStartYear = Number(season.start.slice(0, 4));
const inSeason = (monthDay) =>
  `${monthDay >= "09-01" ? seasonStartYear : seasonStartYear + 1}-${monthDay}`;
const lastSeason = (monthDay) =>
  `${monthDay >= "09-01" ? seasonStartYear - 1 : seasonStartYear}-${monthDay}`;

function judoka(id, extras = {}) {
  return {
    id_judoka: id,
    email: null,
    prenom: `Prenom${id}`,
    nom: `Nom${id}`,
    role: "NORMAL",
    profile_type: "JUDOKA",
    categorie_age: "Cadet",
    club_id: null,
    is_admin: false,
    // INSCR-2 : inscrit pour la saison en cours.
    saison_inscription: seasonStartYear,
    ...extras
  };
}

function competition(id, owner, date, extras = {}) {
  return {
    id_competition: id,
    id_judoka: owner,
    club_competition_id: null,
    nom: `Tournoi ${id}`,
    date,
    categorie_age: "Cadet",
    categorie_poids: "",
    niveau: "Régional",
    classement: "",
    // Colonne encore en base, plus gérée par l'application.
    coach_objective: "ANCIEN-OBJECTIF",
    coach_review: "",
    ...extras
  };
}

function combat(id, owner, competitionId, result, extras = {}) {
  return {
    id_combat: id,
    id_judoka: owner,
    id_competition: competitionId,
    adversaire: `Adversaire ${id}`,
    resultat: result,
    type_victoire: "Ippon",
    deroule: "Notes longues du combat ".repeat(20),
    created_at: `2026-01-01T00:00:${id.slice(-2).padStart(2, "0")}Z`,
    ...extras
  };
}

function resetDatabase() {
  const nantes = Array.from({ length: 30 }, (_, index) =>
    judoka(`N${String(index + 1).padStart(2, "0")}`, { club_id: "NANTES" })
  );
  Object.assign(db, {
    judokas: [
      judoka("COACH1", { email: "coach@example.com", role: "COACH" }),
      judoka("ADMIN1", { email: "admin@example.com", role: "ADMIN" }),
      judoka("PARENT1", { email: "parent@example.com", profile_type: "PARENT" }),
      judoka("SOLO1", { email: "solo@example.com", club_id: "NANTES" }),
      judoka("R01", { club_id: "RENNES" }),
      judoka("A01", { club_id: "ANGERS", email: "angers@example.com" }),
      ...nantes
    ],
    coach_clubs: [
      { id_coach: "COACH1", id_club: "NANTES" },
      { id_coach: "COACH1", id_club: "RENNES" }
    ],
    parent_judokas: [
      { id_parent: "PARENT1", id_judoka: "N01" },
      { id_parent: "PARENT1", id_judoka: "N02" }
    ],
    clubs: [
      { id_club: "ANGERS", nom: "Judo Club Angers" },
      { id_club: "NANTES", nom: "Judo Club Nantes" },
      { id_club: "RENNES", nom: "Judo Club Rennes" }
    ],
    club_competitions: [
      {
        id_club_competition: "EVENT1",
        nom: "Open de Nantes",
        date: inSeason("10-10"),
        categorie_age: "Cadet",
        niveau: "Régional",
        club_id: "NANTES"
      },
      {
        id_club_competition: "EVENT_OLD",
        nom: "Open passé",
        date: lastSeason("10-10"),
        categorie_age: "Cadet",
        niveau: "Régional",
        club_id: "NANTES"
      },
      {
        id_club_competition: "EVENT_ANGERS",
        nom: "Open d'Angers",
        date: inSeason("10-11"),
        categorie_age: "Cadet",
        niveau: "Régional",
        club_id: "ANGERS"
      }
    ],
    competitions: [
      competition("C_N01", "N01", inSeason("10-10"), { club_competition_id: "EVENT1" }),
      competition("C_SOLO", "SOLO1", inSeason("11-02")),
      competition("C_R01", "R01", inSeason("11-15")),
      competition("C_A01", "A01", inSeason("11-20")),
      competition("C_COACH", "COACH1", inSeason("12-01")),
      competition("C_N01_OLD", "N01", lastSeason("10-10"), { club_competition_id: "EVENT_OLD" }),
      competition("C_N02_OLDEST", "N02", `${seasonStartYear - 3}-10-07`)
    ],
    combats: [
      combat("CB01", "N01", "C_N01", "Victoire"),
      combat("CB02", "N01", "C_N01", "Victoire"),
      combat("CB03", "N01", "C_N01", "Défaite"),
      combat("CB04", "SOLO1", "C_SOLO", "Egalité"),
      combat("CB05", "A01", "C_A01", "Victoire"),
      combat("CB06", "N01", "C_N01_OLD", "Défaite")
    ],
    combat_scores: [
      {
        id_combat_score: "CB01_S0",
        id_combat: "CB01",
        categorie: "Tachi-waza",
        technique: "Seoi-nage",
        type_ne_waza: "",
        valeur: "Ippon",
        ordre: 0,
        camp: "JUDOKA"
      },
      {
        id_combat_score: "CB01_C0",
        id_combat: "CB01",
        categorie: "Tachi-waza",
        technique: "Uchi-mata",
        type_ne_waza: "",
        valeur: "Yuko",
        ordre: 1,
        camp: "ADVERSAIRE"
      },
      {
        id_combat_score: "CB06_S0",
        id_combat: "CB06",
        categorie: "Tachi-waza",
        technique: "O-soto-gari",
        type_ne_waza: "",
        valeur: "Yuko",
        ordre: 0,
        camp: "JUDOKA"
      }
    ],
    access_invitations: [
      {
        email: "invite@example.com",
        invited_profile_type: "PARENT",
        invited_by: "ADMIN1",
        created_at: "2026-01-01",
        updated_at: "2026-01-01"
      }
    ]
  });
}

// Lance un appel dans une portée de requête et rend le résultat, les compteurs et les requêtes.
async function measure(call) {
  resetDatabase();
  return measureWithoutReset(call);
}

async function measureWithoutReset(call) {
  requests.length = 0;
  let scope;
  const result = await runInRequestScope(async (requestScope) => {
    scope = requestScope;
    return call(requestScope);
  });
  return { result, scope, requests: [...requests] };
}

const reads = (list, table) =>
  list.filter((request) => request.method === "GET" && (!table || request.table === table));
const writes = (list) => list.filter((request) => request.method !== "GET");

// ---------------------------------------------------------------------------------------------
// CTX-1
// ---------------------------------------------------------------------------------------------

test("CTX-1 : le contexte coûte 2 requêtes au plus, quel que soit le rôle", async () => {
  const contextCost = async (email) => {
    // getCombatSuggestions sans judoka ne lit que le contexte.
    const measured = await measure(() => methods.getCombatSuggestions(email, ""));
    return measured;
  };

  const coach = await contextCost("coach@example.com");
  assert.equal(coach.scope.requests, 2);
  assert.match(
    coach.requests[0].query,
    /^select=\*,coach_clubs\(id_club\),parent_judokas!parent_judokas_id_parent_fkey\(id_judoka\)&email=ilike\.coach@example\.com&limit=1$/
  );
  assert.match(coach.requests[1].query, /club_id=in\.\(NANTES,RENNES\)/);
  // Aucune requête séparée sur coach_clubs ni parent_judokas.
  assert.deepEqual(reads(coach.requests, "coach_clubs"), []);

  const parent = await contextCost("parent@example.com");
  assert.equal(parent.scope.requests, 2);
  assert.match(parent.requests[1].query, /id_judoka=in\.\(N01,N02\)/);
  assert.deepEqual(reads(parent.requests, "parent_judokas"), []);

  const solo = await contextCost("solo@example.com");
  assert.equal(solo.scope.requests, 1);

  const admin = await contextCost("admin@example.com");
  assert.ok(admin.scope.requests <= 2, `admin : ${admin.scope.requests} requêtes`);
});

test("CTX-1 : le contexte n'est calculé qu'une fois par appel, et une écriture vide la mémoire", async () => {
  const twice = await measure(async () => {
    await methods.getCombatSuggestions("coach@example.com", "");
    await methods.getCombatSuggestions("coach@example.com", "");
    await methods.getCombatSuggestions("COACH@example.com", "");
  });
  assert.equal(twice.scope.requests, 2);

  // Hors portée de requête, rien n'est mémorisé d'un appel au suivant.
  requests.length = 0;
  await methods.getCombatSuggestions("coach@example.com", "");
  await methods.getCombatSuggestions("coach@example.com", "");
  assert.equal(requests.length, 4);

  // Une écriture (ici le bilan du coach) vide la mémoire : le contexte est relu ensuite.
  const afterWrite = await measure(async () => {
    await methods.getCombatSuggestions("coach@example.com", "");
    await methods.saveCoachReview("coach@example.com", "C_N01", "Travailler le ne-waza");
    await methods.getCombatSuggestions("coach@example.com", "");
  });
  const identityReads = afterWrite.requests.filter((request) =>
    request.query.includes("email=ilike.")
  );
  assert.equal(identityReads.length, 2);
  assert.equal(writes(afterWrite.requests).length, 1);
});

// ---------------------------------------------------------------------------------------------
// INIT-1, INIT-2, PAGE-2, PAGE-4
// ---------------------------------------------------------------------------------------------

test("INIT-1 / INIT-2 : getInitialData d'un coach tient en 3 étapes et ne charge aucun combat", async () => {
  const {
    result,
    scope,
    requests: list
  } = await measure(() => methods.getInitialData("coach@example.com"));

  assert.ok(scope.stages <= 3, `${scope.stages} étapes`);
  // Les lectures indépendantes partent ensemble : bien moins d'étapes que de requêtes.
  assert.ok(scope.requests > scope.stages);

  // Les clubs du coach sont filtrés par la requête.
  const clubReads = reads(list, "clubs");
  assert.equal(clubReads.length, 1);
  assert.match(clubReads[0].query, /id_club=in\.\(NANTES,RENNES\)/);
  assert.deepEqual(
    result.clubs.map((club) => club.clubId),
    ["NANTES", "RENNES"]
  );

  // Le bilan V/D vient des résultats lus avec les compétitions : aucune lecture de combats.
  assert.deepEqual(reads(list, "combats"), []);
  assert.deepEqual(reads(list, "combat_scores"), []);
  const competitionReads = reads(list, "competitions").filter((request) =>
    request.query.includes("combats(resultat)")
  );
  assert.equal(competitionReads.length, 2);
  competitionReads.forEach((request) => assert.doesNotMatch(request.query, /combats\(\*\)/));
  assert.deepEqual(result.combatRecords, {
    C_N01: { total: 3, wins: 2, losses: 1, draws: 0 },
    C_SOLO: { total: 1, wins: 0, losses: 0, draws: 1 }
  });

  // Le coach voit les compétitions des judokas de ses clubs et les siennes, pas celles d'ANGERS.
  assert.deepEqual(result.competitions.map((item) => item.competitionId).sort(), [
    "C_COACH",
    "C_N01",
    "C_R01",
    "C_SOLO"
  ]);
  assert.deepEqual(
    result.clubCompetitions.map((item) => item.clubCompetitionId),
    ["EVENT1"]
  );
  assert.equal(result.isCoach, true);
  assert.equal(result.judokas.length, 33);
  // Aucune ligne embarquée ne fuit dans les compétitions renvoyées.
  assert.equal("combats" in result.competitions[0], false);
  assert.equal("judokas" in result.competitions[0], false);
});

test("INIT-2 : le bilan de l'accueil pèse moins de 50 octets par combat", async () => {
  resetDatabase();
  requests.length = 0;
  const response = await fakeFetch(
    `${SUPABASE_URL}/rest/v1/competitions?select=id_competition,combats(resultat)&id_competition=eq.C_N01`
  );
  const [row] = await response.json();
  const bytesPerCombat = Buffer.byteLength(JSON.stringify(row.combats)) / row.combats.length;
  assert.ok(bytesPerCombat < 50, `${bytesPerCombat} octets par combat`);
});

test("PAGE-2 : getInitialData ne charge que la saison en cours et les compétitions à venir", async () => {
  const { result, requests: list } = await measure(() =>
    methods.getInitialData("coach@example.com")
  );

  const listReads = reads(list, "competitions").filter((request) =>
    request.query.includes("combats(resultat)")
  );
  listReads.forEach((request) => {
    assert.ok(request.query.includes(`date=gte.${season.start}`), request.query);
    assert.doesNotMatch(request.query, /date=lte\./);
  });
  const clubCompetitionReads = reads(list, "club_competitions");
  assert.equal(clubCompetitionReads.length, 1);
  assert.ok(clubCompetitionReads[0].query.includes(`date=gte.${season.start}`));

  assert.equal(result.loadedFrom, season.start);
  assert.equal(result.oldestCompetitionDate, `${seasonStartYear - 3}-10-07`);
  assert.equal(
    result.competitions.some((item) => item.competitionId === "C_N01_OLD"),
    false
  );
  // La plus ancienne date se lit sans lister l'historique.
  reads(list, "competitions")
    .filter((request) => request.query.startsWith("select=date"))
    .forEach((request) => assert.match(request.query, /order=date\.asc&limit=1$/));
});

test("PAGE-2 : getSeasonCompetitions borne la lecture à la saison demandée", async () => {
  const {
    result,
    scope,
    requests: list
  } = await measure(() => methods.getSeasonCompetitions("coach@example.com", seasonStartYear - 1));
  const bounds = getCurrentSeasonBounds(new Date(seasonStartYear - 1, 9, 1));

  reads(list, "competitions").forEach((request) => {
    assert.ok(request.query.includes(`date=gte.${bounds.start}`), request.query);
    assert.ok(request.query.includes(`date=lte.${bounds.end}`), request.query);
  });
  const clubCompetitionReads = reads(list, "club_competitions");
  assert.ok(
    clubCompetitionReads[0].query.includes(`date=gte.${bounds.start}&date=lte.${bounds.end}`)
  );
  assert.ok(scope.stages <= 2, `${scope.stages} étapes`);

  assert.equal(result.seasonStartYear, seasonStartYear - 1);
  assert.deepEqual(
    result.competitions.map((item) => item.competitionId),
    ["C_N01_OLD"]
  );
  assert.deepEqual(result.combatRecords, { C_N01_OLD: { total: 1, wins: 0, losses: 1, draws: 0 } });
  assert.deepEqual(
    result.clubCompetitions.map((item) => item.clubCompetitionId),
    ["EVENT_OLD"]
  );

  await assert.rejects(
    () => methods.getSeasonCompetitions("coach@example.com", "abc"),
    /Saison invalide/
  );
  await assert.rejects(
    () => methods.getSeasonCompetitions("ghost@example.com", seasonStartYear),
    /Accès refusé/
  );
});

test("PAGE-4 : le périmètre d'un coach se filtre par club, sans liste d'identifiants dans l'URL", async () => {
  const { requests: list } = await measure(() => methods.getInitialData("coach@example.com"));

  const byClub = reads(list, "competitions").filter((request) =>
    request.query.includes("judokas.club_id=in.(NANTES,RENNES)")
  );
  assert.equal(byClub.length, 2); // la liste et la plus ancienne date
  byClub.forEach((request) => assert.match(request.query, /judokas!inner\(club_id\)/));
  // Aucun identifiant de judoka d'un club ne part dans une URL de compétitions.
  reads(list, "competitions").forEach((request) => {
    assert.doesNotMatch(request.query, /N01|N30|R01|SOLO1/);
    assert.ok(request.query.length < 300, `URL de ${request.query.length} caractères`);
  });
});

test("aucune lecture ne renvoie l'ancien objectif du coach resté en base", async () => {
  const calls = {
    getInitialData: () => methods.getInitialData("coach@example.com"),
    getSeasonCompetitions: () => methods.getSeasonCompetitions("coach@example.com", seasonStartYear),
    getCompetitionDetail: () => methods.getCompetitionDetail("coach@example.com", "C_N01"),
    getClubCompetitionDetail: () => methods.getClubCompetitionDetail("coach@example.com", "EVENT1"),
    getJudokaProfile: () => methods.getJudokaProfile("coach@example.com", "N01"),
    getCoachDashboard: () => methods.getCoachDashboard("coach@example.com", {}),
    searchCombats: () => methods.searchCombats("coach@example.com", {}),
    parentInitialData: () => methods.getInitialData("parent@example.com")
  };
  for (const [name, call] of Object.entries(calls)) {
    const { result } = await measure(call);
    assert.equal(/objecti/i.test(JSON.stringify(result)), false, name);
  }
});

test("le périmètre de getInitialData suit le rôle : parent, judoka, admin", async () => {
  const parent = await measure(() => methods.getInitialData("parent@example.com"));
  assert.deepEqual(
    parent.result.competitions.map((item) => item.competitionId),
    ["C_N01"]
  );
  assert.equal(parent.result.oldestCompetitionDate, `${seasonStartYear - 3}-10-07`);
  assert.deepEqual(
    parent.result.judokas.map((item) => item.judokaId),
    ["PARENT1", "N01", "N02"]
  );
  assert.deepEqual(parent.result.clubs, []);
  assert.ok(parent.scope.stages <= 3);
  assert.deepEqual(reads(parent.requests, "clubs"), []);
  assert.deepEqual(reads(parent.requests, "club_competitions"), []);

  const solo = await measure(() => methods.getInitialData("solo@example.com"));
  assert.deepEqual(
    solo.result.competitions.map((item) => item.competitionId),
    ["C_SOLO"]
  );
  assert.deepEqual(solo.result.judokas, []);
  assert.ok(solo.scope.stages <= 3);

  await assert.rejects(
    () => measure(() => methods.getInitialData("ghost@example.com")),
    /invitation est requise/
  );
});

// ---------------------------------------------------------------------------------------------
// DETAIL-1, DETAIL-2
// ---------------------------------------------------------------------------------------------

test("DETAIL-1 / DETAIL-2 : la fiche tient en 3 étapes, lit combats et points en une requête, sans suggestions", async () => {
  const {
    result,
    scope,
    requests: list
  } = await measure(() => methods.getCompetitionDetail("coach@example.com", "C_N01"));

  assert.ok(scope.stages <= 3, `${scope.stages} étapes`);
  assert.equal(scope.requests, 4);
  const combatReads = reads(list, "combats");
  assert.equal(combatReads.length, 1);
  assert.match(
    combatReads[0].query,
    /^select=\*,combat_scores\(\*\)&combat_scores\.order=ordre\.asc/
  );
  assert.match(combatReads[0].query, /id_competition=eq\.C_N01/);
  assert.deepEqual(reads(list, "combat_scores"), []);
  // Aucun combat d'une autre compétition n'est lu (pas de suggestions de saisie).
  list.forEach((request) => assert.doesNotMatch(request.query, /id_judoka=eq\./));
  assert.equal("combatSuggestions" in result, false);

  assert.deepEqual(
    result.combats.map((item) => item.combatId),
    ["CB01", "CB02", "CB03"]
  );
  assert.deepEqual(
    result.combats[0].scores.map((score) => score.technique),
    ["Seoi-nage"]
  );
  assert.deepEqual(
    result.combats[0].concededScores.map((score) => score.technique),
    ["Uchi-mata"]
  );
  assert.equal(result.combats[0].judokaDisplayName, "PrenomN01 NOMN01");
  assert.equal(result.canEditCompetition, true);
});

test("DETAIL-1 : une fiche refusée ne renvoie rien, une fiche inconnue est signalée", async () => {
  await assert.rejects(
    () => measure(() => methods.getCompetitionDetail("coach@example.com", "C_A01")),
    /Accès refusé à cette compétition/
  );
  await assert.rejects(
    () => measure(() => methods.getCompetitionDetail("solo@example.com", "C_N01")),
    /Accès refusé à cette compétition/
  );
  await assert.rejects(
    () => measure(() => methods.getCompetitionDetail("coach@example.com", "INCONNUE")),
    /Compétition introuvable/
  );
});

test("DETAIL-2 : les suggestions se chargent par un RPC dédié, en une lecture", async () => {
  const { result, requests: list } = await measure(() =>
    methods.getCombatSuggestions("coach@example.com", "N01")
  );

  const combatReads = reads(list, "combats");
  assert.equal(combatReads.length, 1);
  assert.match(
    combatReads[0].query,
    /^select=adversaire,garde_adversaire,combat_scores\(categorie,technique,type_ne_waza,camp\)&id_judoka=eq\.N01/
  );
  assert.deepEqual(reads(list, "combat_scores"), []);
  assert.equal(result.opponents.length, 4);
  // Les techniques subies ne sont pas proposées.
  assert.deepEqual(result.techniques.sort(), ["O-soto-gari", "Seoi-nage"]);

  // Hors périmètre : rien n'est lu.
  const refused = await measure(() => methods.getCombatSuggestions("coach@example.com", "A01"));
  assert.deepEqual(refused.result, { opponents: [], opponentStances: {}, techniques: [] });
  assert.deepEqual(reads(refused.requests, "combats"), []);
});

// ---------------------------------------------------------------------------------------------
// ECRIT-1, ECRIT-2, ECRIT-3
// ---------------------------------------------------------------------------------------------

function sixPointCombat() {
  const point = (technique, value, order) => ({
    category: "Tachi-waza",
    technique,
    neWazaType: "",
    value,
    order
  });
  return {
    competitionId: "C_N01",
    judokaId: "N01",
    opponent: "Léo Dupont",
    result: "Victoire",
    victoryType: "Ippon",
    scores: [
      point("Seoi-nage", "Yuko", 0),
      point("Uchi-mata", "Yuko", 2),
      point("O-soto-gari", "Waza-ari", 4),
      point("Seoi-nage", "Ippon", 5)
    ],
    concededScores: [point("Uchi-mata", "Yuko", 1), point("O-soto-gari", "Yuko", 3)]
  };
}

test("ECRIT-1 / ECRIT-2 : enregistrer un combat de 6 points coûte 3 écritures et renvoie le combat", async () => {
  const {
    result,
    scope,
    requests: list
  } = await measure(() => methods.ajouterCombat("coach@example.com", sixPointCombat()));

  const written = writes(list);
  assert.deepEqual(
    written.map((request) => [request.method, request.table]),
    [
      ["POST", "combats"],
      ["DELETE", "combat_scores"],
      ["POST", "combat_scores"]
    ]
  );
  assert.equal(Array.isArray(written[2].payload), true);
  assert.equal(written[2].payload.length, 6);
  assert.deepEqual(
    written[2].payload.map((row) => [row.camp, row.ordre]),
    [
      ["JUDOKA", 0],
      ["JUDOKA", 2],
      ["JUDOKA", 4],
      ["JUDOKA", 5],
      ["ADVERSAIRE", 1],
      ["ADVERSAIRE", 3]
    ]
  );
  // Contexte, compétition, combat, suppression, insertion : 6 étapes au plus.
  assert.ok(scope.stages <= 6, `${scope.stages} étapes`);
  assert.equal(
    db.combat_scores.filter((score) => score.id_combat === result.combat.combatId).length,
    6
  );

  // ECRIT-2 : le combat enregistré revient avec l'écriture ; aucune relecture des combats.
  assert.deepEqual(reads(list, "combats"), []);
  assert.equal(result.success, true);
  assert.equal(result.competitionId, "C_N01");
  assert.equal(result.combat.opponent, "Léo Dupont");
  assert.equal(result.combat.judokaDisplayName, "PrenomN01 NOMN01");
  assert.equal(result.combat.scores.length, 4);
  assert.equal(result.combat.concededScores.length, 2);
});

test("ECRIT-1 : modifier un combat remplace ses points en une suppression et une insertion", async () => {
  const { result, requests: list } = await measure(() =>
    methods.updateCombat("coach@example.com", { ...sixPointCombat(), combatId: "CB01" })
  );

  assert.deepEqual(
    writes(list).map((request) => [request.method, request.table]),
    [
      ["PATCH", "combats"],
      ["DELETE", "combat_scores"],
      ["POST", "combat_scores"]
    ]
  );
  assert.equal(result.combat.combatId, "CB01");
  assert.equal(db.combat_scores.filter((score) => score.id_combat === "CB01").length, 6);
});

test("ECRIT-2 : enregistrer ou classer une compétition renvoie la compétition enregistrée", async () => {
  const created = await measure(() =>
    methods.saveCompetition("solo@example.com", {
      name: "Tournoi de Noël",
      competitionDate: inSeason("12-20"),
      ageCategory: "Cadet"
    })
  );
  assert.equal(created.result.competition.competitionId, created.result.competitionId);
  assert.equal(created.result.competition.ownerJudokaId, "SOLO1");
  assert.equal(created.result.competition.name, "Tournoi de Noël");

  const finalized = await measure(() =>
    methods.finalizeCompetition("solo@example.com", "C_SOLO", "1er")
  );
  assert.equal(finalized.result.competition.competitionId, "C_SOLO");
  assert.equal(finalized.result.competition.result, "1er");
  assert.equal(writes(finalized.requests).length, 1);
});

test("ECRIT-3 : enregistrer une compétition club de 30 judokas coûte 5 écritures au plus", async () => {
  const participantJudokaIds = Array.from(
    { length: 30 },
    (_, index) => `N${String(index + 1).padStart(2, "0")}`
  );
  const creation = await measure(() =>
    methods.saveClubCompetition("coach@example.com", {
      name: "Coupe de printemps",
      competitionDate: inSeason("04-12"),
      ageCategory: "Cadet",
      level: "Régional",
      clubId: "NANTES",
      participantJudokaIds
    })
  );

  const created = writes(creation.requests);
  assert.ok(created.length <= 5, `${created.length} écritures`);
  assert.deepEqual(
    created.map((request) => [request.method, request.table]),
    [
      ["POST", "club_competitions"],
      ["POST", "competitions"]
    ]
  );
  assert.equal(created[1].payload.length, 30);
  assert.deepEqual(
    created[1].payload.map((row) => row.id_judoka),
    participantJudokaIds
  );
  // Chaque participation créée dans le même envoi porte son propre identifiant (clé primaire).
  assert.equal(new Set(created[1].payload.map((row) => row.id_competition)).size, 30);
  assert.equal(creation.result.competitions.length, 30);
  assert.equal(creation.result.clubCompetition.clubId, "NANTES");

  // Modification : les 30 participations existantes sont resynchronisées en une requête.
  const clubCompetitionId = creation.result.clubCompetitionId;
  const edition = await measureWithoutReset(() =>
    methods.saveClubCompetition("coach@example.com", {
      clubCompetitionId,
      name: "Coupe de printemps (report)",
      competitionDate: inSeason("04-19"),
      ageCategory: "Cadet",
      level: "National"
    })
  );
  const edited = writes(edition.requests);
  assert.ok(edited.length <= 5, `${edited.length} écritures`);
  assert.deepEqual(
    edited.map((request) => [request.method, request.table]),
    [
      ["PATCH", "club_competitions"],
      ["PATCH", "competitions"]
    ]
  );
  assert.match(edited[1].query, new RegExp(`^club_competition_id=eq\\.${clubCompetitionId}`));
  assert.deepEqual(Object.keys(edited[1].payload).sort(), [
    "categorie_age",
    "date",
    "niveau",
    "nom"
  ]);
  const linked = db.competitions.filter((row) => row.club_competition_id === clubCompetitionId);
  assert.equal(linked.length, 30);
  assert.ok(
    linked.every((row) => row.nom === "Coupe de printemps (report)" && row.niveau === "National")
  );

  // Suppression : toutes les participations sont détachées en une requête.
  const deletion = await measureWithoutReset(() =>
    methods.deleteClubCompetition("coach@example.com", clubCompetitionId)
  );
  assert.deepEqual(
    writes(deletion.requests).map((request) => [request.method, request.table]),
    [
      ["PATCH", "competitions"],
      ["DELETE", "club_competitions"]
    ]
  );
  assert.equal(
    db.competitions.filter((row) => row.club_competition_id === clubCompetitionId).length,
    0
  );
  assert.equal(
    db.competitions.filter((row) => row.nom === "Coupe de printemps (report)").length,
    30
  );
});

// ---------------------------------------------------------------------------------------------
// PAGE-1
// ---------------------------------------------------------------------------------------------

// Faux supabaseRequest plafonné : jamais plus de `cap` lignes par réponse, total annoncé.
function createCappedRequest(rows, { cap = 1000, announceTotal = true, lie = 0 } = {}) {
  const calls = [];
  const supabaseRequest = async (table, query, options = {}) => {
    calls.push({ table, query, prefer: options.prefer });
    const limit = Number((/(?:^|&)limit=(\d+)/.exec(query) || [])[1] || cap);
    const offset = Number((/(?:^|&)offset=(\d+)/.exec(query) || [])[1] || 0);
    const page = rows.slice(offset, offset + Math.min(limit, cap));
    if (options.onResponse && announceTotal) {
      const range = page.length ? `${offset}-${offset + page.length - 1}` : "*";
      options.onResponse({ headers: { get: () => `${range}/${rows.length + lie}` } });
    } else if (options.onResponse) {
      options.onResponse({ headers: { get: () => null } });
    }
    return page;
  };
  return { supabaseRequest, calls };
}

const fifteenHundredCombats = Array.from({ length: 1500 }, (_, index) => ({
  id_combat: `CB${index}`,
  id_competition: `COMP${index % 100}`,
  resultat: index % 3 ? "Victoire" : "Défaite",
  note: null
}));
const COMBATS_QUERY = "select=*&id_competition=in.(COMP0,COMP1)&order=created_at.asc,id_combat.asc";

test("PAGE-1 : 1 500 combats sur un lot sont tous lus, malgré le plafond de 1 000 lignes", async () => {
  const { supabaseRequest, calls } = createCappedRequest(fifteenHundredCombats);
  const rest = createSupabaseRest({ supabaseRequest });

  const rows = await rest.supabaseSelect("combats", COMBATS_QUERY);

  assert.equal(rows.length, 1500);
  assert.equal(new Set(rows.map((row) => row.id_combat)).size, 1500);
  assert.equal(rows[0].note, "");
  // Toute requête de liste porte une borne explicite.
  assert.equal(LIST_PAGE_SIZE, 1000);
  assert.deepEqual(
    calls.map((call) => call.query),
    [`${COMBATS_QUERY}&limit=1000&offset=0`, `${COMBATS_QUERY}&limit=1000&offset=1000`]
  );
  calls.forEach((call) => assert.equal(call.prefer, "count=exact"));
});

test("PAGE-1 : un plafond de projet plus bas que la borne ne tronque pas la liste", async () => {
  const { supabaseRequest, calls } = createCappedRequest(fifteenHundredCombats, { cap: 400 });
  const rest = createSupabaseRest({ supabaseRequest });

  const rows = await rest.supabaseSelect("combats", COMBATS_QUERY);

  assert.equal(new Set(rows.map((row) => row.id_combat)).size, 1500);
  assert.deepEqual(
    calls.map((call) => Number(/offset=(\d+)/.exec(call.query)[1])),
    [0, 400, 800, 1200]
  );
});

test("PAGE-1 : sans total annoncé, une réponse qui atteint la borne lit la suite", async () => {
  const { supabaseRequest, calls } = createCappedRequest(fifteenHundredCombats, {
    announceTotal: false
  });
  const rest = createSupabaseRest({ supabaseRequest });

  const rows = await rest.supabaseSelect("combats", COMBATS_QUERY);

  assert.equal(rows.length, 1500);
  assert.equal(calls.length, 2);
});

test("PAGE-1 : une liste trop longue sans tri stable lève une erreur", async () => {
  const unordered = "select=*&id_competition=in.(COMP0,COMP1)";
  const withTotal = createSupabaseRest(createCappedRequest(fifteenHundredCombats));
  await assert.rejects(
    () => withTotal.supabaseSelect("combats", unordered),
    /tri stable est requis/
  );

  const withoutTotal = createSupabaseRest(
    createCappedRequest(fifteenHundredCombats, { announceTotal: false })
  );
  await assert.rejects(
    () => withoutTotal.supabaseSelect("combats", unordered),
    /tri stable est requis/
  );

  // Une liste courte sans tri reste lisible.
  const short = createSupabaseRest(createCappedRequest(fifteenHundredCombats.slice(0, 20)));
  assert.equal((await short.supabaseSelect("combats", unordered)).length, 20);
});

test("PAGE-1 : un total annoncé mais non atteint lève une erreur, jamais une troncature silencieuse", async () => {
  const rest = createSupabaseRest(createCappedRequest(fifteenHundredCombats, { lie: 200 }));
  await assert.rejects(
    () => rest.supabaseSelect("combats", COMBATS_QUERY),
    /Liste incomplète sur combats : 1500 lignes lues sur 1700/
  );

  const empty = createSupabaseRest(createCappedRequest([], { lie: 5 }));
  await assert.rejects(
    () => empty.supabaseSelect("combats", COMBATS_QUERY),
    /Liste incomplète sur combats/
  );
});

test("PAGE-1 : supabaseSelectPage lit une page bornée et le total", async () => {
  const { supabaseRequest, calls } = createCappedRequest(fifteenHundredCombats);
  const rest = createSupabaseRest({ supabaseRequest });

  const page = await rest.supabaseSelectPage("combats", COMBATS_QUERY, 10);

  assert.equal(page.rows.length, 10);
  assert.equal(page.total, 1500);
  assert.deepEqual(
    calls.map((call) => call.query),
    [`${COMBATS_QUERY}&limit=10&offset=0`]
  );
});

test("PAGE-1 : avec le vrai câblage, 1 500 combats d'un lot de compétitions sont tous comptés", async () => {
  resetDatabase();
  db.combats = Array.from({ length: 1500 }, (_, index) =>
    combat(
      `K${String(index).padStart(4, "0")}`,
      "N01",
      "C_N01",
      index % 2 ? "Victoire" : "Défaite",
      {
        created_at: `2026-01-01T00:00:00.${String(index).padStart(4, "0")}Z`
      }
    )
  );
  db.competitions.find((row) => row.id_competition === "C_N01").club_competition_id = "EVENT1";

  const { result, requests: list } = await measureWithoutReset(() =>
    methods.getClubCompetitionDetail("coach@example.com", "EVENT1")
  );

  assert.deepEqual(result.combatRecords, {
    C_N01: { total: 1500, wins: 750, losses: 750, draws: 0 }
  });
  const combatReads = reads(list, "combats");
  assert.equal(combatReads.length, 2);
  combatReads.forEach((request) => {
    assert.match(request.query, /order=created_at\.asc,id_combat\.asc/);
    assert.match(request.query, /limit=1000&offset=(0|1000)$/);
  });
});

test("PAGE-1 : toute lecture de liste porte un tri et une borne explicites", async () => {
  const calls = [
    () => methods.getInitialData("coach@example.com"),
    () => methods.getInitialData("parent@example.com"),
    () => methods.getCompetitionDetail("coach@example.com", "C_N01"),
    () => methods.getClubCompetitionDetail("coach@example.com", "EVENT1"),
    () => methods.getCoachDashboard("coach@example.com", {}),
    () => methods.searchCombats("coach@example.com", {}),
    () => methods.getAdminsManagement("admin@example.com"),
    () => methods.getClubsManagement("admin@example.com"),
    () => methods.getJudokaProfile("coach@example.com", "N01")
  ];
  for (const call of calls) {
    const { requests: list } = await measure(call);
    reads(list).forEach((request) => {
      assert.match(
        request.query,
        /(^|&)limit=\d+/,
        `sans borne : ${request.table}?${request.query}`
      );
      if (!/(^|&)limit=1(&|$)/.test(request.query)) {
        assert.match(request.query, /(^|&)order=/, `sans tri : ${request.table}?${request.query}`);
      }
    });
  }
});

// ---------------------------------------------------------------------------------------------
// COACH-1, COACH-2
// ---------------------------------------------------------------------------------------------

const rpcCalls = (list, name) => list.filter((request) => request.table === `rpc/${name}`);

test("COACH-1 / STAT-17 : le tableau de bord lit ses données en un appel, filtré par club, dates et catégorie", async () => {
  const {
    result,
    scope,
    requests: list
  } = await measure(() =>
    methods.getCoachDashboard("coach@example.com", {
      clubId: "NANTES",
      dateFrom: season.start,
      dateTo: season.end,
      ageCategory: "Cadet"
    })
  );

  // STAT-17 : 2 requêtes de contexte, 1 pour les données ; aucune lecture de table pour les combats.
  assert.equal(scope.requests, 3, list.map((request) => `${request.method} ${request.table} ${request.query}`).join("\n"));
  const [dataCall] = rpcCalls(list, "coach_dashboard_data");
  assert.equal(rpcCalls(list, "coach_dashboard_data").length, 1);
  assert.deepEqual(dataCall.payload, {
    p_club_ids: ["NANTES"],
    p_judoka_ids: [],
    // STAT-23 : la lecture commence un an plus tôt, pour la période comparée.
    p_date_from: `${Number(season.start.slice(0, 4)) - 1}${season.start.slice(4)}`,
    p_date_to: season.end,
    p_age_category: "Cadet",
    p_competition_ids: []
  });
  assert.deepEqual(reads(list, "competitions"), []);
  // Seuls les judokas du périmètre sont lus (ceux des clubs du coach), jamais toute la table.
  const judokaReads = reads(list, "judokas").filter(
    (request) => !request.query.includes("email=ilike.")
  );
  assert.equal(judokaReads.length, 1);
  assert.match(judokaReads[0].query, /club_id=in\.\(NANTES,RENNES\)/);
  // Un coach ne lit aucune ligne d'un autre club.
  list.forEach((request) => assert.doesNotMatch(`${request.query}${JSON.stringify(request.payload || "")}`, /ANGERS|C_A01/));
  assert.deepEqual(reads(list, "combats"), []);
  assert.deepEqual(reads(list, "combat_scores"), []);
  assert.ok(scope.stages <= 2, `${scope.stages} étapes`);

  assert.equal(result.stats.totalCombats, 4);
  assert.deepEqual(result.availableCompetitions.map((item) => item.competitionId).sort(), [
    "C_N01",
    "C_SOLO"
  ]);

  await assert.rejects(
    () => measure(() => methods.getCoachDashboard("coach@example.com", { clubId: "ANGERS" })),
    /Club introuvable/
  );
  await assert.rejects(
    () => measure(() => methods.getCoachDashboard("solo@example.com", {})),
    /réservé aux coachs/
  );
});

test("STAT-17 : 250 participations coûtent toujours 3 requêtes, et les combats choisis seulement", async () => {
  resetDatabase();
  db.competitions = Array.from({ length: 250 }, (_, index) =>
    competition(`S${String(index).padStart(3, "0")}`, index % 2 ? "N01" : "N02", inSeason("10-10"))
  );
  db.combats = db.competitions.map((row, index) =>
    combat(`Q${String(index).padStart(3, "0")}`, row.id_judoka, row.id_competition, index % 3 ? "Victoire" : "Défaite")
  );

  const all = await measureWithoutReset(() => methods.getCoachDashboard("coach@example.com", {}));
  assert.equal(all.scope.requests, 3);
  assert.equal(all.result.stats.totalCombats, 250);
  assert.equal(all.result.availableCompetitions.length, 250);

  // Les combats ne sont lus que pour les compétitions choisies ; la liste proposée reste complète.
  const chosen = await measureWithoutReset(() =>
    methods.getCoachDashboard("coach@example.com", { competitionIds: ["S000", "S001"] })
  );
  assert.equal(chosen.scope.requests, 3);
  assert.deepEqual(rpcCalls(chosen.requests, "coach_dashboard_data")[0].payload.p_competition_ids, ["S000", "S001"]);
  assert.equal(chosen.result.stats.totalCombats, 2);
  assert.equal(chosen.result.availableCompetitions.length, 250);

  // STAT-20 : une compétition d'un seul judoka ne donne que son volume.
  const solo = await measureWithoutReset(() =>
    methods.getCoachDashboard("coach@example.com", { competitionIds: ["S000"] })
  );
  assert.equal(solo.result.stats, null);
  assert.deepEqual(solo.result.withheld, { analyzedCompetitions: 1, totalCombats: 1 });
});

test("COACH-2 : une recherche sur 200 compétitions coûte 3 requêtes de combats au plus", async () => {
  resetDatabase();
  db.competitions = Array.from({ length: 200 }, (_, index) =>
    competition(
      `S${String(index).padStart(3, "0")}`,
      index % 2 ? "N01" : "R01",
      lastSeason("10-10")
    )
  );
  db.combats = db.competitions.map((row, index) =>
    combat(`Q${String(index).padStart(3, "0")}`, row.id_judoka, row.id_competition, "Victoire")
  );
  db.combat_scores = db.combats.slice(0, 5).map((row) => ({
    id_combat_score: `${row.id_combat}_S0`,
    id_combat: row.id_combat,
    categorie: "Tachi-waza",
    technique: "Seoi-nage",
    type_ne_waza: "",
    valeur: "Ippon",
    ordre: 0,
    camp: "JUDOKA"
  }));

  const { result, requests: list } = await measureWithoutReset(() =>
    methods.searchCombats("coach@example.com", { opponent: "Adversaire Q199" })
  );

  const combatReads = reads(list, "combats");
  assert.ok(combatReads.length <= 3, `${combatReads.length} requêtes de combats`);
  assert.equal(combatReads.length, 2);
  combatReads.forEach((request) => assert.match(request.query, /^select=\*,combat_scores\(\*\)/));
  assert.deepEqual(reads(list, "combat_scores"), []);
  assert.equal(reads(list, "competitions").length, 2);
  // Le combat de la 200e compétition (second lot) est bien trouvé.
  assert.deepEqual(
    result.matches.map((match) => match.competitionId),
    ["S199"]
  );
});

// ---------------------------------------------------------------------------------------------
// PAGE-3, ADMIN-1
// ---------------------------------------------------------------------------------------------

test("PAGE-3 / ADMIN-1 : « Gestion des accès » lit 10 utilisateurs en 2 étapes, quel que soit l'effectif", async () => {
  const {
    result,
    scope,
    requests: list
  } = await measure(() => methods.getAdminsManagement("admin@example.com"));

  assert.equal(scope.stages, 2);
  assert.equal(scope.requests, 4);
  const judokaReads = reads(list, "judokas");
  const [identityRead, ...listReads] = judokaReads;
  assert.match(identityRead.query, /email=ilike\.admin@example\.com&limit=1$/);
  // La page d'utilisateurs est bornée à 10 ; les admins sont lus par leur filtre, jamais toute la table.
  const pageRead = listReads.find((request) => !request.query.includes("or=(role.eq.ADMIN"));
  assert.match(
    pageRead.query,
    /^select=\*&order=nom\.asc,prenom\.asc,id_judoka\.asc&limit=10&offset=0$/
  );
  const adminRead = listReads.find((request) =>
    request.query.includes("or=(role.eq.ADMIN,is_admin.is.true)")
  );
  assert.ok(adminRead);
  assert.equal(listReads.length, 2);

  assert.equal(result.users.length, 10);
  assert.equal(result.totalUsers, 36);
  assert.deepEqual(
    result.admins.map((item) => item.judokaId),
    ["ADMIN1"]
  );
  assert.equal(result.accessInvitations.length, 1);
  assert.equal(result.user.judokaId, "ADMIN1");

  // Page suivante par curseur, puis recherche envoyée au serveur.
  const next = await measureWithoutReset(() =>
    methods.getUsersPage("admin@example.com", { after: result.nextCursor })
  );
  assert.equal(next.result.users.length, 10);
  assert.equal(next.result.totalUsers, 36);
  const firstIds = new Set(result.users.map((item) => item.judokaId));
  assert.equal(
    next.result.users.some((item) => firstIds.has(item.judokaId)),
    false
  );
  reads(next.requests, "judokas")
    .filter((request) => !request.query.includes("email=ilike."))
    .forEach((request) => {
      assert.match(request.query, /limit=(10|1)&offset=0$/);
      assert.doesNotMatch(request.query, /offset=[1-9]/);
    });

  const search = await measureWithoutReset(() =>
    methods.getUsersPage("admin@example.com", { search: "nomn0" })
  );
  assert.equal(search.result.totalUsers, 9);
  assert.equal(search.result.users.length, 9);

  await assert.rejects(
    () => measure(() => methods.getAdminsManagement("coach@example.com")),
    /réservée aux admins/
  );
});

// ---------------------------------------------------------------------------------------------
// MESURE-1
// ---------------------------------------------------------------------------------------------

function signAccessToken(claims = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const signedPart = `${encode({ alg: "ES256", typ: "JWT", kid: "test-key" })}.${encode({
    iss: `${SUPABASE_URL}/auth/v1`,
    aud: "authenticated",
    email: "coach@example.com",
    exp: now + 3600,
    ...claims
  })}`;
  const signature = crypto.sign("sha256", Buffer.from(signedPart), {
    key: signingKey.privateKey,
    dsaEncoding: "ieee-p1363"
  });
  return `${signedPart}.${signature.toString("base64url")}`;
}

async function callRpc({ method = "POST", token = signAccessToken(), body } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = token ? { authorization: `Bearer ${token}` } : {};
  req.destroy = () => {};
  process.nextTick(() => {
    if (body !== undefined) {
      req.emit("data", JSON.stringify(body));
    }
    req.emit("end");
  });
  const captured = { headers: {} };
  const res = {
    setHeader: (name, value) => {
      captured.headers[name] = value;
    },
    status: (code) => {
      captured.statusCode = code;
      return {
        json: (payload) => {
          captured.body = payload;
        }
      };
    }
  };
  const logs = [];
  console.log = (line) => logs.push(line);
  try {
    await rpcHandler(req, res);
  } finally {
    console.log = originalConsoleLog;
  }
  return { ...captured, logs };
}

test("MESURE-1 : /api/rpc renvoie Server-Timing et journalise la même mesure avec le nom de la méthode", async () => {
  resetDatabase();
  requests.length = 0;

  const response = await callRpc({ body: { method: "getInitialData", args: [] } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.result.user.judokaId, "COACH1");
  const timing = response.headers["Server-Timing"];
  assert.match(timing, /(^|, )total;dur=\d+(\.\d+)?/);
  assert.match(timing, /(^|, )auth;dur=\d+(\.\d+)?/);
  assert.match(timing, /(^|, )supabase;dur=\d+(\.\d+)?;desc="\d+ req \/ \d+ etapes"/);
  const supabaseRequests = requests.filter((request) => request.table).length;
  assert.ok(timing.includes(`desc="${supabaseRequests} req / `), timing);

  assert.equal(response.logs.length, 1);
  const log = JSON.parse(response.logs[0]);
  assert.equal(log.rpc, "getInitialData");
  assert.equal(log.ok, true);
  assert.equal(log.supabaseRequests, supabaseRequests);
  assert.ok(log.supabaseStages <= 3);
  assert.equal(typeof log.totalMs, "number");
  assert.equal(typeof log.authMs, "number");
  assert.equal(typeof log.supabaseMs, "number");
  assert.ok(log.totalMs >= log.authMs);

  // AUTH-1 : un RPC ne fait aucun appel à /auth/v1/user.
  assert.equal(
    requests.some((request) => request.path === "/auth/v1/user"),
    false
  );
  requests.length = 0;
  await callRpc({ body: { method: "getInitialData", args: [] } });
  assert.equal(
    requests.some((request) => request.path.startsWith("/auth/v1/")),
    false
  );
});

test("MESURE-1 : un appel refusé est aussi mesuré, sans requête Supabase avant l'authentification", async () => {
  resetDatabase();
  requests.length = 0;

  const forged = await callRpc({
    token: `${signAccessToken().slice(0, -4)}AAAA`,
    body: { method: "getInitialData", args: [] }
  });
  assert.equal(forged.statusCode, 400);
  assert.match(forged.body.error, /Session Supabase invalide/);
  assert.match(forged.headers["Server-Timing"], /desc="0 req \/ 0 etapes"/);
  assert.equal(JSON.parse(forged.logs[0]).ok, false);
  assert.equal(requests.filter((request) => request.table).length, 0);

  const expired = await callRpc({
    token: signAccessToken({ exp: Math.floor(Date.now() / 1000) - 10 }),
    body: { method: "getInitialData", args: [] }
  });
  assert.equal(expired.statusCode, 400);
  assert.match(expired.body.error, /Session Supabase invalide/);

  const unknown = await callRpc({ body: { method: "methodeInconnue", args: [] } });
  assert.equal(unknown.statusCode, 400);
  assert.match(unknown.body.error, /Méthode inconnue/);
  assert.equal(JSON.parse(unknown.logs[0]).rpc, "inconnue");

  const wrongVerb = await callRpc({ method: "GET" });
  assert.equal(wrongVerb.statusCode, 405);
});
