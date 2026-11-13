const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const serviceWorkerHandler = require(path.join(root, "api", "service-worker.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

const user = {
  judokaId: "judoka-offline-1",
  accountEmail: "offline@example.com",
  firstName: "Offline",
  lastName: "Judoka",
  profileType: "JUDOKA",
  accessRole: "NORMAL",
  ageCategory: "Senior",
  weightCategory: "-73 kg",
  beltColor: "Marron",
  gender: "Homme",
  yearInCategory: "",
  handedness: "Droitier"
};

const competition = {
  competitionId: "competition-offline-1",
  clubCompetitionId: null,
  ownerJudokaId: user.judokaId,
  name: "Tournoi offline",
  competitionDate: "2026-05-10",
  ageCategory: "Senior",
  weightCategory: "-73 kg",
  level: "Départemental",
  result: null,
  coachReview: ""
};

const detail = { competition, combats: [], canEditCompetition: true };

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

async function startTestServer() {
  const rpcCalls = [];
  const shell = { delayMs: 0, requests: 0 };
  const server = http.createServer(async (req, res) => {
    if (req.url === "/service-worker.js") {
      const result = await callHandler(serviceWorkerHandler, req);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }

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

    if (req.url.startsWith("/assets/fonts/")) {
      res.writeHead(200, { "content-type": "font/woff2" });
      res.end(fs.readFileSync(path.join(root, req.url)));
      return;
    }

    if (req.url === "/manifest.webmanifest") {
      res.writeHead(200, { "content-type": "application/manifest+json" });
      res.end(JSON.stringify({ name: "Ayumi", start_url: "/" }));
      return;
    }

    if (req.url === "/api/rpc") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const request = JSON.parse(body || "{}");
        rpcCalls.push(request);
        let result = null;
        if (request.method === "getInitialData") {
          result = {
            user,
            isAdmin: false,
            isCoach: false,
            isParent: false,
            competitions: [competition],
            clubCompetitions: [],
            judokas: [user]
          };
        } else if (request.method === "getCompetitionDetail") {
          result = detail;
        } else if (request.method === "getCombatSuggestions") {
          result = { opponents: ["Adversaire déjà rencontré"], techniques: [] };
        } else if (request.method === "finalizeCompetition") {
          competition.result = request.args[1];
          result = {
            success: true,
            message: "Compétition finalisée.",
            competitionId: competition.competitionId
          };
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result }));
      });
      return;
    }

    if (req.url === "/" || req.url.startsWith("/?")) {
      shell.requests += 1;
      if (shell.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, shell.delayMs));
      }
      if (res.destroyed || !server.listening) {
        return;
      }
      let html = renderIndexHtml();
      html = html.replace(
        "</head>",
        `<script>window.KIROKU_RUNTIME_CONFIG={runtime:"vercel",appUrl:${JSON.stringify(`http://127.0.0.1:${server.address().port}`)},supabaseUrl:"http://supabase.test",supabaseAnonKey:"anon-key"};</script></head>`
      );
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, rpcCalls, shell, url: `http://127.0.0.1:${server.address().port}` };
}

async function createPage(browser, url) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ session }) => {
      localStorage.setItem("kiroku_supabase_session", JSON.stringify(session));
    },
    {
      session: {
        access_token: tokenFor(user.accountEmail),
        refresh_token: "",
        expires_at: Math.floor(Date.now() / 1000) + 3600
      }
    }
  );
  return { context, page: await context.newPage(), url };
}

async function waitForApp(page) {
  await page.locator("#homeView").waitFor({ state: "visible" });
  await page.getByText(competition.name, { exact: true }).waitFor();
}

test("l'application recharge les données locales hors connexion", async (t) => {
  const { server, url } = await startTestServer();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const { context, page } = await createPage(browser, url);
  t.after(() => context.close());

  await page.goto(url);
  await waitForApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".offline-status")).toHaveText(/Hors connexion/);
  await page.reload();
  await waitForApp(page);

  await expect(page.getByRole("status")).toHaveText(/Hors connexion - données du/, {
    timeout: 5000
  });
  await expect(page.getByText(competition.name, { exact: true })).toHaveCount(1);
});

test("les suggestions de saisie déjà chargées restent disponibles après un redémarrage hors connexion", async (t) => {
  const { server, url } = await startTestServer();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const created = await createPage(browser, url);
  const { context } = created;
  let page = created.page;
  t.after(() => context.close());
  const suggestionSelector =
    '#combat_adversaire_suggestions option[value="Adversaire déjà rencontré"]';

  async function openCombatForm() {
    await page.getByRole("button", { name: competition.name }).click();
    await page.locator("#competitionView").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Ajouter un combat" }).click();
    await page.locator("#combatFormView").waitFor({ state: "visible" });
  }

  await page.goto(url);
  await waitForApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await openCombatForm();
  await expect(page.locator(suggestionSelector)).toHaveCount(1);

  // DETAIL-2 : l'application est relancée hors connexion dans un nouvel onglet
  // (même stockage local, même service worker) ; les suggestions viennent du cache.
  page = await context.newPage();
  await context.setOffline(true);
  await page.goto(url);
  await waitForApp(page);
  // Un onglet ouvert après la coupure garde navigator.onLine à true sous Playwright :
  // on rejoue la coupure pour que l'application reçoive l'événement « offline ».
  await context.setOffline(false);
  await context.setOffline(true);
  await expect(page.locator(".offline-status")).toHaveText(/Hors connexion/);
  await openCombatForm();
  await expect(page.locator(suggestionSelector)).toHaveCount(1);
});

test("une finalisation offline est conservée puis synchronisée au retour du réseau", async (t) => {
  const { server, rpcCalls, url } = await startTestServer();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  const { context, page } = await createPage(browser, url);
  t.after(() => context.close());

  await page.goto(url);
  await waitForApp(page);
  await page.getByRole("button", { name: competition.name }).click();
  await page.locator("#competitionView").waitFor({ state: "visible" });
  // FICHE-2 : le classement se choisit directement sur la fiche.
  await context.setOffline(true);
  await page.locator("#competitionRankingSection").getByRole("radio", { name: /1er/ }).click();
  await expect(page.locator(".offline-status")).toHaveText(/modification enregistrée localement/);

  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiroku_pending_ops:offline@example.com"))
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0].type, "finalizeCompetition");
  assert.equal(pending[0].status, "pending");

  await context.setOffline(false);
  await expect(page.locator("#competitionClassement")).toHaveText(/1er/, { timeout: 5000 });
  await expect(page.locator(".offline-status")).toHaveCount(0, { timeout: 5000 });
  assert.equal(rpcCalls.filter((call) => call.method === "finalizeCompetition").length, 1);
});

test("au second lancement, l'accueil s'affiche depuis le cache sans attendre le réseau", async (t) => {
  const { server, shell, url } = await startTestServer();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const { context, page } = await createPage(browser, url);
  t.after(() => context.close());

  await page.goto(url);
  await waitForApp(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  // SHELL-1 : le réseau met 4 s à rendre la coquille ; le cache l'affiche tout de suite.
  shell.delayMs = 4000;
  const requestsBefore = shell.requests;
  const startedAt = Date.now();
  await page.reload();
  await waitForApp(page);
  assert.ok(Date.now() - startedAt < 3000, "la coquille ne doit pas attendre le réseau");
  // La coquille est tout de même relue en arrière-plan, pour le lancement suivant.
  await expect.poll(() => shell.requests).toBeGreaterThan(requestsBefore);
});
