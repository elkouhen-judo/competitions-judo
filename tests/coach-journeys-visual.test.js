const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Parcours du coach après et pendant une compétition (données fictives) : COACH-1 à COACH-7, SIMPL-1.

const CLUB = { clubId: "club-nantes", name: "Judo Club Nantes" };

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
  const judoka = (id, firstName) => ({
    judokaId: id,
    firstName,
    lastName: "Test",
    profileType: "JUDOKA",
    accessRole: "NORMAL",
    ageCategory: "Minime",
    clubId: CLUB.clubId,
    registrationSeason: 2099
  });
  const judokas = [
    judoka("j-hugo", "Hugo"),
    judoka("j-lea", "Léa"),
    judoka("j-nina", "Nina"),
    judoka("j-tom", "Tom")
  ];
  const yesterday = localDate(-1);
  const participation = (competitionId, clubCompetitionId, ownerJudokaId, date, extra = {}) => ({
    competitionId,
    clubCompetitionId,
    ownerJudokaId,
    name: clubCompetitionId === "cc-automne" ? "Coupe d'automne" : `Tournoi ${clubCompetitionId}`,
    competitionDate: date,
    ageCategory: "Minime",
    weightCategory: "",
    level: "Régional",
    result: "",
    coachReview: "",
    ...extra
  });
  // Coupe d'automne (hier) : Hugo a combattu sans bilan, Léa a combattu avec bilan, Nina n'a aucun combat.
  const clubCompetitions = [
    {
      clubCompetitionId: "cc-automne",
      name: "Coupe d'automne",
      competitionDate: yesterday,
      clubId: CLUB.clubId
    }
  ];
  const competitions = [
    participation("p-hugo", "cc-automne", "j-hugo", yesterday),
    participation("p-lea", "cc-automne", "j-lea", yesterday, {
      result: "1er",
      coachReview: "Belle compétition."
    }),
    participation("p-nina", "cc-automne", "j-nina", yesterday)
  ];
  // COACH-6 : sept tournois plus anciens attendent leur classement ; l'agenda en montre 5 en tout.
  for (let index = 1; index <= 7; index += 1) {
    const date = localDate(-10 - index);
    clubCompetitions.push({
      clubCompetitionId: `cc-${index}`,
      name: `Tournoi ${index}`,
      competitionDate: date,
      clubId: CLUB.clubId
    });
    competitions.push(participation(`p-${index}`, `cc-${index}`, "j-tom", date));
  }
  const combatRecords = {
    "p-hugo": { total: 2, wins: 1, losses: 1, draws: 0 },
    "p-lea": { total: 3, wins: 3, losses: 0, draws: 0 }
  };
  const combatsFor = (competitionId) =>
    Array.from({ length: combatRecords[competitionId]?.total || 0 }, (_, index) => ({
      combatId: `${competitionId}-c${index}`,
      competitionId,
      judokaId: competitions.find((c) => c.competitionId === competitionId).ownerJudokaId,
      opponent: `Adversaire ${index + 1}`,
      opponentStance: "",
      stage: "",
      result: index < (combatRecords[competitionId]?.wins || 0) ? "Victoire" : "Défaite",
      victoryType: "",
      scores: [],
      concededScores: [],
      notes: ""
    }));
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
            competitions,
            combatRecords,
            clubCompetitions,
            clubs: [CLUB],
            judokas: [coach, ...judokas]
          };
        } else if (request.method === "getClubCompetitionDetail") {
          const event = clubCompetitions.find((cc) => cc.clubCompetitionId === request.args[0]);
          const participations = competitions.filter(
            (c) => c.clubCompetitionId === event.clubCompetitionId
          );
          result = {
            clubCompetition: {
              id_club_competition: event.clubCompetitionId,
              nom: event.name,
              date: event.competitionDate,
              categorie_age: "Minime",
              niveau: "Régional",
              club_id: event.clubId
            },
            participations,
            judokas,
            combatRecords: Object.fromEntries(
              participations
                .filter((p) => combatRecords[p.competitionId])
                .map((p) => [p.competitionId, combatRecords[p.competitionId]])
            )
          };
        } else if (request.method === "getCompetitionDetail") {
          const competition = competitions.find((c) => c.competitionId === request.args[0]);
          result = {
            competition,
            combats: combatsFor(competition.competitionId),
            canEditCompetition: true
          };
        } else if (request.method === "saveCoachReview") {
          const competition = competitions.find((c) => c.competitionId === request.args[0]);
          competition.coachReview = request.args[1];
          result = { success: true, message: "Bilan enregistré." };
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

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 375, height: 812 }]
]) {
  test(`COACH-4 à 7 : judoka suivant, agenda et modification d'une compétition club sur ${name}`, async (t) => {
    const { server, url, rpc } = await startServer();
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
    const nativeDialogs = [];
    page.on("dialog", async (dialog) => {
      nativeDialogs.push(dialog.message());
      await dialog.dismiss();
    });
    t.after(async () => {
      await context.close();
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    });
    const shot = (step, fullPage = true) =>
      page.screenshot({
        path: `output/playwright/coach-journeys-${name}-${step}.png`,
        fullPage,
        animations: "disabled"
      });
    await page.goto(url);
    await page.locator("#homeView").waitFor({ state: "visible" });

    // Les bilans ne sont rappelés nulle part : ni groupe d'agenda, ni pastille.
    await expect(page.getByRole("heading", { name: "Bilans à écrire" })).toHaveCount(0);
    await expect(page.locator("#homeView")).not.toContainText("à écrire");
    // COACH-6 : 8 compétitions à classer, 5 affichées, le reste annoncé.
    const rankingsGroup = page
      .locator(".coach-agenda-group")
      .filter({ has: page.getByRole("heading", { name: "Classements à saisir" }) });
    await expect(rankingsGroup.locator(".agenda-item")).toHaveCount(5);
    await expect(rankingsGroup.locator(".agenda-more")).toHaveText(
      "+ 3 autres dans « Compétitions »"
    );
    await shot("01-agenda");

    // Sur la fiche, aucune ligne de participant ne réclame de bilan.
    await rankingsGroup.locator(".agenda-item").filter({ hasText: "Coupe d'automne" }).click();
    const participants = page.locator("#clubDetailParticipantsList .participant-card");
    await expect(participants).toHaveCount(3);
    const card = (judokaName) => participants.filter({ hasText: judokaName });
    await expect(page.locator("#clubCompetitionDetailView")).not.toContainText("Bilan à écrire");
    // SIMPL-1 : « Aucun combat saisi » sans couleur d'alerte.
    await expect(card("Nina")).toContainText("Aucun combat saisi");
    await shot("02-participants");

    // COACH-4 : la compétition de Léa propose le judoka suivant (l'ordre est celui de la fiche).
    await card("Léa").locator(".competition-open-button").click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await expect(page.locator("#nextClubParticipantButton")).toHaveText("Suivant : Hugo Test");
    await shot("03-suivant", false);
    await page.locator("#nextClubParticipantButton").click();
    await expect(page.locator("#coachReviewText")).toBeVisible();
    await expect(page.locator("#nextClubParticipantButton")).toHaveText("Suivant : Nina Test");

    // Le bilan de Hugo s'enregistre à la sortie du champ.
    await page
      .locator("#coachReviewText")
      .fill("Bon combat au sol, travailler les sorties de tapis.");
    await page.locator("#competitionTitle").click();
    await expect(page.locator(".autosave-status")).toHaveText("Enregistré");
    assert.deepEqual(
      rpc
        .filter((request) => request.method === "saveCoachReview")
        .map((request) => request.args[0]),
      ["p-hugo"]
    );
    await page.locator("#competitionView .page-back").click();
    await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();
    await page.locator("#clubCompetitionDetailView .page-back").click();

    // COACH-7 : en modification, le niveau se choisit en boutons et annuler une modification demande confirmation.
    await page
      .locator(".coach-agenda .agenda-item")
      .filter({ hasText: "Coupe d'automne" })
      .first()
      .click();
    await page.locator("#clubCompetitionDetailView .page-menu summary").click();
    await page.getByRole("menuitem", { name: "Modifier ou ajouter des judokas" }).click();
    await expect(page.locator("#club_detail_niveau [aria-checked='true']")).toHaveText("Régional");
    await page
      .locator("#club_detail_niveau")
      .getByRole("radio", { name: "National", exact: true })
      .click();
    // UIX-043 : un judoka ajouté passe en pastille et sort de la liste ; « Tout ajouter » prend le reste.
    const newChips = page.locator("#clubDetailNewJudokas .competition-chip");
    const candidates = page.locator("#clubDetailAvailableJudokas .pick-row");
    await expect(page.locator("#clubDetailSelectAll")).toHaveText("Tout ajouter");
    const firstName = (await candidates.first().locator("span").first().textContent()).trim();
    const candidateCount = await candidates.count();
    await candidates.first().click();
    await expect(newChips).toHaveText([`${firstName} ×`]);
    await expect(candidates).toHaveCount(candidateCount - 1);
    await page.getByRole("button", { name: `Retirer ${firstName}` }).click();
    await expect(newChips).toHaveCount(0);
    await page.locator("#clubDetailSelectAll").click();
    await expect(candidates).toHaveCount(0);
    await shot("04-modifier");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(page.locator("#confirmDialog")).toBeVisible();
    await expect(page.locator("#confirmDialogConfirm")).toHaveText("Annuler les modifications");
    await page.getByRole("button", { name: "Continuer la saisie" }).click();
    await expect(page.locator("#club_detail_niveau [aria-checked='true']")).toHaveText("National");
    await page.locator("#clubCompetitionDetailView .page-back").click();
    await expect(page.locator("#confirmDialogConfirm")).toHaveText("Quitter sans enregistrer");
    await page.locator("#confirmDialogConfirm").click();
    await expect(page.locator("#homeView")).toBeVisible();

    assert.deepEqual(nativeDialogs, []);
  });

  test(`UIX-016e : l'onglet « Judokas » liste les judokas du club sur ${name}`, async (t) => {
    const { server, url } = await startServer();
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
    await page.locator("#homeView").getByRole("button", { name: "Judokas", exact: true }).click();

    // Sans rien taper, le coach voit ses judokas, la recherche filtre la liste.
    const roster = page.locator("#homeJudokaRoster .competition-card");
    await expect(roster).toHaveCount(5);
    await expect(roster.filter({ hasText: "Hugo Test" })).toContainText("Minime");
    await page.screenshot({
      path: `output/playwright/coach-judokas-${name}-01-liste.png`,
      fullPage: true,
      animations: "disabled"
    });
    await page.locator("#filterJudokaText").fill("nin");
    await expect(roster).toHaveCount(1);
    await expect(page.locator("#filterJudokaDropdown")).toBeHidden();

    // Toucher un judoka le choisit : ses compétitions et sa fiche, la liste disparaît.
    await roster.first().locator("button").click();
    await expect(page.locator("#homeJudokaRoster")).toHaveCount(0);
    await expect(page.locator("#openHomeJudokaProfileButton")).toHaveText(/Fiche de Nina/);
    await expect(page.locator("#competitionsList")).toContainText("Coupe d'automne");
    await page.screenshot({
      path: `output/playwright/coach-judokas-${name}-02-choisi.png`,
      fullPage: true,
      animations: "disabled"
    });
  });
}

// RETOUR-1 : sur mobile, glisser depuis le bord gauche revient en arrière comme la flèche « ← ».
test("RETOUR-1 : glisser depuis le bord gauche revient en arrière sur mobile", async (t) => {
  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true
  });
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
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  async function swipe(from, to, { release = true } = {}) {
    await touch("touchStart", [{ x: from.x, y: from.y }]);
    const steps = 6;
    for (let step = 1; step <= steps; step += 1) {
      await touch("touchMove", [
        {
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps
        }
      ]);
    }
    if (release) await touch("touchEnd", []);
  }

  await page.goto(url);
  await page.locator("#homeView").waitFor({ state: "visible" });
  await page
    .locator(".coach-agenda .agenda-item")
    .filter({ hasText: "Coupe d'automne" })
    .first()
    .tap();
  await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();
  await page
    .locator("#clubDetailParticipantsList .participant-card")
    .filter({ hasText: "Léa" })
    .locator(".competition-open-button")
    .tap();
  await expect(page.locator("#competitionView")).toBeVisible();

  // Un geste trop court, ou parti du milieu de l'écran, ou vertical, ne fait rien.
  await swipe({ x: 6, y: 400 }, { x: 50, y: 400 });
  await swipe({ x: 120, y: 400 }, { x: 300, y: 400 });
  await swipe({ x: 6, y: 600 }, { x: 20, y: 300 });
  await expect(page.locator("#competitionView")).toBeVisible();

  // Une flèche sort du bord et se colore au seuil ; la page ne bouge pas. Le retour se fait au lâcher.
  await swipe({ x: 6, y: 400 }, { x: 200, y: 400 }, { release: false });
  await expect(page.locator(".swipe-back-indicator")).toHaveClass(/swipe-back-ready/);
  assert.equal(
    await page.locator("#competitionView").evaluate((element) => element.style.transform),
    ""
  );
  await page.screenshot({
    path: "output/playwright/retour-swipe-mobile-01-geste.png",
    animations: "disabled"
  });
  await touch("touchEnd", []);
  await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();
  await expect(page.locator("#competitionView")).toBeHidden();
  await page.screenshot({
    path: "output/playwright/retour-swipe-mobile-02-retour.png",
    animations: "disabled"
  });

  // Un formulaire modifié garde sa confirmation de sortie.
  await page.locator("#clubCompetitionDetailView .page-menu summary").tap();
  await page.getByRole("menuitem", { name: "Modifier ou ajouter des judokas" }).tap();
  await page
    .locator("#club_detail_niveau")
    .getByRole("radio", { name: "National", exact: true })
    .tap();
  await swipe({ x: 6, y: 300 }, { x: 200, y: 300 });
  await expect(page.locator("#confirmDialog")).toBeVisible();
  await expect(page.locator("#confirmDialogConfirm")).toHaveText("Quitter sans enregistrer");
  await page.getByRole("button", { name: "Continuer la saisie" }).tap();
  await expect(page.locator("#clubCompetitionDetailView")).toBeVisible();
  await expect(page.locator("#club_detail_niveau [aria-checked='true']")).toHaveText("National");
  // Pas de flèche retour sur l'accueil : le geste n'y fait rien.
  await page.locator("#clubCompetitionDetailView .page-back").tap();
  await page.locator("#confirmDialogConfirm").tap();
  await expect(page.locator("#homeView")).toBeVisible();
  await swipe({ x: 6, y: 400 }, { x: 200, y: 400 });
  await expect(page.locator("#homeView")).toBeVisible();
});
