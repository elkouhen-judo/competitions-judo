// UI-TOK-001 : les couleurs, rayons et espacements de l'appli viennent des variables de :root,
// la même source que le design system « Ayumi design system ».
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "assets", "app.tailwind.css"), "utf8");
const rootBlock = css.match(/:root \{([\s\S]*?)\n {4}\}/);

function outsideRoot() {
  assert.ok(rootBlock, "bloc :root introuvable");
  return css.slice(0, rootBlock.index) + css.slice(rootBlock.index + rootBlock[0].length);
}

test("UI-TOK-001 : aucune couleur hexadécimale hors de :root", () => {
  const found = outsideRoot().match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(found, [], "utiliser une variable de :root (ajouter un token si besoin)");
});

test("UI-TOK-001 : les rayons du design system passent par leurs variables", () => {
  const found = outsideRoot().match(/border-radius:\s*(?:999|12|6)px\b/g) || [];
  assert.deepEqual(found, [], "utiliser var(--radius-pill), var(--radius) ou var(--radius-sm)");
});

test("UI-TOK-001 : un espacement entièrement dans l'échelle passe par --space-*", () => {
  const scale = new Set(["4px", "8px", "12px", "16px", "20px", "24px"]);
  const offenders = [];
  const declaration =
    /^\s+((?:row-|column-)?gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?):\s*([^;]+);$/gm;
  for (const match of outsideRoot().matchAll(declaration)) {
    const parts = match[2].trim().split(/\s+/);
    const literal = parts.every((part) => /^(\d+px|0|auto)$/.test(part));
    if (
      literal &&
      parts.every((part) => scale.has(part) || part === "0" || part === "auto") &&
      parts.some((part) => scale.has(part))
    ) {
      offenders.push(match[0].trim());
    }
  }
  assert.deepEqual(offenders, [], "utiliser var(--space-1) … var(--space-6)");
});

test("UI-TOK-001 : une seule teinte par état (success = win, warning = pending)", () => {
  assert.match(rootBlock[1], /--success: var\(--win\);/);
  assert.match(rootBlock[1], /--warning: var\(--pending\);/);
});
