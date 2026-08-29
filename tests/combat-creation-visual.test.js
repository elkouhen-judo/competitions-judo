const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

function tokenFor(email) {
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return `header.${payload}.signature`;
}

function callHandler(handler, req) {
  return new Promise((resolve) => {
    const headers = {};
    const response = {
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
    };
    handler(req, response);
  });
}

async function startServer() {
  const user = {
    judokaId: "combat-flow-judoka",
    accountEmail: "combat-flow@example.com",
    firstName: "Léa",
    lastName: "Martin",
    profileType: "JUDOKA",
    accessRole: "NORMAL",
    ageCategory: "Senior",
    weightCategory: "-63 kg",
    beltColor: "Marron",
    gender: "Fille",
    yearInCategory: 2,
    handedness: "Droitier"
  };
  const competition = {
    competitionId: "combat-flow-competition",
    clubCompetitionId: null,
    ownerJudokaId: user.judokaId,
    name: "Tournoi régional de Paris",
    competitionDate: "2026-06-14",
    ageCategory: "Senior",
    weightCategory: "-63 kg",
    level: "Régional",
    result: null,
    coachObjective: "",
    coachReview: ""
  };
  let combats = [];
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/client") {
      const result = await callHandler(clientHandler, req);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }
    if (req.url === "/api/styles") {
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
          result = { user, isAdmin: false, isCoach: false, isParent: false, competitions: [competition], clubCompetitions: [], judokas: [user] };
        } else if (request.method === "getCompetitionDetail") {
          result = { competition, combats, canEditCompetition: true, canFinalizeCompetition: true, canDeleteCompetition: true };
        } else if (request.method === "ajouterCombat") {
          const input = request.args[0];
          const combat = {
            ...input,
            combatId: "combat-flow-combat",
            resultClass: "result-v",
            scoreLabels: (input.scores || []).map((score) => `${score.category} · ${score.value}`),
            judokaDisplayName: "Léa Martin",
            dataQualityIssues: []
          };
          combats = [combat];
          result = { success: true, message: "Combat enregistré." };
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result }));
      });
      return;
    }
    if (req.url === "/" || req.url.startsWith("/?")) {
      const runtime = `window.KIROKU_RUNTIME_CONFIG={runtime:"vercel",appUrl:${JSON.stringify(`http://127.0.0.1:${server.address().port}`)},supabaseUrl:"http://supabase.test",supabaseAnonKey:"anon-key"};`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderIndexHtml().replace("</head>", `<script>${runtime}</script></head>`));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}`, competition };
}

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  test(`parcours visuel de création d'un combat sur ${name}`, async (t) => {
    const { server, url, competition } = await startServer();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    await context.addInitScript((session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)), {
      access_token: tokenFor("combat-flow@example.com"),
      refresh_token: "",
      expires_at: Math.floor(Date.now() / 1000) + 3600
    });
    const page = await context.newPage();
    t.after(async () => {
      await context.close();
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    });

    const shot = (step) => page.screenshot({ path: `output/playwright/combat-flow-${name}-${step}.png`, fullPage: true });
    await page.goto(url);
    await page.locator("#homeView").waitFor({ state: "visible" });
    await expect(page.getByText(competition.name, { exact: true })).toBeVisible();
    await shot("01-home");

    await page.getByRole("button", { name: competition.name }).click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await shot("02-competition");

    await page.getByRole("button", { name: "Ajouter un combat" }).click();
    await expect(page.locator("#combatFormView")).toBeVisible();
    await expect(page.locator("#combatFormView .combat-quick-section")).toHaveCSS(
      "border-left-color",
      "rgb(225, 230, 235)"
    );
    if (name === "desktop") {
      await expect(page.locator("#combatFormView .form-actions")).toHaveCSS("flex-direction", "row");
    }
    await shot("03-form-empty");

    await page.selectOption("#combat_resultat", "Victoire");
    await page.selectOption("#combat_type_victoire", "Ippon");
    await page.fill("#combat_adversaire", "Camille Durand");
    await page.selectOption("#combat_garde_adversaire", "Gaucher");
    await page.getByRole("button", { name: "+ Ajouter une technique" }).click();
    await page.locator(".combat-score-row select").nth(0).selectOption("Tachi-waza");
    await page.locator(".combat-score-row input").fill("O-soto-gari");
    await page.locator(".combat-score-row select").nth(1).selectOption("Ippon");
    await page.fill("#combat_deroule", "Ippon sur o-soto-gari");
    const borderlessLabels = await page.locator(
      ".form-section-heading h3, .stat-label, .meta-label, label:not(.checkbox-row), .combat-section-kicker, .combat-score-row-title"
    ).evaluateAll((elements) =>
      elements
        .filter((element) => Number.parseFloat(getComputedStyle(element).borderLeftWidth) === 0)
        .map((element) => element.textContent.trim())
    );
    assert.deepEqual(borderlessLabels, []);
    const actionOverlap = await page.evaluate(() => {
      const actions = document.querySelector("#combatFormView .mobile-action-bar").getBoundingClientRect();
      const notes = document.querySelector("#combat_deroule").getBoundingClientRect();
      return actions.top < notes.bottom && actions.bottom > notes.top;
    });
    assert.equal(actionOverlap, false);
    await shot("04-form-filled");

    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await expect(page.getByText("Camille Durand · Gaucher", { exact: true })).toBeVisible();
    await expect(page.getByText("O-soto-gari · Ippon", { exact: true })).toBeVisible();
    await expect(page.getByText("Combat enregistré.", { exact: true })).toBeVisible();
    await shot("05-saved");
  });
}
