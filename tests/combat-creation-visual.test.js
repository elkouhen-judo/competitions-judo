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
  const rpcMethods = [];
  const server = http.createServer(async (req, res) => {
    if (req.url.split("?")[0] === "/api/client") {
      const result = await callHandler(clientHandler, req);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
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
        rpcMethods.push(request.method);
        let result = null;
        if (request.method === "getInitialData") {
          result = { user, isAdmin: false, isCoach: false, isParent: false, competitions: [competition], clubCompetitions: [], judokas: [user] };
        } else if (request.method === "getCompetitionDetail") {
          result = {
            competition,
            combats,
            canEditCompetition: true,
            canFinalizeCompetition: true,
            canDeleteCompetition: true
          };
        } else if (request.method === "getCombatSuggestions") {
          // DETAIL-2 : les suggestions se chargent à l'ouverture du formulaire de combat.
          result = {
            opponents: ["Camille Durand", "Inès Robert"],
            opponentStances: { "Camille Durand": "Gaucher" },
            techniques: ["Uchi-mata"]
          };
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
          // ECRIT-2 : l'écriture renvoie le combat enregistré.
          result = { success: true, message: "Combat enregistré.", competitionId: input.competitionId, combat };
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
  return { server, url: `http://127.0.0.1:${server.address().port}`, competition, rpcMethods };
}

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  test(`parcours visuel de création d'un combat sur ${name}`, async (t) => {
    const { server, url, competition, rpcMethods } = await startServer();
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

    const shot = (step) => page.screenshot({ path: `output/playwright/combat-flow-${name}-${step}.png`, fullPage: true, animations: "disabled" });
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

    // COMBAT-CHRONO : avant le combat, sans menu déroulant ; toutes les étapes sont visibles.
    assert.equal(await page.locator("#combatFormView .combat-quick-section select").count(), 0);
    const stageOverflow = await page.locator("#combat_etape").evaluate((element) => element.scrollWidth > element.clientWidth);
    assert.equal(stageOverflow, false);
    await page.locator("#combat_etape").getByRole("radio", { name: "Repêchage" }).click();
    await expect(page.locator("#combat_adversaire_suggestions option")).toHaveCount(2);
    // SAISIE-3 : un adversaire déjà rencontré remplit sa garde ; un inconnu la laisse vide.
    const stanceRadio = (label) => page.locator("#combat_garde_adversaire").getByRole("radio", { name: label });
    await page.fill("#combat_adversaire", "Inconnu");
    await expect(page.locator("#combat_garde_adversaire [aria-checked='true']")).toHaveCount(0);
    await page.fill("#combat_adversaire", "camille durand");
    await expect(stanceRadio("Gaucher")).toHaveAttribute("aria-checked", "true");
    await page.fill("#combat_adversaire", "Camille Durand");

    // Pendant le combat : chaque + ajoute l'action à la fin du déroulé ; le score en est le décompte.
    const scoreSummary = page.locator("#combat_score .combat-official-score-summary");
    const timelineRows = page.locator("#combat_points .combat-score-row");
    await expect(scoreSummary).toHaveText("Non renseigné");
    await expect(page.getByRole("button", { name: "Retirer un Ippon au judoka" })).toBeDisabled();
    await page.getByRole("button", { name: "Ajouter un Waza-ari à l'adversaire" }).click();
    // SAISIE-5 : une fois renseigné, le score n'est lu que dans le tableau.
    await expect(scoreSummary).toHaveCount(0);
    await expect(page.getByRole("status", { name: "Waza-ari à l'adversaire" })).toHaveText("1");
    await page.getByRole("button", { name: "Ajouter un Yuko au judoka" }).click();
    await page.getByRole("button", { name: "Ajouter un Yuko au judoka" }).click();
    await page.getByRole("button", { name: "Ajouter un Yuko à l'adversaire" }).click();
    await page.getByRole("button", { name: "Retirer un Yuko à l'adversaire" }).click();
    await page.getByRole("button", { name: "Ajouter un Shido à l'adversaire" }).click();
    await page.getByRole("button", { name: "Ajouter un Ippon au judoka" }).click();
    await expect(page.getByRole("button", { name: "Ajouter un Ippon au judoka" })).toBeDisabled();
    // SAISIE-1 : l'Ippon du judoka décide l'issue, sans autre toucher.
    const resultRadio = (label) => page.locator("#combat_resultat").getByRole("radio", { name: label, exact: true });
    const decisionRadio = (label) => page.locator("#combat_type_victoire").getByRole("radio", { name: label, exact: true });
    await expect(resultRadio("Victoire")).toHaveAttribute("aria-checked", "true");
    await expect(decisionRadio("Ippon")).toHaveAttribute("aria-checked", "true");
    await expect(timelineRows.locator(".combat-point-badge")).toHaveText([
      "Adversaire · Waza-ari",
      "Léa · Yuko",
      "Léa · Yuko",
      "Léa · Ippon"
    ]);
    // Une action saisie dans le désordre se remet à sa place.
    await page.getByRole("button", { name: "Reculer l'action 1" }).click();
    await expect(timelineRows.nth(1).locator(".combat-point-badge")).toHaveText("Adversaire · Waza-ari");
    await page.getByRole("button", { name: "Avancer l'action 2" }).click();
    await expect(timelineRows.first().locator(".combat-point-badge")).toHaveText("Adversaire · Waza-ari");

    // Technique : liste groupée (debout ou au sol déduit), favoris du judoka, ou saisie libre.
    await timelineRows.first().locator("select.combat-technique-select").selectOption("T:Uchi-mata");
    const ipponSelect = timelineRows.nth(3).locator("select.combat-technique-select");
    await expect(ipponSelect.locator("optgroup[label='Déjà marquées par le judoka'] option")).toHaveText(["Uchi-mata"]);
    await ipponSelect.selectOption("T:__autre__");
    const customTechnique = timelineRows.nth(3).locator(".combat-technique-custom");
    await expect(customTechnique).toBeFocused();
    await customTechnique.fill("Sode-tsurikomi-goshi");
    await expect(ipponSelect).toHaveValue("T:__autre__");
    await shot("04a-custom-technique");
    await ipponSelect.selectOption("T:O-soto-gari");
    await expect(customTechnique).toHaveCount(0);
    const scoreOverflow = await page.locator("#combat_score").evaluate((element) => element.scrollWidth > element.clientWidth);
    assert.equal(scoreOverflow, false);

    // Fin du combat : l'issue déduite ne double pas le point déjà dans le déroulé.
    await expect(page.locator("#combat_type_victoire_label")).toHaveText("Victoire par");
    await expect(timelineRows).toHaveCount(4);
    // SAISIE-2 : un résultat contraire au score est signalé, puis l'issue est rétablie à la main.
    const outcomeWarning = page.locator("#combat_outcome_warning");
    await expect(outcomeWarning).toHaveCount(0);
    await resultRadio("Défaite").click();
    await expect(outcomeWarning).toHaveText("Le score indique une victoire. Vérifiez le résultat.");
    await expect(page.locator("#combat_type_victoire [aria-checked='true']")).toHaveCount(0);
    await expect(timelineRows).toHaveCount(4);
    await resultRadio("Victoire").click();
    await decisionRadio("Ippon").click();
    await expect(outcomeWarning).toHaveCount(0);
    // SAISIE-6 : une technique manquante n'est signalée qu'une fois.
    await expect(page.locator("#combatFormView .combat-decision-notice")).toHaveCount(0);
    // Les Yuko sans technique sont gardés et signalés, pas perdus.
    await expect(page.locator("#combat_points .field-todo")).toHaveText("À compléter : technique d'un point");
    const hansokuHeight = await page.locator("#combat_type_victoire").getByRole("radio", { name: "Hansoku-make" }).evaluate((element) => element.getBoundingClientRect().height);
    assert.ok(hansokuHeight <= 46, `Hansoku-make sur une ligne (hauteur ${hansokuHeight})`);
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

    const callsBeforeSave = rpcMethods.length;
    await page.locator("#saveCombatButton").click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await expect(page.getByText("Camille Durand · Gaucher", { exact: true })).toBeVisible();
    await expect(page.locator("#competitionView .combat-card .combat-stage")).toHaveText("Repêchage");
    await expect(page.locator(".combat-conceded-line .badge-conceded")).toHaveText("Uchi-mata · Waza-ari");
    await expect(page.locator(".combat-scored-line .badge-scored")).toHaveText([
      "Technique non précisée · Yuko",
      "Technique non précisée · Yuko",
      "O-soto-gari · Ippon"
    ]);
    await expect(page.locator(".combat-card .combat-official-score-line-value")).toHaveText("1 0 2 - 0 1 0 · Shidos 0 - 1");
    await expect(page.getByText("Combat enregistré.", { exact: true })).toBeVisible();
    // ECRIT-2 : enregistrer un combat déclenche un seul appel RPC, la fiche n'est pas rechargée.
    assert.deepEqual(rpcMethods.slice(callsBeforeSave), ["ajouterCombat"]);
    assert.equal(rpcMethods.filter((method) => method === "getCombatSuggestions").length, 1);
    await shot("05-saved");

    // SAISIE-4 : après une victoire en repêchage, le combat suivant propose « Place de 3 ».
    await page.getByRole("button", { name: "Ajouter un combat" }).click();
    await expect(page.locator("#combatFormView")).toBeVisible();
    await expect(page.locator("#combat_etape [aria-checked='true']")).toHaveText("Place de 3");
    await expect(page.locator("#combat_adversaire")).toBeFocused();

    // SAISIE-1 : 3 shidos de l'adversaire décident l'issue ; en retirer un l'efface.
    for (let index = 0; index < 3; index += 1) {
      await page.getByRole("button", { name: "Ajouter un Shido à l'adversaire" }).click();
    }
    await expect(resultRadio("Victoire")).toHaveAttribute("aria-checked", "true");
    await expect(decisionRadio("Hansoku-make")).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Retirer un Shido à l'adversaire" }).click();
    await expect(page.locator("#combat_resultat [aria-checked='true']")).toHaveCount(0);

    // Un score supérieur sans Ippon propose l'issue sans la choisir.
    const proposal = page.locator("#combat_outcome_proposal");
    await page.getByRole("button", { name: "Ajouter un Waza-ari au judoka" }).click();
    await expect(proposal).toHaveText("D'après le score : Victoire par Waza-ari");
    await expect(page.locator("#combat_resultat [aria-checked='true']")).toHaveCount(0);
    await shot("05a-proposal");
    await proposal.click();
    await expect(resultRadio("Victoire")).toHaveAttribute("aria-checked", "true");
    await expect(decisionRadio("Waza-ari")).toHaveAttribute("aria-checked", "true");
    await expect(proposal).toHaveCount(0);
    await expect(page.locator("#combat_points .combat-score-row")).toHaveCount(1);

    // Un choix fait à la main n'est pas écrasé par un Ippon ajouté ensuite : il est signalé.
    await page.getByRole("button", { name: "Ajouter un Ippon à l'adversaire" }).click();
    await expect(resultRadio("Victoire")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#combat_outcome_warning")).toHaveText("Le score indique une défaite. Vérifiez le résultat.");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Retour à la compétition" }).click();
    await expect(page.locator("#competitionView")).toBeVisible();

    // Ouverture en modification d'un combat complet : le haut du formulaire (tour) reste visible.
    await page.evaluate("window.scrollTo({ top: document.body.scrollHeight })");
    // La carte du combat s'ouvre en modification d'un simple toucher.
    await page.locator("#competitionView .combat-card").first().click();
    await expect(page.locator("#combatFormView")).toBeVisible();
    await expect(page.locator("#combat_etape [aria-checked='true']")).toHaveText("Repêchage");
    await expect(page.locator("#combat_etape")).toBeInViewport();
    // Rouvert : score, shidos et déroulé dans l'ordre du combat ; l'issue enregistrée n'est pas recalculée.
    await expect(page.getByRole("status", { name: "Shido à l'adversaire" })).toHaveText("1");
    await expect(resultRadio("Victoire")).toHaveAttribute("aria-checked", "true");
    await expect(decisionRadio("Ippon")).toHaveAttribute("aria-checked", "true");
    await expect(timelineRows.locator(".combat-point-badge")).toHaveText([
      "Adversaire · Waza-ari",
      "Léa · Yuko",
      "Léa · Yuko",
      "Léa · Ippon"
    ]);
    await shot("06-edit");

    // COMBAT-QUIT : quitter avec des modifications demande confirmation.
    await page.fill("#combat_deroule", "Note modifiée");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Retour à la compétition" }).click();
    await expect(page.locator("#combatFormView")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Retour à la compétition" }).click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await page.locator("#competitionView .combat-card").first().click();
    await expect(page.locator("#combatFormView")).toBeVisible();

    // Rechargement pendant la modification : on revient sur la compétition, pas sur un formulaire vide.
    await page.reload();
    await expect(page.locator("#competitionView")).toBeVisible();
    await expect(page.locator("#combatFormView")).toBeHidden();
    await expect(page.locator("#competitionView .combat-card .combat-stage")).toHaveText("Repêchage");
  });
}
