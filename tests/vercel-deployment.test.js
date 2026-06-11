const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "Index.html"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const core = fs.readFileSync(path.join(root, "api", "_core.js"), "utf8");
const rpc = fs.readFileSync(path.join(root, "api", "rpc.js"), "utf8");
const profileRegistrationMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260610000006_transactional_profile_registration.sql"),
  "utf8"
);

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

test("vercel runtime uses google auth without password login", () => {
  assert.match(html, /function getSupabaseAnonymousAuthHeaders\(\)/);
  assert.match(html, /"Authorization": "Bearer " \+ runtimeConfig\.supabaseAnonKey/);
  assert.match(html, /kiroku_supabase_session/);
  assert.match(html, /\/auth\/v1\/token\?grant_type=refresh_token/);
  assert.doesNotMatch(html, /auth\/v1\/token\?grant_type=password/);
  assert.doesNotMatch(html, /auth\/v1\/signup/);
  assert.match(html, /id="googleLoginButton"/);
  assert.match(html, /function startGoogleLogin\(\)/);
  assert.match(html, /auth\/v1\/authorize/);
  assert.match(html, /searchParams\.set\("provider", "google"\)/);
  assert.match(html, /searchParams\.set\("redirect_to", getVercelAuthRedirectUrl\(\)\)/);
  assert.match(html, /function parseVercelAuthCallback\(\)/);
  assert.match(html, /access_token/);
  assert.match(html, /refresh_token/);
  assert.match(html, /Connexion Google impossible/);
  assert.doesNotMatch(html, /id="supabaseLoginForm"/);
  assert.doesNotMatch(html, /loginPassword/);
  assert.doesNotMatch(html, /Mot de passe oublié/);
  assert.doesNotMatch(vercel.rewrites.map(rewrite => rewrite.source).join("\n"), /auth-signup/);
});

test("vercel login creates only the initial judoka profile", () => {
  assert.match(html, /id="profileRegistrationForm"/);
  assert.match(html, /\.registerProfile\(profile\)/);
  assert.match(html, /profil judoka/);
  assert.doesNotMatch(html, /id="registrationType"/);
  assert.doesNotMatch(html, /registrationChildren/);
  assert.match(core, /async function registerProfile\(email,\s*profile\)/);
  assert.match(core, /supabaseRpc\("register_profile"/);
  assert.match(core, /p_type: "JUDOKA"/);
  assert.match(core, /p_children: \[\]/);
  assert.doesNotMatch(core, /child\.\$\{childId\.toLowerCase\(\)\}@kiroku\.local/);
  assert.match(profileRegistrationMigration, /alter column email drop not null/i);
  assert.match(profileRegistrationMigration, /create or replace function public\.register_profile/i);
});

test("successful initial load leaves the login view", () => {
  assert.match(html, /renderCompetitions\(\);\s*showView\("homeView"\);/);
});

test("judoka home keeps competition creation available", () => {
  assert.match(html, /id="addCompetitionButton" onclick="showCompetitionForm\(\)"/);
  assert.match(html, /document\.getElementById\("homeAdminActions"\)\.classList\.remove\("hidden"\);/);
  assert.doesNotMatch(html, /if \(!isAdmin && !isParent\) \{\s*document\.getElementById\("homeAdminActions"\)\.classList\.add\("hidden"\);/);
});

test("connected judoka can manage children from a dedicated screen", () => {
  assert.match(html, /id="manageChildrenButton" class="button-secondary hidden" onclick="showChildrenManagement\(\)"/);
  assert.match(html, /id="childrenView" class="panel hidden"/);
  assert.match(html, /function showChildrenManagement\(keepMessage\)/);
  assert.match(html, /function saveManagedChild\(\)/);
  assert.match(html, /function deleteManagedChild\(idJudoka,\s*name\)/);
  assert.match(core, /async function getChildrenManagement\(email\)/);
  assert.match(core, /async function saveManagedChild\(email,\s*child\)/);
  assert.match(core, /async function deleteManagedChild\(email,\s*idJudoka\)/);
  assert.match(core, /role: "PARENT"/);
});

test("vercel runtime shows the connected user without a logout button", () => {
  assert.match(html, /\.user-actions\s*\{[\s\S]*?display: flex;/);
  assert.match(html, /id="userInfo"/);
  assert.doesNotMatch(html, /id="logoutButton"/);
  assert.doesNotMatch(html, /function logoutUser\(\)/);
  assert.doesNotMatch(html, /auth\/v1\/logout/);
  assert.match(html, /clearVercelSession\(\)/);
});

test("vercel api keeps supabase api key usage server side", () => {
  assert.match(core, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(core, /function isJwtLikeToken\(value\)/);
  assert.match(core, /function createSupabaseHeaders\(apiKey,\s*options = \{\}\)/);
  assert.match(core, /canManageChildren: canManageChildrenProfile\(user\)/);
  assert.match(core, /\/auth\/v1\/user/);
  assert.doesNotMatch(core, /auth\/v1\/signup/);
  assert.doesNotMatch(core, /auth\/v1\/admin\/users/);
  assert.match(rpc, /verifySupabaseUser\(accessToken\)/);
  assert.match(rpc, /methods\[body\.method\]/);
});
