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
const coreIndex = fs.readFileSync(path.join(root, "core", "index.js"), "utf8");
const adminService = fs.readFileSync(path.join(root, "core", "services", "admin.service.js"), "utf8");
const childrenService = fs.readFileSync(path.join(root, "core", "services", "children.service.js"), "utf8");
const competitionsService = fs.readFileSync(path.join(root, "core", "services", "competitions.service.js"), "utf8");
const profileService = fs.readFileSync(path.join(root, "core", "services", "profile.service.js"), "utf8");
const registrationService = fs.readFileSync(path.join(root, "core", "services", "registration.service.js"), "utf8");
const userContextService = fs.readFileSync(path.join(root, "core", "services", "user-context.service.js"), "utf8");
const permissions = fs.readFileSync(path.join(root, "core", "domain", "access", "permission-policy.js"), "utf8");
const accessInvitationDomain = fs.readFileSync(
  path.join(root, "core", "domain", "access", "access-invitation.js"),
  "utf8"
);
const competitionDomain = fs.readFileSync(path.join(root, "core", "domain", "competitions", "competition.js"), "utf8");
const seasonDomain = fs.readFileSync(path.join(root, "core", "domain", "season.js"), "utf8");
const seasonStatisticsDomain = fs.readFileSync(path.join(root, "core", "domain", "season-statistics.js"), "utf8");
const judokaDomain = fs.readFileSync(path.join(root, "core", "domain", "access", "judoka.js"), "utf8");
const emailDomain = fs.readFileSync(path.join(root, "core", "domain", "access", "email.js"), "utf8");
const judokasRepository = fs.readFileSync(path.join(root, "core", "repositories", "judokas.repository.js"), "utf8");
const invitationsRepository = fs.readFileSync(path.join(root, "core", "repositories", "invitations.repository.js"), "utf8");
const supabaseClient = fs.readFileSync(path.join(root, "core", "infra", "supabase-client.js"), "utf8");
const textHelpers = fs.readFileSync(path.join(root, "core", "shared", "text.js"), "utf8");
const sessionAuth = fs.readFileSync(path.join(root, "core", "auth", "session.js"), "utf8");
const rpc = fs.readFileSync(path.join(root, "api", "rpc.js"), "utf8");
const migrationFiles = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter(file => file.endsWith(".sql"))
  .sort();
const supabaseSchema = migrationFiles
  .map(file => fs.readFileSync(path.join(root, "supabase", "migrations", file), "utf8"))
  .join("\n");
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
  assert.doesNotMatch(uiBundle, /searchParams\.set\("response_type"/);
  assert.match(uiBundle, /async function parseVercelAuthCallback\(\)/);
  assert.match(uiBundle, /access_token/);
  assert.match(uiBundle, /refresh_token/);
  assert.match(uiBundle, /async function exchangeVercelAuthCode\(authCode\)/);
  assert.match(uiBundle, /grant_type=authorization_code/);
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
  assert.match(registrationService, /async function registerProfile\(email,\s*profile\)/);
  assert.match(registrationService, /const invitation = await adminService\.getAccessInvitation\(email\)/);
  assert.match(registrationService, /Accès non autorisé\. Une invitation est requise\./);
  assert.match(registrationService, /supabaseRpc\("register_profile"/);
  assert.match(registrationService, /p_type: invitation\.invited_profile_type \|\| "JUDOKA"/);
  assert.match(registrationService, /p_children: \[\]/);
  assert.doesNotMatch(registrationService, /child\.\$\{childId\.toLowerCase\(\)\}@kiroku\.local/);
  assert.equal(migrationFiles.length, 1);
  assert.match(supabaseSchema, /email text unique/i);
  assert.match(supabaseSchema, /create or replace function public\.register_profile/i);
  assert.match(supabaseSchema, /'mehdi\.elkouhen@gmail\.com'[\s\S]*'Mehdi'[\s\S]*'EL KOUHEN'[\s\S]*'ADMIN'/i);
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
  assert.match(uiBundle, /competition\.ownerJudokaId = resolveCompetitionOwnerSelection\(\);/);
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
  assert.match(competitionsService, /const domainCompetitionInput = toCanonicalCompetition\(competition\);/);
  assert.match(competitionsService, /const competitionDraft = createCompetition\(domainCompetitionInput,\s*ownerJudokaId\);/);
  assert.match(competitionsService, /const competitionId = domainCompetitionInput\.competitionId;/);
  assert.match(competitionsService, /return records\.map\(toCompetitionReadModel\);/);
  assert.match(competitionsService, /await competitionsRepository\.update\(competitionId,\s*competitionDraft\);/);
  assert.match(competitionsService, /await competitionsRepository\.insert\(competitionDraft,\s*idCompetition\);/);

  assert.match(competitionsService, /async function finalizeCompetition\(email,\s*idCompetition,\s*result\)/);
  assert.match(competitionsService, /const finalization = createPersistedCompetition\(toCanonicalCompetition\(competition\)\)\.finalize\(result\);/);
  assert.match(competitionsService, /await competitionsRepository\.updateResult\(idCompetition,\s*finalization\);/);
  assert.match(uiBundle, /id="competitionFinalizationView" class="panel hidden"/);
  assert.match(uiBundle, /<div class="mobile-action-bar primary-action">[\s\S]*id="finalizeCompetitionButton" class="button-secondary hidden" onclick="showCompetitionFinalizationForm\(\)"[\s\S]*Ajouter un combat/);
  assert.match(uiBundle, /function finalizeCompetition\(\)/);
  assert.match(uiBundle, /"finalizeCompetition",\s*\[\s*competitionId,\s*result\s*\]/);
  assert.doesNotMatch(uiBundle, /id="competition_classement"/);
  assert.match(uiBundle, /id="competition_result"/);
  assert.match(competitionDomain, /function createCompetitionDetailsDraft\(competition = \{\}\)/);
  assert.match(competitionDomain, /function createCompetitionFinalResult\(value\)/);
  assert.match(competitionDomain, /finalize\(finalResult\) \{/);
  assert.match(competitionDomain, /function cleanCompetitionText\(value\)/);
  assert.match(competitionDomain, /function createCompetitionDate\(value\)/);
  assert.match(competitionDomain, /ageCategory: cleanCompetitionText\(competition\.ageCategory\)/);
  assert.match(competitionDomain, /weightCategory: cleanCompetitionText\(competition\.weightCategory\)/);
  assert.doesNotMatch(competitionDomain, /nom:\s*name/);
  assert.doesNotMatch(competitionDomain, /categorie_age:/);
  assert.doesNotMatch(competitionDomain, /categorie_poids:/);
  assert.doesNotMatch(competitionDomain, /lieu:\s*""/);
  assert.doesNotMatch(competitionDomain, /poids_pesee:\s*""/);
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
  assert.match(childrenService, /async function getChildrenManagement\(email\)/);
  assert.match(childrenService, /async function saveManagedChild\(email,\s*child\)/);
  assert.match(childrenService, /const updatedChild = updateManagedChild\(\{/);
  assert.match(childrenService, /const childInput = toCanonicalManagedChild\(child\);/);
  assert.match(childrenService, /const childJudokaId = childInput\.judokaId;/);
  assert.match(childrenService, /children: \(await userContextService\.getParentManagedJudokas\(user\.id_judoka\)\)\.map\(toJudokaReadModel\)/);
  assert.match(childrenService, /await userContextService\.assertJudokaEmailAvailable\(updatedChild\.accountEmail,\s*childJudokaId\)/);
  assert.match(childrenService, /await userContextService\.assertJudokaEmailAvailable\(managedChild\.accountEmail,\s*idJudoka\)/);
  assert.match(childrenService, /const managedChild = createManagedChild\(\{/);
  assert.match(childrenService, /const deletionDecision = decideManagedChildRemoval\(\{/);
  assert.match(judokaDomain, /function createManagedChild\(\{ judokaId,\s*accountEmail,\s*name,\s*firstName,\s*lastName \}\)/);
  assert.match(judokaDomain, /judokaId: createJudokaId\(judokaId\)/);
  assert.match(judokaDomain, /function updateManagedChild\(\{ accountEmail,\s*name,\s*firstName,\s*lastName \}\)/);
  assert.match(emailDomain, /function createOptionalEmail\(value,\s*message = "Email invalide\."\)/);
  assert.match(judokaDomain, /function decideManagedChildRemoval\(\{ child,\s*hasCompetitions,\s*hasCombats,\s*hasOtherParentLink \}\)/);
  assert.match(childrenService, /async function deleteManagedChild\(email,\s*idJudoka\)/);
  assert.match(childrenService, /isParent: isParent\(domainUser\)/);
  assert.match(judokaDomain, /accessRole: "NORMAL"/);
});

test("admin can manage admins from a dedicated screen", () => {
  assert.match(uiBundle, /id="manageAdminsButton" class="button-secondary hidden" onclick="showAdminsManagement\(\)"/);
  assert.match(uiBundle, /id="adminsView" class="panel hidden"/);
  assert.match(uiBundle, /function showAdminsManagement\(keepMessage\)/);
  assert.match(uiBundle, /id="accessInvitationsList"/);
  assert.match(uiBundle, /id="accessInvitationFilter"/);
  assert.match(uiBundle, /id="invite_email"/);
  assert.match(uiBundle, /id="invite_profile_type"/);
  assert.match(uiBundle, /id="saveInvitationButton" onclick="saveAccessInvitation\(\)"/);
  assert.match(uiBundle, /function saveAccessInvitation\(\)/);
  assert.match(uiBundle, /function deleteAccessInvitation\(email\)/);
  assert.match(uiBundle, /function updateAccessInvitationSearch\(value\)/);
  assert.match(uiBundle, /function saveAdminRole\(\)/);
  assert.match(uiBundle, /function revokeAdminRole\(idJudoka,\s*name\)/);
  assert.match(adminService, /async function getAdminsManagement\(email\)/);
  assert.match(adminService, /accessInvitations: \(await getAccessInvitations\(\)\)\.map\(toInvitationReadModel\)/);
  assert.match(adminService, /async function saveAccessInvitation\(email,\s*targetEmail,\s*targetProfileType\)/);
  assert.match(adminService, /const invitation = createAccessInvitation\(\{/);
  assert.match(accessInvitationDomain, /invited_profile_type: createProfileType\(invited_profile_type\)/);
  assert.doesNotMatch(adminService, /"ADMIN", "JUDOKA", "PARENT"/);
  assert.match(adminService, /async function deleteAccessInvitation\(email,\s*invitedEmail\)/);
  assert.match(adminService, /async function grantAdminRole\(email,\s*targetEmail\)/);
  assert.match(adminService, /createJudoka\(toCanonicalJudoka\(target\)\)\.grantAdminRole\(\)/);
  assert.match(adminService, /createJudoka\(toCanonicalJudoka\(target\)\)\.revokeAdminRole\(user\.id_judoka\)/);
  assert.match(judokaDomain, /return \{ accessRole: createRole\("ADMIN"\) \};/);
  assert.match(judokaDomain, /return \{ accessRole: createRole\("NORMAL"\) \};/);
  assert.match(adminService, /async function revokeAdminRole\(email,\s*idJudoka\)/);
  assert.match(adminService, /Vous ne pouvez pas retirer vos propres droits admin/);
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
  assert.match(uiBundle, /return \[normalizeDisplayName\(j && j\.firstName\), normalizeLastName\(j && j\.lastName\)\]\.filter\(Boolean\)\.join\(" "\);/);
  assert.match(userContextService, /const managedJudokaIds = judokas\.map\(j => String\(j\.id_judoka\)\);/);
  assert.match(userContextService, /managedJudokaScope = createManagedJudokaScope\(managedJudokaIds\);/);
  assert.match(userContextService, /return \{ user, judokas, managedJudokaScope \};/);
  assert.match(userContextService, /assertCanAccessJudokaProfile\(toCanonicalJudoka\(user\),\s*targetId,\s*userContext\.managedJudokaScope\);/);
  assert.match(permissions, /function assertCanAccessJudokaProfile\(user,\s*idJudoka,\s*managedJudokaScope\)/);
  assert.match(permissions, /throw new Error\("Accès refusé à cette fiche judoka\."\);/);
  assert.match(profileService, /async function getJudokaProfile\(email,\s*idJudoka\)/);
  assert.match(seasonDomain, /function getCurrentSeasonBounds\(referenceDate = new Date\(\)\)/);
  assert.match(profileService, /const snapshot = buildJudokaProfileSnapshot\(\{/);
  assert.match(profileService, /competitions: competitions\.map\(toCanonicalCompetition\),/);
  assert.match(profileService, /combats: combats\.map\(toCanonicalCombat\),/);
  assert.match(seasonStatisticsDomain, /const seasonWins = seasonCombats\.filter\(c => String\(c\.result \|\| ""\)\.toUpperCase\(\) === "V"\)\.length;/);
  assert.match(seasonStatisticsDomain, /const seasonLosses = seasonCombats\.filter\(c => String\(c\.result \|\| ""\)\.toUpperCase\(\) === "D"\)\.length;/);
  assert.match(seasonStatisticsDomain, /const sortedCompetitions = \[\.\.\.competitions\]\.sort/);
  assert.match(seasonStatisticsDomain, /category: getCompetitionCategoryLabel\(lastCompetition\),/);
  assert.match(seasonStatisticsDomain, /weightCategory:/);
  assert.match(seasonStatisticsDomain, /seasonWins/);
  assert.match(seasonStatisticsDomain, /seasonLosses/);
  assert.match(seasonStatisticsDomain, /bestSeasonResults/);
});

test("admin owner selection is not restricted by parent-managed scope", () => {
  assert.match(permissions, /function getCompetitionOwnerJudokaId\(competition\) \{\s*return competition && competition\.ownerJudokaId;\s*\}/);
  assert.match(permissions, /function resolveCompetitionOwnerId\(user,\s*competition,\s*managedJudokaScope\) \{\s*const ownerJudokaId = getCompetitionOwnerJudokaId\(competition\);[\s\S]*if \(isAdmin\(user\)\) \{/);
  assert.match(permissions, /function isInManagedScope\(managedJudokaScope,\s*idJudoka\) \{\s*return Boolean\(managedJudokaScope && managedJudokaScope\.includes\(idJudoka\)\);/);
  assert.match(permissions, /function resolveJudokaDataAccess\(user,\s*managedJudokaScope\)/);
  assert.match(competitionsService, /const access = resolveJudokaDataAccess\(domainUser,\s*managedJudokaScope\);/);
});

test("judoka lookup uses an exact normalized email match", () => {
  assert.match(userContextService, /const normalizedEmail = normalizeEmail\(email\);/);
  assert.match(judokasRepository, /return supabaseSelectOne\("judokas", `select=\*&\$\{eqFilter\("email", email\)\}`\);/);
  assert.doesNotMatch(judokasRepository, /email=ilike\./);
});

test("combat mutations reload competition details after save", () => {
  assert.match(uiBundle, /"ajouterCombat"[\s\S]*showSuccess\(response\.message\);[\s\S]*resetCombatForm\(\);[\s\S]*openCompetition\(currentCompetition\.competitionId,\s*true\);/);
  assert.match(uiBundle, /"updateCombat"[\s\S]*showSuccess\(response\.message\);[\s\S]*resetCombatForm\(\);[\s\S]*openCompetition\(currentCompetition\.competitionId,\s*true\);/);
  assert.doesNotMatch(uiBundle, /judoka_nom: currentUser \? getJudokaDisplayName\(currentUser\) : ""/);
});

test("vercel runtime lets the connected user log out", () => {
  assert.match(uiBundle, /\.user-actions\s*\{[\s\S]*?display: flex;/);
  assert.match(css, /\.user-pill\s*\{[\s\S]*?padding:\s*0 10px;[\s\S]*?height:\s*38px;[\s\S]*?min-height:\s*38px;[\s\S]*?max-height:\s*38px;[\s\S]*?line-height:\s*1;[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;/);
  assert.match(css, /\.logout-button\s*\{[\s\S]*?height:\s*38px;[\s\S]*?min-height:\s*38px;[\s\S]*?max-height:\s*38px;/);
  assert.match(uiBundle, /id="userInfo"/);
  assert.match(uiBundle, /id="logoutButton"/);
  assert.match(uiBundle, /aria-label="Déconnexion"/);
  assert.match(uiBundle, /id="toastLayer" class="toast-layer"/);
  assert.match(uiBundle, /getJudokaDisplayName\(currentUser\)/);
  assert.match(uiBundle, /const toneClass = type === "success" \? "success" : "error";/);
  assert.match(uiBundle, /<p class="\$\{toneClass\}"><svg/);
  assert.match(uiBundle, /function clearToasts\(\)/);
  assert.match(uiBundle, /document\.getElementById\("message"\)\.innerHTML = "";\s*showToast\("success", message,\s*4000\);/);
  assert.match(uiBundle, /document\.getElementById\("message"\)\.innerHTML = "";\s*showToast\("error", error\.message \|\| error,\s*7000\);/);
  assert.match(uiBundle, /async function logoutUser\(\)/);
  assert.match(uiBundle, /auth\/v1\/logout/);
  assert.match(uiBundle, /clearVercelSession\(\)/);
  assert.match(uiBundle, /resetApplicationState\(\);/);
  assert.match(uiBundle, /showVercelLogin\(\);/);
});

test("vercel api keeps supabase api key usage server side", () => {
  assert.match(core, /module\.exports = require\("\.\.\/core"\);/);
  assert.match(coreIndex, /createAdminService/);
  assert.match(coreIndex, /createCompetitionsService/);
  assert.match(coreIndex, /createCombatsService/);
  assert.match(coreIndex, /buildJudokaProfileSnapshot/);
  assert.match(coreIndex, /\.\.\.adminService\.methods/);
  assert.match(coreIndex, /\.\.\.competitionsService\.methods/);
  assert.match(coreIndex, /\.\.\.combatsService\.methods/);
  assert.match(supabaseClient, /function isJwtLikeToken\(value\)/);
  assert.match(supabaseClient, /function createSupabaseHeaders\(apiKey,\s*options = \{\}\)/);
  assert.match(textHelpers, /function normalizeLastName\(value\)/);
  assert.match(adminService, /async function getAccessInvitation\(email\)/);
  assert.match(adminService, /async function getAccessInvitations\(\)/);
  assert.match(coreIndex, /const domainUser = toCanonicalJudoka\(user\);/);
  assert.match(coreIndex, /canManageChildren: permissions\.canManageChildrenProfile\(domainUser\)/);
  assert.match(client, /const roleLabel = isAdmin \? `ADMIN · \$\{profileTypeLabel\}` : profileTypeLabel;/);
  assert.match(sessionAuth, /\/auth\/v1\/user/);
  assert.match(competitionsService, /const enriched = toCombatReadModelsWithJudokas\(filtered,\s*judokas,/);
  assert.match(competitionsService, /formatJudokaDisplayName: judoka => `\$\{judoka\.firstName\} \$\{normalizeLastName\(judoka\.lastName\)\}`/);
  assert.match(client, /competition\.ownerJudokaId = resolveCompetitionOwnerSelection\(\);/);
  assert.doesNotMatch(client, /competition\.id_judoka = resolveCompetitionOwnerSelection\(\);/);
  assert.doesNotMatch(coreIndex, /auth\/v1\/signup/);
  assert.doesNotMatch(coreIndex, /auth\/v1\/admin\/users/);
  assert.match(rpc, /verifySupabaseUser\(accessToken\)/);
  assert.match(rpc, /methods\[body\.method\]/);
});
