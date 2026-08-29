const { test, expect } = require("@playwright/test");

const devUrl = process.env.PLAYWRIGHT_BASE_URL || "https://competitions-judo-dev.vercel.app/";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.use({
  storageState: storageState || undefined,
  viewport: { width: 1440, height: 900 },
  trace: "retain-on-failure"
});

test("crée et valide durablement la participation d'Ali du 29 août 2026", async ({ page }) => {
  test.setTimeout(120000);
  expect(storageState, "Définissez PLAYWRIGHT_STORAGE_STATE avec une session connectée d'Ali").toBeTruthy();

  const competitionName = "Test Playwright — Ali — 29 août 2026";
  await page.goto(devUrl, { waitUntil: "networkidle" });
  await expect(page.locator("#homeView")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#userInfo")).toContainText("COACH");

  await page.getByRole("button", { name: "Choisir un judoka" }).click();
  const judokaSelector = page.getByRole("textbox", { name: "Judoka consulté" });
  await judokaSelector.fill("Ali");
  await page.getByText("Ali EL KOUHEN", { exact: true }).click();
  await expect(page.locator("#homeActiveJudokaSummary")).toContainText("Ali EL KOUHEN");

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
    await page.locator("#clubFormJudokaSearch").fill("Ali");
    await page
      .locator("#clubCompetitionParticipants label")
      .filter({ hasText: "Ali EL KOUHEN" })
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
    .filter({ hasText: "Ali EL KOUHEN" });
  await expect(aliParticipant).toHaveCount(1);
  await aliParticipant.getByRole("button", { name: "Voir les combats" }).click();
  await expect(page.locator("#competitionView")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#competitionTitle")).toContainText(competitionName);
  await page.getByRole("button", { name: "Ajouter un combat" }).click();
  await expect(page.locator("#combatFormView")).toBeVisible();

  for (const [index, combat] of [
    [1, { result: "Victoire", decision: "Ippon", opponent: "Adversaire Playwright 1" }],
    [2, { result: "Défaite", decision: "Décision", opponent: "Adversaire Playwright 2" }],
    [3, { result: "Egalité", decision: "Hiki wake", opponent: "Adversaire Playwright 3" }]
  ]) {
    await page.locator("#combat_resultat").selectOption(combat.result);
    await page.locator("#combat_type_victoire").selectOption(combat.decision);
    await page.locator("#combat_adversaire").fill(combat.opponent);
    await page.locator("#saveCombatButton").click();
    await expect(page.locator("#competitionView")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#combatsList .combat-card")).toHaveCount(index);
    if (index < 3) {
      await page.getByRole("button", { name: "Ajouter un combat" }).click();
      await expect(page.locator("#combatFormView")).toBeVisible();
    }
  }

  await page.locator("#finalizeCompetitionButton").click();
  await expect(page.locator("#competitionFinalizationView")).toBeVisible();
  await page.locator("#finalization_classement").selectOption("1er");
  await page.locator("#competitionFinalizationView").getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.locator("#competitionView")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#competitionDate")).toContainText("29");
  await expect(page.locator("#competitionClassement")).toContainText("1er");
  await expect(page.locator("#combatsList .combat-card")).toHaveCount(3);
  await page.screenshot({ path: "output/playwright/dev-ali-competition-persisted.png", fullPage: true });
});
