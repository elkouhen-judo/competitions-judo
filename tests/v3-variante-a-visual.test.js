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
const { computeCoachDashboardStats } = require(
  path.join(root, "core-dist", "domain", "coach-dashboard-statistics.js")
);

// Variante A des écrans V3 (données fictives) : compétition club, compétition d'un judoka,
// saisie d'un combat, statistiques. V3A_SHOT=before|after préfixe les captures.
const SHOT = process.env.V3A_SHOT || "after";
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

// Huit participants : nom, ceinture, classement, victoires, défaites.
const ROSTER = [
  ["j-lea", "Léa", "Morel", "Orange", "1er", 4, 0],
  ["j-ines", "Inès", "Tavares", "Vert", "2e", 3, 1],
  ["j-jade", "Jade", "Roux", "Jaune", "3e", 2, 2],
  ["j-hugo", "Hugo", "Durand", "Orange", "", 2, 1],
  ["j-noah", "Noah", "Petit", "Blanc-Jaune", "5e", 1, 2],
  ["j-malo", "Malo", "Garnier", "Vert", "", 1, 1],
  ["j-sami", "Sami", "Touré", "Jaune", "Non classé", 0, 2],
  ["j-zoe", "Zoé", "Lambert", "Blanc", "", 0, 0]
];
const judokas = ROSTER.map(([id, first, last, belt]) =>
  person(id, first, last, { beltColor: belt })
);
const COUPE_DATE = localDate(-7);
const clubCompetition = {
  clubCompetitionId: "cc-coupe",
  name: "Coupe de Loire-Atlantique",
  competitionDate: COUPE_DATE,
  clubId: CLUB.clubId
};
const competitions = ROSTER.map(([id, , , , result]) => ({
  competitionId: `p-${id}`,
  clubCompetitionId: "cc-coupe",
  ownerJudokaId: id,
  name: clubCompetition.name,
  competitionDate: COUPE_DATE,
  ageCategory: "Minime",
  weightCategory: "-46kg",
  level: "Départemental",
  result,
  coachReview: ""
}));
const combatRecords = Object.fromEntries(
  ROSTER.filter(([, , , , , wins, losses]) => wins + losses > 0).map(
    ([id, , , , , wins, losses]) => [`p-${id}`, { total: wins + losses, wins, losses, draws: 0 }]
  )
);

const tachi = (technique, value) => ({ category: "Tachi-waza", technique, value });
// Les combats détaillés de Hugo ; les autres judokas ont des combats génériques.
const hugoCombats = [
  {
    combatId: "c-hugo-1",
    stage: "Poule",
    opponent: "Léo Martin",
    opponentStance: "Gaucher",
    result: "Victoire",
    victoryType: "Ippon",
    scores: [tachi("Seoi-nage", "Ippon")],
    concededScores: []
  },
  {
    combatId: "c-hugo-2",
    stage: "1/4",
    opponent: "Sami Benali",
    opponentStance: "Droitier",
    result: "Victoire",
    victoryType: "Waza-ari",
    scores: [tachi("O-soto-gari", "Waza-ari")],
    concededScores: []
  },
  {
    combatId: "c-hugo-3",
    stage: "1/2",
    opponent: "Tom Leroy",
    opponentStance: "Droitier",
    result: "Défaite",
    victoryType: "Waza-ari",
    scores: [],
    concededScores: [tachi("Uchi-mata", "Waza-ari")]
  }
].map((combat) => ({
  ...combat,
  competitionId: "p-j-hugo",
  judokaId: "j-hugo",
  notes: "",
  judokaGender: "Homme",
  judokaHandedness: "Droitier",
  competitionLevel: "Départemental"
}));

function combatsFor(competitionId) {
  if (competitionId === "p-j-hugo") return hugoCombats;
  const record = combatRecords[competitionId];
  if (!record) return [];
  const owner = competitions.find((c) => c.competitionId === competitionId).ownerJudokaId;
  return Array.from({ length: record.total }, (_, index) => {
    const win = index < record.wins;
    return {
      combatId: `${competitionId}-c${index}`,
      competitionId,
      judokaId: owner,
      opponent: `Adversaire ${index + 1}`,
      opponentStance: "",
      stage: "",
      result: win ? "Victoire" : "Défaite",
      victoryType: win ? (index % 2 ? "Waza-ari" : "Ippon") : "Waza-ari",
      scores: win ? [tachi(index % 2 ? "O-soto-gari" : "Seoi-nage", "Waza-ari")] : [],
      concededScores: win ? [] : [tachi("Uchi-mata", "Waza-ari")],
      notes: "",
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      competitionLevel: "Départemental"
    };
  });
}

function dashboard() {
  const allCombats = competitions.flatMap((c) => combatsFor(c.competitionId));
  return {
    stats: computeCoachDashboardStats(allCombats, competitions),
    withheld: null,
    previous: null,
    availableCompetitions: [
      {
        competitionId: "p-j-zoe",
        competitionIds: competitions.map((c) => c.competitionId),
        name: clubCompetition.name,
        competitionDate: COUPE_DATE
      }
    ]
  };
}

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
            combatRecords,
            clubCompetitions: [clubCompetition],
            clubs: [CLUB],
            judokas: [coach, ...judokas]
          };
        } else if (request.method === "getClubCompetitionDetail") {
          result = {
            clubCompetition: {
              id_club_competition: clubCompetition.clubCompetitionId,
              nom: clubCompetition.name,
              date: COUPE_DATE,
              categorie_age: "Minime",
              niveau: "Départemental",
              club_id: CLUB.clubId
            },
            participations: competitions,
            judokas,
            combatRecords
          };
        } else if (request.method === "getCompetitionDetail") {
          const competition = competitions.find((c) => c.competitionId === request.args[0]);
          result = {
            competition,
            combats: combatsFor(competition.competitionId),
            canEditCompetition: true
          };
        } else if (request.method === "getCombatSuggestions") {
          result = { opponents: ["Sami Benali"], techniques: [] };
        } else if (request.method === "getCoachDashboard") {
          result = dashboard();
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

async function openAsCoach(t, viewport) {
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
  return page;
}

async function openClubCompetition(page) {
  await page.locator("#coachTodo .todo-row").first().click();
  await page.locator("#clubCompetitionDetailView").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
}

async function openHugoCompetition(page) {
  await openClubCompetition(page);
  await page
    .locator("#clubDetailParticipantsList")
    .getByText("Hugo Durand", { exact: false })
    .first()
    .click();
  await page.locator("#competitionView").waitFor({ state: "visible" });
  await page.locator("#combatsList").getByText("Léo Martin").first().waitFor();
  await page.waitForTimeout(300);
}

for (const [name, viewport] of [
  ["mobile", { width: 375, height: 812 }],
  ["desktop", { width: 1440, height: 900 }]
]) {
  const shot = (page, step) =>
    page.screenshot({
      path: `output/playwright/v3a-${SHOT}-${name}-${step}.png`,
      fullPage: true,
      animations: "disabled"
    });

  test(`V3 A : compétition club sur ${name}`, async (t) => {
    const page = await openAsCoach(t, viewport);
    await openClubCompetition(page);
    if (ASSERT) {
      const progress = page.locator("#clubCompetitionProgress");
      await expect(progress).toContainText("5 classés sur 8");
      await expect(progress).toContainText("3 à classer");
      await expect(progress).toContainText("3 podiums · 13 V · 9 D");
      const rows = page.locator("#clubDetailParticipantsList .participant-card");
      await expect(rows).toHaveCount(8);
      await expect(rows.locator(".belt-swatch")).toHaveCount(8);
      await expect(rows.locator(".row-tag-pending")).toHaveCount(3);
      const lea = rows.filter({ hasText: "Léa Morel" });
      await expect(lea.locator(".choice-chip.choice-active")).toHaveClass(/rank-1/);
      await expect(page.locator("#clubCompetitionStatsButton")).toContainText(
        "Statistiques de la compétition"
      );
    }
    await shot(page, "01-competition-club");
  });

  test(`V3 A : compétition d'un judoka sur ${name}`, async (t) => {
    const page = await openAsCoach(t, viewport);
    await openHugoCompetition(page);
    if (ASSERT) {
      await expect(
        page.locator("#competitionView .competition-summary-pills .belt-swatch")
      ).toHaveCount(1);
      const chips = page.locator("#competitionRankingSection [role='radio']");
      await expect(chips).toHaveText(["1er", "2e", "3e", "5e", "7e", "NC"]);
      await expect(chips.last()).toHaveAttribute("aria-label", "Non classé");
      await expect(
        page.locator("#competitionView .competition-sport-summary .record-bar > span")
      ).toHaveCount(2);
      const combats = page.locator("#combatsList .combat-list .combat-card");
      await expect(combats).toHaveCount(3);
      await expect(combats.locator(".badge-technique")).toHaveText([
        "Ippon",
        "Waza-ari",
        "Waza-ari"
      ]);
      await expect(combats.first()).toContainText("Marqué");
      await expect(combats.last()).toContainText("Subi");
      await expect(combats.first().locator(".result-badge").first()).toHaveText("Victoire");
    }
    await shot(page, "02-competition-judoka");
  });

  test(`V3 A : saisie d'un combat sur ${name}`, async (t) => {
    const page = await openAsCoach(t, viewport);
    await openHugoCompetition(page);
    await page.locator("#addCombatButton").click();
    await page.locator("#combatFormView").waitFor({ state: "visible" });
    await page.locator("#combat_resultat").getByRole("radio", { name: "Victoire" }).click();
    await page.getByRole("button", { name: "Ajouter un Waza-ari au judoka" }).click();
    await page.waitForTimeout(300);
    if (ASSERT) {
      await expect(page.locator("#combatFormView .combat-more-section h3")).toContainText(
        "Adversaire et notes"
      );
      await expect(page.locator("#combat_adversaire")).toBeVisible();
    }
    await shot(page, "03-saisie-combat");
  });

  test(`V3 A : statistiques sur ${name}`, async (t) => {
    const page = await openAsCoach(t, viewport);
    await page
      .locator("#homeView")
      .getByRole("button", { name: "Statistiques", exact: true })
      .click();
    await page.locator("#coachDashboardView").waitFor({ state: "visible" });
    await page.locator("#coachDashboardWinLossBar").waitFor();
    await page.waitForTimeout(300);
    if (ASSERT) {
      await expect(page.locator("#coachDashboardView .dashboard-card").first()).toBeVisible();
      await expect(page.locator("#coachDashboardWinning .dashboard-card-title")).toContainText(
        "Comment on gagne"
      );
      const winColor = await page
        .locator("#coachDashboardWinning .bar-list .bar-fill")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.equal(winColor, "rgb(31, 107, 58)");
      // Les bulles « i » masquées n'élargissent plus l'écran.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      assert.ok(overflow <= 0, `débordement horizontal de ${overflow}px`);
    }
    await shot(page, "04-statistiques");
  });
}

test("V3 A : aucune fenêtre native du navigateur", () => {
  const sources = [
    "app-screen-competition.ts",
    "app-screen-combat-form.ts",
    "app-screen-club-competition.ts",
    "app-screen-coach-dashboard.ts"
  ].map((file) => fs.readFileSync(path.join(root, "assets", file), "utf8"));
  for (const source of sources) assert.doesNotMatch(source, /\b(alert|confirm|prompt)\(/);
});
