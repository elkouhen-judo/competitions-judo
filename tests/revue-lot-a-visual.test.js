const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Revue A (données fictives) : haut des onglets coach et couleur du choix actif.
const SHOT = "after";

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

const person = (judokaId, firstName, lastName, extra = {}) => ({
  judokaId,
  accountEmail: "",
  firstName,
  lastName,
  profileType: "JUDOKA",
  accessRole: "NORMAL",
  ageCategory: "Minime",
  weightCategory: "-46kg",
  beltColor: "",
  gender: "Homme",
  yearInCategory: "",
  handedness: "Droitier",
  clubId: CLUB.clubId,
  registrationSeason: 2099,
  ...extra
});

const coach = person("coach-1", "Alex", "Martin", {
  accountEmail: "coach@example.com",
  accessRole: "COACH",
  ageCategory: "Senior",
  clubId: ""
});

const ROSTER = [
  ["j-hugo", "Hugo", "Durand", "Orange", "Minime", "-46kg", "1", 2099],
  ["j-malo", "Malo", "Garnier", "Vert", "Minime", "-50kg", "2", 2099],
  ["j-zoe", "Zoé", "Lambert", "Blanc", "Minime", "-44kg", "", 2020],
  ["j-lea", "Léa", "Morel", "Orange", "Minime", "-48kg", "2", 2099],
  ["j-noah", "Noah", "Petit", "Blanc-Jaune", "Benjamin", "-38kg", "", 2099],
  ["j-jade", "Jade", "Roux", "Jaune", "Benjamin", "-40kg", "", 2099],
  ["j-ines", "Inès", "Tavares", "Vert", "Minime", "-52kg", "1", 2099],
  ["j-sami", "Sami", "Touré", "Jaune", "Benjamin", "-34kg", "", 2020]
];
const judokas = ROSTER.map(([id, first, last, belt, age, weight, year, season]) =>
  person(id, first, last, {
    beltColor: belt,
    ageCategory: age,
    weightCategory: weight,
    yearInCategory: year,
    registrationSeason: season
  })
);
const cc = (id, name, offset) => ({
  clubCompetitionId: id,
  name,
  competitionDate: localDate(offset),
  clubId: CLUB.clubId
});
const clubCompetitions = [
  cc("cc-noel", "Interclubs de Noël", 2),
  cc("cc-herblain", "Tournoi de Saint-Herblain", 15),
  cc("cc-coupe", "Coupe de Loire-Atlantique", -7),
  cc("cc-dept", "Championnat départemental", -13),
  cc("cc-reze", "Tournoi de Rezé", -24)
];
const entry = (ccId, owner, result = "") => {
  const event = clubCompetitions.find((item) => item.clubCompetitionId === ccId);
  return {
    competitionId: `${ccId}-${owner}`,
    clubCompetitionId: ccId,
    ownerJudokaId: owner,
    name: event.name,
    competitionDate: event.competitionDate,
    ageCategory: "Minime",
    weightCategory: "",
    level: "Départemental",
    result,
    coachReview: ""
  };
};
const competitions = [
  entry("cc-noel", "j-hugo"),
  entry("cc-noel", "j-lea"),
  entry("cc-herblain", "j-noah"),
  entry("cc-coupe", "j-hugo"),
  entry("cc-coupe", "j-lea", "1er"),
  entry("cc-coupe", "j-ines", "3e"),
  entry("cc-dept", "j-malo", "2e"),
  entry("cc-dept", "j-ines", "Non classé"),
  entry("cc-reze", "j-hugo"),
  entry("cc-reze", "j-jade", "5e")
];

async function startServer() {
  const server = http.createServer(async (req, res) => {
    if (req.url.split("?")[0] === "/api/client") {
      const response = await callHandler(clientHandler, req);
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
      return;
    }
    if (req.url.split("?")[0] === "/api/styles") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      res.end(fs.readFileSync(path.join(root, "assets", "app.css"), "utf8"));
      return;
    }
    if (req.url === "/api/rpc") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const request = JSON.parse(body || "{}");
        let result = null;
        if (request.method === "getInitialData") {
          result = {
            user: coach,
            isAdmin: false,
            isCoach: true,
            isParent: false,
            competitions,
            combatRecords: {},
            clubCompetitions,
            clubs: [CLUB],
            judokas: [coach, ...judokas]
          };
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result }));
      });
      return;
    }
    if (req.url === "/" || req.url.startsWith("/?")) {
      const runtime = `window.KIROKU_RUNTIME_CONFIG={runtime:"vercel",appUrl:"http://127.0.0.1:${server.address().port}",supabaseUrl:"http://supabase.test",supabaseAnonKey:"anon-key"};`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderIndexHtml().replace("</head>", `<script>${runtime}</script></head>`));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function openTab(t, viewport, label) {
  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)),
    {
      access_token: tokenFor(coach.accountEmail),
      refresh_token: "",
      expires_at: Math.floor(Date.now() / 1000) + 3600
    }
  );
  const page = await context.newPage();
  t.after(async () => {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  await page.goto(url);
  await page.locator("#homeView").waitFor({ state: "visible" });
  await page.locator("#homeView").getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(400);
  return page;
}

for (const [name, viewport] of [
  ["mobile", { width: 375, height: 812 }],
  ["desktop", { width: 1440, height: 900 }]
]) {
  const shot = (page, step) =>
    page.screenshot({
      path: `output/playwright/revueA-${SHOT}-${name}-${step}.png`,
      fullPage: true,
      animations: "disabled"
    });

  test(`Revue A : le haut des onglets Judokas et Compétitions sur ${name}`, async (t) => {
    const page = await openTab(t, viewport, "Judokas");
    await expect(page.locator("#homeView .tab-title")).toHaveText("Judokas");
    await expect(page.locator("#homeFilterLabel")).toHaveClass(/sr-only/);
    await expect(page.locator("#homeAdminActions")).toBeHidden();
    await page
      .locator("#homeView")
      .getByRole("button", { name: "Compétitions", exact: true })
      .click();
    const title = page.locator("#homeClubCompetitionsSection .tab-title-row");
    await expect(title.locator(".tab-title")).toHaveText("Compétitions");
    await expect(title.locator("#addClubCompetitionButton")).toHaveText("Nouvelle");
    const box = await page.locator("#addClubCompetitionButton").boundingBox();
    assert.ok(box.height >= 44, `bouton de ${box.height}px`);
    await shot(page, "tabs-competitions");
  });

  test(`Revue A : un choix actif est bleu nuit sur ${name}`, async (t) => {
    const page = await openTab(t, viewport, "Compétitions");
    await page.locator("#addClubCompetitionButton").click();
    const level = page.locator("#club_competition_niveau").getByRole("radio", { name: "Régional" });
    await level.click();
    await page.locator("#club_competition_name").click();
    await expect(level).toHaveCSS("background-color", "rgb(14, 26, 43)");
  });
}

test("Revue A : aucune fenêtre native du navigateur", () => {
  const source = fs.readFileSync(path.join(root, "assets", "app-screen-home.ts"), "utf8");
  assert.doesNotMatch(source, /\b(alert|confirm|prompt)\(/);
});
