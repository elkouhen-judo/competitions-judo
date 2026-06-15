const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const appHandler = require(path.join(root, "api", "app.js"));
const html = appHandler.renderIndexHtml();
const css = fs.readFileSync(path.join(root, "assets", "app.css"), "utf8");
const notificationsClient = fs.readFileSync(
  path.join(root, "assets", "dist", "app-notifications.js"),
  "utf8"
);
const client = [
  fs.readFileSync(path.join(root, "assets", "vendor/vue.global.prod.js"), "utf8"),
  fs.readFileSync(path.join(root, "assets", "dist", "app-ui.js"), "utf8"),
  notificationsClient,
  ...[
    "app-auth.js",
    "app-screen-projections.js",
    "app-screen-login.js",
    "app-screen-home.js",
    "app-judoka-presentation.js",
    "app-screen-judoka.js",
    "app-screen-competition.js",
    "app-screen-children.js",
    "app-screen-admins.js",
    "app-runtime.js",
    "app.js"
  ].map((file) => fs.readFileSync(path.join(root, "assets", "dist", file), "utf8"))
].join("\n");
const appRuntimeClient = fs.readFileSync(
  path.join(root, "assets", "dist", "app-runtime.js"),
  "utf8"
);
const appBootstrapClient = fs.readFileSync(path.join(root, "assets", "dist", "app.js"), "utf8");
const judokaPresentationClient = fs.readFileSync(
  path.join(root, "assets", "dist", "app-judoka-presentation.js"),
  "utf8"
);
const screenProjectionsClient = fs.readFileSync(
  path.join(root, "assets", "dist", "app-screen-projections.js"),
  "utf8"
);
const judokaScreenClient = fs.readFileSync(
  path.join(root, "assets", "dist", "app-screen-judoka.js"),
  "utf8"
);
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const appShell = fs.readFileSync(path.join(root, "api", "app.js"), "utf8");
const core = fs.readFileSync(path.join(root, "api", "_core.js"), "utf8");
const coreIndex = fs.readFileSync(path.join(root, "core", "index.js"), "utf8");
const adminService = fs.readFileSync(
  path.join(root, "core", "services", "admin.service.js"),
  "utf8"
);
const childrenService = fs.readFileSync(
  path.join(root, "core", "services", "children.service.js"),
  "utf8"
);
const competitionsService = fs.readFileSync(
  path.join(root, "core", "services", "competitions.service.js"),
  "utf8"
);
const profileService = fs.readFileSync(
  path.join(root, "core", "services", "profile.service.js"),
  "utf8"
);
const registrationService = fs.readFileSync(
  path.join(root, "core", "services", "registration.service.js"),
  "utf8"
);
const userContextService = fs.readFileSync(
  path.join(root, "core", "services", "user-context.service.js"),
  "utf8"
);
const permissions = fs.readFileSync(
  path.join(root, "core", "domain", "access", "permission-policy.js"),
  "utf8"
);
const accessInvitationDomain = fs.readFileSync(
  path.join(root, "core", "domain", "access", "access-invitation.js"),
  "utf8"
);
const competitionDomain = fs.readFileSync(
  path.join(root, "core", "domain", "competitions", "competition.js"),
  "utf8"
);
const seasonDomain = fs.readFileSync(path.join(root, "core", "domain", "season.js"), "utf8");
const seasonStatisticsDomain = fs.readFileSync(
  path.join(root, "core", "domain", "season-statistics.js"),
  "utf8"
);
const judokaDomain = fs.readFileSync(
  path.join(root, "core", "domain", "access", "judoka.js"),
  "utf8"
);
const emailDomain = fs.readFileSync(
  path.join(root, "core", "domain", "access", "email.js"),
  "utf8"
);
const judokasRepository = fs.readFileSync(
  path.join(root, "core", "repositories", "judokas.repository.js"),
  "utf8"
);
const invitationsRepository = fs.readFileSync(
  path.join(root, "core", "repositories", "invitations.repository.js"),
  "utf8"
);
const supabaseClient = fs.readFileSync(
  path.join(root, "core", "infra", "supabase-client.js"),
  "utf8"
);
const textHelpers = fs.readFileSync(path.join(root, "core", "shared", "text.ts"), "utf8");
const sessionAuth = fs.readFileSync(path.join(root, "core", "auth", "session.js"), "utf8");
const rpc = fs.readFileSync(path.join(root, "api", "rpc.js"), "utf8");
const { CANONICAL_PRODUCTION_APP_URL, getCanonicalRedirectUrl, getRuntimeAppUrl } =
  appHandler.__internal;
const migrationFiles = fs
  .readdirSync(path.join(root, "supabase", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const supabaseSchema = migrationFiles
  .map((file) => fs.readFileSync(path.join(root, "supabase", "migrations", file), "utf8"))
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
  assert.match(
    appShell,
    /const CANONICAL_PRODUCTION_APP_URL = "https:\/\/competitions-judo\.vercel\.app";/
  );
  assert.match(appShell, /function getRuntimeAppUrl\(req\)/);
  assert.match(appShell, /function getCanonicalRedirectUrl\(req\)/);
  assert.match(appShell, /res\.redirect\(308,\s*redirectUrl\);/);
  assert.match(appShell, /appUrl:/);
  assert.match(appShell, /html\.replace\("<\/head>",/);
  assert.match(html, /href="\/api\/styles"/);
  assert.match(html, /src="\/api\/client" defer/);
  assert.doesNotMatch(html, /vue@3\/dist\/vue\.global\.prod\.js/);
  assert.match(client, /vue v3\./);
  assert.match(client, /var Vue=function/);
  assert.match(uiBundle, /class="brand"/);
  assert.match(uiBundle, /async function runServer\(method,\s*args,\s*success,\s*failure\)/);
  assert.match(uiBundle, /fetch\("\/api\/rpc"/);
  assert.match(uiBundle, /Authorization: "Bearer " \+ session\.access_token/);
  assert.doesNotMatch(uiBundle, /google\.script/);
});

test("vercel runtime falls back to the canonical production URL for preview hosts", () => {
  const request = {
    headers: {
      host: "competitions-judo-git-feature-1234.vercel.app",
      "x-forwarded-proto": "https"
    },
    url: "/login?source=preview"
  };
  const previousPublicAppUrl = process.env.PUBLIC_APP_URL;
  const previousAppUrl = process.env.APP_URL;
  const previousProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  try {
    assert.equal(getRuntimeAppUrl(request), CANONICAL_PRODUCTION_APP_URL);
    assert.equal(
      getCanonicalRedirectUrl(request),
      "https://competitions-judo.vercel.app/login?source=preview"
    );
  } finally {
    process.env.PUBLIC_APP_URL = previousPublicAppUrl;
    process.env.APP_URL = previousAppUrl;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProductionUrl;
  }
});

test("vercel runtime keeps localhost as-is for local development", () => {
  const request = {
    headers: {
      host: "localhost:3000",
      "x-forwarded-proto": "http"
    },
    url: "/"
  };
  const previousPublicAppUrl = process.env.PUBLIC_APP_URL;
  const previousAppUrl = process.env.APP_URL;
  const previousProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.PUBLIC_APP_URL;
  delete process.env.APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  try {
    assert.equal(getRuntimeAppUrl(request), "http://localhost:3000");
    assert.equal(getCanonicalRedirectUrl(request), "");
  } finally {
    process.env.PUBLIC_APP_URL = previousPublicAppUrl;
    process.env.APP_URL = previousAppUrl;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProductionUrl;
  }
});

test("vercel runtime uses google auth without password login", () => {
  assert.match(uiBundle, /function waitForSupabaseSessionReadiness\(accessToken\)/);
  assert.match(uiBundle, /function getSupabaseAnonymousAuthHeaders\(\)/);
  assert.match(uiBundle, /const baseUrl = runtimeConfig\.appUrl \|\| window\.location\.origin;/);
  assert.match(
    uiBundle,
    /return new URL\(window\.location\.pathname \|\| "\/", baseUrl\)\.toString\(\);/
  );
  assert.match(uiBundle, /Authorization: "Bearer " \+ runtimeConfig\.supabaseAnonKey/);
  assert.match(uiBundle, /kiroku_supabase_session/);
  assert.match(uiBundle, /fetch\(`\$\{runtimeConfig\.supabaseUrl\}\/auth\/v1\/user`,/);
  assert.match(uiBundle, /await waitForSupabaseSessionReadiness\(accessToken\);/);
  assert.match(uiBundle, /await waitForSupabaseSessionReadiness\(session\.access_token\);/);
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
  assert.match(uiBundle, /return \{ handled: true, completedAuth: false \};/);
  assert.match(uiBundle, /return \{ handled: false, completedAuth: true \};/);
  assert.match(uiBundle, /access_token/);
  assert.match(uiBundle, /refresh_token/);
  assert.match(uiBundle, /async function exchangeVercelAuthCode\(authCode\)/);
  assert.match(uiBundle, /grant_type=authorization_code/);
  assert.match(uiBundle, /app\.runServerWithOptions\(/);
  assert.match(
    uiBundle,
    /retrySessionOnce: Boolean\(callbackResult && callbackResult\.completedAuth\)/
  );
  assert.match(uiBundle, /Connexion Google impossible/);
  assert.match(uiBundle, /function showInvitationRequired\(\)/);
  assert.match(
    uiBundle,
    /normalizedError\.includes\("invitation"\) \|\| normalizedError\.includes\("non autorisé"\)/
  );
  assert.match(uiBundle, /Accès non autorisé\./);
  assert.doesNotMatch(uiBundle, /id="supabaseLoginForm"/);
  assert.doesNotMatch(uiBundle, /loginPassword/);
  assert.doesNotMatch(uiBundle, /Mot de passe oublié/);
  assert.doesNotMatch(vercel.rewrites.map((rewrite) => rewrite.source).join("\n"), /auth-signup/);
});

test("app bootstrap delegates to the extracted runtime", () => {
  assert.match(appRuntimeClient, /function createKirokuApp\(\)/);
  assert.match(appBootstrapClient, /window\.createKirokuApp\(\)/);
  assert.doesNotMatch(appBootstrapClient, /runServerWithOptions|logoutUser|applyInitialData/);
});

test("judoka presentation is extracted from the screen component", () => {
  assert.match(
    judokaPresentationClient,
    /function createJudokaProfileViewModel\(profile,\s*helpers\)/
  );
  assert.match(
    judokaScreenClient,
    /window\.createJudokaProfileViewModel\(state\.currentJudokaProfile,/
  );
  assert.doesNotMatch(
    judokaScreenClient,
    /heroSummary: `\$\{seasonCompetitionCount \|\| 0\} compétitions/
  );
});

test("screen projections are extracted into a shared helper module", () => {
  assert.match(screenProjectionsClient, /function projectManagedChildren\(children,\s*helpers\)/);
  assert.match(
    screenProjectionsClient,
    /function projectCompetitionDetail\(competition,\s*canEditCompetition,\s*helpers\)/
  );
  assert.doesNotThrow(() => new Function(screenProjectionsClient));
});

test("vercel login creates only the initial judoka profile", () => {
  assert.match(uiBundle, /id="profileRegistrationForm"/);
  assert.match(uiBundle, /"registerProfile",\s*\[\s*profile\s*\]/);
  assert.match(uiBundle, /Votre invitation est validée/);
  assert.doesNotMatch(uiBundle, /id="registrationType"/);
  assert.doesNotMatch(uiBundle, /registrationChildren/);
  assert.match(registrationService, /async function registerProfile\(email,\s*profile\)/);
  assert.match(
    registrationService,
    /const invitation = await adminService\.getAccessInvitation\(email\)/
  );
  assert.match(registrationService, /Accès non autorisé\. Une invitation est requise\./);
  assert.match(registrationService, /supabaseRpc\("register_profile"/);
  assert.match(registrationService, /p_type: invitation\.invited_profile_type \|\| "JUDOKA"/);
  assert.match(registrationService, /p_children: \[\]/);
  assert.doesNotMatch(registrationService, /child\.\$\{childId\.toLowerCase\(\)\}@kiroku\.local/);
  assert.equal(migrationFiles.length, 1);
  assert.match(supabaseSchema, /email text unique/i);
  assert.match(supabaseSchema, /create or replace function public\.register_profile/i);
  assert.match(
    supabaseSchema,
    /'mehdi\.elkouhen@gmail\.com'[\s\S]*'Mehdi'[\s\S]*'EL KOUHEN'[\s\S]*'ADMIN'/i
  );
});

test("successful initial load leaves the login view", () => {
  assert.match(uiBundle, /renderCompetitions\(\);[\s\S]*?showView\("homeView"\);/);
});

test("judoka home keeps competition creation available", () => {
  assert.match(
    uiBundle,
    /id="addCompetitionButton" v-if="canCreateCompetition" class="home-context-action" :disabled="actionDisabled" @click="showHomeCompetitionForm\(\)"/
  );
  assert.match(uiBundle, /id="addCompetitionButtonText"/);
  assert.match(uiBundle, /id="addCompetitionButtonMeta"/);
  assert.match(uiBundle, /function showHomeCompetitionForm\(\)/);
  assert.match(uiBundle, /function resolveCompetitionOwnerSelection\(\)/);
  assert.match(uiBundle, /function getCompetitionOwnerRequiredMessage\(\)/);
  assert.match(uiBundle, /competition\.ownerJudokaId = resolveCompetitionOwnerSelection\(\);/);
  assert.match(uiBundle, /showError\(\{ message: getCompetitionOwnerRequiredMessage\(\) \}\);/);
  assert.match(uiBundle, /function syncHomeContext\(\)/);
  assert.match(uiBundle, /function getHomeActiveJudokaId\(\)/);
  assert.match(uiBundle, /homeViewModel\.actionDisabled = actionDisabled;/);
  assert.match(uiBundle, /canDelete: \(state\.isAdmin \|\| state\.isParent\) && !state\.isCoach/);
  assert.match(uiBundle, /showHomeActions: true/);
  assert.match(
    uiBundle,
    /id="homeActiveJudokaSummary" class="summary home-context-card"[\s\S]*?\{\{ activeJudokaSummary\.value \}\}[\s\S]*?<div id="homeAdminActions" class="toolbar admin-actions" v-show="showHomeActions">[\s\S]*?<h3 id="homeCompetitionsTitle">\{\{ competitionsTitle \}\}<\/h3>/
  );
  assert.match(uiBundle, /v-for="competition in competitions"/);
  assert.doesNotMatch(uiBundle, /activeJudokaSummaryHtml|competitionsHtml/);
  assert.match(uiBundle, /function createMountedViewModel\(id,\s*defaultState,\s*actions = \{\}\)/);
  assert.match(uiBundle, /ui\.createMountedViewModel\("homeView", defaultHomeViewState,/);
  assert.doesNotMatch(
    uiBundle,
    /if \(!isAdmin && !isParent\) \{\s*document\.getElementById\("homeAdminActions"\)\.classList\.add\("hidden"\);/
  );
});

test("competition persistence keeps categories and omits removed place and actual weight fields", () => {
  assert.match(
    competitionsService,
    /const domainCompetitionInput = toCanonicalCompetition\(competition\);/
  );
  assert.match(
    competitionsService,
    /const competitionDraft = createCompetition\(domainCompetitionInput,\s*ownerJudokaId\);/
  );
  assert.match(competitionsService, /const competitionId = domainCompetitionInput\.competitionId;/);
  assert.match(competitionsService, /return records\.map\(toCanonicalCompetition\);/);
  assert.match(
    competitionsService,
    /await competitionsRepository\.update\(competitionId,\s*competitionDraft\);/
  );
  assert.match(
    competitionsService,
    /await competitionsRepository\.insert\(competitionDraft,\s*idCompetition\);/
  );
  assert.match(
    competitionsService,
    /async function finalizeCompetition\(email,\s*idCompetition,\s*result\)/
  );
  assert.match(
    competitionsService,
    /const finalization = createPersistedCompetition\(toCanonicalCompetition\(competition\)\)\.finalize\(\s*result\s*\);/
  );
  assert.match(
    competitionsService,
    /await competitionsRepository\.updateResult\(idCompetition,\s*finalization\);/
  );
  assert.match(uiBundle, /id="competitionFinalizationView" class="panel hidden"/);
  assert.match(
    uiBundle,
    /<div class="mobile-action-bar primary-action">[\s\S]*id="finalizeCompetitionButton" class="button-secondary" :class="\{ hidden: !canFinalizeCompetition \}" @click="showCompetitionFinalizationForm\(\)"[\s\S]*Ajouter un combat/
  );
  assert.match(uiBundle, /function finalizeCompetition\(\)/);
  assert.match(uiBundle, /"finalizeCompetition",\s*\[\s*competitionId,\s*result\s*\]/);
  assert.doesNotMatch(uiBundle, /id="competition_classement"/);
  assert.match(uiBundle, /id="competition_result"/);
  assert.match(competitionDomain, /function createCompetitionDetailsDraft\(competition = \{\}\)/);
  assert.match(competitionDomain, /function createCompetitionFinalResult\(value\)/);
  assert.match(competitionDomain, /finalize\(finalResult\) \{/);
  assert.match(competitionDomain, /function cleanCompetitionText\(value\)/);
  assert.match(competitionDomain, /function createCompetitionDate\(value\)/);
  assert.match(competitionDomain, /function createCompetitionAgeCategory\(value\)/);
  assert.match(
    competitionDomain,
    /ageCategory: createCompetitionAgeCategory\(competition\.ageCategory\)/
  );
  assert.match(
    competitionDomain,
    /weightCategory: cleanCompetitionText\(competition\.weightCategory\)/
  );
  assert.doesNotMatch(competitionDomain, /nom:\s*name/);
  assert.doesNotMatch(competitionDomain, /categorie_age:/);
  assert.doesNotMatch(competitionDomain, /categorie_poids:/);
  assert.doesNotMatch(competitionDomain, /lieu:\s*""/);
  assert.doesNotMatch(competitionDomain, /poids_pesee:\s*""/);
});

test("connected parent can manage children from a dedicated screen", () => {
  assert.match(
    uiBundle,
    /id="manageChildrenButton" v-if="canManageChildren" class="button-secondary" @click="showChildrenManagement\(\)"/
  );
  assert.match(uiBundle, /id="childrenView" class="panel hidden"/);
  assert.match(uiBundle, /function showChildrenManagement\(keepMessage\)/);
  assert.match(uiBundle, /function saveManagedChild\(\)/);
  assert.match(uiBundle, /v-for="child in children"/);
  assert.doesNotMatch(uiBundle, /childrenListHtml/);
  assert.match(uiBundle, /id="child_email"/);
  assert.match(uiBundle, /se connecter seuls si un email est renseigné/);
  assert.match(uiBundle, /function normalizeLastName\(value\)/);
  assert.match(uiBundle, /function deleteManagedChild\(idJudoka,\s*name\)/);
  assert.match(childrenService, /async function getChildrenManagement\(email\)/);
  assert.match(childrenService, /async function saveManagedChild\(email,\s*child\)/);
  assert.match(childrenService, /const updatedChild = updateManagedChild\(\{/);
  assert.match(childrenService, /const childInput = toCanonicalManagedChild\(child\);/);
  assert.match(childrenService, /const childJudokaId = childInput\.judokaId;/);
  assert.match(
    childrenService,
    /children: \(await userContextService\.getParentManagedJudokas\(user\.id_judoka\)\)\.map\(\s*toCanonicalJudoka\s*\)/
  );
  assert.match(
    childrenService,
    /await userContextService\.assertJudokaEmailAvailable\(updatedChild\.accountEmail,\s*childJudokaId\)/
  );
  assert.match(
    childrenService,
    /await userContextService\.assertJudokaEmailAvailable\(managedChild\.accountEmail,\s*idJudoka\)/
  );
  assert.match(childrenService, /const managedChild = createManagedChild\(\{/);
  assert.match(childrenService, /const deletionDecision = decideManagedChildRemoval\(\{/);
  assert.match(
    judokaDomain,
    /function createManagedChild\(\{ judokaId,\s*accountEmail,\s*name,\s*firstName,\s*lastName \}\)/
  );
  assert.match(judokaDomain, /judokaId: createJudokaId\(judokaId\)/);
  assert.match(
    judokaDomain,
    /function updateManagedChild\(\{ accountEmail,\s*name,\s*firstName,\s*lastName \}\)/
  );
  assert.match(
    emailDomain,
    /function createOptionalEmail\(value,\s*message = "Email invalide\."\)/
  );
  assert.match(
    judokaDomain,
    /function decideManagedChildRemoval\(\{ child,\s*hasCompetitions,\s*hasCombats,\s*hasOtherParentLink \}\)/
  );
  assert.match(childrenService, /async function deleteManagedChild\(email,\s*idJudoka\)/);
  assert.match(childrenService, /isParent: isParent\(domainUser\)/);
  assert.match(judokaDomain, /accessRole: "NORMAL"/);
});

test("admin can manage admins from a dedicated screen", () => {
  assert.match(
    uiBundle,
    /id="manageAdminsButton" v-if="canManageAdmins" class="button-secondary" @click="showAdminsManagement\(\)"/
  );
  assert.match(uiBundle, /id="adminsView" class="panel hidden"/);
  assert.match(uiBundle, /function showAdminsManagement\(keepMessage\)/);
  assert.match(uiBundle, /id="accessInvitationsList"/);
  assert.match(uiBundle, /v-for="invitation in accessInvitations"/);
  assert.match(uiBundle, /v-for="admin in adminsPage"/);
  assert.doesNotMatch(
    uiBundle,
    /accessInvitationsSummaryHtml|accessInvitationsListHtml|adminsListHtml/
  );
  assert.match(uiBundle, /id="accessInvitationFilter"/);
  assert.match(uiBundle, /id="invite_email"/);
  assert.match(uiBundle, /id="invite_profile_type"/);
  assert.match(uiBundle, /id="saveInvitationButton" @click="saveAccessInvitation\(\)"/);
  assert.match(uiBundle, /function saveAccessInvitation\(\)/);
  assert.match(uiBundle, /function deleteAccessInvitation\(email\)/);
  assert.match(uiBundle, /function updateAccessInvitationSearch\(value\)/);
  assert.match(uiBundle, /function saveAdminRole\(\)/);
  assert.match(uiBundle, /function revokeAdminRole\(idJudoka,\s*name\)/);
  assert.match(adminService, /async function getAdminsManagement\(email\)/);
  assert.match(
    adminService,
    /accessInvitations: \(await getAccessInvitations\(\)\)\.map\(toInvitationReadModel\)/
  );
  assert.match(
    adminService,
    /async function saveAccessInvitation\(email,\s*targetEmail,\s*targetProfileType\)/
  );
  assert.match(adminService, /const invitation = createAccessInvitation\(\{/);
  assert.match(
    accessInvitationDomain,
    /invited_profile_type: createProfileType\(invited_profile_type\)/
  );
  assert.doesNotMatch(adminService, /"ADMIN", "JUDOKA", "PARENT"/);
  assert.match(adminService, /async function deleteAccessInvitation\(email,\s*invitedEmail\)/);
  assert.match(adminService, /async function grantAdminRole\(email,\s*targetEmail\)/);
  assert.match(adminService, /createJudoka\(toCanonicalJudoka\(target\)\)\.grantAdminRole\(\)/);
  assert.match(
    adminService,
    /createJudoka\(toCanonicalJudoka\(target\)\)\.revokeAdminRole\(user\.id_judoka\)/
  );
  assert.match(judokaDomain, /return \{ accessRole: createRole\("ADMIN"\) \};/);
  assert.match(judokaDomain, /return \{ accessRole: createRole\("NORMAL"\) \};/);
  assert.match(adminService, /async function revokeAdminRole\(email,\s*idJudoka\)/);
  assert.match(adminService, /Vous ne pouvez pas retirer vos propres droits admin/);
});

test("judoka profile exposes season statistics through a dedicated screen", () => {
  assert.match(
    uiBundle,
    /id="openHomeJudokaProfileButton" class="button-secondary home-context-action" :disabled="actionDisabled" @click="openHomeJudokaProfile\(\)"/
  );
  assert.match(uiBundle, /id="openHomeJudokaProfileButtonMeta"/);
  assert.match(uiBundle, /id="judokaView" class="panel hidden"/);
  assert.match(uiBundle, /id="judokaHeroAvatar"/);
  assert.match(uiBundle, /id="judokaHeroSummary"/);
  assert.match(uiBundle, /function openHomeJudokaProfile\(\)/);
  assert.match(uiBundle, /Sélectionnez un judoka actif pour ouvrir sa fiche/);
  assert.match(
    uiBundle,
    /Sélectionnez votre profil ou l'un de vos enfants comme judoka actif pour ouvrir la fiche/
  );
  assert.match(uiBundle, /Aucune compétition enregistrée pour votre périmètre/);
  assert.match(uiBundle, /Résumé performance/);
  assert.match(uiBundle, /Profil de combat/);
  assert.match(uiBundle, /Résultats compétition/);
  assert.match(uiBundle, /id="judokaSeasonCombatCount"/);
  assert.match(uiBundle, /id="judokaSeasonBalance"/);
  assert.match(uiBundle, /id="judokaVictoryRate"/);
  assert.match(uiBundle, /Victoires ippon/);
  assert.match(uiBundle, /Pénalités/);
  assert.match(uiBundle, /Forfaits/);
  assert.match(uiBundle, /rank-gold/);
  assert.match(uiBundle, /rank-silver/);
  assert.match(uiBundle, /rank-bronze/);
  assert.match(uiBundle, /function showJudokaProfile\(idJudoka,\s*keepMessage\)/);
  assert.match(uiBundle, /function renderJudokaProfile\(\)/);
  assert.match(
    uiBundle,
    /return \[normalizeDisplayName\(j && j\.firstName\), normalizeLastName\(j && j\.lastName\)\]\s*\.filter\(Boolean\)\s*\.join\(" "\);/
  );
  assert.match(
    userContextService,
    /const managedJudokaIds = judokas\.map\(\(?j\)? => String\(j\.id_judoka\)\);/
  );
  assert.match(
    userContextService,
    /managedJudokaScope = createManagedJudokaScope\(managedJudokaIds\);/
  );
  assert.match(userContextService, /return \{ user, judokas, managedJudokaScope \};/);
  assert.match(
    userContextService,
    /assertCanAccessJudokaProfile\(toCanonicalJudoka\(user\),\s*targetId,\s*userContext\.managedJudokaScope\);/
  );
  assert.match(
    permissions,
    /function assertCanAccessJudokaProfile\(user,\s*idJudoka,\s*managedJudokaScope\)/
  );
  assert.match(permissions, /throw new Error\("Accès refusé à cette fiche judoka\."\);/);
  assert.match(profileService, /async function getJudokaProfile\(email,\s*idJudoka\)/);
  assert.match(seasonDomain, /function getCurrentSeasonBounds\(referenceDate = new Date\(\)\)/);
  assert.match(profileService, /const snapshot = buildJudokaProfileSnapshot\(\{/);
  assert.match(profileService, /competitions: competitions\.map\(toCanonicalCompetition\),/);
  assert.match(profileService, /combats: combats\.map\(toCanonicalCombat\),/);
  assert.match(
    seasonStatisticsDomain,
    /const currentSeasonCompetitions = sortedCompetitions\.filter\(\(?c\)? =>\s*isDateWithinSeason\(c\.competitionDate,\s*currentBounds\)\s*\);/
  );
  assert.match(
    seasonStatisticsDomain,
    /const seasonWins = seasonCombats\.filter\(\(?c\)? => isVictoryCombatResult\(c\.result\)\)\.length;/
  );
  assert.match(
    seasonStatisticsDomain,
    /const seasonLosses = seasonCombats\.filter\(\(?c\)? => isLossCombatResult\(c\.result\)\)\.length;/
  );
  assert.match(
    seasonStatisticsDomain,
    /const seasonDraws = seasonCombats\.length - seasonWins - seasonLosses;/
  );
  assert.match(
    seasonStatisticsDomain,
    /const victoryRate = seasonCombats\.length\s*\? Math\.round\(\(seasonWins \/ seasonCombats\.length\) \* 100\)\s*: 0;/
  );
  assert.match(seasonStatisticsDomain, /function buildCombatProfile\(combats\)/);
  assert.match(
    seasonStatisticsDomain,
    /function getCompetitionCombatRecord\(combats,\s*competitionId\)/
  );
  assert.match(seasonStatisticsDomain, /const sortedCompetitions = \[\.\.\.competitions\]\.sort/);
  assert.match(seasonStatisticsDomain, /category: getCompetitionCategoryLabel\(lastCompetition\),/);
  assert.match(seasonStatisticsDomain, /weightCategory:/);
  assert.match(seasonStatisticsDomain, /competitionResults/);
  assert.match(seasonStatisticsDomain, /combatProfile/);
});

test("admin owner selection is not restricted by parent-managed scope", () => {
  assert.match(
    permissions,
    /function getCompetitionOwnerJudokaId\(competition\) \{\s*return competition && competition\.ownerJudokaId;\s*\}/
  );
  assert.match(
    permissions,
    /function resolveCompetitionOwnerId\(user,\s*competition,\s*managedJudokaScope\) \{\s*const ownerJudokaId = getCompetitionOwnerJudokaId\(competition\);[\s\S]*if \(isAdmin\(user\)\) \{/
  );
  assert.match(
    permissions,
    /function isInManagedScope\(managedJudokaScope,\s*idJudoka\) \{\s*return Boolean\(managedJudokaScope && managedJudokaScope\.includes\(idJudoka\)\);/
  );
  assert.match(permissions, /function resolveJudokaDataAccess\(user,\s*managedJudokaScope\)/);
  assert.match(
    competitionsService,
    /const access = resolveJudokaDataAccess\(domainUser,\s*managedJudokaScope\);/
  );
});

test("judoka and invitation lookup use a case-insensitive normalized email match", () => {
  assert.match(userContextService, /const normalizedEmail = normalizeEmail\(email\);/);
  assert.match(judokasRepository, /function findEmailQueryValue\(email\)/);
  assert.match(
    judokasRepository,
    /return supabaseSelectOne\("judokas", `select=\*&email=ilike\.\$\{findEmailQueryValue\(email\)\}`\);/
  );
  assert.match(invitationsRepository, /function findEmailQueryValue\(email\)/);
  assert.match(
    invitationsRepository,
    /return supabaseSelectOne\(\s*"access_invitations",\s*`select=\*&email=ilike\.\$\{findEmailQueryValue\(email\)\}`\s*\);/
  );
  assert.match(
    invitationsRepository,
    /return supabaseDelete\("access_invitations", `email=ilike\.\$\{findEmailQueryValue\(email\)\}`\);/
  );
});

test("combat mutations reload competition details after save", () => {
  assert.match(
    uiBundle,
    /"ajouterCombat"[\s\S]*showSuccess\(response\.message\);[\s\S]*resetCombatForm\(\);[\s\S]*openCompetition\(state\.currentCompetition\.competitionId,\s*true\);/
  );
  assert.match(
    uiBundle,
    /"updateCombat"[\s\S]*showSuccess\(response\.message\);[\s\S]*resetCombatForm\(\);[\s\S]*openCompetition\(state\.currentCompetition\.competitionId,\s*true\);/
  );
  assert.doesNotMatch(
    uiBundle,
    /judoka_nom: state\.currentUser \? getJudokaDisplayName\(state\.currentUser\) : ""/
  );
});

test("vercel runtime lets the connected user log out", () => {
  assert.match(uiBundle, /\.user-actions\s*\{[\s\S]*?display: flex;/);
  assert.match(
    css,
    /\.user-pill\s*\{[\s\S]*?padding:\s*0 10px;[\s\S]*?height:\s*38px;[\s\S]*?min-height:\s*38px;[\s\S]*?max-height:\s*38px;[\s\S]*?line-height:\s*1;[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;/
  );
  assert.match(
    css,
    /\.logout-button\s*\{[\s\S]*?height:\s*38px;[\s\S]*?min-height:\s*38px;[\s\S]*?max-height:\s*38px;/
  );
  assert.match(uiBundle, /id="userInfo"/);
  assert.match(
    uiBundle,
    /id="userInfo" class="user-pill"><strong>\{\{ userName \}\}<\/strong> - \{\{ roleLabel \}\}<\/div>/
  );
  assert.match(
    uiBundle,
    /id="logoutButton" type="button" class="button-secondary logout-button" @click="logoutUser\(\)"/
  );
  assert.match(uiBundle, /showHeader: false/);
  assert.match(uiBundle, /function setHeaderVisible\(visible\)/);
  assert.match(uiBundle, /app\.setHeaderVisible\(false\);/);
  assert.doesNotMatch(uiBundle, /onclick="logoutUser\(\)"/);
  assert.doesNotMatch(uiBundle, /document\.querySelector\("header"\)\.classList/);
  assert.match(uiBundle, /aria-label="Déconnexion"/);
  assert.match(uiBundle, /id="toastLayer" class="toast-layer"/);
  assert.match(uiBundle, /getJudokaDisplayName\(state\.currentUser\)/);
  assert.match(uiBundle, /const toneClass = type === "success" \? "success" : "error";/);
  assert.match(uiBundle, /notificationsViewModel = window\.Vue\.reactive\(\{/);
  assert.match(uiBundle, /notificationsViewModel\.toasts\.push\(\{/);
  assert.match(uiBundle, /<p :class="toast\.toneClass">/);
  assert.match(uiBundle, /@click="dismissToast\(toast\.id\)"/);
  assert.match(uiBundle, /function clearToasts\(\)/);
  assert.doesNotMatch(html, /id="message" class="message"/);
  assert.doesNotMatch(css, /\.message/);
  assert.doesNotMatch(
    client,
    /Object\.assign\(window,[\s\S]*?(dismissToast|saveCompetition|showHomeCompetitionForm|startGoogleLogin)/
  );
  assert.doesNotMatch(
    notificationsClient,
    /\$\("message"\)\.innerHTML|onclick="dismissToast|document\.createElement|document\.querySelector|innerHTML/
  );
  assert.match(uiBundle, /async function logoutUser\(\)/);
  assert.match(uiBundle, /auth\/v1\/logout/);
  assert.match(uiBundle, /clearVercelSession\(\)/);
  assert.match(uiBundle, /resetApplicationState\(\);/);
  assert.match(uiBundle, /showVercelLogin\(\);/);
});

test("vercel api keeps supabase api key usage server side", () => {
  assert.match(core, /module\.exports = require\("\.\.\/core"\);/);
  assert.match(coreIndex, /createAdminService/);
  assert.match(coreIndex, /createClubCompetitionsService/);
  assert.match(coreIndex, /createCompetitionsService/);
  assert.match(coreIndex, /createCombatsService/);
  assert.match(coreIndex, /buildJudokaProfileSnapshot/);
  assert.match(coreIndex, /\.\.\.adminService\.methods/);
  assert.match(coreIndex, /\.\.\.clubCompetitionsService\.methods/);
  assert.match(coreIndex, /\.\.\.competitionsService\.methods/);
  assert.match(coreIndex, /\.\.\.combatsService\.methods/);
  assert.match(supabaseClient, /function isJwtLikeToken\(value\)/);
  assert.match(supabaseClient, /function createSupabaseHeaders\(apiKey,\s*options = \{\}\)/);
  assert.match(textHelpers, /function normalizeLastName\(value\)/);
  assert.match(adminService, /async function getAccessInvitation\(email\)/);
  assert.match(adminService, /async function getAccessInvitations\(\)/);
  assert.match(
    coreIndex,
    /const \{ user, judokas, managedJudokaScope, domainUser \} =\s*await userContextService\.getDomainUserContext\(email\);/
  );
  assert.match(coreIndex, /canManageChildren: permissions\.canManageChildrenProfile\(domainUser\)/);
  assert.match(client, /state\.isCoach\s*\?\s*`COACH · \$\{profileTypeLabel\}`/);
  assert.match(sessionAuth, /\/auth\/v1\/user/);
  assert.match(
    competitionsService,
    /const enriched = toCombatReadModelsWithJudokas\(filtered,\s*judokas,/
  );
  assert.match(
    competitionsService,
    /formatJudokaDisplayName: \(?judoka\)? =>\s*`\$\{judoka\.firstName\} \$\{normalizeLastName\(judoka\.lastName\)\}`/
  );
  assert.match(client, /competition\.ownerJudokaId = resolveCompetitionOwnerSelection\(\);/);
  assert.match(client, /ownerJudokaId: ""/);
  assert.doesNotMatch(
    client,
    /bindAutocomplete|dataset\.bound|competition_id_judoka|id="filterJudoka"/
  );
  assert.doesNotMatch(client, /competition\.id_judoka = resolveCompetitionOwnerSelection\(\);/);
  assert.doesNotMatch(coreIndex, /auth\/v1\/signup/);
  assert.doesNotMatch(coreIndex, /auth\/v1\/admin\/users/);
  assert.match(rpc, /verifySupabaseUser\(accessToken\)/);
  assert.match(rpc, /methods\[body\.method\]/);
});
