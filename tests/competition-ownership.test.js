const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const code = fs.readFileSync(path.join(__dirname, "..", "Code.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "Index.html"), "utf8");

test("competitions are filtered by explicit owner for non-admin users", () => {
  assert.match(code, /function canManageCompetition\(user,\s*competition\)/);
  assert.match(code, /String\(competition\.id_judoka\)\s*===\s*String\(user\.id_judoka\)/);
  assert.match(code, /return competitions\.filter\(c =>\s*canManageCompetition\(user,\s*c\)\s*\)/);
});

test("saving a competition is allowed for owners and writes id_judoka", () => {
  assert.doesNotMatch(code, /Création et modification de compétition réservées aux admins/);
  assert.match(code, /const ownerJudokaId = resolveCompetitionOwnerId\(user,\s*competition\)/);
  assert.match(code, /supabasePatch\("competitions",/);
  assert.match(code, /supabaseInsert\("competitions",\s*\{/);
  assert.match(code, /id_judoka: ownerJudokaId/);
});

test("deleting a competition requires admin or owner and keeps cascade delete", () => {
  assert.match(code, /if \(!canManageCompetition\(user,\s*competition\)\)/);
  assert.match(code, /Suppression de cette compétition non autorisée/);
  assert.match(code, /supabaseDelete\("competitions",/);
  assert.match(code, /La suppression en cascade des combats est gérée par Supabase/);
});

test("client shows competition management based on canManageCompetition", () => {
  assert.match(html, /let canManageCurrentCompetition = false;/);
  assert.match(html, /canManageCurrentCompetition = Boolean\(data\.canManageCompetition\);/);
  assert.match(html, /classList\.toggle\("hidden",\s*!canManageCurrentCompetition\)/);
  assert.match(html, /id="competitionOwnerBlock" class="hidden full-row"/);
});

test("admin competition owner field supports name search and list selection", () => {
  assert.match(html, /id="competition_owner_search"/);
  assert.match(html, /oninput="filterCompetitionOwners\(\)"/);
  assert.match(html, /function filterCompetitionOwners\(\)/);
  assert.match(html, /function getJudokaDisplayName\(j\)/);
  assert.match(html, /fillCompetitionOwnersSelect\(idJudoka,\s*searchValue\)/);
  assert.match(html, /document\.getElementById\("competition_owner_search"\)\.value = getJudokaDisplayName\(owner\);/);
  assert.match(html, /competition\.id_judoka = document\.getElementById\("competition_id_judoka"\)\.value;/);
});
