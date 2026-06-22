const test = require("node:test");
const assert = require("./helpers/relaxed-assert");
const fs = require("node:fs");
const path = require("node:path");

const appHandler = require(path.join(__dirname, "..", "api", "app.js"));
const html = appHandler.renderIndexHtml();
const css = fs.readFileSync(path.join(__dirname, "..", "assets", "app.css"), "utf8");
const notificationsClient = fs.readFileSync(
  path.join(__dirname, "..", "assets", "dist", "app-notifications.js"),
  "utf8"
);
const judokaScreenClient = fs.readFileSync(
  path.join(__dirname, "..", "assets", "dist", "app-screen-judoka.js"),
  "utf8"
);
const client = [
  fs.readFileSync(path.join(__dirname, "..", "assets", "vendor/vue.global.prod.js"), "utf8"),
  fs.readFileSync(path.join(__dirname, "..", "assets", "dist", "app-ui.js"), "utf8"),
  notificationsClient,
  ...[
    "app-auth.js",
    "app-screen-projections.js",
    "app-screen-login.js",
    "app-screen-home.js",
    "app-judoka-presentation.js",
    "app-screen-judoka.js",
    "app-competition-form-helpers.js",
    "app-screen-competition-form.js",
    "app-screen-club-competition.js",
    "app-screen-combat-form.js",
    "app-screen-competition.js",
    "app-screen-admins.js",
    "app-screen-coach-dashboard.js",
    "coach-chat-widget.js",
    "app-runtime.js",
    "app.js"
  ].map((file) => fs.readFileSync(path.join(__dirname, "..", "assets", "dist", file), "utf8"))
].join("\n");
const bundle = `${html}\n${css}\n${client}`;

test("competition cards avoid redundant mobile action rows", () => {
  assert.equal(bundle.includes('<span class="meta-label">Action</span>'), false);
  assert.equal(bundle.includes('<span class="meta-value">Ouvrir</span>'), false);
});

test("mobile action bars are available for primary form and detail actions", () => {
  assert.match(bundle, /\.mobile-action-bar\s*\{/);
  assert.match(bundle, /class="mobile-action-bar primary-action"/);
  assert.match(bundle, /class="form-actions mobile-action-bar"/);
});

test("mobile navigation uses browser history and restores focus", () => {
  assert.match(client, /window\.addEventListener\("popstate"/);
  assert.match(client, /window\.history\.pushState/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /kiroku_navigation_state/);
  assert.match(client, /function restoreNavigationState\(\)/);
  assert.match(client, /sessionStorage\.setItem\(navigationStateStorageKey/);
  assert.match(client, /app\.restoreNavigationState\(\)/);
  assert.match(client, /view\.setAttribute\("tabindex", "-1"\)/);
  assert.match(client, /view\.focus\(\{ preventScroll: true \}\)/);
});

test("mobile mutations are guarded against double taps and offline network", () => {
  assert.match(client, /pendingRpcKeys/);
  assert.match(client, /Action déjà en cours/);
  assert.match(client, /Connexion indisponible/);
  assert.match(client, /Réseau trop lent/);
  assert.match(bundle, /:disabled="isSubmitting"/);
});

test("initial data can reopen from a local offline snapshot", () => {
  assert.match(client, /kiroku_initial_data:/);
  assert.match(client, /function loadCachedInitialData\(\)/);
  assert.match(client, /hasLocalVercelSession/);
  assert.match(client, /if \(!app\.state\.isOnline && app\.loadCachedInitialData\(\)\)/);
  assert.match(client, /Hors connexion - données du/);
  assert.match(bundle, /v-if="showOfflineStatus" class="offline-status"/);
  assert.match(css, /\.offline-status\s*\{/);
  assert.match(css, /\.user-actions \.offline-status\s*\{/);
});

test("offline combat and ranking mutations queue as pending operations and sync on reconnect", () => {
  assert.match(client, /kiroku_pending_ops:/);
  assert.match(client, /function loadPendingOperationsForUser\(/);
  assert.match(client, /function upsertPendingOperation\(/);
  assert.match(client, /function syncPendingOperations\(\)/);
  assert.match(client, /function getLocalOfflineMutationError\(/);
  assert.match(client, /function cancelPendingOperation\(/);
  assert.match(client, /Enregistré localement\. En attente de synchronisation\./);
  assert.match(client, /window\.KirokuScreenProjections\.mergePendingCombatCards\(/);
  assert.match(bundle, /v-if="combat\.pendingSync" class="pending-sync-note"/);
  assert.match(bundle, /v-if="pendingFinalization" class="pending-sync-note"/);
  assert.match(bundle, /@click="cancelPendingOperation\(combat\.pendingOperationId\)"/);
  assert.match(css, /\.badge-pending\s*\{/);
  assert.match(css, /\.pending-sync-note\s*\{/);
});

test("button colors use consistent variants and disabled states", () => {
  assert.match(css, /--button-primary-bg: var\(--primary\)/);
  assert.match(css, /--button-secondary-bg: #ffffff/);
  assert.match(css, /--button-danger-bg: #fffaf9/);
  assert.match(css, /--button-danger-border: #efc9c5/);
  assert.match(css, /--button-danger-text: var\(--danger\)/);
  assert.match(css, /button:hover:not\(:disabled\), \.button:hover:not\(:disabled\)/);
  assert.match(css, /\.button-secondary:hover:not\(:disabled\)/);
  assert.match(
    css,
    /\.button-secondary:disabled,[\s\S]*\.button-google:disabled:hover \{[\s\S]*background: var\(--button-secondary-bg\)/
  );
  assert.match(
    css,
    /\.button-danger:disabled,[\s\S]*\.button-danger:disabled:hover \{[\s\S]*background: var\(--button-danger-bg\)/
  );
  assert.doesNotMatch(
    css,
    /\.button-secondary:disabled:hover,\s*\.button-danger:disabled:hover\s*\{\s*background: var\(--danger\)/
  );
});

test("notifications use a toast layer without shifting the main layout", () => {
  assert.match(bundle, /id="toastLayer" class="toast-layer"/);
  assert.match(bundle, /\.toast-layer\s*\{/);
  assert.match(bundle, /\.toast-close\s*\{/);
  assert.match(bundle, /showToast\("success", message,\s*4e3\)/);
  assert.match(bundle, /showToast\("error", getErrorMessage\(error\),\s*7e3\)/);
  assert.match(bundle, /function showToast\(type,\s*message,\s*duration\)/);
  assert.match(bundle, /function dismissToast\(toastId\)/);
  assert.match(bundle, /v-for="toast in toasts"/);
  assert.match(bundle, /@click="dismissToast\(toast\.id\)"/);
  assert.match(bundle, /\{\{ toast\.message \}\}/);
  assert.doesNotMatch(html, /id="message" class="message"/);
  assert.doesNotMatch(css, /\.message/);
  assert.doesNotMatch(
    notificationsClient,
    /onclick="dismissToast|document\.createElement|document\.querySelector|innerHTML/
  );
});

test("combat cards expose result as a first-class badge", () => {
  assert.match(bundle, /\.result-badge\s*\{/);
  assert.match(bundle, /<span class="result-badge/);
  assert.match(bundle, /result:\s*formatResultat\(c\.result\),/);
  assert.match(
    bundle,
    /<span class="result-badge" :class="combat\.resultClass">\{\{ combat\.result \}\}<\/span>/
  );
});

test("small-screen layout is the base and desktop is progressive", () => {
  assert.match(bundle, /@media \(min-width: 721px\)/);
  assert.match(bundle, /\.topbar\s*\{[\s\S]*?padding: 12px 12px 8px;/);
  assert.match(bundle, /class="brand-logo"/);
  assert.match(bundle, /class="brand-logo-mark"/);
  assert.match(bundle, /class="brand-logo-belt"/);
  assert.doesNotMatch(bundle, /qwant\.com|tse\.mm\.bing\.net|OIP\.2L4yJnGwNyAZkgiTuUu-NAHaHa/);
  assert.match(
    bundle,
    /\.app-shell\s*\{[\s\S]*?padding: 0 0 calc\(96px \+ env\(safe-area-inset-bottom\)\);/
  );
});

test("admin competition management stays visible on mobile", () => {
  assert.match(
    bundle,
    /id="homeAdminActions" class="toolbar admin-actions" v-show="showHomeActions"/
  );
  assert.match(bundle, /id="homeActiveJudokaSummary" class="summary home-context-card"/);
  assert.match(
    bundle,
    /id="competitionAdminActions" class="competition-management-actions" v-show="canEditCompetition"/
  );
  assert.match(bundle, /id="editCompetitionButton"/);
  assert.match(bundle, /id="finalizeCompetitionButton"/);
  assert.match(bundle, /id="deleteCompetitionButton"/);
  assert.match(
    bundle,
    /<div class="mobile-action-bar primary-action">[\s\S]*id="finalizeCompetitionButton"[\s\S]*Ajouter un combat/
  );
  assert.doesNotMatch(
    bundle,
    /id="competitionAdminActions" class="competition-management-actions"[\s\S]*id="finalizeCompetitionButton"[\s\S]*id="deleteCompetitionButton"/
  );
  assert.match(bundle, /window\.KirokuScreenProjections\.projectCompetitionDetail\(/);
  assert.match(bundle, /window\.KirokuScreenProjections\.projectCompetitionCombats\(/);
  assert.match(bundle, /\.hidden\s*\{\s*display: none !important;/);
});

test("club competition creation keeps age category without weight category", () => {
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="club_competition_name"/);
  assert.match(bundle, /id="club_competition_date"/);
  assert.match(bundle, /id="club_competition_categorie_age"/);
  assert.doesNotMatch(bundle, /club_competition_categorie_poids/);
  assert.doesNotMatch(client, /clubCompetitionWeightCategoryOptions/);
});

test("family home keeps the active judoka competition context", () => {
  assert.doesNotMatch(bundle, /if \(\(state\.isAdmin \|\| state\.isParent\) && !activeJudoka\) \{/);
  assert.match(bundle, /let filteredComps = state\.competitions;/);
  assert.match(
    bundle,
    /if \(activeJudokaId\) \{\s*filteredComps = state\.competitions\.filter\(\s*\(?c\)? => String\(c\.ownerJudokaId\) === String\(activeJudokaId\)\s*\);/
  );
  assert.match(
    bundle,
    /return \(mode === "coachJudoka" \|\| mode === "family"\) && state\.judokas\.length > 0;/
  );
  assert.match(bundle, /filterPlaceholder: "Choisir un judoka\.\.\."/);
  assert.match(bundle, /label: "Judoka actif"/);
  assert.match(
    bundle,
    /getCurrentMode\(\) === "coachJudoka" \? "Judoka consulté" : "Judoka actif"/
  );
  assert.match(bundle, /Sélectionnez un judoka pour voir ses résultats\./);
  assert.match(bundle, /modes\.push\(\{ key: "parentHome", label: "Parent" \}\);/);
  assert.match(
    bundle,
    /if \(modeKey === "parentHome"\) \{\s*return \["parentHome", "family"\]\.includes\(getCurrentMode\(\)\);/
  );
  assert.match(bundle, /state\.homeMode = "parentHome";/);
  assert.match(bundle, /<h3>Accueil parent[\s\S]*class="tooltip"/);
  assert.match(bundle, /Espace parent centré sur l'enfant sélectionné/);
  assert.match(bundle, /Ouvre la liste des compétitions filtrée sur le judoka actif/);
  assert.match(bundle, /Change l'enfant actif/);
  assert.match(bundle, /Affiche la progression du judoka actif/);
  assert.match(
    bundle,
    /<h4>Suivi des compétitions[\s\S]*\{\{ parentCompetitionsHubButtonText \}\}/
  );
  assert.match(client, /formatParentCompetitionsHubButtonText\(getHomeActiveJudoka\(\)\)/);
  assert.match(client, /Gérer les compétitions \$\{prefix\}\$\{firstName\}/);
  assert.match(bundle, /<h4>Judoka actif[\s\S]*@click="openParentJudokaSelectionHub\(\)"/);
  assert.match(bundle, /<h4>Fiche de progression[\s\S]*@click="openParentProfileHub\(\)"/);
  assert.doesNotMatch(bundle, /Moi ou mes enfants/);
});

test("coach home stays club-centered and separate from judoka consultation", () => {
  assert.match(bundle, /modes\.push\(\{ key: "coachHome", label: "Coach" \}\);/);
  assert.match(
    bundle,
    /coachSubModes = window\.Vue\.computed\(\(\) => \[[\s\S]*key: "coachHome",\s*label: "Accueil coach"[\s\S]*key: "judoka",\s*label: "Mon espace"/
  );
  assert.doesNotMatch(bundle, /key: "coach",\s*label: "Compétitions club"/);
  assert.doesNotMatch(bundle, /key: "coachJudoka",\s*label: "Judoka"/);
  assert.match(
    bundle,
    /state\.isCoach && \["coachHome", "judoka", "coach", "coachJudoka"\]\.includes\(getCurrentMode\(\)\)/
  );
  assert.match(bundle, /v-if="showModeTabs && !showCoachSubTabs" class="mode-tabs"/);
  assert.match(bundle, /v-if="showCoachSubTabs" class="mode-tabs coach-sub-tabs"/);
  assert.match(
    bundle,
    /showHomeContextTitle = window\.Vue\.computed\(\s*\(\) => !\["admin", "judoka", "family", "parentHome", "coachHome"\]\.includes\(getCurrentMode\(\)\) && !showCoachSubTabs\.value\s*\)/
  );
  assert.match(
    bundle,
    /showHomeHero = window\.Vue\.computed\(\s*\(\) => showModeTabs\.value && !showCoachSubTabs\.value \|\| showCoachSubTabs\.value \|\| showActiveJudokaSummary\.value \|\| canFilterByJudoka\.value \|\| showHomeContextTitle\.value\s*\)/
  );
  assert.match(bundle, /<div v-if="showHomeHero" class="dash-hero">/);
  assert.match(bundle, /v-else-if="showHomeContextTitle" class="dash-context-line"/);
  assert.match(
    bundle,
    /<h4>Suivi des compétitions<\/h4>[\s\S]*@click="openCoachCompetitionsHub\(\)"[\s\S]*Gérer les compétitions/
  );
  assert.match(
    bundle,
    /<h4>Judoka actif<\/h4>[\s\S]*@click="openCoachJudokaHub\(\)"[\s\S]*Choisir un judoka/
  );
  assert.match(
    bundle,
    /<h4>Bilan de saison<\/h4>[\s\S]*@click="openCoachStatsHub\(\)"[\s\S]*Voir les statistiques/
  );
  assert.match(client, /function openCoachStatsHub\(\)/);
  assert.match(bundle, /isPrimaryModeActive\(mode\.key\)/);
  assert.match(bundle, /if \(getCurrentMode\(\) === "coachHome"\) return "";/);
  assert.match(bundle, /if \(getCurrentMode\(\) === "coach"\) return "";/);
  assert.match(
    bundle,
    /showClubCompetitionsSection = window\.Vue\.computed\(\s*\(\) => getCurrentMode\(\) === "coach"\s*\)/
  );
  assert.match(bundle, /homeTitle: "Coach"[\s\S]*showCompetitionsSection: false/);
  assert.match(bundle, /homeTitle: "Compétition"[\s\S]*showCompetitionsSection: false/);
  assert.match(
    bundle,
    /canOpenJudokaProfile = window\.Vue\.computed\(\s*\(\) => getCurrentMode\(\) !== "coachHome" && getCurrentMode\(\) !== "coach"\s*\)/
  );
  assert.match(bundle, /id="openHomeJudokaProfileButton" v-if="canOpenJudokaProfile"/);
  assert.doesNotMatch(bundle, /const firstCoachJudoka = mode === "coach"/);
});

test("coach judoka view shows the selected judoka competition history", () => {
  assert.match(bundle, /homeTitle: "Judoka"/);
  assert.match(bundle, /if \(mode === "coachJudoka"\) \{/);
  assert.match(
    bundle,
    /if \(\(mode === "coachJudoka" \|\| mode === "family"\) && !activeJudokaId\) \{/
  );
  assert.match(bundle, /const emptyMsg = mode === "coachJudoka"/);
  assert.match(bundle, /Aucune compétition enregistrée pour ce judoka\./);
  assert.match(bundle, /Aucune compétition planifiée pour ce judoka\./);
  assert.match(bundle, /Sélectionnez un judoka pour voir ses compétitions à venir\./);
});

test("admin management screen is available in the mobile action flow", () => {
  assert.match(bundle, /@click="handleModeTabClick\(mode\.key\)"/);
  assert.match(bundle, /Gestion des accès/);
  assert.match(bundle, /id="adminsView" class="panel hidden"/);
  assert.match(bundle, /id="adminsList"/);
  assert.match(bundle, /id="usersList"/);
  assert.match(bundle, /id="usersFilter"/);
  assert.match(bundle, /id="importUsersFile"/);
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
  assert.match(bundle, /Résultats du judoka actif/);
  assert.match(bundle, /id="judokaView" class="panel hidden"/);
  assert.match(bundle, /Résumé performance/);
  assert.match(
    bundle,
    /Indicateurs calculés sur la saison sélectionnée pour cette fiche judoka uniquement/
  );
  assert.match(bundle, /Nombre de compétitions rattachées au judoka sur la saison affichée/);
  assert.match(bundle, /Pourcentage de victoires parmi les combats gagnés ou perdus/);
  assert.match(bundle, /Mode de victoire/);
  assert.match(bundle, /Mode de défaite/);
  assert.match(
    bundle,
    /Répartition des victoires de ce judoka selon la manière dont le combat s'est terminé/
  );
  assert.match(bundle, /id="judokaCompetitionResults"/);
  assert.match(bundle, /Liste les compétitions de la saison avec le classement/);
  assert.match(bundle, /:key="result\.competitionId \|\|/);
  assert.match(bundle, /id="judokaSeasonCombatCount"/);
  assert.match(bundle, /id="judokaSeasonBalance"/);
  assert.match(bundle, /id="judokaVictoryRate"/);
  assert.match(bundle, /id="judoka_couleur_ceinture"/);
  assert.match(bundle, /Informations utilisées pour qualifier les analyses/);
  assert.match(bundle, /<label for="judoka_lateralite">Garde<\/label>/);
  assert.match(judokaScreenClient, /const isManagedProfile = /);
  assert.match(
    judokaScreenClient,
    /\(\) => state\.isCoach \|\| state\.isAdmin \|\| isOwnProfile\.value \|\| isManagedProfile\.value/
  );
  assert.match(bundle, /Taux de victoire/);
  assert.match(bundle, /v-if="Number\(seasonWins\)"/);
  assert.match(bundle, /v-if="Number\(seasonLosses\)"/);
  assert.match(judokaScreenClient, /formatCompetitionRanking/);
  assert.match(bundle, /class="result-badge classement-badge"[\s\S]*\{\{ result\.result \}\}/);
  assert.match(bundle, /id="competitionFinalizationView" class="panel hidden"/);
  assert.match(bundle, /id="finalization_classement"/);
  assert.doesNotMatch(bundle, /id="competition_classement"/);
  assert.match(client, /finalizationResult === "Non classé"/);
});

test("judoka forms do not expose birth year fields", () => {
  assert.doesNotMatch(bundle, /ann[eé]e[_ -]?naissance/i);
  assert.doesNotMatch(bundle, /naissance/i);
  assert.doesNotMatch(bundle, /birthYear|birth_year/i);
});

test("home action buttons share one stable height", () => {
  assert.match(bundle, /#homeAdminActions button\s*\{[\s\S]*?min-height:\s*64px;/);
});

test("competition header actions share one aligned action row", () => {
  assert.match(bundle, /class="competition-header-actions"/);
  assert.doesNotMatch(
    bundle,
    /<div class="toolbar">\s*<button class="button-secondary" onclick="showHome\(\)">Retour<\/button>\s*<div id="competitionAdminActions" class="toolbar admin-actions hidden">/
  );
  assert.match(bundle, /\.competition-header-actions\s*\{/);
  assert.match(bundle, /\.competition-management-actions\s*\{/);
  assert.match(bundle, /\.judoka-hero\s*\{/);
  assert.match(bundle, /\.classement-badge\s*\{/);
});

test("competition list cards stay open-only without destructive actions", () => {
  assert.match(bundle, /class="card competition-card"/);
  assert.match(bundle, /class="card-button competition-open-button"/);
  assert.match(bundle, /Ouvrir les combats/);
  assert.doesNotMatch(client, /canDelete: state\.isParent && !state\.isCoach && !state\.isAdmin/);
  assert.doesNotMatch(
    bundle,
    /@click="deleteCompetitionFromList\(competition\.competitionId, competition\.name\)"/
  );
  assert.doesNotMatch(
    bundle,
    /@click="deleteClubCompetitionFromList\(cc\.clubCompetitionId, cc\.name\)"/
  );
  assert.doesNotMatch(client, /function deleteCompetitionFromList\(id,\s*name\)/);
  assert.doesNotMatch(bundle, /<button class="card card-button"[\s\S]*?<button/);
});

test("mobile actions stay explicit instead of icon-only", () => {
  assert.match(bundle, /id="editCompetitionButton"[\s\S]*Modifier la compétition/);
  assert.match(bundle, /id="deleteCompetitionButton"[\s\S]*Supprimer la compétition/);
  assert.match(
    bundle,
    /@click="showCombatForm\(combat\.combatId\)"[\s\S]*?>[\s\S]*?Modifier le combat\s*<\/button>/
  );
  assert.match(
    bundle,
    /@click="deleteCombat\(combat\.combatId\)"[\s\S]*?>[\s\S]*?Supprimer le combat\s*<\/button>/
  );
  assert.match(
    bundle,
    /@click="deleteCombat\(combat\.combatId\)"[\s\S]*?>[\s\S]*?Supprimer\s*<\/button>/
  );
  assert.match(bundle, /id="deleteCompetitionButton"[\s\S]*?>[\s\S]*?Supprimer\s*<\/button>/);
});

test("parent competition detail exposes coach objectives", () => {
  assert.match(bundle, /v-if="showCoachAssessment" class="section coach-assessment-section"/);
  assert.match(
    client,
    /state\.isCoach \|\| state\.isParent \|\| state\.currentCompetition\.coachObjective/
  );
  assert.match(bundle, /<label class="coach-assessment-label">Objectif<\/label>/);
  assert.match(bundle, /\{\{ coachObjectiveText \}\}/);
  assert.match(
    bundle,
    /class="button-secondary coach-assessment-save" type="button" :disabled="isSubmitting" @click="saveCoachObjective\(\)"/
  );
  assert.match(
    bundle,
    /class="button-secondary coach-assessment-save" type="button" :disabled="isSubmitting" @click="saveCoachReview\(\)"/
  );
  assert.doesNotMatch(bundle, /title="Éditer"/);
  assert.doesNotMatch(bundle, /title="Supprimer"/);
});

test("login screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.doesNotMatch(html, /vue@3\/dist\/vue\.global\.prod\.js/);
  assert.match(client, /vue v3\./);
  assert.match(bundle, /id="loginView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /function mountViewModel\(id, viewModel, actions = \{\}, computedRefs = \{\}\)/
  );
  assert.match(
    bundle,
    /function createMountedViewModel\(id,\s*defaultState,\s*actions = \{\},\s*computedRefs = \{\}\)/
  );
  assert.match(bundle, /ui\.createMountedViewModel\("loginView", defaultLoginState,/);
  assert.doesNotMatch(bundle, /id="profileRegistrationForm"/);
  assert.doesNotMatch(bundle, /id="registrationPrenom"|id="registrationNom"/);
  assert.doesNotMatch(bundle, /submitProfileRegistration/);
});

test("home screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="homeView" class="panel" v-cloak/);
  assert.match(bundle, /id="homeActiveJudokaSummary" class="summary home-context-card"/);
  assert.match(bundle, /\{\{ activeJudokaSummary\.value \}\}/);
  assert.match(bundle, /id="competitionsList"/);
  assert.match(bundle, /v-for="competition in competitions"/);
  assert.match(bundle, /@click="openCompetition\(competition\.competitionId\)"/);
  assert.doesNotMatch(bundle, /activeJudokaSummaryHtml|competitionsHtml/);
  assert.match(bundle, /@click="showHomeCompetitionForm\(\)"/);
  assert.match(bundle, /@click="openHomeJudokaProfile\(\)"/);
  assert.match(bundle, /function ensureHomeViewModel\(\)/);
});

test("judoka profile screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="judokaView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="judokaHeroAvatar" class="hero-avatar">\{\{ heroAvatar \}\}<\/div>/);
  assert.match(bundle, /function createJudokaProfileViewModel\(profile,\s*helpers\)/);
  assert.match(bundle, /window\.createJudokaProfileViewModel\(state\.currentJudokaProfile,/);
  assert.match(bundle, /v-for="entry in victoriesByDecisionType"/);
  assert.match(bundle, /v-if="!hasCompetitionResults"/);
  assert.match(bundle, /v-for="result in competitionResultsPage"/);
  assert.match(bundle, /:class="\[result\.resultClass, result\.badgeClass\]"/);
  assert.doesNotMatch(bundle, /lastCompetitionHtml|bestResultsHtml/);
  assert.match(bundle, /function ensureJudokaView\(\)/);
  assert.match(bundle, /\{\{ heroGender \}\}/);
  assert.match(bundle, /\{\{ heroYearInCategory \}\}/);
  assert.match(bundle, /\{\{ heroWeightCategory \}\}/);
  assert.match(bundle, /\{\{ heroHandedness \}\}/);
  assert.match(bundle, /v-model="handednessEditing"/);
  assert.match(
    bundle,
    /id="judokaHeroRecord"[\s\S]*id="judokaHeroCategory"[\s\S]*id="judokaHeroYearInCategory"[\s\S]*id="judokaHeroWeightCategory"[\s\S]*id="judokaHeroGender"[\s\S]*id="judokaHeroHandedness"[\s\S]*id="judokaHeroBeltColor"/
  );
  assert.match(
    bundle,
    /heroCategory,\s*heroWeightCategory,\s*heroBeltColor,\s*heroGender,\s*heroYearInCategory,\s*heroHandedness,\s*heroSeason,/
  );
  assert.match(
    bundle,
    /select v-if="weightCategoryOptions\.length" id="judoka_categorie_poids" v-model="weightCategoryEditing"/
  );
  assert.match(
    bundle,
    /input v-else id="judoka_categorie_poids" v-model="weightCategoryEditing" type="text" :disabled="!ageCategoryEditing"/
  );
  assert.match(bundle, /v-for="weightOption in weightCategoryOptions"/);
  assert.match(bundle, /v-if="yearInCategoryOptions\.length"/);
  assert.match(bundle, /v-for="yearOption in yearInCategoryOptions"/);
  assert.match(bundle, /function onJudokaInfoAgeOrGenderChange\(\)/);
});

test("judoka profile client script stays parseable", () => {
  assert.doesNotThrow(() => new Function(judokaScreenClient));
});

test("coach dashboard screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="coachDashboardView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /const viewIds = \[\s*"loginView",\s*"homeView",\s*"judokaView",\s*"adminsView",\s*"coachDashboardView",\s*"competitionView"/
  );
  assert.match(bundle, /v-model="coachDashboardForm\.ageCategory"/);
  assert.match(bundle, /v-show="activeCoachDashboardTab === 'chat'"/);
  assert.match(
    bundle,
    /id="coachDashboardView" class="panel hidden" v-cloak>\s*<div class="dash-hero">/
  );
  assert.match(bundle, /class="mode-tabs coach-sub-tabs"/);
  assert.match(bundle, /@click="showCoachHome\(\)">Accueil coach/);
  assert.match(bundle, /@click="showPersonalSpace\(\)">Mon espace/);
  assert.doesNotMatch(bundle, /@click="showCoachCompetitions\(\)">Compétition/);
  assert.doesNotMatch(bundle, /@click="showCoachJudoka\(\)">Judoka/);
  assert.match(bundle, /activeCoachDashboardTab === 'stats'/);
  assert.doesNotMatch(bundle, /id="coachDashboardView"[\s\S]{0,500}<div class="panel-header">/);
  assert.doesNotMatch(bundle, /id="coachDashboardView"[\s\S]{0,900}Retour/);
  assert.match(client, /Chat coach — quota LLM limité/);
  assert.match(bundle, /id="coachChatWidget"/);
  assert.match(client, /id:"coachAssistantQuestion",type:"search"/);
  assert.match(client, /function mountCoachChatWidget\(\)/);
  assert.match(client, /function showCoachChat\(\)/);
  assert.match(client, /api\/coach-chat/);
  assert.match(
    bundle,
    /id="coachDashboard_date_debut" type="date" v-model="coachDashboardForm\.dateFrom"/
  );
  assert.match(
    bundle,
    /id="coachDashboard_date_fin" type="date" v-model="coachDashboardForm\.dateTo"/
  );
  assert.match(client, /dateFrom: coachDashboardViewModel\.coachDashboardForm\.dateFrom/);
  assert.match(client, /dateTo: coachDashboardViewModel\.coachDashboardForm\.dateTo/);
  assert.match(client, /if \(dateFrom && dateTo && dateFrom > dateTo\) \{/);
  assert.match(client, /La date de début doit être antérieure ou égale à la date de fin\./);
  assert.doesNotMatch(bundle, /coachDashboardYearOptions|coachDashboardForm\.categoryYear/);
  assert.doesNotMatch(bundle, /coachDashboard_genre|coachDashboardForm\.gender"/);
  assert.doesNotMatch(bundle, /coachDashboard_lateralite|coachDashboardForm\.handedness/);
  assert.match(
    bundle,
    /v-for="option in coachDashboardCompetitionSuggestions" :key="option\.competitionId"[\s\S]*@click="addCoachDashboardCompetition\(option\.competitionId\)"/
  );
  assert.match(
    bundle,
    /v-for="competition in coachDashboardSelectedCompetitions" :key="competition\.competitionId"[\s\S]*@click="removeCoachDashboardCompetition\(competition\.competitionId\)"/
  );
  assert.ok(
    bundle.indexOf('id="coachDashboard_date_debut"') <
      bundle.indexOf('id="coachDashboardCompetitionSearch"'),
    "the age/date filters should appear before the competition picker"
  );
  assert.match(client, /competitionIds: getSelectedCoachDashboardCompetitionIds\(\)/);
  assert.match(client, /function getSelectedCoachDashboardCompetitionIds\(\)/);
  assert.match(
    client,
    /option\.competitionIds\?\.length \? option\.competitionIds : \[option\.competitionId\]/
  );
  assert.match(client, /availableCompetitions = response\.availableCompetitions/);
  assert.match(
    client,
    /coachDashboardForm\.competitionIds = coachDashboardViewModel\.coachDashboardForm\.competitionIds\.filter/
  );
  assert.doesNotMatch(bundle, /applyCoachDashboardFilters|>Actualiser</);
  assert.match(client, /function scheduleCoachDashboardRefresh\(\)/);
  assert.match(bundle, /@change="scheduleCoachDashboardRefresh\(\)"/);
  assert.match(bundle, /<h3>Synthèse coach<\/h3>/);
  assert.match(bundle, /L'essentiel avant de creuser les détails\./);
  assert.match(
    bundle,
    /Pour chaque niveau, affiche la plus belle médaille obtenue et le nombre de podiums de cette médaille uniquement/
  );
  assert.match(bundle, /coachDashboardTopPodiumLevel/);
  assert.match(
    client,
    /PODIUM_LEVEL_PRIORITY = \["International", "National", "Régional", "Départemental"\]/
  );
  assert.match(
    client,
    /PODIUM_LEVEL_LABELS = \{[\s\S]*International: "Int\."[\s\S]*National: "Nat\."[\s\S]*Régional: "Rég\."[\s\S]*Départemental: "Dép\."/
  );
  assert.match(client, /PODIUM_PLACE_PRIORITY = \["1er", "2e", "3e"\]/);
  assert.match(client, /PODIUM_PLACE_EMOJIS = \{ "1er": "🥇", "2e": "🥈", "3e": "🥉" \}/);
  assert.match(client, /const podiumCount = Number\(podium\?\.count \|\| 0\)/);
  assert.match(
    client,
    /podiumHighlights\.push\(`\$\{PODIUM_LEVEL_LABELS\[level\] \|\| level\} \$\{podiumCount\}x\$\{PODIUM_PLACE_EMOJIS\[place\]\}`\)/
  );
  assert.match(client, /podiumHighlights\.join\("\\n"\)/);
  assert.match(
    bundle,
    /class="stat-value stat-value-multiline">\{\{ coachDashboardTopPodiumLevel \}\}/
  );
  assert.match(client, /const coachDashboardTopQualityIssue = window\.Vue\.computed/);
  assert.match(client, /issue\.rate > topIssue\.rate/);
  assert.match(bundle, /coachDashboardMainQualityIssue/);
  assert.match(bundle, /coachDashboardSummaryInsight/);
  assert.match(bundle, /Compétitions analysées/);
  assert.match(bundle, /\{\{ coachDashboardStats\.analyzedCompetitions \}\}/);
  assert.ok(
    bundle.indexOf("<h3>Synthèse coach</h3>") < bundle.indexOf("<h3>Podiums"),
    "the dashboard summary should appear before detailed podium metrics"
  );
  assert.match(bundle, /<h3>Volume de combats<\/h3>/);
  assert.match(bundle, /Volume calculé avec les filtres choisis\./);
  assert.match(
    bundle,
    /class="stat-card stat-card-split"[\s\S]*<span class="stat-label">Judokas par genre/
  );
  assert.match(
    bundle,
    /<span class="split-stat-label">Homme<\/span>[\s\S]*coachDashboardJudokasByGender\[0\]\?\.judokaCount \|\| 0/
  );
  assert.match(
    bundle,
    /<span class="split-stat-label">Femme<\/span>[\s\S]*coachDashboardJudokasByGender\[1\]\?\.judokaCount \|\| 0/
  );
  assert.match(
    bundle,
    /class="stat-card stat-card-split"[\s\S]*<span class="stat-label">Judokas par garde/
  );
  assert.match(
    bundle,
    /<span class="split-stat-label">Droitier<\/span>[\s\S]*coachDashboardJudokasByHandedness\[0\]\?\.judokaCount \|\| 0/
  );
  assert.match(
    bundle,
    /<span class="split-stat-label">Gaucher<\/span>[\s\S]*coachDashboardJudokasByHandedness\[1\]\?\.judokaCount \|\| 0/
  );
  assert.match(bundle, /<h3>Podiums/);
  assert.match(
    bundle,
    /v-for="entry in coachDashboardPodiumsByLevel" :key="entry\.level" class="stat-card stat-card-split"[\s\S]*\{\{ entry\.level \}\}[\s\S]*v-for="podium in entry\.podiums" :key="`\$\{entry\.level\}-\$\{podium\.place\}`"[\s\S]*\{\{ podium\.label \}\}[\s\S]*<span class="split-stat-value">\{\{ podium\.count \}\}<\/span>/
  );
  assert.match(bundle, /podium-split-grid/);
  assert.doesNotMatch(bundle, /podium\.place === '1er' \}"[\s\S]{0,400}podium\.total/);
  assert.match(client, /coachDashboardPodiumsByLevel/);
  assert.match(bundle, /<h3>Profil de performance<\/h3>/);
  assert.match(bundle, /Taux calculés avec les filtres choisis\./);
  assert.doesNotMatch(bundle, /dashboard-subsection/);
  assert.match(bundle, /<span class="stat-label">Victoires totales/);
  assert.match(bundle, /<span class="stat-label">Victoires Ippon debout/);
  assert.match(bundle, /<span class="stat-label">Victoires Ippon au sol/);
  assert.doesNotMatch(bundle, /Défaites par hansoku-make<\/span>/);
  assert.match(bundle, /<h3>Par garde<\/h3>/);
  assert.match(bundle, /Taux de victoire selon la garde du judoka et de l'adversaire\./);
  assert.match(bundle, /<span class="split-stat-label">Garde opposée<\/span>/);
  assert.match(bundle, /<span class="split-stat-label">Même Garde<\/span>/);
  assert.match(
    bundle,
    /\{\{ coachDashboardStats\.victories \}\}\/\{\{ coachDashboardStats\.totalCombats \}\} \(\{\{ coachDashboardStats\.victoryRate \}\}%\)/
  );
  assert.match(
    bundle,
    /\{\{ coachDashboardStats\.tachiWazaIpponVictories \}\}\/\{\{ coachDashboardStats\.totalCombats \}\} \(\{\{ coachDashboardStats\.tachiWazaIpponVictoryRate \}\}%\)/
  );
  assert.match(
    bundle,
    /\{\{ coachDashboardStats\.neWazaIpponVictories \}\}\/\{\{ coachDashboardStats\.totalCombats \}\} \(\{\{ coachDashboardStats\.neWazaIpponVictoryRate \}\}%\)/
  );
  assert.match(
    bundle,
    /v-for="entry in coachDashboardVictoriesByType" :key="entry\.decisionType" class="stat-card"[\s\S]*\{\{ entry\.count \}\}\/\{\{ entry\.total \}\} \(\{\{ entry\.rate \}\}%\)/
  );
  assert.match(
    bundle,
    /v-for="entry in coachDashboardDefeatsByType" :key="entry\.decisionType" class="stat-card"[\s\S]*\{\{ entry\.count \}\}\/\{\{ entry\.total \}\} \(\{\{ entry\.rate \}\}%\)/
  );
  assert.match(bundle, /<h3>Fiabilité des données<\/h3>/);
  assert.match(
    bundle,
    /v-if="!coachDashboardDataQualityIssues\.length" class="empty-state">Aucune donnée à fiabiliser/
  );
  assert.match(
    bundle,
    /v-for="entry in coachDashboardDataQualityIssues" :key="entry\.criterion" class="stat-card"[\s\S]*\{\{ entry\.label \}\}[\s\S]*:aria-label="getDataQualityIssueDescription\(entry\.criterion\)"[\s\S]*\{\{ getDataQualityIssueDescription\(entry\.criterion\) \}\}[\s\S]*\{\{ entry\.count \}\}\/\{\{ entry\.total \}\} \(\{\{ entry\.rate \}\}%\)/
  );
  assert.match(client, /function getDataQualityIssueDescription\(criterion\)/);
  assert.match(client, /\(entry\) => entry\.count > 0/);
  assert.match(client, /inconsistentIppon:/);
  assert.match(bundle, /class="info-tip" tabindex="0"/);
  assert.match(bundle, /class="info-tip-bubble" aria-hidden="true"/);
  assert.match(bundle, /\.tooltip,\s*\.info-tip\s*\{/);
  assert.match(bundle, /\.tooltip-trigger\s*\{/);
  assert.match(bundle, /\.tooltip-content,\s*\.info-tip-bubble\s*\{/);
  assert.match(bundle, /--tooltip-shift-x/);
  assert.match(bundle, /--tooltip-arrow-shift-x/);
  assert.match(bundle, /\.tooltip:hover \.tooltip-content/);
  assert.match(client, /function setupTooltipPositioning\(\)/);
  assert.match(client, /getBoundingClientRect\(\)/);
  assert.match(bundle, /\.info-tip\s*\{/);
  assert.match(bundle, /\.info-tip-bubble\s*\{/);
  assert.match(
    bundle,
    /class="stat-card stat-card-split"[\s\S]*<span class="stat-label">Garde du judoka vs garde de l'adversaire[\s\S]*coachDashboardByLateralMatchup\[0\]\?\.victories \|\| 0[\s\S]*coachDashboardByLateralMatchup\[0\]\?\.combats \|\| 0[\s\S]*coachDashboardByLateralMatchup\[0\]\?\.victoryRate \|\| 0[\s\S]*coachDashboardByLateralMatchup\[1\]\?\.victories \|\| 0[\s\S]*coachDashboardByLateralMatchup\[1\]\?\.combats \|\| 0[\s\S]*coachDashboardByLateralMatchup\[1\]\?\.victoryRate \|\| 0/
  );
  assert.doesNotMatch(bundle, /<h3>Par niveau/);
  assert.doesNotMatch(client, /coachDashboardByCompetitionLevel/);
  assert.doesNotMatch(bundle, /Performance selon la garde de l'adversaire/);
  assert.doesNotMatch(bundle, /Performance selon la garde historique du judoka/);
  assert.match(bundle, /\.stat-card-split\s*\{/);
  assert.match(bundle, /\.split-stat-grid\s*\{/);
  assert.match(bundle, /\.split-stat-label\s*\{/);
  assert.doesNotMatch(bundle, /breakdown-row/);
  assert.match(bundle, /function ensureCoachDashboardViewModel\(\)/);
  assert.match(bundle, /@click="showCoachHome\(\)">Accueil coach/);
  assert.match(bundle, /@click="showPersonalSpace\(\)">Mon espace/);
  assert.doesNotMatch(bundle, /@click="showCoachCompetitions\(\)">Compétitions club/);
  assert.doesNotMatch(bundle, /@click="showCoachJudoka\(\)">Judoka/);
  assert.doesNotMatch(bundle, /@click="showCoachDashboard\(\)">Tableau de bord/);
  assert.doesNotMatch(bundle, /@click="showCoachChat\(\)">Chat/);
  assert.match(client, /function showCoachHome\(\)/);

  const coachDashboardSectionStart = bundle.indexOf('id="coachDashboardView"');
  const dashboardSectionOrder = [
    "<h3>Podiums",
    "<h3>Volume de combats</h3>",
    "<h3>Effectif engagé</h3>",
    "<h3>Par garde</h3>",
    "<h3>Profil de performance</h3>",
    "<h3>Mode de victoire",
    "<h3>Mode de défaite",
    "<h3>Fiabilité des données</h3>"
  ].map((marker) => bundle.indexOf(marker, coachDashboardSectionStart));
  assert.ok(
    dashboardSectionOrder.every((index) => index !== -1),
    "every dashboard section heading should be present"
  );
  assert.ok(
    dashboardSectionOrder.every(
      (index, position) => position === 0 || dashboardSectionOrder[position - 1] < index
    ),
    "dashboard sections should follow the configured order"
  );
});

test("admins screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="adminsView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="importUsersFile" accept="\.csv,text\/csv"/);
  assert.match(bundle, /<strong>couleur_ceinture<\/strong>/);
  assert.match(
    bundle,
    /Import CSV terminé : \$\{response\.imported\} ligne\(s\) OK, \$\{response\.failed\} ligne\(s\) KO\./
  );
  assert.doesNotMatch(
    bundle,
    /importUsersResults|id="importUsersResults"|v-for="entry in importUsersResults"/
  );
  assert.match(bundle, /id="usersList"/);
  assert.match(bundle, /v-for="managedUser in managedUsersPage"/);
  assert.match(bundle, /@click="deleteUser\(managedUser\.judokaId, managedUser\.fullName\)"/);
  assert.match(bundle, /id="adminsList"/);
  assert.match(bundle, /v-for="admin in adminsPage"/);
  assert.match(bundle, /@click="revokeAdminRole\(admin\.judokaId, admin\.fullName\)"/);
  assert.doesNotMatch(bundle, /usersSummaryHtml|usersListHtml|adminsListHtml/);
  assert.match(
    bundle,
    /id="saveAdminButton" type="button" :disabled="isSubmitting" @click="saveAdminRole\(\)"/
  );
  assert.match(bundle, /function ensureAdminsViewModel\(\)/);
});

test("competition detail screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="competitionView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="competitionTitle">\{\{ competitionTitle \}\}<\/h2>/);
  assert.match(bundle, /id="combatsList">[\s\S]*v-for="combat in combats"/);
  assert.match(bundle, /Niveau de compétition non renseigné/);
  assert.match(bundle, /v-if="combat\.dataQualityIssues\.length"/);
  assert.match(bundle, /v-for="issue in combat\.dataQualityIssues"/);
  assert.match(bundle, /'metric-warning-high': issue\.priority === 'high'/);
  assert.match(client, /Droitier\/gaucher du judoka non renseigné/);
  assert.match(client, /Droitier\/gaucher de l'adversaire non renseigné/);
  assert.match(client, /Fin du combat non renseignée/);
  assert.match(client, /Points marqués non renseignés/);
  assert.match(client, /Ippon indiqué, mais aucun point Ippon détaillé/);
  assert.match(client, /priority: "high"/);
  assert.match(client, /priority: "medium"/);
  assert.doesNotMatch(bundle, /combatsHtml/);
  assert.match(
    bundle,
    /id="finalizeCompetitionButton" class="button-secondary" type="button" v-show="canFinalizeCompetition" :disabled="isSubmitting" @click="showCompetitionFinalizationForm\(\)"/
  );
  assert.match(bundle, /function ensureCompetitionDetailViewModel\(\)/);
});

test("competition form keeps age and weight categories without place or actual weight", () => {
  assert.match(
    bundle,
    /<select id="competition_categorie_age" v-model="competitionForm\.ageCategory" :disabled="competitionInheritedFieldsLocked" @change="onCompetitionFormAgeCategoryChange\(\)">[\s\S]*<option value="">Sélectionnez une catégorie<\/option>[\s\S]*<option value="Poussinet">Poussinet<\/option>[\s\S]*<option value="Poussin">Poussin<\/option>[\s\S]*<option value="Benjamin">Benjamin<\/option>[\s\S]*<option value="Minime">Minime<\/option>[\s\S]*<option value="Cadet">Cadet<\/option>[\s\S]*<option value="Junior">Junior<\/option>[\s\S]*<option value="Senior">Senior<\/option>[\s\S]*<option value="Vétéran">Vétéran<\/option>[\s\S]*<\/select>/
  );
  assert.match(
    bundle,
    /select v-if="competitionWeightCategoryOptions\.length" id="competition_categorie_poids" v-model="competitionForm\.weightCategory"/
  );
  assert.match(
    bundle,
    /input v-else id="competition_categorie_poids" v-model="competitionForm\.weightCategory" type="text" :disabled="!competitionForm\.ageCategory"/
  );
  assert.match(bundle, /v-for="weightOption in competitionWeightCategoryOptions"/);
  assert.doesNotMatch(
    bundle,
    /id="competitionResultBlock" :class="\{ hidden: !showCompetitionResultBlock \}"/
  );
  assert.doesNotMatch(bundle, /id="competition_result" v-model="competitionForm\.result"/);
  assert.doesNotMatch(bundle, /competitionFormViewModel\.showCompetitionResultBlock = true;/);
  assert.doesNotMatch(bundle, /competitionFormViewModel\.showCompetitionResultBlock = false;/);
  assert.doesNotMatch(bundle, /id="competition_lieu"/);
  assert.doesNotMatch(bundle, /id="competition_poids_pesee"/);
  assert.match(bundle, /<span id="competitionAgePoids"/);
  assert.match(
    client,
    /if \(!competition\.ageCategory\) \{\s*showError\(\{ message: "Sélectionnez une catégorie d'âge avant d'enregistrer la compétition\." \}\);\s*return;\s*\}/
  );
});

test("new competition form defaults the date to today", () => {
  assert.match(bundle, /function getCurrentLocalDate\(\)/);
  assert.match(bundle, /competitionDate: getCurrentLocalDate\(\)/);
});

test("competition form screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="competitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /Compétition liée à un événement club/);
  assert.match(
    bundle,
    /id="competition_nom" v-model\.trim="competitionForm\.name" :disabled="competitionInheritedFieldsLocked"/
  );
  assert.match(
    bundle,
    /id="competition_date" v-model="competitionForm\.competitionDate" :disabled="competitionInheritedFieldsLocked"/
  );
  assert.match(
    bundle,
    /id="competition_categorie_age" v-model="competitionForm\.ageCategory" :disabled="competitionInheritedFieldsLocked"/
  );
  assert.match(
    bundle,
    /id="competition_niveau" v-model="competitionForm\.level" :disabled="competitionInheritedFieldsLocked"/
  );
  assert.match(
    client,
    /competitionFormViewModel\.competitionInheritedFieldsLocked = Boolean\(c\.clubCompetitionId\)/
  );
  assert.match(bundle, /@click="saveCompetition\(\)"/);
  assert.match(bundle, /function ensureCompetitionFormViewModel\(\)/);
});

test("coach can open club competition creation and participant management UI", () => {
  assert.match(bundle, /id="addClubCompetitionButton"/);
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /id="club_competition_categorie_age" v-model="clubCompetitionForm\.ageCategory"/
  );
  assert.match(bundle, /id="club_competition_niveau" v-model="clubCompetitionForm\.level"/);
  assert.match(bundle, /id="club_detail_niveau" v-model="clubCompetitionDetailForm\.level"/);
  assert.match(bundle, /Compétition terminée — les participants sont verrouillés/);
  assert.match(bundle, /v-if="!clubCompetitionParticipantsLocked" class="section"/);
  assert.match(bundle, /:disabled="isSubmitting \|\| clubCompetitionParticipantsLocked"/);
  assert.match(bundle, /v-if="!hasClubCompetitionFormAgeCategory"/);
  assert.match(bundle, /id="clubCompetitionParticipants"/);
  assert.match(bundle, /v-for="participant in clubCompetitionFormParticipantsPage"/);
  assert.match(client, /function showClubCompetitionForm\(\)/);
  assert.match(client, /function updateClubCompetitionAgeCategory\(\)/);
  assert.match(client, /"saveClubCompetition"/);
  assert.match(client, /detachClubCompetitionParticipant/);
  assert.match(client, /formatCompetitionRanking\(p\.result\) \|\| "Non classé"/);
  assert.match(bundle, /Aucun judoka disponible dans cette catégorie\./);
  assert.match(bundle, /v-else-if="!clubCompetitionAvailableJudokasFiltered\.length"/);
});

test("competition finalization screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="competitionFinalizationView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /id="competitionFinalizationSubtitle" class="subtitle">\{\{ finalizationSubtitle \}\}<\/p>/
  );
  assert.match(bundle, /id="finalization_classement" v-model="finalizationForm\.result"/);
  assert.match(bundle, /<option value="1er">🥇<\/option>/);
  assert.match(bundle, /<option value="2e">🥈<\/option>/);
  assert.match(bundle, /<option value="3e">🥉<\/option>/);
  assert.match(bundle, /@click="finalizeCompetition\(\)"/);
  assert.match(bundle, /function ensureCompetitionFinalizationViewModel\(\)/);
});

test("owner autocomplete provides disambiguation metadata", () => {
  assert.match(bundle, /class="autocomplete-option-copy"/);
  assert.match(bundle, /class="autocomplete-option-meta"/);
  assert.doesNotMatch(css, /\.autocomplete-dropdown\s*\{[^}]*display:\s*none;/);
  assert.match(bundle, /v-for="option in ownerOptions"/);
  assert.match(bundle, /v-for="option in filterOptions"/);
  assert.match(bundle, /@blur="hideHomeFilterOptions\(\)"/);
  assert.match(bundle, /@blur="hideCompetitionOwnerOptions\(\)"/);
  assert.match(client, /showHomeFilterOptions,\s*hideHomeFilterOptions,/);
  assert.match(bundle, /@mousedown\.prevent="selectCompetitionOwner\(option\)"/);
  assert.match(bundle, /@mousedown\.prevent="selectFilterJudoka\(option\)"/);
  assert.match(client, /function hideHomeFilterOptions\(\)/);
  assert.match(client, /function hideCompetitionOwnerOptions\(\)/);
  assert.match(client, /refreshHomeFilterOptions\(""\)/);
  assert.match(client, /refreshCompetitionOwnerOptions\(""\)/);
  assert.match(
    client,
    /window\.setTimeout\(\(\) => \{\s*const homeViewModel = getHomeViewModel\(\);\s*homeViewModel\.showFilterOptions = false;/
  );
  assert.match(
    client,
    /window\.setTimeout\(\(\) => \{\s*competitionFormViewModel\.showOwnerOptions = false;/
  );
  assert.doesNotMatch(
    bundle,
    /bindAutocomplete|dataset\.bound|competition_id_judoka|id="filterJudoka"/
  );
  assert.match(bundle, /function getCompactJudokaLabel\(j\)/);
  assert.match(bundle, /function getClassementBadgeClass\(value\)/);
  assert.match(bundle, /function getJudokaInitials\(judoka\)/);
  assert.match(bundle, /function normalizeDisplayName\(value\)/);
  assert.match(bundle, /function normalizeLastName\(value\)/);
  assert.match(bundle, /function getJudokaSecondaryText\(judoka\)/);
  assert.match(bundle, /function getJudokaSearchText\(judoka\)/);
});

test("combat decision type appears only after choosing a result", () => {
  assert.match(bundle, /id="combatDecisionBlock" :class="\{ hidden: !showCombatDecisionBlock \}"/);
  assert.match(bundle, /function getCombatDecisionOptions\(result\)/);
  assert.match(bundle, /function getCombatFormFocusTarget\(isEditingExistingCombat\)/);
  assert.match(bundle, /!isEditingExistingCombat \|\| !form\.result/);
  assert.match(bundle, /return "combat_adversaire"/);
  assert.match(bundle, /function syncCombatDecisionVisibility\(clearValueWhenHidden\)/);
  assert.match(bundle, /if \(result === "Victoire" \|\| result === "Défaite"\)/);
  assert.match(bundle, /if \(result === "Egalité"\)/);
  assert.match(bundle, /Hansoku-make/);
  assert.match(
    bundle,
    /id="combat_resultat" v-model="combatForm\.result" @change="syncCombatDecisionVisibility\(true\)"/
  );
});

test("combat form screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="combatFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="combat_adversaire" v-model\.trim="combatForm\.opponent"/);
  assert.match(bundle, /Aide à comparer les combats selon le côté préféré de chacun\./);
  assert.match(
    bundle,
    /Indiquez si le combat s'est terminé par ippon, points, décision ou pénalité\./
  );
  assert.match(bundle, /Aide à repérer les points debout et au sol\./);
  assert.match(
    bundle,
    /<template v-if="score\.category === 'Tachi-waza'">[\s\S]*type="text" list="tachiWazaTechniqueSuggestions" v-model\.trim="score\.technique" placeholder="Action debout/
  );
  assert.match(
    bundle,
    /<datalist id="tachiWazaTechniqueSuggestions">[\s\S]*v-for="technique in tachiWazaTechniques"/
  );
  assert.match(
    client,
    /const tachiWazaTechniques = window\.Vue\.computed\(\(\) => TACHI_WAZA_TECHNIQUES\)/
  );
  assert.match(
    bundle,
    /<option v-for="option in combatDecisionOptions" :key="option" :value="option">\{\{ option \}\}<\/option>/
  );
  assert.match(
    bundle,
    /id="saveCombatButton" type="button" :disabled="isSubmitting" @click="saveCombat\(\)"/
  );
  assert.match(bundle, /@click="showCombatForm\(\)"/);
  assert.match(bundle, /const combatId = id && typeof id === "object" && "type" in id \? "" : id;/);
  assert.match(bundle, /function ensureCombatFormViewModel\(\)/);
});

test("combat form surfaces every data quality issue inline, near the field it concerns", () => {
  assert.match(
    bundle,
    /id="combatDecisionBlock"[\s\S]*v-if="combatFormVictoryTypeIssues\.length"[\s\S]*v-for="issue in combatFormVictoryTypeIssues"/
  );
  assert.match(
    bundle,
    /id="combat_garde_adversaire"[\s\S]*v-if="combatFormOpponentStanceIssues\.length"[\s\S]*v-for="issue in combatFormOpponentStanceIssues"/
  );
  assert.match(
    bundle,
    /\+ Ajouter une prise[\s\S]*v-if="combatFormScoreIssues\.length"[\s\S]*v-for="issue in combatFormScoreIssues"/
  );
  assert.match(bundle, /'metric-warning-high': issue\.priority === 'high'/);
  assert.match(
    client,
    /form\.result === "Victoire" &&\s*form\.victoryType === "Ippon" &&\s*!form\.scores\.some\(\(score\) => score\.value === "Ippon"\)/
  );
  assert.match(client, /Ippon indiqué, mais aucun point Ippon détaillé/);
  assert.match(client, /getCombatDecisionOptions\(form\.result\)\.length && !form\.victoryType/);
  assert.doesNotMatch(bundle, /hasInconsistentIppon/);
  assert.doesNotMatch(bundle, /v-if="combatFormDataQualityIssues\.length"/);
});
