const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

function tokenFor(email) {
  return `header.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.signature`;
}

function callHandler(handler, req) {
  return new Promise((resolve) => {
    const headers = {};
    handler(req, {
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; },
      send(body) { resolve({ statusCode: this.statusCode || 200, headers, body: String(body) }); },
      json(body) { resolve({ statusCode: this.statusCode || 200, headers, body: JSON.stringify(body) }); }
    });
  });
}

// Compte uniquement parent avec deux enfants : cas qui n'avait plus de retour vers l'accueil parent.
async function startServer() {
  const parent = {
    judokaId: "p1", accountEmail: "parent@example.com", firstName: "Claire", lastName: "Durand",
    profileType: "PARENT", accessRole: "NORMAL"
  };
  const children = [
    { judokaId: "c1", accountEmail: "", firstName: "Hugo", lastName: "Durand", profileType: "JUDOKA", accessRole: "NORMAL", ageCategory: "Cadet" },
    { judokaId: "c2", accountEmail: "", firstName: "Nina", lastName: "Durand", profileType: "JUDOKA", accessRole: "NORMAL", ageCategory: "Minime" }
  ];
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/client") {
      const response = await callHandler(clientHandler, req);
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
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
        const result = request.method === "getInitialData"
          ? { user: parent, isAdmin: false, isCoach: false, isParent: true, competitions: [], clubCompetitions: [], judokas: [parent, ...children] }
          : null;
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

test("un compte parent revient à l'accueil parent et ne se voit pas parmi ses enfants", async () => {
  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript((session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)), {
      access_token: tokenFor("parent@example.com"), refresh_token: "", expires_at: Math.floor(Date.now() / 1000) + 3600
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator("#homeView").waitFor({ state: "visible" });

    await page.getByRole("button", { name: "Gérer les compétitions" }).click();
    const parentTabs = page.getByRole("navigation", { name: "Navigation parent" });
    await parentTabs.waitFor({ state: "visible" });

    await page.locator("#filterJudokaText").focus();
    const options = await page.locator("#filterJudokaDropdown .autocomplete-option").allInnerTexts();
    assert.equal(options.length, 2, `options inattendues : ${options.join(" | ")}`);
    assert.ok(options.every((text) => !/Claire/.test(text)), "le parent ne doit pas être proposé comme judoka");

    await parentTabs.getByRole("button", { name: "Accueil parent" }).click();
    await page.getByRole("button", { name: "Gérer les compétitions" }).waitFor({ state: "visible" });
    assert.equal(await parentTabs.isVisible(), false);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
