const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const root = path.join(__dirname, "..");
const { renderIndexHtml } = require(path.join(root, "api", "app.js"));
const css = fs.readFileSync(path.join(root, "assets", "app.css"), "utf8");

const viewMarkup = renderIndexHtml()
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<link[^>]*>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "");

async function inspectHeadingBorders(viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${viewMarkup}</body></html>`);

  const result = await page.evaluate(() => {
    document.querySelectorAll("[v-cloak]").forEach((element) => element.removeAttribute("v-cloak"));
    document.querySelectorAll(".hidden").forEach((element) => element.classList.remove("hidden"));

    const selectors = [
      ".section-heading > div > h3",
      ".panel-header > div:first-child > h2",
      ".form-section-heading h3",
      ".stat-label",
      ".meta-label",
      "label:not(.checkbox-row)",
      ".combat-section-kicker",
      ".combat-score-row-title"
    ];
    return selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const container = element.closest(
          ".section-heading, .panel-header, .form-section, .stat-card, .card"
        ) || element.parentElement;
        const containerRect = container.getBoundingClientRect();
        return {
          selector,
          text: element.textContent.replace(/\s+/g, " ").trim(),
          borderLeftWidth: parseFloat(style.borderLeftWidth),
          borderLeftStyle: style.borderLeftStyle,
          left: rect.left,
          containerLeft: containerRect.left
        };
      })
    );
  });

  await browser.close();
  return result;
}

async function captureLogo(viewport, name) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${viewMarkup}</body></html>`);
  await page.evaluate(() => {
    document.querySelectorAll("[v-cloak]").forEach((element) => element.removeAttribute("v-cloak"));
    document.querySelectorAll(".hidden").forEach((element) => element.classList.remove("hidden"));
  });
  fs.mkdirSync(path.join(root, "output", "playwright"), { recursive: true });
  const stage = process.env.LOGO_SCREENSHOT_STAGE || "after";
  const logo = page.locator(".brand-logo");
  const box = await logo.boundingBox();
  const expectedSize = viewport.width < 721 ? 36 : 52;
  assert.ok(box, `${name}: logo introuvable`);
  assert.equal(Math.round(box.width), expectedSize, `${name}: largeur de logo inattendue`);
  assert.equal(Math.round(box.height), expectedSize, `${name}: hauteur de logo inattendue`);
  await page.locator("#appHeader").screenshot({
    path: path.join(root, "output", "playwright", `logo-${stage}-${name}.png`)
  });
  await browser.close();
}

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 375, height: 844 }]
]) {
  test(`capture visuelle du logo ${name}`, async () => {
    await captureLogo(viewport, name);
  });

  test(`les labels de section gardent une bordure gauche visible et alignée sur ${name}`, async () => {
    const headings = await inspectHeadingBorders(viewport);
    assert.ok(headings.length > 0, "aucun label de widget trouvé dans le shell");

    for (const heading of headings) {
      assert.ok(
        heading.borderLeftWidth > 0 && heading.borderLeftStyle !== "none",
        `${name}: « ${heading.text} » doit avoir une bordure gauche visible`
      );
      assert.ok(
        heading.left >= heading.containerLeft - 0.5,
        `${name}: « ${heading.text} » ne doit pas commencer avant son conteneur`
      );
    }
  });
}
