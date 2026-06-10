const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const code = fs.readFileSync(path.join(__dirname, "..", "Code.js"), "utf8");

test("apps script reads supabase credentials from script properties", () => {
  assert.match(code, /SUPABASE_URL_PROPERTY = "SUPABASE_URL"/);
  assert.match(code, /SUPABASE_SERVICE_ROLE_KEY_PROPERTY = "SUPABASE_SERVICE_ROLE_KEY"/);
  assert.match(code, /PropertiesService\.getScriptProperties\(\)/);
  assert.doesNotMatch(code, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']/);
});

test("apps script uses supabase rest helpers instead of spreadsheet access", () => {
  assert.match(code, /function supabaseRequest\(table,\s*query,\s*options\)/);
  assert.match(code, /function isJwtLikeToken\(value\)/);
  assert.match(code, /function createSupabaseHeaders\(apiKey,\s*options\)/);
  assert.match(code, /UrlFetchApp\.fetch/);
  assert.match(code, /authorizationToken: isJwtLikeToken\(config\.serviceRoleKey\) \? config\.serviceRoleKey : ""/);
  assert.doesNotMatch(code, /SpreadsheetApp/);
  assert.doesNotMatch(code, /getRowsAsObjects/);
});

test("business operations target supabase tables", () => {
  assert.match(code, /supabaseSelect\("judokas"/);
  assert.match(code, /function getChildrenManagement\(\)/);
  assert.match(code, /function saveManagedChild\(child\)/);
  assert.match(code, /function deleteManagedChild\(idJudoka\)/);
  assert.match(code, /supabaseInsert\("parent_judokas"/);
  assert.match(code, /CacheService\.getUserCache\(\)\.remove\("currentUser"\)/);
  assert.match(code, /supabaseSelect\("competitions"/);
  assert.match(code, /supabaseSelect\("combats"/);
  assert.match(code, /supabaseInsert\("combats"/);
  assert.match(code, /supabasePatch\("combats"/);
  assert.match(code, /supabaseDelete\("combats"/);
});
