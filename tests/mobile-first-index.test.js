const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "Index.html"), "utf8");

test("competition cards avoid redundant mobile action rows", () => {
  assert.equal(html.includes("<span class=\"meta-label\">Action</span>"), false);
  assert.equal(html.includes("<span class=\"meta-value\">Ouvrir</span>"), false);
});

test("mobile action bars are available for primary form and detail actions", () => {
  assert.match(html, /\.mobile-action-bar\s*\{/);
  assert.match(html, /class="mobile-action-bar primary-action"/);
  assert.match(html, /class="form-actions mobile-action-bar"/);
});

test("combat cards expose result as a first-class badge", () => {
  assert.match(html, /\.result-badge\s*\{/);
  assert.match(html, /<span class="result-badge/);
});

test("small-screen layout is the base and desktop is progressive", () => {
  assert.match(html, /@media \(min-width: 721px\)/);
  assert.match(html, /\.topbar\s*\{[\s\S]*?padding: 12px 12px 8px;/);
  assert.match(html, /\.app-shell\s*\{[\s\S]*?padding: 0 0 calc\(96px \+ env\(safe-area-inset-bottom\)\);/);
});

test("admin competition management stays visible on mobile", () => {
  assert.match(html, /id="homeAdminActions" class="toolbar admin-actions hidden"/);
  assert.match(html, /id="competitionAdminActions" class="competition-management-actions hidden"/);
  assert.match(html, /id="editCompetitionButton"/);
  assert.match(html, /id="deleteCompetitionButton"/);
  assert.match(html, /\.hidden\s*\{\s*display: none !important;/);
});

test("child management screen is available in the mobile action flow", () => {
  assert.match(html, /id="manageChildrenButton"/);
  assert.match(html, /id="childrenView" class="panel hidden"/);
  assert.match(html, /id="childrenList"/);
  assert.match(html, /id="child_prenom"/);
  assert.match(html, /id="child_nom"/);
  assert.match(html, /id="saveChildButton"/);
});

test("competition header actions share one aligned action row", () => {
  assert.match(html, /class="competition-header-actions"/);
  assert.doesNotMatch(html, /<div class="toolbar">\s*<button class="button-secondary" onclick="showHome\(\)">Retour<\/button>\s*<div id="competitionAdminActions" class="toolbar admin-actions hidden">/);
  assert.match(html, /\.competition-header-actions\s*\{/);
  assert.match(html, /\.competition-management-actions\s*\{/);
});

test("competition list exposes direct delete actions without nesting buttons", () => {
  assert.match(html, /class="card competition-card"/);
  assert.match(html, /class="card-button competition-open-button"/);
  assert.match(html, /onclick="deleteCompetitionFromList\(this\.dataset\.id,\s*this\.dataset\.name\)"/);
  assert.match(html, /function deleteCompetitionFromList\(id,\s*name\)/);
  assert.doesNotMatch(html, /<button class="card card-button"[\s\S]*?<button/);
});
