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
      "background-color",
      "rgb(255, 255, 255)"
    );
    if (name === "desktop") {
      await expect(page.locator("#combatFormView .form-actions")).toHaveCSS("flex-direction", "row");
    }
    await shot("03-form-empty");

    // Saisie rapide sans menu déroulant : étape, résultat et fin du combat se choisissent en un geste.
    assert.equal(await page.locator("#combatFormView .combat-quick-section select").count(), 0);
    await page.locator("#combat_etape").getByRole("radio", { name: "Repêchage" }).click();
    await page.locator("#combat_resultat").getByRole("radio", { name: "Victoire" }).click();
    await page.locator("#combat_type_victoire").getByRole("radio", { name: "Ippon" }).click();
    await page.fill("#combat_adversaire", "Camille Durand");
    await page.locator("#combat_garde_adversaire").getByRole("radio", { name: "Gaucher" }).click();
    // Choisir « Ippon » a créé la ligne de point : il ne reste que la technique à préciser.
    await expect(page.locator(".combat-score-row")).toHaveCount(1);
    await expect(page.locator(".combat-score-row").getByRole("radiogroup", { name: "Valeur du point 1" }).locator("[aria-checked='true']")).toHaveText("Ippon");
    await page.locator(".combat-score-row").getByRole("radio", { name: "Debout" }).click();
    // Technique absente de la liste : « Autre technique… » ouvre un champ libre, choisir une technique connue le referme.
    const techniqueSelect = page.locator(".combat-score-row select.combat-technique-select");
    await techniqueSelect.selectOption("__autre__");
    const customTechnique = page.locator(".combat-score-row .combat-technique-custom");
    await expect(customTechnique).toBeFocused();
    await customTechnique.fill("Sode-tsurikomi-goshi");
    await expect(techniqueSelect).toHaveValue("__autre__");
    await shot("04a-custom-technique");
    await techniqueSelect.selectOption("O-soto-gari");
    await expect(customTechnique).toHaveCount(0);
    // COMBAT-PTS : une seule liste ; le point créé par la victoire est au judoka, le suivant est attribué à l'adversaire.
    await expect(page.locator(".combat-score-row").first().getByRole("radio", { name: "Judoka, point 1" })).toHaveAttribute("aria-checked", "true");
    assert.equal(await page.locator("#combat_points_subis").count(), 0);
    await expect(page.locator("#combat_points").getByRole("button", { name: "+ Ajouter un point" })).toHaveCount(1);
    await page.locator("#combat_points").getByRole("button", { name: "+ Ajouter un point" }).click();
    const concededRow = page.locator("#combat_points .combat-score-row").nth(1);
    await expect(page.locator("#combat_points .combat-score-row")).toHaveCount(2);
    await concededRow.getByRole("radio", { name: "Adversaire, point 2" }).click();
    await concededRow.getByRole("radio", { name: "Waza-ari" }).click();
    await concededRow.getByRole("radio", { name: "Debout" }).click();
    await concededRow.locator("select.combat-technique-select").selectOption("Uchi-mata");

    // COMBAT-SCORE : score officiel IWY - IWY, non renseigné tant qu'aucun compteur n'est touché.
    const scoreSummary = page.locator("#combat_score .combat-official-score-summary");
    await expect(scoreSummary).toHaveText("Non renseigné");
    await expect(page.getByRole("button", { name: "Retirer un Ippon au judoka" })).toBeDisabled();
    await page.getByRole("button", { name: "Ajouter un Ippon au judoka" }).click();
    await expect(scoreSummary).toHaveText("1 0 0 - 0 0 0");
    await page.getByRole("button", { name: "Ajouter un Yuko au judoka" }).click();
    await page.getByRole("button", { name: "Ajouter un Yuko au judoka" }).click();
    await page.getByRole("button", { name: "Ajouter un Waza-ari à l'adversaire" }).click();
    await page.getByRole("button", { name: "Ajouter un Yuko à l'adversaire" }).click();
    await page.getByRole("button", { name: "Retirer un Yuko à l'adversaire" }).click();
    await expect(scoreSummary).toHaveText("1 0 2 - 0 1 0");
    // « Effacer » remet le score à non renseigné.
    await page.locator("#combat_score").getByRole("button", { name: "Effacer" }).click();
    await expect(scoreSummary).toHaveText("Non renseigné");
    for (const name of ["Ajouter un Ippon au judoka", "Ajouter un Yuko au judoka", "Ajouter un Yuko au judoka", "Ajouter un Waza-ari à l'adversaire"]) {
      await page.getByRole("button", { name }).click();
    }
    await expect(scoreSummary).toHaveText("1 0 2 - 0 1 0");
    const scoreOverflow = await page.locator("#combat_score").evaluate((element) => element.scrollWidth > element.clientWidth);
    assert.equal(scoreOverflow, false);
    await page.fill("#combat_deroule", "Ippon sur o-soto-gari");
    const borderedLabels = await page.locator(
      ".form-section-heading h3, .stat-label, .meta-label, label:not(.checkbox-row), .combat-section-kicker, .combat-score-row-title"
    ).evaluateAll((elements) =>
      elements
        .filter((element) => Number.parseFloat(getComputedStyle(element).borderLeftWidth) > 0)
        .map((element) => element.textContent.trim())
    );
    assert.deepEqual(borderedLabels, []);
    const actionOverlap = await page.evaluate(() => {
      const actions = document.querySelector("#combatFormView .mobile-action-bar").getBoundingClientRect();
      const notes = document.querySelector("#combat_deroule").getBoundingClientRect();
      return actions.top < notes.bottom && actions.bottom > notes.top;
    });
    assert.equal(actionOverlap, false);
    await shot("04-form-filled");

    await page.locator("#saveCombatButton").click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await expect(page.getByText("Camille Durand · Gaucher", { exact: true })).toBeVisible();
    await expect(page.locator("#competitionView .combat-card .combat-stage")).toHaveText("Repêchage");
    await expect(page.getByText("O-soto-gari · Ippon", { exact: true })).toBeVisible();
    await expect(page.locator(".combat-conceded-line .badge-conceded")).toHaveText("Uchi-mata · Waza-ari");
    await expect(page.locator(".combat-scored-line .badge-scored")).toHaveText("O-soto-gari · Ippon");
    await expect(page.locator(".combat-card .combat-official-score-line-value")).toHaveText("1 0 2 - 0 1 0");
    await expect(page.getByText("Combat enregistré.", { exact: true })).toBeVisible();
    await shot("05-saved");

    // Ouverture en modification d'un combat complet : le haut du formulaire (tour) reste visible.
    await page.evaluate("window.scrollTo({ top: document.body.scrollHeight })");
    // La carte du combat s'ouvre en modification d'un simple toucher.
    await page.locator("#competitionView .combat-card").first().click();
    await expect(page.locator("#combatFormView")).toBeVisible();
    await expect(page.locator("#combat_etape [aria-checked='true']")).toHaveText("Repêchage");
    await expect(page.locator("#combat_etape")).toBeInViewport();
    // Rouvert : score et points retrouvent leur camp.
    await expect(page.locator("#combat_score .combat-official-score-summary")).toHaveText("1 0 2 - 0 1 0");
    await expect(page.locator("#combat_points .combat-score-row")).toHaveCount(2);
    await expect(page.getByRole("radio", { name: "Adversaire, point 2" })).toHaveAttribute("aria-checked", "true");
    await shot("06-edit");

    // Rechargement pendant la modification : on revient sur la compétition, pas sur un formulaire vide.
    await page.reload();
    await expect(page.locator("#competitionView")).toBeVisible();
    await expect(page.locator("#combatFormView")).toBeHidden();
    await expect(page.locator("#competitionView .combat-card .combat-stage")).toHaveText("Repêchage");
  });
}
