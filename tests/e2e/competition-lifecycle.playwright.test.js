const { test, expect } = require("@playwright/test");

const devUrl = process.env.PLAYWRIGHT_BASE_URL || "https://competitions-judo-dev.vercel.app/";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;
// Nom affiché du judoka de test sur dev (ex. « Prénom NOM ») : aucune donnée réelle dans le dépôt.
const judokaName = process.env.PLAYWRIGHT_JUDOKA_NAME || "";
const judokaFirstName = judokaName.split(" ")[0] || "";

test.use({
  storageState: storageState || undefined,
  viewport: { width: 1440, height: 900 },
  trace: "retain-on-failure"
});

test("crée et valide durablement la participation du judoka de test du 29 août 2026", async ({ page }) => {
  test.setTimeout(120000);
  expect(storageState, "Définissez PLAYWRIGHT_STORAGE_STATE avec une session coach connectée").toBeTruthy();
  expect(judokaName, "Définissez PLAYWRIGHT_JUDOKA_NAME avec le nom affiché du judoka de test").toBeTruthy();

  const competitionName = `Test Playwright — ${judokaFirstName} — 29 août 2026`;
  await page.goto(devUrl, { waitUntil: "networkidle" });
  await expect(page.locator("#homeView")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#userInfo")).toContainText("COACH");

  await page.getByRole("button", { name: "Choisir un judoka" }).click();
  const judokaSelector = page.getByRole("textbox", { name: "Judoka consulté" });
  await judokaSelector.fill(judokaFirstName);
  await page.getByText(judokaName, { exact: true }).click();
  await expect(page.locator("#homeActiveJudokaSummary")).toContainText(judokaName);

  await page.getByRole("button", { name: "Accueil coach" }).click();
  await page.getByRole("button", { name: "Gérer les compétitions" }).click();
  const existingCompetition = page
    .locator("#homeView button")
    .filter({ hasText: competitionName });
  if (await existingCompetition.count()) {
    await existingCompetition.first().click();
  } else {
    await page.getByRole("button", { name: /Nouvelle compétition/ }).click();
    await expect(page.locator("#clubCompetitionFormView")).toBeVisible();
    await page.locator("#club_competition_name").fill(competitionName);
    await page.locator("#club_competition_date").fill("2026-08-29");
    await page.locator("#club_competition_categorie_age").selectOption("Minime");
    await page.locator("#club_competition_niveau").selectOption("Régional");
    await page.locator("#clubFormJudokaSearch").fill(judokaFirstName);
    await page
      .locator("#clubCompetitionParticipants label")
      .filter({ hasText: judokaName })
      .locator("input[type='checkbox']")
      .check();
    await page.locator("#saveClubCompetitionButton").click();
    await expect(page.locator("#homeView")).toBeVisible({ timeout: 30000 });
    await page
      .locator("#homeView button")
      .filter({ hasText: competitionName })
      .first()
      .click();
  }
  await expect(page.locator("#clubCompetitionDetailView")).toBeVisible({ timeout: 30000 });

  const aliParticipant = page
    .locator("#clubDetailParticipantsList article")
    .filter({ hasText: judokaName });
  await expect(aliParticipant).toHaveCount(1);
  await aliParticipant.getByRole("button", { name: "Voir les combats" }).click();
  await expect(page.locator("#competitionView")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#competitionTitle")).toContainText(competitionName);
  await page.getByRole("button", { name: "Ajouter un combat" }).click();
  await expect(page.locator("#combatFormView")).toBeVisible();

  for (const [index, combat] of [
    [1, { result: "Victoire", decision: "Ippon", opponent: "Adversaire Playwright 1" }],
    [2, { result: "Défaite", decision: "Décision", opponent: "Adversaire Playwright 2" }],
    [3, { result: "Égalité", decision: "Hiki wake", opponent: "Adversaire Playwright 3" }]
  ]) {
    await page.locator("#combat_resultat").getByRole("radio", { name: combat.result, exact: true }).click();
    if (combat.result !== "Égalité") {
      await page.locator("#combat_type_victoire").getByRole("radio", { name: combat.decision, exact: true }).click();
    }
    await page.locator("#combat_adversaire").fill(combat.opponent);
    await page.locator("#saveCombatButton").click();
    await expect(page.locator("#competitionView")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#combatsList .combat-card")).toHaveCount(index);
    if (index < 3) {
      await page.getByRole("button", { name: "Ajouter un combat" }).click();
      await expect(page.locator("#combatFormView")).toBeVisible();
    }
  }

  // Le classement se choisit sur la fiche de la compétition.
  await page.locator("#competitionRankingSection").getByRole("radio", { name: /1er/ }).click();

  await expect(page.locator("#competitionView")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#competitionSubtitle")).toContainText("29");
  await expect(page.locator("#competitionClassement")).toContainText("1er");
  await expect(page.locator("#combatsList .combat-card")).toHaveCount(3);
  await page.screenshot({ path: "output/playwright/dev-judoka-competition-persisted.png", fullPage: true });
});
