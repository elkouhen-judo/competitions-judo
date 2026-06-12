const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "Index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "assets", "app.css"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
const bundle = `${html}\n${css}\n${client}`;

test("competition cards avoid redundant mobile action rows", () => {
  assert.equal(bundle.includes("<span class=\"meta-label\">Action</span>"), false);
  assert.equal(bundle.includes("<span class=\"meta-value\">Ouvrir</span>"), false);
});

test("mobile action bars are available for primary form and detail actions", () => {
  assert.match(bundle, /\.mobile-action-bar\s*\{/);
  assert.match(bundle, /class="mobile-action-bar primary-action"/);
  assert.match(bundle, /class="form-actions mobile-action-bar"/);
});

test("notifications use a toast layer without shifting the main layout", () => {
  assert.match(bundle, /id="toastLayer" class="toast-layer"/);
  assert.match(bundle, /\.toast-layer\s*\{/);
  assert.match(bundle, /\.toast-close\s*\{/);
  assert.match(bundle, /showToast\("success", message,\s*4000\)/);
  assert.match(bundle, /showToast\("error", error\.message \|\| error,\s*7000\)/);
  assert.match(bundle, /function showToast\(type,\s*message,\s*duration\)/);
  assert.match(bundle, /function dismissToast\(toastId\)/);
});

test("combat cards expose result as a first-class badge", () => {
  assert.match(bundle, /\.result-badge\s*\{/);
  assert.match(bundle, /<span class="result-badge/);
});

test("small-screen layout is the base and desktop is progressive", () => {
  assert.match(bundle, /@media \(min-width: 721px\)/);
  assert.match(bundle, /\.topbar\s*\{[\s\S]*?padding: 12px 12px 8px;/);
  assert.match(bundle, /class="brand-logo"/);
  assert.match(bundle, /class="brand-logo-image"/);
  assert.match(bundle, /\.app-shell\s*\{[\s\S]*?padding: 0 0 calc\(96px \+ env\(safe-area-inset-bottom\)\);/);
});

test("admin competition management stays visible on mobile", () => {
  assert.match(bundle, /id="homeAdminActions" class="toolbar admin-actions hidden"/);
  assert.match(bundle, /id="homeActiveJudokaSummary" class="summary home-context-card"/);
  assert.match(bundle, /id="competitionAdminActions" class="competition-management-actions hidden"/);
  assert.match(bundle, /id="editCompetitionButton"/);
  assert.match(bundle, /id="finalizeCompetitionButton"/);
  assert.match(bundle, /id="deleteCompetitionButton"/);
  assert.match(bundle, /<div class="mobile-action-bar primary-action">[\s\S]*id="finalizeCompetitionButton"[\s\S]*Ajouter un combat/);
  assert.doesNotMatch(bundle, /id="competitionAdminActions" class="competition-management-actions hidden"[\s\S]*id="finalizeCompetitionButton"[\s\S]*id="deleteCompetitionButton"/);
  assert.match(bundle, /const hasResult = Boolean\(String\(currentCompetition\.result \|\| ""\)\.trim\(\)\);/);
  assert.match(bundle, /setHidden\("finalizeCompetitionButton", !canEditCurrentCompetition \|\| hasResult\);/);
  assert.match(bundle, /\.hidden\s*\{\s*display: none !important;/);
});

test("child management screen is available in the mobile action flow", () => {
  assert.match(bundle, /id="manageChildrenButton"/);
  assert.match(bundle, /id="childrenView" class="panel hidden"/);
  assert.match(bundle, /id="childrenList"/);
  assert.match(bundle, /id="child_prenom"/);
  assert.match(bundle, /id="child_nom"/);
  assert.match(bundle, /id="child_email"/);
  assert.match(bundle, /id="saveChildButton"/);
});

test("admin management screen is available in the mobile action flow", () => {
  assert.match(bundle, /id="manageAdminsButton"/);
  assert.match(bundle, /id="adminsView" class="panel hidden"/);
  assert.match(bundle, /id="adminsList"/);
  assert.match(bundle, /id="accessInvitationsList"/);
  assert.match(bundle, /id="accessInvitationFilter"/);
  assert.match(bundle, /id="invite_email"/);
  assert.match(bundle, /id="invite_profile_type"/);
  assert.match(bundle, /id="saveInvitationButton"/);
  assert.match(bundle, /id="admin_email"/);
  assert.match(bundle, /id="saveAdminButton"/);
});

test("judoka profile screen is available in the mobile action flow", () => {
  assert.match(bundle, /id="openHomeJudokaProfileButton"/);
  assert.match(bundle, /Ma fiche/);
  assert.match(bundle, /id="openHomeJudokaProfileButtonMeta"/);
  assert.match(bundle, /id="addCompetitionButtonMeta"/);
  assert.match(bundle, /id="judokaHero" class="judoka-hero"/);
  assert.match(bundle, /id="judokaHeroRecord" class="result-badge"/);
  assert.match(bundle, /Judoka actif/);
  assert.match(bundle, /Compétitions du judoka actif/);
  assert.match(bundle, /id="judokaView" class="panel hidden"/);
  assert.match(bundle, /id="judokaLastCompetition"/);
  assert.match(bundle, /id="judokaBestResults"/);
  assert.match(bundle, /id="judokaSeasonCombatCount"/);
  assert.match(bundle, /id="judokaSeasonWins"/);
  assert.match(bundle, /id="judokaSeasonLosses"/);
  assert.match(bundle, /id="competitionFinalizationView" class="panel hidden"/);
  assert.match(bundle, /id="finalization_classement"/);
  assert.doesNotMatch(bundle, /id="competition_classement"/);
});

test("home action buttons share one stable height", () => {
  assert.match(bundle, /#homeAdminActions button\s*\{[\s\S]*?min-height:\s*64px;/);
});

test("competition header actions share one aligned action row", () => {
  assert.match(bundle, /class="competition-header-actions"/);
  assert.doesNotMatch(bundle, /<div class="toolbar">\s*<button class="button-secondary" onclick="showHome\(\)">Retour<\/button>\s*<div id="competitionAdminActions" class="toolbar admin-actions hidden">/);
  assert.match(bundle, /\.competition-header-actions\s*\{/);
  assert.match(bundle, /\.competition-management-actions\s*\{/);
  assert.match(bundle, /\.judoka-hero\s*\{/);
  assert.match(bundle, /\.classement-badge\s*\{/);
});

test("competition list exposes direct delete actions without nesting buttons", () => {
  assert.match(bundle, /class="card competition-card"/);
  assert.match(bundle, /class="card-button competition-open-button"/);
  assert.match(bundle, /Ouvrir les combats/);
  assert.match(bundle, /onclick="deleteCompetitionFromList\(this\.dataset\.id,\s*this\.dataset\.name\)"/);
  assert.match(bundle, /function deleteCompetitionFromList\(id,\s*name\)/);
  assert.doesNotMatch(bundle, /<button class="card card-button"[\s\S]*?<button/);
});

test("mobile actions stay explicit instead of icon-only", () => {
  assert.match(bundle, /onclick="showCombatForm\(this\.dataset\.id\)"[\s\S]*?>[\s\S]*?Modifier\s*<\/button>/);
  assert.match(bundle, /onclick="deleteCombat\(this\.dataset\.id\)"[\s\S]*?>[\s\S]*?Supprimer\s*<\/button>/);
  assert.match(bundle, /onclick="deleteCompetitionFromList\(this\.dataset\.id,\s*this\.dataset\.name\)"[\s\S]*?>[\s\S]*?Supprimer\s*<\/button>/);
  assert.match(bundle, /Créer mon profil/);
  assert.doesNotMatch(bundle, /title="Éditer"/);
  assert.doesNotMatch(bundle, /title="Supprimer"/);
});

test("competition form keeps age and weight categories without place or actual weight", () => {
  assert.match(bundle, /id="competition_categorie_age"/);
  assert.match(bundle, /id="competition_categorie_poids"/);
  assert.match(bundle, /id="competitionResultBlock" class="hidden"/);
  assert.match(bundle, /id="competition_result"/);
  assert.match(bundle, /setHidden\("competitionResultBlock", false\);/);
  assert.match(bundle, /setHidden\("competitionResultBlock", true\);/);
  assert.doesNotMatch(bundle, /id="competition_lieu"/);
  assert.doesNotMatch(bundle, /id="competition_poids_pesee"/);
  assert.match(bundle, /<span id="competitionAgePoids"/);
});

test("new competition form defaults the date to today", () => {
  assert.match(bundle, /function getCurrentLocalDate\(\)/);
  assert.match(bundle, /competition_date: getCurrentLocalDate\(\),/);
});

test("owner autocomplete provides disambiguation metadata", () => {
  assert.match(bundle, /class="autocomplete-option-copy"/);
  assert.match(bundle, /class="autocomplete-option-meta"/);
  assert.match(bundle, /function getCompactJudokaLabel\(j\)/);
  assert.match(bundle, /function getClassementBadgeClass\(value\)/);
  assert.match(bundle, /function getJudokaInitials\(judoka\)/);
  assert.match(bundle, /function normalizeDisplayName\(value\)/);
  assert.match(bundle, /function normalizeLastName\(value\)/);
  assert.match(bundle, /function getJudokaSecondaryText\(judoka\)/);
  assert.match(bundle, /function getJudokaSearchText\(judoka\)/);
});

test("combat decision type appears only after choosing a result", () => {
  assert.match(bundle, /id="combatDecisionBlock" class="hidden"/);
  assert.match(bundle, /function syncCombatDecisionVisibility\(clearValueWhenHidden\)/);
  assert.match(bundle, /\$\("combat_resultat"\)\.addEventListener\("change",/);
});
