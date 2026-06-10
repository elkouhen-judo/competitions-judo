const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "Index.html"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const core = fs.readFileSync(path.join(root, "api", "_core.js"), "utf8");
const rpc = fs.readFileSync(path.join(root, "api", "rpc.js"), "utf8");

test("vercel config routes the app shell and rpc endpoint", () => {
  assert.equal(vercel.version, 2);
  assert.deepEqual(vercel.rewrites[0], {
    source: "/api/rpc",
    destination: "/api/rpc"
  });
  assert.deepEqual(vercel.rewrites[1], {
    source: "/(.*)",
    destination: "/api/app"
  });
});

test("vercel runtime injects a compatible google.script.run adapter", () => {
  assert.match(html, /KIROKU_RUNTIME_CONFIG/);
  assert.match(html, /function createVercelRunner\(\)/);
  assert.match(html, /fetch\("\/api\/rpc"/);
  assert.match(html, /"Authorization": "Bearer " \+ session\.access_token/);
});

test("vercel runtime starts google oauth and stores the supabase session", () => {
  assert.match(html, /provider=google/);
  assert.match(html, /parseVercelAuthHash/);
  assert.match(html, /kiroku_supabase_session/);
  assert.match(html, /\/auth\/v1\/token\?grant_type=refresh_token/);
});

test("successful initial load leaves the login view", () => {
  assert.match(html, /renderCompetitions\(\);\s*showView\("homeView"\);/);
});

test("vercel api keeps supabase api key usage server side", () => {
  assert.match(core, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(core, /\/auth\/v1\/user/);
  assert.match(rpc, /verifySupabaseUser\(accessToken\)/);
  assert.match(rpc, /methods\[body\.method\]/);
});
