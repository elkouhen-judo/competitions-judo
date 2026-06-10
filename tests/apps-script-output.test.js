const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const code = fs.readFileSync(path.join(__dirname, "..", "Code.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "appsscript.json"), "utf8"));

test("web app output declares the mobile viewport through HtmlOutput", () => {
  assert.match(code, /\.addMetaTag\(\s*"viewport"\s*,\s*"width=device-width, initial-scale=1"\s*\)/);
});

test("manifest declares scopes required by Supabase access", () => {
  assert.ok(Array.isArray(manifest.oauthScopes));
  assert.ok(manifest.oauthScopes.includes("https://www.googleapis.com/auth/script.external_request"));
  assert.ok(manifest.oauthScopes.includes("https://www.googleapis.com/auth/script.storage"));
  assert.ok(manifest.oauthScopes.includes("https://www.googleapis.com/auth/userinfo.email"));
});
