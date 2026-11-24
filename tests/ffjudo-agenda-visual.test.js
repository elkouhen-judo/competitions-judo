const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Agenda FFJDA (AGD-*) : onglet du coach, données fictives.

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
    sourceUrl: "https://pays-de-la-loire-judo.ffjudo.com/evenement/tournoi-nantes/18",
    suggestedLevel: "Départemental",
    suggestedAgeCategory: "Cadet"
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
    sourceUrl: "https://judo-bretagne.ffjudo.com/evenement/stage-morbihan/7",
    suggestedLevel: "Départemental",
    suggestedAgeCategory: ""
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
    sourceUrl: "https://www.ffjudo.com/evenement/championnat-de-france-individuel-1ere-division-2",
    suggestedLevel: "National",
    suggestedAgeCategory: ""
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
  // AGD-001 : l'agenda est un onglet du coach, plus une entrée du menu du compte.
  await expect(page.getByRole("menuitem", { name: "Agenda FFJDA" })).toHaveCount(0);
  await page.locator("#accountMenu summary").click();
  await page.locator("#homeView").getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(page.locator("#ffjudoAgendaView")).toBeVisible();
  return { page, rpc };
}

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 375, height: 812 }]
];

test("agenda: the view, its coach tab and its script are shipped without native dialogs", () => {
  const html = renderIndexHtml();
  assert.match(html, /<section id="ffjudoAgendaView" class="panel hidden"/);
  assert.doesNotMatch(html, /openFfjudoAgenda/);
  assert.match(
    html,
    /class="mode-tab mode-tab-active" aria-current="page"><svg[^>]*class="mode-tab-icon"[\s\S]*?<span>Agenda<\/span><\/button>/
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
    // AGD-014 : une clôture passée se lit « Inscriptions closes ».
    await expect(cards.nth(1).locator(".agenda-card-closed")).toHaveText("Inscriptions closes");
    await expect(cards.nth(2)).not.toContainText("Inscriptions");
    // AGD-017 : le jour de la semaine précède la date.
    await expect(first.locator(".agenda-card-date")).toHaveText(
      /^(lun|mar|mer|jeu|ven|sam|dim)\. \d{2}\/\d{2}$/
    );
    await expect(cards.nth(1).locator(".agenda-card-date")).toHaveText(
      /^\w+\. \d{2}\/\d{2} → \w+\. \d{2}\/\d{2}$/
    );
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
    // NAV-6 : l'onglet « Accueil » de l'agenda ramène à l'accueil coach.
    await page
      .locator("#ffjudoAgendaView")
      .getByRole("button", { name: "Accueil", exact: true })
      .click();
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

for (const [name, viewport] of VIEWPORTS) {
  test(`AGD-018 : une compétition de l'agenda devient une compétition club préremplie sur ${name}`, async (t) => {
    const cadet = {
      ...judoka,
      judokaId: "j-ines",
      firstName: "Inès",
      lastName: "Durand",
      accountEmail: "",
      ageCategory: "Cadet",
      clubId: "club-1",
      registrationSeason: 2099
    };
    const base = scenario([{ events: EVENTS, lastSyncAt: LAST_SYNC }]);
    const handle = (request) => {
      if (request.method === "getInitialData") return { ...base(request), judokas: [coach, cadet] };
      if (request.method === "saveClubCompetition") {
        const input = request.args[0];
        return {
          success: true,
          message: "Compétition club enregistrée.",
          clubCompetition: {
            clubCompetitionId: "cc-new",
            name: input.name,
            competitionDate: input.competitionDate,
            clubId: input.clubId
          },
          competitions: []
        };
      }
      return base(request);
    };
    const { page, rpc } = await openAgenda(t, handle, viewport);
    const cards = page.locator("#ffjudoAgendaView .agenda-card");
    await expect(cards).toHaveCount(3);
    // Seule une compétition propose le bouton : ni le stage, ni l'événement sans type.
    await expect(page.getByRole("button", { name: "Créer la compétition" })).toHaveCount(1);
    await page.screenshot({
      path: `output/playwright/agenda-creer-${name}-01-carte.png`,
      fullPage: true,
      animations: "disabled"
    });

    await cards.first().getByRole("button", { name: "Créer la compétition" }).click();
    await expect(page.locator("#clubCompetitionFormView")).toBeVisible();
    await expect(page.locator("#club_competition_name")).toHaveValue(
      "TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES"
    );
    await expect(page.locator("#club_competition_date")).toHaveValue(EVENTS[0].dateDebut);
    await expect(page.locator("#club_competition_categorie_age")).toHaveValue("Cadet");
    await expect(
      page
        .locator("#club_competition_niveau")
        .getByRole("radio", { name: "Départemental", exact: true })
    ).toHaveAttribute("aria-checked", "true");
    await page.screenshot({
      path: `output/playwright/agenda-creer-${name}-02-formulaire.png`,
      fullPage: true,
      animations: "disabled"
    });

    // Sans modification, « Retour » revient à l'agenda sans confirmation.
    await page.locator("#clubCompetitionFormView .page-back").click();
    await expect(page.locator("#ffjudoAgendaView")).toBeVisible();

    // Rien n'est enregistré avant « Enregistrer » ; l'enregistrement reprend les champs préremplis.
    assert.equal(
      rpc.some((request) => request.method === "saveClubCompetition"),
      false
    );
    await cards.first().getByRole("button", { name: "Créer la compétition" }).click();
    await page.locator("#clubCompetitionFormView").getByText("Inès Durand").click();
    await page.locator("#saveClubCompetitionButton").click();
    await expect
      .poll(() => rpc.filter((request) => request.method === "saveClubCompetition").length)
      .toBe(1);
    const saved = rpc.find((request) => request.method === "saveClubCompetition").args[0];
    assert.equal(saved.name, "TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES");
    assert.equal(saved.competitionDate, EVENTS[0].dateDebut);
    assert.equal(saved.ageCategory, "Cadet");
    assert.equal(saved.level, "Départemental");
    assert.equal(saved.clubId, "club-1");
    assert.deepEqual(saved.participantJudokaIds, ["j-ines"]);
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
  await expect(
    page.locator("#homeView").getByRole("button", { name: "Agenda", exact: true })
  ).toHaveCount(0);
  assert.equal(rpc.filter((request) => request.method === "getFfjudoEvents").length, 0);
});

const UV_SESSIONS = [
  {
    ...EVENTS[0],
    eventKey: "fed:uv-123",
    titre: "Examen UV1/2/3b n°1",
    typeEvenement: "PASSAGE DE GRADE",
    inscriptionCloture: "",
    uvs: ["UV1", "UV2", "UV3"]
  },
  {
    ...EVENTS[1],
    eventKey: "fed:uv-2",
    titre: "CD56 EXAMEN UV2",
    typeEvenement: "PASSAGE DE GRADE",
    dateFin: "",
    uvs: ["UV2"]
  },
  {
    ...EVENTS[2],
    eventKey: "fed:uv-3",
    titre: "TEST EFFICACITE COMBAT DU 1ER AU 4EME DAN",
    typeEvenement: "PASSAGE DE GRADE",
    uvs: ["UV3"],
    grades: [1, 2, 3, 4]
  },
  { ...EVENTS[0], uvs: [] },
  // AGD-016 : un passage de grade dont le titre ne nomme aucune UV.
  {
    ...EVENTS[0],
    eventKey: "fed:grade-sans-uv",
    titre: "PASSAGE DE GRADE CEINTURE NOIRE",
    typeEvenement: "PASSAGE DE GRADE",
    inscriptionCloture: "",
    uvs: []
  }
];

for (const [name, viewport] of VIEWPORTS) {
  test(`AGD-013 : le filtre UV garde les séances qui proposent toutes les UV cochées sur ${name}`, async (t) => {
    const { page } = await openAgenda(
      t,
      scenario([{ events: UV_SESSIONS, lastSyncAt: LAST_SYNC }]),
      viewport
    );
    const cards = page.locator("#ffjudoAgendaView .agenda-card");
    await expect(cards).toHaveCount(5);
    // AGD-015 : le grade visé précède les UV.
    await expect(
      cards.filter({ hasText: "TEST EFFICACITE COMBAT" }).locator(".agenda-card-uvs")
    ).toHaveText("1er au 4e dan · UV3");
    await expect(page.locator("#ffjudoAgendaUnlabeledHint")).toHaveCount(0);
    const uv1 = page.locator("#ffjudoAgendaUv1");
    const uv2 = page.locator("#ffjudoAgendaUv2");
    await expect(uv1).toHaveAttribute("aria-pressed", "false");
    await expect(
      cards.filter({ hasText: "Examen UV1/2/3b" }).locator(".agenda-card-uvs")
    ).toHaveText("UV1 · UV2 · UV3");
    await expect(
      cards.filter({ hasText: "TOURNOI EXCELLENCE" }).locator(".agenda-card-uvs")
    ).toHaveCount(0);

    await uv2.click();
    await expect(uv2).toHaveAttribute("aria-pressed", "true");
    await expect(cards).toHaveCount(2);
    // AGD-016 : le passage de grade sans UV renseignée est signalé, puis affiché à la demande.
    const hint = page.locator("#ffjudoAgendaUnlabeledHint");
    await expect(hint).toContainText("1 passage de grade sans UV renseignée");
    await page.screenshot({
      path: `output/playwright/uv-after-${name}-uv2-sans-uv.png`,
      fullPage: true,
      animations: "disabled"
    });
    await hint.getByRole("button", { name: "Afficher" }).click();
    await expect(page.locator("#ffjudoAgendaUnlabeledGrades .agenda-card")).toHaveCount(1);
    await expect(page.locator("#ffjudoAgendaUnlabeledGrades")).toContainText(
      "PASSAGE DE GRADE CEINTURE NOIRE"
    );
    await page.screenshot({
      path: `output/playwright/uv-after-${name}-uv2-sans-uv-affiche.png`,
      fullPage: true,
      animations: "disabled"
    });
    await expect(cards).toHaveCount(3);
    await uv1.click();
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText("Examen UV1/2/3b n°1");
    await page.screenshot({
      path: `output/playwright/uv-after-${name}-uv1-uv2.png`,
      fullPage: true,
      animations: "disabled"
    });

    await page.locator("#ffjudoAgendaUv4").click();
    await expect(
      page.locator("#ffjudoAgendaView .agenda-month:not(#ffjudoAgendaUnlabeledGrades) .agenda-card")
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    await expect(cards).toHaveCount(5);
    await expect(page.locator("#ffjudoAgendaUnlabeledHint")).toHaveCount(0);
    await expect(uv1).toHaveAttribute("aria-pressed", "false");
    await page.screenshot({
      path: `output/playwright/uv-after-${name}-liste.png`,
      fullPage: true,
      animations: "disabled"
    });
  });
}
