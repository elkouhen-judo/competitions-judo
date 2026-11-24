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

test("UI-TOK-001 : aucune transparence rgba() hors de :root", () => {
  const found = outsideRoot().match(/rgba?\([^)]*\)/g) || [];
  assert.deepEqual(found, [], "utiliser --overlay, --hover-tint, --shadow-* ou ajouter un token");
});

test("UI-TOK-001 : les rayons du design system passent par leurs variables", () => {
  const found = outsideRoot().match(/border-radius:[^;]*\b\d+px/g) || [];
  assert.deepEqual(
    found,
    [],
    "utiliser var(--radius-sm), var(--radius), var(--radius-card) ou var(--radius-pill)"
  );
});

test("UI-TOK-001 : les espacements passent par --space-* (sauf la hauteur des barres en zone sûre)", () => {
  const offenders = [];
  const declaration =
    /^\s+((?:row-|column-)?gap|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?):\s*([^;]+);$/gm;
  for (const match of outsideRoot().matchAll(declaration)) {
    const withoutSafeArea = match[2].replace(/calc\([^()]*env\(safe-area-inset-[a-z]+\)\)/g, "");
    if (/(?<![\w-])\d+px/.test(withoutSafeArea)) offenders.push(match[0].trim());
  }
  assert.deepEqual(offenders, [], "utiliser var(--space-0-5) … var(--space-8)");
});

test("UI-TOK-001 : une seule teinte par état (success = win, warning = pending)", () => {
  assert.match(rootBlock[1], /--success: var\(--win\);/);
  assert.match(rootBlock[1], /--warning: var\(--pending\);/);
});
