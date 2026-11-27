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

// Parcours d'un coach de deux clubs (données fictives) : MULTI-1, MULTI-2 et MULTI-3.

const NANTES = { clubId: "club-nantes", name: "Judo Club Nantes" };
const RENNES = { clubId: "club-rennes", name: "Dojo de Rennes" };

function tokenFor(email) {
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return `header.${payload}.signature`;
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

async function startServer() {
  const coach = {
    judokaId: "coach-1",
    accountEmail: "coach@example.com",
    firstName: "Alex",
    lastName: "Martin",
    profileType: "JUDOKA",
    accessRole: "COACH",
    ageCategory: "Senior",
    clubId: ""
  };
  const judoka = (id, firstName, club) => ({
    judokaId: id,
    firstName,
    lastName: "Test",
    profileType: "JUDOKA",
    accessRole: "NORMAL",
    ageCategory: "Minime",
    clubId: club.clubId
  });
  const judokas = [judoka("j-1", "Hugo", NANTES), judoka("j-2", "Nina", RENNES)];
  // Deux « Interclubs » le même jour, un par club : seul le club les distingue.
  const date = localDate(2);
  const clubCompetitions = [
    {
      clubCompetitionId: "cc-nantes",
      name: "Interclubs",
      competitionDate: date,
      clubId: NANTES.clubId
    },
    {
      clubCompetitionId: "cc-rennes",
      name: "Interclubs",
      competitionDate: date,
      clubId: RENNES.clubId
    }
  ];
  const rpc = [];

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
        rpc.push(request);
        let result = null;
        if (request.method === "getInitialData") {
          result = {
            user: coach,
            isAdmin: false,
            isCoach: true,
            isParent: false,
            competitions: [],
            clubCompetitions,
            clubs: [NANTES, RENNES],
            judokas: [coach, ...judokas]
          };
        } else if (request.method === "getClubCompetitionDetail") {
          const event = clubCompetitions.find((cc) => cc.clubCompetitionId === request.args[0]);
          result = {
            clubCompetition: {
              id_club_competition: event.clubCompetitionId,
              nom: event.name,
              date: event.competitionDate,
              categorie_age: "Minime",
              niveau: "Régional",
              club_id: event.clubId
            },
            participations: [],
            judokas,
            combatRecords: {}
          };
        } else if (request.method === "deleteClubCompetition") {
          result = { success: true, message: "Compétition club supprimée." };
        } else if (request.method === "getCoachDashboard") {
          result = {
            stats: computeCoachDashboardStats([], []),
            // MULTI-6 : une ligne par club sur « Tous mes clubs ».
            byClub: request.args[0].clubId
              ? null
              : [
                  {
                    clubId: NANTES.clubId,
                    withheld: false,
                    engagedJudokas: 3,
                    participations: 4,
                    combats: 10,
                    victories: 6,
                    podiums: 2
                  },
                  {
                    clubId: RENNES.clubId,
                    withheld: true,
                    engagedJudokas: 0,
                    participations: 0,
                    combats: 0,
                    victories: 0,
                    podiums: 0
                  }
                ],
            withheld: null,
            previous: null,
            availableCompetitions: clubCompetitions.map((cc) => ({
              competitionId: `p-${cc.clubCompetitionId}`,
              competitionIds: [`p-${cc.clubCompetitionId}`],
              name: cc.name,
              competitionDate: cc.competitionDate,
              clubId: cc.clubId
            }))
          };
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
  return { server, url: `http://127.0.0.1:${server.address().port}`, rpc };
}

async function openApp(t, viewport) {
  const { server, url, rpc } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => {
      if (!localStorage.getItem("kiroku_supabase_session")) {
        localStorage.setItem("kiroku_supabase_session", JSON.stringify(session));
      }
    },
    {
      access_token: tokenFor("coach@example.com"),
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
  return { page, rpc };
}

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }]
]) {
  test(`MULTI-1 à 3 : un coach de deux clubs sait de quel club il parle sur ${name}`, async (t) => {
    const { page, rpc } = await openApp(t, viewport);
    const shot = (step) =>
      page.screenshot({
        path: `output/playwright/multi-club-${name}-${step}.png`,
        fullPage: true,
        animations: "disabled"
      });
    const clubFilter = page.locator("#homeClubFilter");

    // MULTI-1 : sur « Tous mes clubs », la prochaine compétition dit son club.
    await expect(page.locator("#coachNextCompetition .next-hero-meta")).toContainText(NANTES.name);
    await shot("01-agenda-all-clubs");

    await page.getByRole("button", { name: "Compétitions", exact: true }).click();
    const cards = page.locator("#clubCompetitionsList .competition-card");
    await expect(cards.locator(".club-name")).toHaveText([NANTES.name, RENNES.name]);
    await shot("02-competitions-all-clubs");

    // Un club choisi n'est pas répété sur chaque ligne.
    await clubFilter.selectOption(RENNES.clubId);
    await expect(cards).toHaveCount(1);
    await expect(cards.locator(".club-name")).toHaveCount(0);

    // La fiche d'une compétition club dit toujours son club.
    await cards.first().locator(".competition-open-button").click();
    await expect(page.locator("#clubCompetitionDetailView .page-title .subtitle")).toContainText(
      RENNES.name
    );
    await shot("03-detail");

    // MULTI-2 : le club choisi survit au rechargement.
    await page.goto(page.url().split("?")[0]);
    await page.locator("#homeView").waitFor({ state: "visible" });
    await expect(page.locator("#homeClubFilter")).toHaveValue(RENNES.clubId);

    // MULTI-3 : les statistiques s'ouvrent sur le club de l'accueil.
    await page.getByRole("button", { name: "Statistiques", exact: true }).click();
    await expect(page.locator("#coachDashboardView")).toBeVisible();
    const dashboardCalls = () => rpc.filter((request) => request.method === "getCoachDashboard");
    await expect.poll(() => dashboardCalls().length).toBeGreaterThan(0);
    assert.equal(dashboardCalls().at(-1).args[0].clubId, RENNES.clubId);

    // Changer de club dans les statistiques change celui de l'accueil.
    await page.locator("#coachDashboardFilterToggle").click();
    await page.locator("#coachDashboard_club").selectOption("");
    await expect.poll(() => dashboardCalls().at(-1).args[0].clubId).toBe("");
    // Sur « Tous mes clubs », les suggestions de compétitions disent leur club.
    await page.locator("#coachDashboardCompetitionSearch").fill("Inter");
    await expect(page.locator(".competition-suggestion")).toHaveText([
      new RegExp(NANTES.name),
      new RegExp(RENNES.name)
    ]);
    const clubLines = page.locator("#coachDashboardByClub li");
    await expect(clubLines).toHaveCount(2);
    await expect(clubLines.nth(0)).toContainText("6/10 gagnés (60 %)");
    await expect(clubLines.nth(0)).toContainText("3 judokas · 4 participations · 2 podiums");
    await expect(clubLines.nth(1)).toContainText("moins de 2 judokas");
    await shot("04-stats-all-clubs");
    await page.locator("#coachDashboardByClub").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `output/playwright/multi-club-${name}-05-by-club.png`,
      animations: "disabled"
    });

    await page.getByRole("button", { name: "Accueil", exact: true }).first().click();
    await expect(page.locator("#homeClubFilter")).toHaveValue("");
  });
}

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }]
]) {
  test(`CONFIRM-1 : les confirmations sont dessinées par l'appli, jamais par le navigateur sur ${name}`, async (t) => {
    const { page, rpc } = await openApp(t, viewport);
    const nativeDialogs = [];
    page.on("dialog", async (dialog) => {
      nativeDialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const dialog = page.locator("#confirmDialog");
    const deletes = () => rpc.filter((request) => request.method === "deleteClubCompetition");

    // Suppression : « Annuler » ou Échap n'envoient rien ; le focus est sur l'action la moins risquée.
    await page.getByRole("button", { name: "Compétitions", exact: true }).click();
    await page.locator("#clubCompetitionsList .competition-open-button").first().click();
    const openDeleteConfirm = async () => {
      await page.locator("#clubCompetitionDetailView .page-menu summary").click();
      await page.getByRole("menuitem", { name: "Supprimer la compétition club" }).click();
      await expect(dialog).toBeVisible();
    };
    await openDeleteConfirm();
    await expect(page.locator("#confirmDialogMessage")).toContainText(
      "Supprimer la compétition club"
    );
    await expect(page.locator("#confirmDialogCancel")).toBeFocused();
    await page.screenshot({
      path: `output/playwright/confirm-dialog-${name}-delete.png`,
      animations: "disabled"
    });
    await page.locator("#confirmDialogCancel").click();
    await expect(dialog).toBeHidden();
    await openDeleteConfirm();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    assert.equal(deletes().length, 0);

    await openDeleteConfirm();
    await page.locator("#confirmDialogConfirm").click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => deletes().length).toBe(1);

    // Quitter un formulaire modifié : « Continuer la saisie » garde le formulaire.
    await page.goto(page.url().split("?")[0]);
    await page.locator("#homeView").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Compétitions", exact: true }).click();
    await page.locator("#addClubCompetitionButton").click();
    await page.fill("#club_competition_name", "Coupe de Carquefou");
    await page.locator("#clubCompetitionFormView .page-back").click();
    await expect(dialog).toBeVisible();
    await expect(page.locator("#confirmDialogConfirm")).toHaveText("Quitter sans enregistrer");
    await page.screenshot({
      path: `output/playwright/confirm-dialog-${name}-leave.png`,
      animations: "disabled"
    });
    await page.getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(page.locator("#clubCompetitionFormView")).toBeVisible();
    await expect(page.locator("#club_competition_name")).toHaveValue("Coupe de Carquefou");
    await page.locator("#clubCompetitionFormView .page-back").click();
    await page.locator("#confirmDialogConfirm").click();
    await expect(page.locator("#homeView")).toBeVisible();

    assert.deepEqual(nativeDialogs, []);
  });
}
