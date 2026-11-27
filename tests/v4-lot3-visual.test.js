/* global document, window, getComputedStyle */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// V4 lot 3 (données fictives) : agenda FFJDA et gestion des accès.
// V4_SHOT=before|after préfixe les captures.
const SHOT = process.env.V4_SHOT || "after";
const ASSERT = SHOT === "after";

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

const coach = person("coach-1", "Alex", { accessRole: "COACH", clubId: CLUB.clubId });
const EVENTS = [
  {
    eventKey: "fed:1",
    titre: "COUPE DEPARTEMENTALE BENJAMINS",
    dateDebut: localDate(8),
    dateFin: "",
    inscriptionCloture: localDate(4),
    typeEvenement: "COMPETITION",
    lieu: "Dojo",
    ville: "SAINT-HERBLAIN",
    ligue: "Pays de la Loire",
    proprietaire: "Comité LOIRE ATLANTIQUE JUDO",
    sourceUrl: "https://example.test/evenement/1",
    suggestedLevel: "Départemental",
    suggestedAgeCategory: "Benjamin"
  },
  {
    eventKey: "fed:2",
    titre: "PASSAGE DE GRADE UV2 UV3",
    dateDebut: localDate(15),
    dateFin: "",
    inscriptionCloture: "",
    typeEvenement: "GRADE",
    lieu: "Dojo",
    ville: "NANTES",
    ligue: "Pays de la Loire",
    proprietaire: "Ligue PAYS DE LA LOIRE",
    sourceUrl: "https://example.test/evenement/2",
    suggestedLevel: "",
    suggestedAgeCategory: ""
  },
  {
    eventKey: "fed:3",
    titre: "TOURNOI REGIONAL MINIMES",
    dateDebut: localDate(16),
    dateFin: "",
    inscriptionCloture: localDate(-1),
    typeEvenement: "COMPETITION",
    lieu: "Salle",
    ville: "ANGERS",
    ligue: "Pays de la Loire",
    proprietaire: "Ligue PAYS DE LA LOIRE",
    sourceUrl: "https://example.test/evenement/3",
    suggestedLevel: "Régional",
    suggestedAgeCategory: "Minime"
  }
];

function agendaScenario(request) {
  if (request.method === "getInitialData") {
    return {
      user: coach,
      isAdmin: false,
      isCoach: true,
      isParent: false,
      competitions: [],
      clubCompetitions: [],
      clubs: [CLUB],
      judokas: [coach]
    };
  }
  if (request.method === "getFfjudoEvents") {
    return { events: EVENTS, lastSyncAt: "2026-11-22T03:00:08.000Z" };
  }
  return null;
}

function adminScenario() {
  const admin = person("admin-1", "Alice", { isAdmin: true, adminAccess: true, clubId: "" });
  const users = [
    admin,
    person("j-lea", "Léa", { beltColor: "Orange" }),
    person("j-sam", "Sam", { clubId: "" }),
    person("j-tom", "Tom", { accessRole: "COACH" }),
    person("p-max", "Max", { profileType: "PARENT", clubId: "" })
  ];
  const page = (list) => ({ users: list, totalUsers: list.length, nextCursor: null });
  const invitations = [
    { email: "paul@example.com", invitedProfileType: "PARENT" },
    { email: "nina@example.com", invitedProfileType: "JUDOKA" }
  ];
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
      return { user: admin, admins: [admin], ...page(users), accessInvitations: invitations };
    }
    if (request.method === "getClubsManagement") {
      return {
        clubs: [
          { ...CLUB, coachIds: ["j-tom"], judokaCount: 2 },
          { clubId: "pole-espoir", name: "Pôle Espoir", coachIds: [], judokaCount: 0 }
        ],
        coaches: [users[3]]
      };
    }
    if (request.method === "getUsersPage") return page(users);
    return null;
  };
}

for (const [name, viewport] of [
  ["mobile", { width: 375, height: 812 }],
  ["desktop", { width: 1440, height: 900 }]
]) {
  const shot = (page, step) =>
    page.screenshot({
      path: `output/playwright/v4-lot3-${SHOT}-${name}-${step}.png`,
      fullPage: true,
      animations: "disabled"
    });
  const noOverflow = async (page) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    assert.ok(overflow <= 0, `débordement horizontal de ${overflow}px`);
  };

  test(`V4 lot 3 : agenda FFJDA sur ${name}`, async (t) => {
    const { page } = await openApp(t, agendaScenario, "alex@example.com", viewport);
    await page.locator("#homeView").getByRole("button", { name: "Agenda", exact: true }).click();
    await page.locator("#ffjudoAgendaView .agenda-card").first().waitFor();
    await page.waitForTimeout(300);
    if (ASSERT) {
      const months = page.locator("#ffjudoAgendaView .agenda-month");
      await expect(months.first().locator(".agenda-card")).toHaveCount(3);
      const panelBg = await months
        .first()
        .locator(".list")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.equal(panelBg, "rgb(255, 255, 255)");
      await noOverflow(page);
    }
    await shot(page, "01-agenda");
  });

  test(`V4 lot 3 : gestion des accès sur ${name}`, async (t) => {
    const { page } = await openApp(t, adminScenario(), "alice@example.com", viewport);
    await page.locator("#accountMenu summary").click();
    await page.getByRole("menuitem", { name: "Gestion des accès" }).click();
    await page.locator("#usersList .admin-card").first().waitFor();
    await page.waitForTimeout(300);
    if (ASSERT) {
      const rows = page.locator("#usersList .admin-card");
      await expect(rows).toHaveCount(5);
      await expect(rows.first().locator(".row-avatar")).toHaveText("AT");
      await expect(page.locator("#adminsList .admin-row .row-meta")).toHaveText(
        "alice@example.com"
      );
      await noOverflow(page);
    }
    await shot(page, "02-utilisateurs");
    const tabs = page.locator(".admin-sub-tabs");
    await tabs.getByRole("button", { name: "Clubs" }).click();
    await page.locator("#clubsList .admin-card").first().waitFor();
    await page.waitForTimeout(300);
    if (ASSERT) {
      const clubs = page.locator("#clubsList .admin-card");
      await expect(clubs).toHaveCount(2);
      await expect(clubs.first().locator(".row-meta")).toHaveText("2 judokas · Tom Test");
      await clubs.last().locator(".page-menu summary").click();
      await expect(clubs.last().getByRole("menuitem")).toHaveText(["Renommer", "Supprimer"]);
      await clubs.last().locator(".page-menu summary").click();
      await noOverflow(page);
    }
    await shot(page, "03-clubs");
    await tabs.getByRole("button", { name: "Invitations" }).click();
    await page.waitForTimeout(300);
    if (ASSERT) {
      const invitations = page.locator("#accessInvitationsList .admin-card");
      await expect(invitations).toHaveCount(2);
      await expect(invitations.first().locator(".row-title")).toHaveText("paul@example.com");
      await invitations.first().locator(".page-menu summary").click();
      await expect(invitations.first().getByRole("menuitem")).toHaveText("Annuler l'invitation");
    }
    await shot(page, "04-invitations");
    await tabs.getByRole("button", { name: "Import" }).click();
    await page.waitForTimeout(300);
    await shot(page, "05-import");
  });
}

test("V4 lot 3 : aucune fenêtre native du navigateur", () => {
  const sources = ["app-screen-admins.ts", "app-screen-ffjudo-agenda.ts"].map((file) =>
    fs.readFileSync(path.join(root, "assets", file), "utf8")
  );
  for (const source of sources) assert.doesNotMatch(source, /\b(alert|confirm|prompt)\(/);
});
