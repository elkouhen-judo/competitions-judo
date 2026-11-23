const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Revue des parcours par profil (données fictives) : ADMIN-1, ADMIN-2, PART-1, FAM-1.

const CLUB = { clubId: "club-nantes", name: "Judo Club Nantes" };

function tokenFor(email) {
  return `header.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.signature`;
}

function callHandler(handler, req) {
  return new Promise((resolve) => {
    const headers = {};
    handler(req, {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(body) {
        resolve({ statusCode: this.statusCode || 200, headers, body: String(body) });
      }
    });
  });
}

function localDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const person = (judokaId, firstName, extra = {}) => ({
  judokaId,
  firstName,
  lastName: "Test",
  accountEmail: `${firstName.toLowerCase()}@example.com`,
  profileType: "JUDOKA",
  accessRole: "NORMAL",
  ageCategory: "Minime",
  clubId: CLUB.clubId,
  registrationSeason: 2026,
  ...extra
});

async function startServer(scenario) {
  const rpc = [];
  const server = http.createServer(async (req, res) => {
    const route = req.url.split("?")[0];
    if (route === "/api/client") {
      const result = await callHandler(clientHandler, req);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }
    if (route === "/api/styles") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      res.end(fs.readFileSync(path.join(root, "assets", "app.css"), "utf8"));
      return;
    }
    if (route === "/api/rpc") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const request = JSON.parse(body || "{}");
        rpc.push(request);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result: scenario(request) }));
      });
      return;
    }
    if (route === "/") {
      const runtime = `window.KIROKU_RUNTIME_CONFIG={runtime:"vercel",appUrl:${JSON.stringify(`http://127.0.0.1:${server.address().port}`)},supabaseUrl:"http://supabase.test",supabaseAnonKey:"anon-key"};`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderIndexHtml().replace("</head>", `<script>${runtime}</script></head>`));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}`, rpc };
}

async function openApp(t, scenario, email, viewport) {
  const { server, url, rpc } = await startServer(scenario);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)),
    {
      access_token: tokenFor(email),
      refresh_token: "",
      expires_at: Math.floor(Date.now() / 1000) + 3600
    }
  );
  const page = await context.newPage();
  const nativeDialogs = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  t.after(async () => {
    assert.deepEqual(nativeDialogs, []);
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  await page.goto(url);
  await page.locator("#homeView").waitFor({ state: "visible" });
  return { page, rpc };
}

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 375, height: 812 }]
];

function adminScenario() {
  const admin = person("admin-1", "Alice", {
    accessRole: "NORMAL",
    isAdmin: true,
    adminAccess: true,
    clubId: ""
  });
  const users = [
    admin,
    person("j-lea", "Léa"),
    person("j-sam", "Sam", { clubId: "" }),
    person("j-tom", "Tom", { accessRole: "COACH" }),
    person("p-max", "Max", { profileType: "PARENT", clubId: "" })
  ];
  const page = (list) => ({ users: list, totalUsers: list.length, nextCursor: null });
  return (request) => {
    if (request.method === "getInitialData") {
      return {
        user: admin,
        isAdmin: true,
        isCoach: false,
        isParent: false,
        competitions: [],
        clubCompetitions: [],
        clubs: [],
        judokas: [admin]
      };
    }
    if (request.method === "getAdminsManagement") {
      return { user: admin, admins: [admin], ...page(users), accessInvitations: [] };
    }
    if (request.method === "getClubsManagement") {
      return { clubs: [{ ...CLUB, coachIds: ["j-tom"], judokaCount: 2 }], coaches: [users[3]] };
    }
    if (request.method === "getUsersPage") {
      const filter = request.args[0].filter;
      if (filter === "noClub")
        return page(
          users.filter((user) => user.profileType === "JUDOKA" && !user.clubId && user !== admin)
        );
      if (filter === "notRegistered") return page([]);
      return page(users);
    }
    if (request.method === "grantCoachRole" || request.method === "revokeCoachRole") {
      return {
        success: true,
        message: request.method === "grantCoachRole" ? "Rôle coach accordé." : "Rôle coach retiré."
      };
    }
    return null;
  };
}

for (const [name, viewport] of VIEWPORTS) {
  test(`ADMIN-1 / ADMIN-2 : l'admin filtre les judokas et gère le rôle coach sur ${name}`, async (t) => {
    const { page, rpc } = await openApp(t, adminScenario(), "alice@example.com", viewport);
    await page.locator("#accountMenu summary").click();
    await page.getByRole("menuitem", { name: "Gestion des accès" }).click();
    await expect(page.locator("#adminsView")).toBeVisible();
    const cards = page.locator("#usersList .admin-card");
    await expect(cards).toHaveCount(5);

    // ADMIN-2 : « Sans club » part au serveur et ne garde que les judokas sans club.
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Sans club" }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Sam Test");
    assert.equal(rpc.filter((r) => r.method === "getUsersPage").at(-1).args[0].filter, "noClub");
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-01-sans-club.png`,
      fullPage: true,
      animations: "disabled"
    });
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Non réinscrits" }).click();
    await expect(page.locator("#usersList .empty-state")).toHaveText(
      "Tous les judokas sont réinscrits pour la saison en cours."
    );
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Tous" }).click();
    await expect(cards).toHaveCount(5);

    // ADMIN-1 : nommer coach un judoka ; jamais un parent.
    const card = (fullName) => cards.filter({ hasText: fullName });
    await card("Léa Test").locator(".card-menu summary").click();
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-02-nommer-coach.png`,
      animations: "disabled"
    });
    await card("Léa Test").getByRole("menuitem", { name: "Nommer coach" }).click();
    await expect
      .poll(() => rpc.filter((r) => r.method === "grantCoachRole").map((r) => r.args[0]))
      .toEqual(["j-lea"]);
    await expect(card("Max Test").getByRole("menuitem", { name: "Nommer coach" })).toHaveCount(0);

    // Retirer le rôle coach demande confirmation dans l'appli.
    await card("Tom Test").locator(".card-menu summary").click();
    await card("Tom Test").getByRole("menuitem", { name: "Retirer le rôle coach" }).click();
    await expect(page.locator("#confirmDialog")).toBeVisible();
    await expect(page.locator("#confirmDialogConfirm")).toHaveText("Retirer le rôle coach");
    await page.locator("#confirmDialogConfirm").click();
    await expect
      .poll(() => rpc.filter((r) => r.method === "revokeCoachRole").map((r) => r.args[0]))
      .toEqual(["j-tom"]);
  });
}

function familyScenario({ childClubId }) {
  const parent = person("p-1", "Claire", { profileType: "PARENT", clubId: "" });
  const child = person("j-hugo", "Hugo", { clubId: childClubId, accountEmail: "" });
  const linked = {
    competitionId: "p-hugo",
    clubCompetitionId: "cc-1",
    ownerJudokaId: "j-hugo",
    name: "Coupe d'automne",
    competitionDate: localDate(-1),
    ageCategory: "Minime",
    weightCategory: "",
    level: "Régional",
    result: "",
    coachReview: ""
  };
  return (request) => {
    if (request.method === "getInitialData") {
      return {
        user: parent,
        isAdmin: false,
        isCoach: false,
        isParent: true,
        competitions: childClubId ? [linked] : [],
        combatRecords: {},
        clubCompetitions: [],
        clubs: [],
        judokas: [parent, child]
      };
    }
    if (request.method === "getCompetitionDetail") {
      return { competition: linked, combats: [], canEditCompetition: true };
    }
    return null;
  };
}

for (const [name, viewport] of VIEWPORTS) {
  test(`FAM-1 : un enfant sans club dit pourquoi il n'a aucune compétition sur ${name}`, async (t) => {
    const { page } = await openApp(
      t,
      familyScenario({ childClubId: "" }),
      "claire@example.com",
      viewport
    );
    await expect(page.locator("#competitionsList .empty-action-body")).toHaveText(
      "Hugo n'est rattaché à aucun club : aucun coach ne peut l'inscrire. Demandez au club de le rattacher."
    );
    await page.screenshot({
      path: `output/playwright/profiles-family-${name}-01-sans-club.png`,
      fullPage: true,
      animations: "disabled"
    });
  });

  test(`PART-1 : une participation à une compétition club ne se supprime pas depuis sa fiche sur ${name}`, async (t) => {
    const { page } = await openApp(
      t,
      familyScenario({ childClubId: CLUB.clubId }),
      "claire@example.com",
      viewport
    );
    await page.getByRole("button", { name: /Coupe d'automne/ }).click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await page.locator("#competitionAdminActions summary").click();
    await expect(page.getByRole("menuitem", { name: "Modifier la compétition" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Supprimer la compétition" })).toHaveCount(0);
    await page.screenshot({
      path: `output/playwright/profiles-family-${name}-02-menu.png`,
      animations: "disabled"
    });
  });
}

test("FAM-1 : un judoka sans club le lit dans « Mon espace »", async (t) => {
  const judoka = person("j-ines", "Inès", { clubId: "" });
  const { page } = await openApp(
    t,
    (request) =>
      request.method === "getInitialData"
        ? {
            user: judoka,
            isAdmin: false,
            isCoach: false,
            isParent: false,
            competitions: [],
            clubCompetitions: [],
            clubs: [],
            judokas: [judoka]
          }
        : null,
    "inès@example.com",
    { width: 375, height: 812 }
  );
  await expect(page.locator("#competitionsList .empty-action-body")).toHaveText(
    "Vous n'êtes rattaché à aucun club : aucun coach ne peut vous inscrire. Demandez au club de vous rattacher."
  );
  await page.screenshot({
    path: "output/playwright/profiles-judoka-mobile-01-sans-club.png",
    fullPage: true,
    animations: "disabled"
  });
});
