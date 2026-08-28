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
  coachObjective: "",
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
  const server = http.createServer(async (req, res) => {
    if (req.url === "/service-worker.js") {
      const result = await callHandler(serviceWorkerHandler, req);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }

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

    if (req.url === "/manifest.webmanifest") {
      res.writeHead(200, { "content-type": "application/manifest+json" });
      res.end(JSON.stringify({ name: "Kiroku", start_url: "/" }));
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
  return { server, rpcCalls, url: `http://127.0.0.1:${server.address().port}` };
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
  await page.reload();
  await waitForApp(page);

  await expect(page.getByRole("status")).toHaveText(/Hors connexion - données du/, {
    timeout: 5000
  });
  await expect(page.getByText(competition.name, { exact: true })).toHaveCount(1);
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
  await page.getByRole("button", { name: "Finaliser" }).click();
  await context.setOffline(true);
  await page.selectOption("#finalization_classement", "1er");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("En attente de synchronisation", { exact: true }).waitFor();

  const pending = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kiroku_pending_ops:offline@example.com"))
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0].type, "finalizeCompetition");
  assert.equal(pending[0].status, "pending");

  await context.setOffline(false);
  await expect(page.getByText("Classement 1er", { exact: true })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("En attente de synchronisation", { exact: true })).toHaveCount(0, {
    timeout: 5000
  });
  assert.equal(rpcCalls.filter((call) => call.method === "finalizeCompetition").length, 1);
});
