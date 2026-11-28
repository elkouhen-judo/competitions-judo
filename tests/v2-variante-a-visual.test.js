const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Variante A des écrans V2 (données fictives) : accueil coach, accueil famille, « Mon espace », fiche judoka.
// V2A_SHOT=before|after préfixe les captures pour comparer avant et après.
const SHOT = process.env.V2A_SHOT || "after";
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
      },
      json(body) {
        resolve({ statusCode: this.statusCode || 200, headers, body: JSON.stringify(body) });
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

function seasonBounds() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${start}-09-01`, end: `${start + 1}-08-31`, label: `${start}-${start + 1}` };
}

const person = (judokaId, firstName, lastName, extra = {}) => ({
  judokaId,
  accountEmail: "",
  firstName,
  lastName,
  profileType: "JUDOKA",
  accessRole: "NORMAL",
  ageCategory: "Minime",
  weightCategory: "",
  beltColor: "",
  gender: "",
  yearInCategory: "",
  handedness: "",
  clubId: CLUB.clubId,
  registrationSeason: 2099,
  ...extra
});

const participation = (competitionId, ownerJudokaId, name, date, extra = {}) => ({
  competitionId,
  clubCompetitionId: null,
  ownerJudokaId,
  name,
  competitionDate: date,
  ageCategory: "Minime",
  weightCategory: "",
  level: "Départemental",
  result: "",
  coachReview: "",
  ...extra
});

function coachFixture({ empty = false } = {}) {
  const coach = person("coach-1", "Alex", "Martin", {
    accountEmail: "coach@example.com",
    accessRole: "COACH",
    ageCategory: "Senior",
    clubId: ""
  });
  const judokas = [
    person("j-hugo", "Hugo", "Durand", { beltColor: "Orange" }),
    person("j-ines", "Inès", "Test", { beltColor: "Vert" }),
    person("j-sam", "Sam", "Test", { beltColor: "Jaune-Orange" }),
    ...["Nina", "Tom", "Lou", "Max", "Zoé"].map((name, index) => person(`j-${index}`, name, "Test"))
  ];
  if (empty) {
    return {
      user: coach,
      isCoach: true,
      competitions: [],
      clubCompetitions: [],
      clubs: [CLUB],
      judokas: [coach, ...judokas]
    };
  }
  const noel = localDate(4);
  const coupe = localDate(-7);
  const reze = localDate(-24);
  const dept = localDate(-14);
  const clubCompetitions = [
    {
      clubCompetitionId: "cc-noel",
      name: "Interclubs de Noël",
      competitionDate: noel,
      clubId: CLUB.clubId
    },
    {
      clubCompetitionId: "cc-coupe",
      name: "Coupe de Loire-Atlantique",
      competitionDate: coupe,
      clubId: CLUB.clubId
    },
    {
      clubCompetitionId: "cc-dept",
      name: "Championnat départemental",
      competitionDate: dept,
      clubId: CLUB.clubId
    },
    {
      clubCompetitionId: "cc-reze",
      name: "Tournoi de Rezé",
      competitionDate: reze,
      clubId: CLUB.clubId
    }
  ];
  const linked = (id, ccId, owner, extra) => {
    const cc = clubCompetitions.find((item) => item.clubCompetitionId === ccId);
    return participation(id, owner, cc.name, cc.competitionDate, {
      clubCompetitionId: ccId,
      ...extra
    });
  };
  const competitions = [
    ...judokas.map((j, index) => linked(`p-noel-${index}`, "cc-noel", j.judokaId)),
    linked("p-coupe-hugo", "cc-coupe", "j-hugo"),
    linked("p-coupe-sam", "cc-coupe", "j-sam"),
    linked("p-dept-ines", "cc-dept", "j-ines", { result: "2e" }),
    linked("p-dept-sam", "cc-dept", "j-sam", { result: "1er" }),
    linked("p-reze-hugo", "cc-reze", "j-hugo", { result: "3e" }),
    linked("p-reze-ines", "cc-reze", "j-ines")
  ];
  return {
    user: coach,
    isCoach: true,
    competitions,
    clubCompetitions,
    clubs: [CLUB],
    judokas: [coach, ...judokas]
  };
}

const hugo = person("c-hugo", "Hugo", "Durand", {
  beltColor: "Orange",
  weightCategory: "-46kg",
  yearInCategory: "1",
  handedness: "Droitier",
  gender: "Homme"
});
const lea = person("c-lea", "Léa", "Durand", {
  ageCategory: "Benjamin",
  beltColor: "Jaune",
  gender: "Femme"
});

function hugoCompetitions() {
  return [
    participation("h-noel", "c-hugo", "Interclubs de Noël", localDate(4)),
    participation("h-coupe", "c-hugo", "Coupe de Loire-Atlantique", localDate(-7)),
    participation("h-reze", "c-hugo", "Tournoi de Rezé", localDate(-24), { result: "3e" })
  ];
}
const hugoRecords = {
  "h-coupe": { total: 1, wins: 0, losses: 1, draws: 0 },
  "h-reze": { total: 3, wins: 2, losses: 1, draws: 0 }
};

function parentFixture() {
  const parent = person("p1", "Claire", "Durand", {
    accountEmail: "parent@example.com",
    profileType: "PARENT",
    clubId: ""
  });
  return {
    user: parent,
    isParent: true,
    competitions: hugoCompetitions(),
    combatRecords: hugoRecords,
    clubCompetitions: [],
    judokas: [parent, hugo, lea]
  };
}

function judokaFixture() {
  const self = { ...hugo, accountEmail: "hugo@example.com" };
  return {
    user: self,
    competitions: hugoCompetitions(),
    combatRecords: hugoRecords,
    clubCompetitions: [],
    judokas: [self]
  };
}

function hugoProfile(judoka) {
  const result = (competitionId, name, offset, value, record, isUpcoming = false) => ({
    competitionId,
    name,
    competitionDate: localDate(offset),
    result: value,
    category: "Minime",
    weightCategory: "-46kg",
    resultBadge: {
      label: value || "Non classé",
      className: value === "3e" ? "rank-bronze" : "rank-unclassified"
    },
    combatRecord: record,
    isUpcoming
  });
  return {
    judoka,
    season: seasonBounds(),
    lastCompetition: null,
    victoriesByDecisionType: [{ decisionType: "Ippon", count: 2, total: 2, rate: 100 }],
    defeatsByDecisionType: [{ decisionType: "Waza-ari", count: 2, total: 2, rate: 100 }],
    topWinTechniques: [{ technique: "Seoi-nage", count: 2 }],
    competitionResults: [
      result(
        "h-noel",
        "Interclubs de Noël",
        4,
        "",
        { total: 0, wins: 0, losses: 0, draws: 0 },
        true
      ),
      result("h-coupe", "Coupe de Loire-Atlantique", -7, "", hugoRecords["h-coupe"]),
      result("h-reze", "Tournoi de Rezé", -24, "3e", hugoRecords["h-reze"])
    ],
    seasonCombatCount: 4,
    seasonCompetitionCount: 2,
    seasonWins: 2,
    seasonLosses: 2,
    seasonDraws: 0,
    victoryRate: 50
  };
}

async function startServer(fixture) {
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
            isAdmin: false,
            isCoach: false,
            isParent: false,
            combatRecords: {},
            ...fixture
          };
        } else if (request.method === "getJudokaProfile") {
          const target =
            fixture.judokas.find((j) => j.judokaId === request.args[0]) || fixture.user;
          result = hugoProfile(target);
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

async function openAs(t, fixture, viewport) {
  const { server, url } = await startServer(fixture);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)),
    {
      access_token: tokenFor(fixture.user.accountEmail),
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

for (const [name, viewport] of [
  ["mobile", { width: 375, height: 812 }],
  ["desktop", { width: 1440, height: 900 }]
]) {
  const shot = (page, step) =>
    page.screenshot({
      path: `output/playwright/v2a-${SHOT}-${name}-${step}.png`,
      fullPage: true,
      animations: "disabled"
    });

  test(`V2 A : accueil coach sur ${name}`, async (t) => {
    const page = await openAs(t, coachFixture(), viewport);
    await page.waitForTimeout(300);
    if (ASSERT) {
      const hero = page.locator("#coachNextCompetition");
      await expect(hero).toContainText("Interclubs de Noël");
      await expect(hero).toContainText("J-4");
      await expect(hero).toContainText("8 inscrits");
      await expect(hero.locator(".avatar-stack .avatar")).toHaveCount(3);
      await expect(hero.locator(".avatar-stack-more")).toHaveText("+5");
      const todo = page.locator("#coachTodo");
      await expect(todo.locator(".todo-row")).toHaveCount(2);
      await expect(todo.locator(".section-count")).toHaveText("3");
      await expect(todo.locator(".todo-row").first()).toContainText("2 classements à saisir");
      const podiums = page.locator("#coachPodiums .podium-row");
      await expect(podiums).toHaveCount(3);
      // Même date : le 1er avant le 2e, puis le podium plus ancien.
      await expect(podiums.locator(".row-title")).toHaveText([
        "Sam Test",
        "Inès Test",
        "Hugo Durand"
      ]);
      await expect(podiums.locator(".medal-dot")).toHaveText(["1", "2", "3"]);
      await expect(podiums.first().locator(".belt-swatch")).toHaveCount(1);
      await expect(page.locator("#coachGreeting")).toContainText("3 classements vous attendent");
    }
    await shot(page, "01-accueil-coach");
    if (ASSERT) {
      await page.locator("#coachNextCompetition").click();
      await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();
    }
  });

  test(`V2 A : accueil coach vide sur ${name}`, async (t) => {
    const page = await openAs(t, coachFixture({ empty: true }), viewport);
    await page.waitForTimeout(300);
    if (ASSERT) {
      await expect(page.locator("#coachNextCompetition")).toHaveCount(0);
      await expect(page.locator(".coach-agenda .empty-action-title")).toHaveText("Rien en attente");
    }
    await shot(page, "02-accueil-coach-vide");
  });

  test(`V2 A : accueil famille sur ${name}`, async (t) => {
    const page = await openAs(t, parentFixture(), viewport);
    await page.waitForTimeout(300);
    if (ASSERT) {
      const cards = page.locator("#homeChildPills [role='radio']");
      await expect(cards).toHaveCount(2);
      await expect(cards.first()).toContainText("Hugo");
      await expect(cards.first()).toContainText("Minime · Orange");
      await expect(cards.first().locator(".child-card-avatar[style*='--belt-ring']")).toHaveCount(
        1
      );
      await expect(page.locator("#homePendingRanking")).toContainText("Coupe de Loire-Atlantique");
      // Revue A : mêmes places que sur la compétition, « NC » compris, sur une ligne.
      const places = page.locator("#homePendingRanking .choice-chip");
      await expect(places).toHaveText(["1er", "2e", "3e", "5e", "7e", "NC"]);
      await expect(places.last()).toHaveAttribute("aria-label", "Non classé");
      await expect(page.locator("#homePendingRanking")).toHaveCSS("border-top-style", "dashed");
      const tops = await places.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().top)
      );
      assert.equal(new Set(tops.map(Math.round)).size, 1);
      await expect(page.locator("#homeNextCompetition")).toContainText("J-4");
      const season = page.locator("#homeSeasonSummary");
      await expect(season).toContainText("La saison de Hugo");
      await expect(season.locator(".record-bar-legend")).toHaveText(/2 victoires\s*2 défaites/);
      const past = page.locator("#competitionsList .result-row");
      await expect(past).toHaveCount(2);
      await expect(past.filter({ hasText: "Tournoi de Rezé" }).locator(".medal-dot")).toHaveText(
        "3"
      );
      await expect(
        past.filter({ hasText: "Coupe de Loire-Atlantique" }).locator(".medal-dot-pending")
      ).toHaveCount(1);
    }
    await shot(page, "03-accueil-famille");
    if (ASSERT) {
      // Léa (ceinture jaune) n'a aucune compétition : bilan sans chiffres et état vide.
      await page.locator("#homeChildPills [role='radio']").nth(1).click();
      await expect(page.locator("#homeNextCompetition")).toHaveCount(0);
      await expect(page.locator("#homeSeasonSummary")).toContainText("La saison de Léa");
      await expect(page.locator("#homeSeasonSummary .season-stats")).toHaveCount(0);
      await expect(
        page
          .locator("#homeChildPills [role='radio']")
          .nth(1)
          .locator(".child-card-avatar[style*='--belt-ring']")
      ).toHaveCount(1);
      await expect(page.locator("#competitionsList .empty-action-title")).toHaveText(
        "Aucune compétition"
      );
      await shot(page, "04-accueil-famille-vide");
    }
  });

  test(`V2 A : « Mon espace » judoka sur ${name}`, async (t) => {
    const page = await openAs(t, judokaFixture(), viewport);
    await page.waitForTimeout(300);
    if (ASSERT) {
      await expect(page.locator("#homeSeasonSummary")).toContainText("Ma saison");
      await expect(page.locator("#homeNextCompetition")).toContainText("Interclubs de Noël");
    }
    await shot(page, "05-mon-espace");
  });

  test(`V2 A : fiche judoka sur ${name}`, async (t) => {
    const page = await openAs(t, parentFixture(), viewport);
    await page.locator("#homeProfileLink").click();
    await page.locator("#judokaView").waitFor({ state: "visible" });
    await page.waitForTimeout(300);
    if (ASSERT) {
      const hero = page.locator("#judokaHero");
      await expect(hero.locator("h3")).toHaveText("Hugo Durand");
      await expect(hero).toContainText("Ceinture orange");
      await expect(hero.locator(".profile-facts dt")).toHaveText([
        "Catégorie",
        "Année",
        "Poids",
        "Garde"
      ]);
      await expect(hero.locator(".profile-facts dd")).toHaveText([
        "Minime",
        "1re année",
        "-46 kg",
        "Droitier"
      ]);
      await expect(page.locator("#judokaSeasonTabs [aria-checked='true']")).toHaveText(
        seasonBounds().label
      );
      await expect(page.locator("#judokaVictoryRate")).toHaveText("50 %");
      const endings = page.locator("#judokaCombatEndings");
      await expect(endings).toContainText("Gagnés");
      await expect(endings).toContainText("Ippon");
      await expect(endings).toContainText("Perdus");
      await expect(endings).toContainText("Waza-ari");
      const rows = page.locator("#judokaCompetitionResults .result-row");
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).toContainText("J-4");
      await expect(rows.nth(1)).toContainText("À saisir");
      await expect(rows.nth(2).locator(".medal-dot")).toHaveText("3");
    }
    await shot(page, "06-fiche");
  });
}

test("V2 A : aucune fenêtre native du navigateur", () => {
  // Garde-fou : les nouveaux blocs n'appellent jamais alert/confirm/prompt (UIX-038).
  const sources = ["app-screen-home.ts", "app-screen-judoka.ts"].map((file) =>
    fs.readFileSync(path.join(root, "assets", file), "utf8")
  );
  for (const source of sources) assert.doesNotMatch(source, /\b(alert|confirm|prompt)\(/);
});
