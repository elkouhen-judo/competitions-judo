const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "Index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "app.css"), "utf8");
const client = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const appShell = fs.readFileSync(path.join(root, "api", "app.js"), "utf8");
const core = fs.readFileSync(path.join(root, "api", "_core.js"), "utf8");
const adminCore = fs.readFileSync(path.join(root, "api", "_core-admin.js"), "utf8");
const businessCore = fs.readFileSync(path.join(root, "api", "_core-business.js"), "utf8");
const rpc = fs.readFileSync(path.join(root, "api", "rpc.js"), "utf8");
const profileRegistrationMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260610000006_transactional_profile_registration.sql"),
  "utf8"
);
const uiBundle = `${html}\n${css}\n${client}`;

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

test("vercel runtime calls the rpc endpoint directly", () => {
  assert.match(appShell, /KIROKU_RUNTIME_CONFIG/);
  assert.match(appShell, /function getRuntimeAppUrl\(req\)/);
  assert.match(appShell, /function getCanonicalRedirectUrl\(req\)/);
  assert.match(appShell, /res\.redirect\(308,\s*redirectUrl\);/);
  assert.match(appShell, /appUrl:/);
  assert.match(appShell, /html\.replace\("<\/head>",/);
  assert.match(html, /href="\/api\/styles"/);
  assert.match(html, /src="\/api\/client" defer/);
  assert.match(uiBundle, /class="brand"/);
  assert.match(uiBundle, /async function runServer\(method,\s*args,\s*success,\s*failure\)/);
  assert.match(uiBundle, /fetch\("\/api\/rpc"/);
  assert.match(uiBundle, /"Authorization": "Bearer " \+ session\.access_token/);
  assert.doesNotMatch(uiBundle, /google\.script/);
});

test("vercel runtime uses google auth without password login", () => {
  assert.match(uiBundle, /function getSupabaseAnonymousAuthHeaders\(\)/);
  assert.match(uiBundle, /const baseUrl = runtimeConfig\.appUrl \|\| window\.location\.origin;/);
  assert.match(uiBundle, /return new URL\(window\.location\.pathname \|\| "\/", baseUrl\)\.toString\(\);/);
  assert.match(uiBundle, /"Authorization": "Bearer " \+ runtimeConfig\.supabaseAnonKey/);
  assert.match(uiBundle, /kiroku_supabase_session/);
  assert.match(uiBundle, /\/auth\/v1\/token\?grant_type=refresh_token/);
  assert.doesNotMatch(uiBundle, /auth\/v1\/token\?grant_type=password/);
  assert.doesNotMatch(uiBundle, /auth\/v1\/signup/);
  assert.match(uiBundle, /id="googleLoginButton"/);
  assert.match(uiBundle, /function startGoogleLogin\(\)/);
  assert.match(uiBundle, /auth\/v1\/authorize/);
  assert.match(uiBundle, /searchParams\.set\("provider", "google"\)/);
  assert.match(uiBundle, /searchParams\.set\("redirect_to", getVercelAuthRedirectUrl\(\)\)/);
  assert.match(uiBundle, /function parseVercelAuthCallback\(\)/);
  assert.match(uiBundle, /access_token/);
  assert.match(uiBundle, /refresh_token/);
  assert.match(uiBundle, /Connexion Google impossible/);
  assert.match(uiBundle, /function showInvitationRequired\(\)/);
  assert.match(uiBundle, /normalizedError\.includes\("invitation"\) \|\| normalizedError\.includes\("non autorisé"\)/);
  assert.match(uiBundle, /Accès non autorisé\./);
  assert.doesNotMatch(uiBundle, /id="supabaseLoginForm"/);
  assert.doesNotMatch(uiBundle, /loginPassword/);
  assert.doesNotMatch(uiBundle, /Mot de passe oublié/);
  assert.doesNotMatch(vercel.rewrites.map(rewrite => rewrite.source).join("\n"), /auth-signup/);
});

test("vercel login creates only the initial judoka profile", () => {
  assert.match(uiBundle, /id="profileRegistrationForm"/);
  assert.match(uiBundle, /"registerProfile",\s*\[\s*profile\s*\]/);
  assert.match(uiBundle, /Votre invitation est validée/);
  assert.doesNotMatch(uiBundle, /id="registrationType"/);
  assert.doesNotMatch(uiBundle, /registrationChildren/);
  assert.match(core, /async function registerProfile\(email,\s*profile\)/);
  assert.match(core, /const invitation = await adminModule\.getAccessInvitation\(email\)/);
  assert.match(core, /Accès non autorisé\. Une invitation est requise\./);
  assert.match(core, /supabaseRpc\("register_profile"/);
  assert.match(core, /p_type: invitation\.invited_profile_type \|\| "JUDOKA"/);
  assert.match(core, /p_children: \[\]/);
  assert.doesNotMatch(core, /child\.\$\{childId\.toLowerCase\(\)\}@kiroku\.local/);
  assert.match(profileRegistrationMigration, /alter column email drop not null/i);
  assert.match(profileRegistrationMigration, /create or replace function public\.register_profile/i);
});

test("successful initial load leaves the login view", () => {
  assert.match(uiBundle, /renderCompetitions\(\);\s*showView\("homeView"\);/);
});

test("judoka home keeps competition creation available", () => {
  assert.match(uiBundle, /id="addCompetitionButton" class="home-context-action" onclick="showHomeCompetitionForm\(\)"/);
  assert.match(uiBundle, /id="addCompetitionButtonText"/);
  assert.match(uiBundle, /id="addCompetitionButtonMeta"/);
  assert.match(uiBundle, /function showHomeCompetitionForm\(\)/);
  assert.match(uiBundle, /function resolveCompetitionOwnerSelection\(\)/);
  assert.match(uiBundle, /function getCompetitionOwnerRequiredMessage\(\)/);
  assert.match(uiBundle, /competition\.id_judoka = resolveCompetitionOwnerSelection\(\);/);
  assert.match(uiBundle, /showError\(\{ message: getCompetitionOwnerRequiredMessage\(\) \}\);/);
  assert.match(uiBundle, /function syncHomeContext\(\)/);
  assert.match(uiBundle, /function getHomeActiveJudokaId\(\)/);
  assert.match(uiBundle, /addCompetitionButton\.disabled = actionDisabled;/);
  assert.match(uiBundle, /profileButton\.disabled = actionDisabled;/);
  assert.match(uiBundle, /document\.getElementById\("homeAdminActions"\)\.classList\.remove\("hidden"\);/);
  assert.match(uiBundle, /id="homeActiveJudokaSummary" class="summary home-context-card"><\/div>\s*<div id="homeAdminActions" class="toolbar admin-actions hidden">[\s\S]*?<h3 id="homeCompetitionsTitle">/);
  assert.doesNotMatch(uiBundle, /if \(!isAdmin && !isParent\) \{\s*document\.getElementById\("homeAdminActions"\)\.classList\.add\("hidden"\);/);
});

test("competition persistence keeps categories and omits removed place and actual weight fields", () => {
  assert.match(businessCore, /categorie_age:\s*competition\.categorie_age \|\| ""/);
  assert.match(businessCore, /categorie_poids:\s*competition\.categorie_poids \|\| ""/);
  assert.doesNotMatch(businessCore, /lieu:\s*""/);
  assert.doesNotMatch(businessCore, /poids_pesee:\s*""/);
});

test("connected parent can manage children from a dedicated screen", () => {
  assert.match(uiBundle, /id="manageChildrenButton" class="button-secondary hidden" onclick="showChildrenManagement\(\)"/);
  assert.match(uiBundle, /id="childrenView" class="panel hidden"/);
  assert.match(uiBundle, /function showChildrenManagement\(keepMessage\)/);
  assert.match(uiBundle, /function saveManagedChild\(\)/);
  assert.match(uiBundle, /id="child_email"/);
  assert.match(uiBundle, /se connecter seuls si un email est renseigné/);
  assert.match(uiBundle, /function normalizeLastName\(value\)/);
  assert.match(uiBundle, /function deleteManagedChild\(idJudoka,\s*name\)/);
  assert.match(core, /async function getChildrenManagement\(email\)/);
  assert.match(core, /async function saveManagedChild\(email,\s*child\)/);
  assert.match(core, /const childEmail = normalizeEmail\(child && child\.email\)/);
  assert.match(core, /await assertJudokaEmailAvailable\(childEmail,\s*child && child\.id_judoka\)/);
  assert.match(core, /profile_type: "JUDOKA"/);
  assert.match(core, /email: childEmail \|\| null/);
  assert.match(core, /async function deleteManagedChild\(email,\s*idJudoka\)/);
  assert.match(core, /return isParent\(user\);/);
  assert.match(core, /role: "NORMAL"/);
});

test("admin can manage admins from a dedicated screen", () => {
  assert.match(uiBundle, /id="manageAdminsButton" class="button-secondary hidden" onclick="showAdminsManagement\(\)"/);
  assert.match(uiBundle, /id="adminsView" class="panel hidden"/);
  assert.match(uiBundle, /function showAdminsManagement\(keepMessage\)/);
  assert.match(uiBundle, /id="accessInvitationsList"/);
  assert.match(uiBundle, /id="invite_email"/);
  assert.match(uiBundle, /id="invite_profile_type"/);
  assert.match(uiBundle, /id="saveInvitationButton" onclick="saveAccessInvitation\(\)"/);
  assert.match(uiBundle, /function saveAccessInvitation\(\)/);
  assert.match(uiBundle, /function deleteAccessInvitation\(email\)/);
  assert.match(uiBundle, /function saveAdminRole\(\)/);
  assert.match(uiBundle, /function revokeAdminRole\(idJudoka,\s*name\)/);
  assert.match(adminCore, /async function getAdminsManagement\(email\)/);
  assert.match(adminCore, /accessInvitations: await getAccessInvitations\(\)/);
  assert.match(adminCore, /async function saveAccessInvitation\(email,\s*targetEmail,\s*targetProfileType\)/);
  assert.match(adminCore, /invited_profile_type: normalizedProfileType/);
  assert.doesNotMatch(adminCore, /"ADMIN", "JUDOKA", "PARENT"/);
  assert.match(adminCore, /async function deleteAccessInvitation\(email,\s*invitedEmail\)/);
  assert.match(adminCore, /async function grantAdminRole\(email,\s*targetEmail\)/);
  assert.match(adminCore, /role: "ADMIN"/);
  assert.match(adminCore, /role: "NORMAL"/);
  assert.match(adminCore, /async function revokeAdminRole\(email,\s*idJudoka\)/);
  assert.match(adminCore, /Vous ne pouvez pas retirer vos propres droits admin/);
});

test("judoka profile exposes season statistics through a dedicated screen", () => {
  assert.match(uiBundle, /id="openHomeJudokaProfileButton" class="button-secondary home-context-action" onclick="openHomeJudokaProfile\(\)"/);
  assert.match(uiBundle, /id="openHomeJudokaProfileButtonMeta"/);
  assert.match(uiBundle, /id="judokaView" class="panel hidden"/);
  assert.match(uiBundle, /id="judokaHeroAvatar"/);
  assert.match(uiBundle, /id="judokaHeroSummary"/);
  assert.match(uiBundle, /function openHomeJudokaProfile\(\)/);
  assert.match(uiBundle, /Sélectionnez un judoka actif pour ouvrir sa fiche/);
  assert.match(uiBundle, /Sélectionnez votre profil ou l'un de vos enfants comme judoka actif pour ouvrir la fiche/);
  assert.match(uiBundle, /Sélectionnez un judoka pour afficher son parcours/);
  assert.match(uiBundle, /Catégorie judoka/);
  assert.match(uiBundle, /Poids/);
  assert.match(uiBundle, /id="judokaSeasonCombatCount"/);
  assert.match(uiBundle, /id="judokaSeasonWins"/);
  assert.match(uiBundle, /id="judokaSeasonLosses"/);
  assert.match(uiBundle, /function showJudokaProfile\(idJudoka,\s*keepMessage\)/);
  assert.match(uiBundle, /function renderJudokaProfile\(\)/);
  assert.match(uiBundle, /return \[normalizeDisplayName\(j && j\.prenom\), normalizeLastName\(j && j\.nom\)\]\.filter\(Boolean\)\.join\(" "\);/);
  assert.match(core, /if \(isAdmin\(user\)\) \{\s*return \{ user, target \};\s*\}/);
  assert.match(core, /if \(isParent\(user\)\) \{\s*if \(!\(userContext\.managedJudokaIds \|\| \[\]\)\.includes\(String\(targetId\)\)\) \{\s*throw new Error\("Accès refusé à cette fiche judoka\."\);/);
  assert.match(core, /if \(String\(user\.id_judoka\) !== String\(targetId\)\) \{\s*throw new Error\("Accès refusé à cette fiche judoka\."\);/);
  assert.match(core, /async function getJudokaProfile\(email,\s*idJudoka\)/);
  assert.match(core, /function getCurrentSeasonBounds\(referenceDate = new Date\(\)\)/);
  assert.match(core, /const lastCompetitionForCategory = lastCombatCompetition \? lastCombatCompetition\.competition : lastCompetition;/);
  assert.match(core, /weightCategory:/);
  assert.match(core, /seasonWins/);
  assert.match(core, /seasonLosses/);
  assert.match(core, /bestSeasonResults/);
});

test("admin owner selection is not restricted by parent-managed scope", () => {
  assert.match(core, /function resolveCompetitionOwnerId\(user,\s*competition,\s*managedJudokaIds\) \{\s*if \(isAdmin\(user\)\) \{\s*const ownerJudokaId = competition\.id_judoka;\s*if \(!ownerJudokaId\) throw new Error\("Judoka participant obligatoire\."\);\s*return ownerJudokaId;\s*\}\s*if \(isParent\(user\)\) \{/);
  assert.match(core, /if \(isParent\(user\)\) \{\s*const ownerJudokaId = competition\.id_judoka;\s*if \(!ownerJudokaId\) throw new Error\("Judoka participant obligatoire\."\);\s*if \(!\(managedJudokaIds \|\| \[\]\)\.includes\(String\(ownerJudokaId\)\)\) \{\s*throw new Error\("Ce judoka n'est pas dans votre liste\."\);/);
});

test("judoka lookup uses an exact normalized email match", () => {
  assert.match(core, /const normalizedEmail = normalizeEmail\(email\);/);
  assert.match(core, /return supabaseSelectOne\("judokas", `select=\*&\$\{eqFilter\("email", normalizedEmail\)\}`\);/);
  assert.doesNotMatch(core, /email=ilike\./);
});

test("combat mutations reload competition details after save", () => {
  assert.match(uiBundle, /"ajouterCombat"[\s\S]*showSuccess\(response\.message\);[\s\S]*resetCombatForm\(\);[\s\S]*openCompetition\(currentCompetition\.id_competition,\s*true\);/);
  assert.match(uiBundle, /"updateCombat"[\s\S]*showSuccess\(response\.message\);[\s\S]*resetCombatForm\(\);[\s\S]*openCompetition\(currentCompetition\.id_competition,\s*true\);/);
  assert.doesNotMatch(uiBundle, /judoka_nom: currentUser \? getJudokaDisplayName\(currentUser\) : ""/);
});

test("vercel runtime shows the connected user without a logout button", () => {
  assert.match(uiBundle, /\.user-actions\s*\{[\s\S]*?display: flex;/);
  assert.match(uiBundle, /id="userInfo"/);
  assert.match(uiBundle, /id="toastLayer" class="toast-layer"/);
  assert.match(uiBundle, /getJudokaDisplayName\(currentUser\)/);
  assert.match(uiBundle, /const toneClass = type === "success" \? "success" : "error";/);
  assert.match(uiBundle, /<p class="\$\{toneClass\}"><svg/);
  assert.match(uiBundle, /function clearToasts\(\)/);
  assert.match(uiBundle, /document\.getElementById\("message"\)\.innerHTML = "";\s*showToast\("success", message,\s*4000\);/);
  assert.match(uiBundle, /document\.getElementById\("message"\)\.innerHTML = "";\s*showToast\("error", error\.message \|\| error,\s*7000\);/);
  assert.doesNotMatch(uiBundle, /id="logoutButton"/);
  assert.doesNotMatch(uiBundle, /function logoutUser\(\)/);
  assert.doesNotMatch(uiBundle, /auth\/v1\/logout/);
  assert.match(uiBundle, /clearVercelSession\(\)/);
});

test("vercel api keeps supabase api key usage server side", () => {
  assert.match(core, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(core, /createAdminModule/);
  assert.match(core, /createBusinessModule/);
  assert.match(core, /\.\.\.adminModule\.methods/);
  assert.match(core, /\.\.\.businessModule\.methods/);
  assert.match(core, /function isJwtLikeToken\(value\)/);
  assert.match(core, /function createSupabaseHeaders\(apiKey,\s*options = \{\}\)/);
  assert.match(core, /function normalizeLastName\(value\)/);
  assert.match(adminCore, /async function getAccessInvitation\(email\)/);
  assert.match(adminCore, /async function getAccessInvitations\(\)/);
  assert.match(core, /canManageChildren: canManageChildrenProfile\(user\)/);
  assert.match(client, /const roleLabel = isAdmin \? `ADMIN · \$\{profileTypeLabel\}` : profileTypeLabel;/);
  assert.match(core, /\/auth\/v1\/user/);
  assert.match(businessCore, /judoka_nom: judoka \? `\$\{judoka\.prenom\} \$\{normalizeLastName\(judoka\.nom\)\}` : combat\.id_judoka/);
  assert.doesNotMatch(core, /auth\/v1\/signup/);
  assert.doesNotMatch(core, /auth\/v1\/admin\/users/);
  assert.match(rpc, /verifySupabaseUser\(accessToken\)/);
  assert.match(rpc, /methods\[body\.method\]/);
});
