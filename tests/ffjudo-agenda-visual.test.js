const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Agenda FFJDA (AGD-*) : écran en lecture seule ouvert depuis le menu du compte, données fictives.

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

const judoka = {
  judokaId: "j-lea",
  firstName: "Léa",
  lastName: "Test",
  accountEmail: "lea@example.com",
  profileType: "JUDOKA",
  accessRole: "NORMAL",
  ageCategory: "Senior",
  clubId: "",
  registrationSeason: 2026
};

// AGD-001 : l'agenda est réservé aux coachs.
const coach = {
  ...judoka,
  judokaId: "c-tom",
  firstName: "Tom",
  accountEmail: "tom@example.com",
  accessRole: "COACH",
  clubId: "club-1"
};

const EVENTS = [
  {
    eventKey: "fed:1",
    titre: "TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES",
    dateDebut: localDate(3),
    dateFin: "",
    inscriptionCloture: localDate(1),
    typeEvenement: "COMPETITION",
    lieu: "DOJO DU CROISSANT",
    ville: "NANTES",
    ligue: "Pays de la Loire",
    proprietaire: "Comité LOIRE ATLANTIQUE JUD",
    sourceUrl: "https://pays-de-la-loire-judo.ffjudo.com/evenement/tournoi-nantes/18"
  },
  {
    eventKey: "fed:2",
    titre: "STAGE TECHNIQUE DU MORBIHAN POUR LES CEINTURES DE COULEUR ET LES ARBITRES STAGIAIRES",
    dateDebut: localDate(40),
    dateFin: localDate(41),
    inscriptionCloture: localDate(-2),
    typeEvenement: "STAGE",
    lieu: "Dojo départemental",
    ville: "VANNES",
    ligue: "Bretagne",
    proprietaire: "Comité MORBIHAN JUDO",
    sourceUrl: "https://judo-bretagne.ffjudo.com/evenement/stage-morbihan/7"
  },
  {
    eventKey: "nat:championnat:x",
    titre: "CHAMPIONNAT DE FRANCE INDIVIDUEL 1ÈRE DIVISION",
    dateDebut: localDate(45),
    dateFin: "",
    inscriptionCloture: "",
    typeEvenement: "",
    lieu: "LA ROCHE-SUR-YON",
    ville: "",
    ligue: "National",
    proprietaire: "",
    sourceUrl: "https://www.ffjudo.com/evenement/championnat-de-france-individuel-1ere-division-2"
  }
];

const LAST_SYNC = "2026-11-22T03:00:08.000Z";

function scenario(agendaResponses, user = coach) {
  let agendaCalls = 0;
  return (request) => {
    if (request.method === "getInitialData") {
      return {
        user,
        isAdmin: false,
        isCoach: user.accessRole === "COACH",
        isParent: false,
        competitions: [],
        clubCompetitions: [],
        clubs: user.clubId ? [{ clubId: user.clubId, name: "Judo Club Nantes" }] : [],
        judokas: [user]
      };
    }
    if (request.method === "getFfjudoEvents") {
      const response = agendaResponses[Math.min(agendaCalls, agendaResponses.length - 1)];
      agendaCalls += 1;
      return response;
    }
    return null;
  };
}

async function startServer(handle) {
  const rpc = [];
  const server = http.createServer(async (req, res) => {
    const route = req.url.split("?")[0];
    if (route === "/api/client") {
      const result = await callHandler(clientHandler, req);
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
      return;
    }
    if (route === "/api/styles") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      res.end(fs.readFileSync(path.join(root, "assets", "app.css"), "utf8"));
      return;
    }
    if (route === "/api/rpc") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const request = JSON.parse(body || "{}");
        rpc.push(request);
        const result = handle(request);
        if (result instanceof Error) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: result.message }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result }));
      });
      return;
    }
    if (route === "/") {
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

async function openHome(t, handle, viewport) {
  const { server, url, rpc } = await startServer(handle);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)),
    {
      access_token: tokenFor("lea@example.com"),
      refresh_token: "",
      expires_at: Math.floor(Date.now() / 1000) + 3600
    }
  );
  const page = await context.newPage();
  const nativeDialogs = [];
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  t.after(async () => {
    assert.deepEqual(nativeDialogs, []);
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });
  await page.goto(url);
  await page.locator("#homeView").waitFor({ state: "visible" });
  await page.locator("#accountMenu summary").click();
  return { page, rpc };
}

async function openAgenda(t, handle, viewport) {
  const { page, rpc } = await openHome(t, handle, viewport);
  await page.getByRole("menuitem", { name: "Agenda FFJDA" }).click();
  await expect(page.locator("#ffjudoAgendaView")).toBeVisible();
  return { page, rpc };
}

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 375, height: 812 }]
];

test("agenda: the view, its menu entry and its script are shipped without native dialogs", () => {
  const html = renderIndexHtml();
  assert.match(html, /<section id="ffjudoAgendaView" class="panel hidden"/);
  assert.match(
    html,
    /v-if="showFfjudoAgendaLink" type="button" role="menuitem" @click="openFfjudoAgenda\(\)">Agenda FFJDA<\/button>/
  );
  const screen = fs.readFileSync(
    path.join(root, "assets", "dist", "app-screen-ffjudo-agenda.js"),
    "utf8"
  );
  assert.match(screen, /"getFfjudoEvents"/);
  assert.doesNotMatch(screen, /\b(alert|confirm|prompt)\(/);
  assert.match(
    fs.readFileSync(path.join(root, "scripts", "build-assets.js"), "utf8"),
    /"assets\/app-screen-ffjudo-agenda\.ts"/
  );
});

for (const [name, viewport] of VIEWPORTS) {
  test(`AGD : l'agenda groupe les événements par mois et se filtre par ligue sur ${name}`, async (t) => {
    const { page, rpc } = await openAgenda(
      t,
      scenario([{ events: EVENTS, lastSyncAt: LAST_SYNC }]),
      viewport
    );
    const cards = page.locator("#ffjudoAgendaView .agenda-card");
    await expect(cards).toHaveCount(3);
    await expect(page.locator("#ffjudoAgendaView .agenda-month")).not.toHaveCount(0);
    await expect(page.locator("#ffjudoAgendaLastSync")).toContainText(
      "Mis à jour le 22/11/2026 à 04:00"
    );
    const first = cards.first();
    await expect(first).toContainText("TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES");
    await expect(first).toContainText("NANTES · Compétition");
    await expect(first).toContainText("Comité LOIRE ATLANTIQUE JUD — Pays de la Loire");
    await expect(first).toContainText("Inscriptions jusqu'au");
    await expect(cards.nth(1)).not.toContainText("Inscriptions jusqu'au");
    await expect(cards.nth(1)).toContainText("→");
    const link = first.getByRole("link", { name: /Voir sur ffjudo\.com/ });
    await expect(link).toHaveAttribute("href", EVENTS[0].sourceUrl);
    await expect(link).toHaveAttribute("target", "_blank");
    await page.screenshot({
      path: `output/playwright/agenda-after-${name}-01-liste.png`,
      fullPage: true,
      animations: "disabled"
    });

    await page.locator("#ffjudoAgendaLigue").selectOption("Bretagne");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("STAGE TECHNIQUE DU MORBIHAN");
    await page.screenshot({
      path: `output/playwright/agenda-after-${name}-02-bretagne.png`,
      fullPage: true,
      animations: "disabled"
    });

    await page.locator("#ffjudoAgendaType").selectOption("COMPETITION");
    await expect(cards).toHaveCount(0);
    await expect(page.locator("#ffjudoAgendaView .empty-state")).toContainText(
      "Aucun événement pour ces filtres."
    );
    await page.screenshot({
      path: `output/playwright/agenda-after-${name}-03-sans-resultat.png`,
      fullPage: true,
      animations: "disabled"
    });
    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    await expect(cards).toHaveCount(3);

    await page.locator("#ffjudoAgendaLigue").selectOption("National");
    await expect(cards).toHaveCount(1);
    await page.locator("#ffjudoAgendaLigue").selectOption("");
    await page.locator("#ffjudoAgendaType").selectOption("STAGE");
    await expect(cards).toHaveCount(1);

    assert.equal(rpc.filter((request) => request.method === "getFfjudoEvents").length, 1);
    // VCL-020 : un rechargement rouvre l'agenda.
    await page.reload();
    await expect(page.locator("#ffjudoAgendaView")).toBeVisible();
    await expect(cards).toHaveCount(3);
    await page.locator("#ffjudoAgendaView .page-back").click();
    await expect(page.locator("#homeView")).toBeVisible();
  });

  test(`AGD : l'agenda distingue l'état vide et l'erreur, puis réessaie sur ${name}`, async (t) => {
    const { page } = await openAgenda(
      t,
      scenario([new Error("Erreur serveur."), { events: [], lastSyncAt: "" }]),
      viewport
    );
    await expect(page.locator("#ffjudoAgendaView .error-state")).toContainText(
      "Impossible de charger l'agenda."
    );
    await page.screenshot({
      path: `output/playwright/agenda-after-${name}-04-erreur.png`,
      fullPage: true,
      animations: "disabled"
    });
    await page.getByRole("button", { name: "Réessayer" }).click();
    await expect(page.locator("#ffjudoAgendaView .empty-state")).toContainText(
      "Aucun événement à venir."
    );
    await expect(page.locator("#ffjudoAgendaLigue")).toHaveCount(0);
    await expect(page.locator("#ffjudoAgendaLastSync")).toContainText("Pas encore synchronisé");
    await page.screenshot({
      path: `output/playwright/agenda-after-${name}-05-vide.png`,
      fullPage: true,
      animations: "disabled"
    });
  });
}

test("AGD-001 : un judoka ne voit pas l'agenda dans le menu du compte", async (t) => {
  const { page, rpc } = await openHome(
    t,
    scenario([{ events: EVENTS, lastSyncAt: LAST_SYNC }], judoka),
    {
      width: 375,
      height: 812
    }
  );
  await expect(page.getByRole("menuitem", { name: "Données personnelles" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Agenda FFJDA" })).toHaveCount(0);
  assert.equal(rpc.filter((request) => request.method === "getFfjudoEvents").length, 0);
});
