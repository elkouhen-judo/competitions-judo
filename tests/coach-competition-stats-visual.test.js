/* global document, window */
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

// Parcours coach (données fictives) : création d'une compétition club, puis ses statistiques.

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

const CLUB = { clubId: "club-1", name: "Judo Club Nantes" };
const MINIME_NAMES = [
  "Hugo Dubois",
  "Nina Durand",
  "Léo Petit",
  "Emma Roux",
  "Jules Blanc",
  "Lina Moreau",
  "Noah Girard",
  "Chloé Faure",
  "Tom André",
  "Zoé Mercier",
  "Adam Lambert",
  "Inès Bonnet"
];

function judoka(index, name, ageCategory) {
  const [firstName, lastName] = name.split(" ");
  return {
    judokaId: `judoka-${index}`,
    accountEmail: `judoka-${index}@example.com`,
    firstName,
    lastName,
    profileType: "JUDOKA",
    accessRole: "NORMAL",
    ageCategory,
    clubId: CLUB.clubId,
    gender: "Homme",
    handedness: "Droitier"
  };
}

function currentSeasonLabel() {
  const today = new Date();
  const startYear = today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
  return `Saison ${startYear}-${startYear + 1}`;
}

async function startServer({ clubs = [CLUB] } = {}) {
  const coach = {
    judokaId: "coach-1",
    accountEmail: "coach@example.com",
    firstName: "Alex",
    lastName: "Martin",
    profileType: "COACH",
    accessRole: "COACH",
    ageCategory: "Senior",
    clubId: CLUB.clubId
  };
  const judokas = [
    ...MINIME_NAMES.map((name, index) => judoka(index + 1, name, "Minime")),
    judoka(13, "Paul Simon", "Cadet"),
    judoka(14, "Sans Catégorie", "")
  ];
  const hugo = judokas[0];
  const nina = judokas[1];
  const rpc = [];
  const control = { failDashboard: false, savedCompetition: null };

  // Combats fictifs des deux participants : une victoire par Ippon, deux défaites sur Uchi-mata.
  const participations = [
    { competitionId: "participation-hugo", ownerJudokaId: hugo.judokaId, result: "3e" },
    { competitionId: "participation-nina", ownerJudokaId: nina.judokaId, result: "" }
  ];
  const conceded = [{ category: "Tachi-waza", technique: "Uchi-mata", value: "Waza-ari" }];
  const combats = [
    {
      combatId: "combat-1",
      judokaId: hugo.judokaId,
      competitionId: "participation-hugo",
      opponent: "Camille Leroy",
      opponentStance: "Droitier",
      result: "Victoire",
      victoryType: "Ippon",
      scores: [{ category: "Tachi-waza", technique: "Seoi-nage", value: "Ippon" }],
      concededScores: [],
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      competitionLevel: "Régional"
    },
    {
      combatId: "combat-2",
      judokaId: hugo.judokaId,
      competitionId: "participation-hugo",
      opponent: "Sacha Bernard",
      opponentStance: "",
      result: "Défaite",
      victoryType: "Waza-ari",
      scores: [],
      concededScores: conceded,
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      competitionLevel: "Régional"
    },
    {
      combatId: "combat-3",
      judokaId: nina.judokaId,
      competitionId: "participation-nina",
      opponent: "Maé Laurent",
      opponentStance: "Gaucher",
      result: "Défaite",
      victoryType: "Waza-ari",
      scores: [],
      concededScores: conceded,
      judokaGender: "Homme",
      judokaHandedness: "Droitier",
      competitionLevel: "Régional"
    }
  ];

  function dashboardFor(filters) {
    const name = control.savedCompetition ? control.savedCompetition.name : "Coupe de Nantes";
    const date = control.savedCompetition ? control.savedCompetition.competitionDate : "2026-11-28";
    const competitions = participations.map((participation) => ({
      competitionId: participation.competitionId,
      clubCompetitionId: "cc-1",
      ownerJudokaId: participation.ownerJudokaId,
      name,
      level: "Régional",
      result: participation.result,
      competitionDate: date
    }));
    const inScope = competitions.filter(
      (competition) =>
        (!filters.dateFrom || competition.competitionDate >= filters.dateFrom) &&
        (!filters.dateTo || competition.competitionDate <= filters.dateTo) &&
        (!filters.ageCategory || filters.ageCategory === "Minime")
    );
    const selected = (filters.competitionIds || []).length
      ? inScope.filter((competition) => filters.competitionIds.includes(competition.competitionId))
      : inScope;
    const selectedIds = new Set(selected.map((competition) => competition.competitionId));
    return {
      stats: computeCoachDashboardStats(
        combats.filter((combat) => selectedIds.has(combat.competitionId)),
        selected
      ),
      // Le serveur désigne la compétition club par sa dernière participation.
      availableCompetitions: inScope.length
        ? [
            {
              competitionId: "participation-nina",
              competitionIds: inScope.map((competition) => competition.competitionId),
              name,
              competitionDate: date
            }
          ]
        : []
    };
  }

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
        let payload = { result: null };
        if (request.method === "getInitialData") {
          payload.result = {
            user: coach,
            isAdmin: false,
            isCoach: true,
            isParent: false,
            competitions: [],
            clubCompetitions: control.savedCompetition ? [control.savedCompetition] : [],
            clubs,
            judokas: [coach, ...judokas]
          };
        } else if (request.method === "saveClubCompetition") {
          const input = request.args[0];
          control.savedCompetition = {
            clubCompetitionId: "cc-1",
            name: input.name,
            competitionDate: input.competitionDate,
            clubId: input.clubId
          };
          payload.result = {
            success: true,
            message: "Compétition club enregistrée.",
            clubCompetition: control.savedCompetition,
            competitions: []
          };
        } else if (request.method === "getClubCompetitionDetail") {
          const saved = control.savedCompetition;
          payload.result = {
            clubCompetition: {
              id_club_competition: "cc-1",
              nom: saved.name,
              date: saved.competitionDate,
              categorie_age: "Minime",
              niveau: "Régional",
              club_id: CLUB.clubId
            },
            participations,
            judokas,
            combatRecords: {
              "participation-hugo": { total: 2, wins: 1, losses: 1, draws: 0 },
              "participation-nina": { total: 1, wins: 0, losses: 1, draws: 0 }
            }
          };
        } else if (request.method === "getCoachDashboard") {
          payload = control.failDashboard
            ? { error: "Erreur serveur." }
            : { result: dashboardFor(request.args[0] || {}) };
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
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
  return { server, url: `http://127.0.0.1:${server.address().port}`, rpc, control };
}

async function openApp(t, viewport, options) {
  const { server, url, rpc, control } = await startServer(options);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)),
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
  return { page, context, rpc, control };
}

const methods = (rpc) => rpc.map((request) => request.method);

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }]
]) {
  test(`parcours coach : création d'une compétition puis ses statistiques sur ${name}`, async (t) => {
    const { page, context, rpc, control } = await openApp(t, viewport);
    const shot = (step) =>
      page.screenshot({
        path: `output/playwright/coach-flow-${name}-${step}.png`,
        fullPage: true,
        animations: "disabled"
      });
    const form = page.locator("#clubCompetitionFormView");
    const chips = page.locator("#clubCompetitionSelectedParticipants .competition-chip");
    const selectAll = page.locator("#clubCompetitionSelectAll");
    const levelRadio = (label) =>
      page.locator("#club_competition_niveau").getByRole("radio", { name: label });

    await page.getByRole("button", { name: "Compétitions", exact: true }).click();
    await page.locator("#addClubCompetitionButton").click();
    await expect(form).toBeVisible();
    // CREA-9 : niveau en boutons, une seule façon d'annuler (la flèche retour).
    await expect(form.locator("select#club_competition_niveau")).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Annuler" })).toHaveCount(0);
    await shot("01-form-empty");

    // CREA-1 : tous les champs exigés sont vérifiés avant l'envoi, sous le champ.
    await page.fill("#club_competition_date", "");
    await page.locator("#saveClubCompetitionButton").click();
    await expect(form.locator(".field-error")).toHaveText([
      "Indiquez le nom de la compétition.",
      "Indiquez la date.",
      "Choisissez la catégorie d'âge.",
      "Choisissez le niveau.",
      "Cochez au moins un judoka."
    ]);
    await expect(page.locator("#club_competition_name")).toBeFocused();
    assert.equal(methods(rpc).includes("saveClubCompetition"), false);

    await page.fill("#club_competition_name", "Coupe de Nantes");
    await page.fill("#club_competition_date", "2026-11-28");
    await page.selectOption("#club_competition_categorie_age", "Minime");
    await levelRadio("Régional").click();
    await expect(levelRadio("Régional")).toHaveAttribute("aria-checked", "true");
    // CREA-8 : le judoka du club sans catégorie d'âge est signalé.
    await expect(page.locator("#clubCompetitionUncategorized")).toHaveText(
      "1 judoka du club n'a pas de catégorie d'âge."
    );

    // CREA-4 : toute la catégorie en un toucher, toutes pages confondues.
    await selectAll.click();
    await expect(chips).toHaveCount(12);
    await expect(selectAll).toHaveText("Tout désélectionner");
    await selectAll.click();
    await expect(chips).toHaveCount(0);

    // CREA-5 : un judoka coché en page 2 reste visible en page 1.
    await page.getByRole("button", { name: "Page suivante" }).click();
    await page
      .locator("#clubCompetitionParticipants label")
      .filter({ hasText: "Inès Bonnet" })
      .locator("input")
      .check();
    await page.getByRole("button", { name: "Page précédente" }).click();
    await expect(chips).toHaveText(["Inès Bonnet ×"]);

    // CREA-6 : la recherche ne liste que les noms qui correspondent.
    await page.fill("#clubFormJudokaSearch", "du");
    await expect(page.locator("#clubCompetitionParticipants label")).toHaveText([
      "Hugo Dubois",
      "Nina Durand"
    ]);
    await selectAll.click();
    await expect(chips).toHaveCount(3);
    await page.getByRole("button", { name: "Retirer Inès Bonnet" }).click();
    await expect(chips).toHaveText(["Hugo Dubois ×", "Nina Durand ×"]);

    // CREA-7 : changer de catégorie annonce les judokas retirés.
    await page.selectOption("#club_competition_categorie_age", "Cadet");
    await expect(page.locator("#clubCompetitionFormNotice")).toHaveText(
      "2 judokas retirés : ils ne sont pas dans cette catégorie."
    );
    await expect(chips).toHaveCount(0);
    await page.selectOption("#club_competition_categorie_age", "Minime");
    await page.fill("#clubFormJudokaSearch", "du");
    await selectAll.click();
    await expect(chips).toHaveCount(2);
    await shot("02-form-filled");

    // CREA-3 : quitter un formulaire modifié demande confirmation.
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Retour", exact: true }).click();
    await expect(form).toBeVisible();

    // CREA-10 : la compétition créée s'ouvre, sans autre appel que l'enregistrement et l'ouverture.
    const callsBeforeSave = rpc.length;
    await page.locator("#saveClubCompetitionButton").click();
    await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();
    await expect(page.locator("#clubDetailParticipantsList article")).toHaveCount(2);
    assert.deepEqual(methods(rpc).slice(callsBeforeSave), [
      "saveClubCompetition",
      "getClubCompetitionDetail"
    ]);
    assert.equal(control.savedCompetition.name, "Coupe de Nantes");
    await shot("03-detail");

    // TDB-1 : les statistiques de la compétition en un toucher, en un seul appel.
    const callsBeforeStats = rpc.length;
    await page.locator("#clubCompetitionStatsButton").click();
    await expect(page.locator("#coachDashboardView")).toBeVisible();
    await expect(
      page.locator("#coachDashboardView .dashboard-kpis .mini-stat-value").first()
    ).toHaveText("3");
    const statsCalls = rpc.slice(callsBeforeStats);
    assert.deepEqual(methods(statsCalls), ["getCoachDashboard"]);
    assert.deepEqual(statsCalls[0].args[0].competitionIds, [
      "participation-hugo",
      "participation-nina"
    ]);
    const filterSummary = page.locator("#coachDashboardView .dashboard-filter-summary");
    await expect(filterSummary).toContainText("Saison 2026-2027");
    await expect(filterSummary).toContainText("Coupe de Nantes");

    // TDB-3 : résultats par judoka ; TDB-5 : techniques subies.
    await expect(page.locator("#coachDashboardJudokas .dashboard-judoka-row")).toHaveText([
      /Hugo Dubois\s*2 combats · 1 V · 1 D · 1 podium/,
      /Nina Durand\s*1 combat · 0 V · 1 D/
    ]);
    await expect(page.locator("#coachDashboardConcededTechniques .bar-row-head")).toHaveText([
      /Uchi-mata\s*2/
    ]);
    // TDB-7 : la synthèse parle de performance ; la légende Ippon porte sur tous les combats.
    await expect(page.locator("#coachDashboardView .dashboard-summary-insight")).toHaveText(
      "Point d'attention : 33 % de victoires sur 3 combats ; défaites surtout par Waza-ari."
    );
    await expect(
      page
        .locator("#coachDashboardView")
        .getByText("en part de tous les combats.", { exact: false })
    ).toBeVisible();

    // TDB-4 : un manque de saisie ouvre la liste des combats concernés.
    const opponentIssue = page
      .locator("#coachDashboardQualityIssues > li")
      .filter({ hasText: "de l'adversaire" });
    await opponentIssue.getByRole("button", { name: "Voir les combats" }).click();
    await expect(opponentIssue.locator(".quality-issue-combat")).toHaveText([
      "Hugo Dubois · Coupe de Nantes · contre Sacha Bernard"
    ]);

    // TDB-9 : chaque tuile et chaque section de statistiques porte une info-bulle.
    const untipped = await page.evaluate(() =>
      [
        ...document.querySelectorAll("#coachDashboardView .mini-stat"),
        ...document.querySelectorAll("#coachDashboardView .section h3")
      ]
        .filter(
          (element) => !["Filtres", "Analyse des combats"].includes(element.textContent.trim())
        )
        .filter((element) => !element.querySelector(".info-tip"))
        .map((element) => element.textContent.trim())
    );
    assert.deepEqual(untipped, []);
    const lastTip = page.locator("#coachDashboardView .dashboard-kpis .info-tip").last();
    await lastTip.focus();
    // La bulle se décale pour rester dans l'écran une fois affichée (transition comprise).
    await expect
      .poll(async () => {
        const bubble = await lastTip.locator(".info-tip-bubble").boundingBox();
        return bubble.x >= 0 && bubble.x + bubble.width <= viewport.width;
      })
      .toBe(true);
    // Capture à la taille réelle de l'écran : la capture pleine page élargit la fenêtre.
    await page.screenshot({
      path: `output/playwright/coach-flow-${name}-04b-info-tip.png`,
      animations: "disabled"
    });
    // Les bulles cachées des tuiles de droite ne rendent pas la page défilable en largeur.
    assert.equal(
      await page.evaluate(() => {
        window.scrollTo(1000, window.scrollY);
        return window.scrollX;
      }),
      0
    );
    await shot("04-competition-stats");

    // Le retour depuis ces statistiques ramène à la fiche de la compétition.
    await page.locator("#coachDashboardBackButton").click();
    await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();

    // TDB-6 : l'onglet « Stats » s'ouvre sur la saison en cours, sans la compétition.
    await page
      .locator("#clubCompetitionDetailView")
      .getByRole("button", { name: "Retour", exact: true })
      .click();
    await expect(page.locator("#homeView")).toBeVisible();
    await page.locator("#homeView").getByRole("button", { name: "Stats", exact: true }).click();
    await expect(page.locator("#coachDashboardView")).toBeVisible();
    await expect(page.locator("#coachDashboardBackButton")).toHaveCount(0);
    await expect(filterSummary).toHaveText(currentSeasonLabel());

    // Les filtres choisis sont gardés en quittant l'onglet.
    await page.getByRole("button", { name: "Afficher" }).click();
    await page.selectOption("#coachDashboard_categorie_age", "Minime");
    await expect(page.locator("#coachDashboardView .dashboard-kpis")).toBeVisible();
    await page
      .locator("#coachDashboardView")
      .getByRole("button", { name: "Accueil", exact: true })
      .click();
    await page.locator("#homeView").getByRole("button", { name: "Stats", exact: true }).click();
    await expect(filterSummary).toContainText("Minime");

    // TDB-8 : une date de fin avant la date de début s'affiche sous les dates, sans appel.
    await page.getByRole("button", { name: "Afficher" }).click();
    const callsBeforeDates = rpc.length;
    await page.fill("#coachDashboard_date_fin", "2020-01-01");
    await page.locator("#coachDashboard_date_fin").dispatchEvent("change");
    await expect(page.locator("#coachDashboardDateError")).toHaveText(
      "La date de début doit être antérieure ou égale à la date de fin."
    );
    await page.waitForTimeout(400);
    assert.equal(rpc.length, callsBeforeDates);
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(page.locator("#coachDashboardDateError")).toHaveCount(0);

    // TDB-2 : un échec garde les dernières statistiques et propose de réessayer.
    await page.selectOption("#coachDashboard_categorie_age", "Minime");
    await expect(page.locator("#coachDashboardView .dashboard-kpis")).toBeVisible();
    control.failDashboard = true;
    await page.selectOption("#coachDashboard_categorie_age", "");
    await expect(page.locator("#coachDashboardLoadError")).toContainText(
      "Statistiques indisponibles pour le moment."
    );
    await expect(page.getByText("Aucun combat trouvé pour ces filtres.")).toHaveCount(0);
    await expect(page.locator("#coachDashboardView .dashboard-kpis")).toBeVisible();
    await shot("05-stats-error");
    control.failDashboard = false;
    await page
      .locator("#coachDashboardLoadError")
      .getByRole("button", { name: "Réessayer" })
      .click();
    await expect(page.locator("#coachDashboardLoadError")).toHaveCount(0);

    // Hors connexion, le message dit que les statistiques demandent une connexion.
    await context.setOffline(true);
    await page.selectOption("#coachDashboard_categorie_age", "Minime");
    await expect(page.locator("#coachDashboardLoadError")).toContainText(
      "Les statistiques demandent une connexion."
    );
    await expect(page.getByText("Aucun combat trouvé pour ces filtres.")).toHaveCount(0);
    await context.setOffline(false);
  });
}

test("CREA-2 : un coach sans club ne peut pas remplir le formulaire", async (t) => {
  const { page, rpc } = await openApp(t, { width: 390, height: 844 }, { clubs: [] });
  await page.getByRole("button", { name: "Compétitions", exact: true }).click();
  await page.locator("#addClubCompetitionButton").click();
  const form = page.locator("#clubCompetitionFormView");
  await expect(form).toBeVisible();
  await expect(form.locator(".status-banner-warning")).toContainText(
    "Vous n'êtes rattaché à aucun club."
  );
  await expect(form.locator("#club_competition_name")).toHaveCount(0);
  await expect(form.locator("#saveClubCompetitionButton")).toHaveCount(0);
  assert.equal(methods(rpc).includes("saveClubCompetition"), false);
});
