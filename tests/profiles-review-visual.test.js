const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

const root = path.join(__dirname, "..");
const clientHandler = require(path.join(root, "api", "client.js"));
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));

// Revue des parcours par profil (données fictives) : ADMIN-1, ADMIN-2, PART-1, FAM-1.

const CLUB = { clubId: "club-nantes", name: "Judo Club Nantes" };

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

const person = (judokaId, firstName, extra = {}) => ({
  judokaId,
  firstName,
  lastName: "Test",
  accountEmail: `${firstName.toLowerCase()}@example.com`,
  profileType: "JUDOKA",
  accessRole: "NORMAL",
  ageCategory: "Minime",
  clubId: CLUB.clubId,
  registrationSeason: 2026,
  ...extra
});

async function startServer(scenario) {
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
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ result: scenario(request) }));
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

async function openApp(t, scenario, email, viewport) {
  const { server, url, rpc } = await startServer(scenario);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    (session) => localStorage.setItem("kiroku_supabase_session", JSON.stringify(session)),
    {
      access_token: tokenFor(email),
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
  return { page, rpc };
}

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 375, height: 812 }]
];

function adminScenario() {
  const admin = person("admin-1", "Alice", {
    accessRole: "NORMAL",
    isAdmin: true,
    adminAccess: true,
    clubId: ""
  });
  const users = [
    admin,
    person("j-lea", "Léa"),
    person("j-sam", "Sam", { clubId: "" }),
    person("j-tom", "Tom", { accessRole: "COACH" }),
    person("p-max", "Max", { profileType: "PARENT", clubId: "" })
  ];
  const page = (list) => ({ users: list, totalUsers: list.length, nextCursor: null });
  return (request) => {
    if (request.method === "getInitialData") {
      return {
        user: admin,
        isAdmin: true,
        isCoach: false,
        isParent: false,
        competitions: [],
        clubCompetitions: [],
        clubs: [],
        judokas: [admin]
      };
    }
    if (request.method === "getAdminsManagement") {
      return { user: admin, admins: [admin], ...page(users), accessInvitations: [] };
    }
    if (request.method === "getClubsManagement") {
      return {
        clubs: [
          { ...CLUB, coachIds: ["j-tom"], judokaCount: 2 },
          { clubId: "pole-espoir", name: "Pôle Espoir", coachIds: [], judokaCount: 0 }
        ],
        coaches: [users[3]]
      };
    }
    if (request.method === "getUsersPage") {
      const filter = request.args[0].filter;
      if (filter === "noClub")
        return page(
          users.filter((user) => user.profileType === "JUDOKA" && !user.clubId && user !== admin)
        );
      if (filter === "notRegistered") return page([]);
      if (filter === "coach") return page(users.filter((user) => user.accessRole === "COACH"));
      return page(users);
    }
    if (request.method === "setCoachClubs") {
      return { success: true, message: "Clubs coachés mis à jour." };
    }
    if (request.method === "setJudokaClubs") {
      return { success: true, message: "Club modifié." };
    }
    if (request.method === "grantCoachRole" || request.method === "revokeCoachRole") {
      return {
        success: true,
        message: request.method === "grantCoachRole" ? "Rôle coach accordé." : "Rôle coach retiré."
      };
    }
    return null;
  };
}

for (const [name, viewport] of VIEWPORTS) {
  test(`ADMIN-1 / ADMIN-2 : l'admin filtre les judokas et gère le rôle coach sur ${name}`, async (t) => {
    const { page, rpc } = await openApp(t, adminScenario(), "alice@example.com", viewport);
    await page.locator("#accountMenu summary").click();
    await page.getByRole("menuitem", { name: "Gestion des accès" }).click();
    await expect(page.locator("#adminsView")).toBeVisible();
    const cards = page.locator("#usersList .admin-card");
    await expect(cards).toHaveCount(5);
    // ADMIN-3 : une ligne par utilisateur ; le judoka sans club est signalé.
    await expect(cards.filter({ hasText: "Sam Test" }).locator(".admin-user-flag")).toHaveText(
      "Sans club"
    );
    await expect(cards.filter({ hasText: "Léa Test" })).toContainText("Judo Club Nantes");

    // ADMIN-2 : « Sans club » part au serveur et ne garde que les judokas sans club.
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Sans club" }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Sam Test");
    assert.equal(rpc.filter((r) => r.method === "getUsersPage").at(-1).args[0].filter, "noClub");
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-01-sans-club.png`,
      fullPage: true,
      animations: "disabled"
    });
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Non réinscrits" }).click();
    await expect(page.locator("#usersList .empty-state")).toHaveText(
      "Tous les judokas sont réinscrits pour la saison en cours."
    );
    // ADMIN-3 : « Coachs » part au serveur.
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Coachs" }).click();
    await expect(cards).toHaveCount(1);
    assert.equal(rpc.filter((r) => r.method === "getUsersPage").at(-1).args[0].filter, "coach");
    await page.locator("#usersKindFilter").getByRole("radio", { name: "Tous" }).click();
    await expect(cards).toHaveCount(5);

    // ADMIN-3 / CLUB-001 : les clubs se choisissent par le menu (club et pôle), avec un club principal,
    // puis une confirmation dans l'appli.
    const row = (fullName) => cards.filter({ hasText: fullName });
    await row("Sam Test").locator(".card-menu summary").click();
    await row("Sam Test").getByRole("menuitem", { name: "Modifier les clubs" }).click();
    const choice = row("Sam Test").locator(".admin-user-club-choice");
    await expect(choice.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    // UIX-043 : les clubs choisis en pastilles, les autres dans le menu « Ajouter un club… ».
    const addClub = choice.getByRole("combobox", { name: "Ajouter un club à Sam Test" });
    await addClub.selectOption({ label: "Judo Club Nantes" });
    await expect(choice.locator(".competition-chip")).toHaveText(["Judo Club Nantes ×"]);
    await expect(choice.getByRole("radiogroup", { name: "Club principal" })).toHaveCount(0);
    await addClub.selectOption({ label: "Pôle Espoir" });
    const main = choice.getByRole("radiogroup", { name: "Club principal" });
    await expect(main.getByRole("radio", { name: "Judo Club Nantes" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await main.getByRole("radio", { name: "Pôle Espoir" }).click();
    await expect(main.getByRole("radio", { name: "Pôle Espoir" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-01b-clubs.png`,
      animations: "disabled"
    });
    await choice.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#confirmDialog")).toContainText(
      "Rattacher Sam Test à Judo Club Nantes, Pôle Espoir (principal) ?"
    );
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-01c-confirmer-clubs.png`,
      animations: "disabled"
    });
    await page.locator("#confirmDialogConfirm").click();
    await expect
      .poll(() => rpc.filter((r) => r.method === "setJudokaClubs").map((r) => r.args))
      .toEqual([["j-sam", ["club-nantes", "pole-espoir"], "pole-espoir"]]);

    // UIX-043 : les clubs coachés en pastilles ; le menu ne propose que les autres clubs.
    await page.locator(".admin-sub-tabs").getByRole("button", { name: "Clubs" }).click();
    const coachClubs = page.locator("#coachClubsList .admin-card").filter({ hasText: "Tom Test" });
    await expect(coachClubs.locator(".competition-chip")).toHaveText(["Judo Club Nantes ×"]);
    const addCoachClub = coachClubs.getByRole("combobox", {
      name: "Ajouter un club coaché par Tom Test"
    });
    await expect(addCoachClub.locator("option")).toHaveText(["Ajouter un club…", "Pôle Espoir"]);
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-01d-clubs-coaches.png`,
      fullPage: true,
      animations: "disabled"
    });
    await addCoachClub.selectOption({ label: "Pôle Espoir" });
    await expect
      .poll(() => rpc.filter((r) => r.method === "setCoachClubs").map((r) => r.args))
      .toEqual([["j-tom", ["club-nantes", "pole-espoir"]]]);
    await page.locator(".admin-sub-tabs").getByRole("button", { name: "Utilisateurs" }).click();

    // ADMIN-1 : nommer coach un judoka ; jamais un parent.
    const card = (fullName) => cards.filter({ hasText: fullName });
    await card("Léa Test").locator(".card-menu summary").click();
    await page.screenshot({
      path: `output/playwright/profiles-admin-${name}-02-nommer-coach.png`,
      animations: "disabled"
    });
    await card("Léa Test").getByRole("menuitem", { name: "Nommer coach" }).click();
    await expect
      .poll(() => rpc.filter((r) => r.method === "grantCoachRole").map((r) => r.args[0]))
      .toEqual(["j-lea"]);
    await expect(card("Max Test").getByRole("menuitem", { name: "Nommer coach" })).toHaveCount(0);

    // Retirer le rôle coach demande confirmation dans l'appli.
    await card("Tom Test").locator(".card-menu summary").click();
    await card("Tom Test").getByRole("menuitem", { name: "Retirer le rôle coach" }).click();
    await expect(page.locator("#confirmDialog")).toBeVisible();
    await expect(page.locator("#confirmDialogConfirm")).toHaveText("Retirer le rôle coach");
    await page.locator("#confirmDialogConfirm").click();
    await expect
      .poll(() => rpc.filter((r) => r.method === "revokeCoachRole").map((r) => r.args[0]))
      .toEqual(["j-tom"]);
  });
}

function familyScenario({ childClubId, extraCompetitions = [] }) {
  const parent = person("p-1", "Claire", { profileType: "PARENT", clubId: "" });
  const child = person("j-hugo", "Hugo", { clubId: childClubId, accountEmail: "" });
  const linked = {
    competitionId: "p-hugo",
    clubCompetitionId: "cc-1",
    ownerJudokaId: "j-hugo",
    name: "Coupe d'automne",
    competitionDate: localDate(-1),
    ageCategory: "Minime",
    weightCategory: "",
    level: "Régional",
    result: "",
    coachReview: ""
  };
  return (request) => {
    if (request.method === "getInitialData") {
      return {
        user: parent,
        isAdmin: false,
        isCoach: false,
        isParent: true,
        competitions: childClubId ? [linked, ...extraCompetitions] : [],
        combatRecords: {},
        clubCompetitions: [],
        clubs: [],
        judokas: [parent, child]
      };
    }
    if (request.method === "getCompetitionDetail") {
      const competition =
        extraCompetitions.find((item) => item.competitionId === request.args[0]) || linked;
      return { competition, combats: [], canEditCompetition: true };
    }
    if (request.method === "finalizeCompetition") {
      linked.result = request.args[1];
      return { success: true, message: "Classement enregistré.", competition: { ...linked } };
    }
    return null;
  };
}

for (const [name, viewport] of VIEWPORTS) {
  test(`FAM-1 : un enfant sans club dit pourquoi il n'a aucune compétition sur ${name}`, async (t) => {
    const { page } = await openApp(
      t,
      familyScenario({ childClubId: "" }),
      "claire@example.com",
      viewport
    );
    await expect(page.locator("#competitionsList .empty-action-body")).toHaveText(
      "Hugo n'est rattaché à aucun club : aucun coach ne peut l'inscrire. Demandez au club de le rattacher."
    );
    await page.screenshot({
      path: `output/playwright/profiles-family-${name}-01-sans-club.png`,
      fullPage: true,
      animations: "disabled"
    });
  });

  test(`PART-1 : une participation à une compétition club ne se supprime pas depuis sa fiche sur ${name}`, async (t) => {
    const { page } = await openApp(
      t,
      familyScenario({ childClubId: CLUB.clubId }),
      "claire@example.com",
      viewport
    );
    await page.getByRole("button", { name: /Coupe d'automne/ }).click();
    await expect(page.locator("#competitionView")).toBeVisible();
    await page.locator("#competitionAdminActions summary").click();
    await expect(page.getByRole("menuitem", { name: "Modifier la compétition" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Supprimer la compétition" })).toHaveCount(0);
    await page.screenshot({
      path: `output/playwright/profiles-family-${name}-02-menu.png`,
      animations: "disabled"
    });
  });
}

for (const [name, viewport] of VIEWPORTS) {
  test(`ACCUEIL-5 : le parent classe la dernière compétition depuis l'accueil sur ${name}`, async (t) => {
    const { page, rpc } = await openApp(
      t,
      familyScenario({ childClubId: CLUB.clubId }),
      "claire@example.com",
      viewport
    );
    const todo = page.locator("#homePendingRanking");
    await expect(todo).toContainText("À faire");
    await expect(todo).toContainText("Quelle place pour Hugo à Coupe d'automne ?");
    await page.screenshot({
      path: `output/playwright/profiles-family-${name}-03-a-faire.png`,
      fullPage: true,
      animations: "disabled"
    });
    await todo.getByRole("button", { name: "3e", exact: true }).click();
    await expect(page.locator("#homeRankingSaved")).toContainText("Classement enregistré : 3e.");
    await expect(todo).toHaveCount(0);
    assert.deepEqual(rpc.find((request) => request.method === "finalizeCompetition").args, [
      "p-hugo",
      "3e"
    ]);
  });
}

for (const [name, viewport] of VIEWPORTS) {
  test(`FICHE-8 : la compétition liste les autres compétitions du judoka sur ${name}`, async (t) => {
    const other = (competitionId, label, days, result) => ({
      competitionId,
      ownerJudokaId: "j-hugo",
      name: label,
      competitionDate: localDate(days),
      ageCategory: "Minime",
      weightCategory: "",
      level: "Départemental",
      result,
      coachReview: ""
    });
    const extraCompetitions = [
      other("p-reze", "Tournoi de Rezé", -20, "3e"),
      other("p-noel", "Interclubs de Noël", 6, "")
    ];
    const { page, rpc } = await openApp(
      t,
      familyScenario({ childClubId: CLUB.clubId, extraCompetitions }),
      "claire@example.com",
      viewport
    );
    await page
      .getByRole("button", { name: /Coupe d'automne/ })
      .first()
      .click();
    await expect(page.locator("#competitionView")).toBeVisible();
    const side = page.locator("#competitionSideList");
    if (name === "mobile") {
      await expect(side).toBeHidden();
      return;
    }
    await expect(side).toBeVisible();
    await expect(side.locator(".competition-side-heading")).toHaveText(["À venir", "Passées"]);
    await expect(side.locator(".competition-side-item strong")).toHaveText([
      "Interclubs de Noël",
      "Coupe d'automne",
      "Tournoi de Rezé"
    ]);
    await expect(side.locator("[aria-current='page']")).toContainText("Classement à saisir");
    await page.screenshot({
      path: `output/playwright/competition-side-${name}-01.png`,
      animations: "disabled"
    });
    await side.getByRole("button", { name: /Tournoi de Rezé/ }).click();
    await expect(page.locator("#competitionTitle")).toHaveText("Tournoi de Rezé");
    await expect(side.locator("[aria-current='page']")).toContainText("Tournoi de Rezé");
    assert.equal(rpc.filter((r) => r.method === "getCompetitionDetail").at(-1).args[0], "p-reze");
  });
}

test("FAM-1 : un judoka sans club le lit dans « Mon espace »", async (t) => {
  const judoka = person("j-ines", "Inès", { clubId: "" });
  const { page } = await openApp(
    t,
    (request) =>
      request.method === "getInitialData"
        ? {
            user: judoka,
            isAdmin: false,
            isCoach: false,
            isParent: false,
            competitions: [],
            clubCompetitions: [],
            clubs: [],
            judokas: [judoka]
          }
        : null,
    "inès@example.com",
    { width: 375, height: 812 }
  );
  await expect(page.locator("#competitionsList .empty-action-body")).toHaveText(
    "Vous n'êtes rattaché à aucun club : aucun coach ne peut vous inscrire. Demandez au club de vous rattacher."
  );
  await page.screenshot({
    path: "output/playwright/profiles-judoka-mobile-01-sans-club.png",
    fullPage: true,
    animations: "disabled"
  });
});
