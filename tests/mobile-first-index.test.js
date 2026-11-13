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
    "app-runtime.js",
    "app.js"
  ].map((file) => fs.readFileSync(path.join(__dirname, "..", "assets", "dist", file), "utf8"))
].join("\n");
const bundle = `${html}\n${css}\n${client}`;

test("competition cards avoid redundant mobile action rows", () => {
  assert.equal(bundle.includes('<span class="meta-label">Action</span>'), false);
  assert.equal(bundle.includes('<span class="meta-value">Ouvrir</span>'), false);
});

test("mobile action bars hold one line with a wide primary action", () => {
  assert.match(bundle, /\.mobile-action-bar\s*\{/);
  assert.match(bundle, /\.mobile-action-bar\.action-bar-inline\s*\{[\s\S]*?flex-direction:\s*row;/);
  assert.match(bundle, /\.action-bar-inline > \.action-bar-primary\s*\{[\s\S]*?flex:\s*1;/);
  assert.match(bundle, /class="mobile-action-bar primary-action action-bar-inline"/);
  assert.match(bundle, /class="form-actions mobile-action-bar action-bar-inline"/);
  assert.match(bundle, /id="saveCombatButton" class="action-bar-primary"/);
  assert.match(bundle, /id="saveCompetitionButton" class="action-bar-primary"/);
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
  assert.match(client, /Cette action nécessite une connexion/);
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
  assert.doesNotMatch(bundle, /pending-sync-note/);
  assert.match(client, /modification.*enregistrée.*localement/);
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
  assert.match(bundle, /\.topbar\s*\{[\s\S]*?padding: 16px 16px 14px;/);
  assert.match(bundle, /class="brand-logo"/);
  assert.match(bundle, /class="brand-logo-mark"/);
  assert.match(bundle, /class="brand-logo-belt"/);
  assert.doesNotMatch(bundle, /qwant\.com|tse\.mm\.bing\.net|OIP\.2L4yJnGwNyAZkgiTuUu-NAHaHa/);
  assert.match(
    bundle,
    /\.app-shell\s*\{[\s\S]*?padding: 0 0 calc\(96px \+ env\(safe-area-inset-bottom\)\);/
  );
});

test("competition actions live in a « ⋯ » menu and the ranking is chosen on the page", () => {
  assert.match(bundle, /<details v-if="canEditCompetition" id="competitionAdminActions" class="page-menu">/);
  assert.match(bundle, /id="editCompetitionButton"[^>]*role="menuitem"[\s\S]*?Modifier la compétition/);
  assert.match(bundle, /id="deleteCompetitionButton"[^>]*role="menuitem"[^>]*class="page-menu-danger"/);
  assert.doesNotMatch(bundle, /id="finalizeCompetitionButton"/);
  assert.doesNotMatch(bundle, /id="competitionFinalizationView"/);
  assert.match(bundle, /id="competitionRankingSection"/);
  assert.match(bundle, /@click="saveCompetitionRanking\(option\.value\)"/);
  assert.match(client, /\["1er", "2e", "3e", "5e", "7e", "Non classé"\]/);
  assert.match(bundle, /<div v-if="canManageCombat" class="mobile-action-bar primary-action action-bar-inline">[\s\S]*id="addCombatButton"[\s\S]*Ajouter un combat/);
  assert.match(bundle, /window\.KirokuScreenProjections\.projectCompetitionDetail\(/);
  assert.match(bundle, /window\.KirokuScreenProjections\.projectCompetitionCombats\(/);
  assert.match(bundle, /\.hidden\s*\{\s*display: none !important;/);
});

test("judoka home opens on the competition list with its actions on one line", () => {
  assert.doesNotMatch(bundle, /v-if="showJudokaHub"|class="coach-home-grid"|parent-home-card"/);
  assert.match(bundle, /id="homeAdminActions" class="home-actions-row" v-show="showHomeActions"/);
  assert.match(bundle, /id="addCompetitionButton" v-if="showAddCompetitionAction"/);
  assert.match(bundle, /id="openHomeJudokaProfileButton" v-if="canOpenJudokaProfile"/);
  // ACCUEIL-4 : sans compétition, seul l'état vide porte le bouton d'ajout.
  assert.match(client, /showAddCompetitionAction = window\.Vue\.computed\(\(\) => canCreateCompetition\.value && hasCompetitions\(\)\)/);
  // LISTE-2 : deux intertitres au lieu d'une phrase d'explication.
  assert.match(client, /title: "À venir"/);
  assert.match(client, /title: "Passées"/);
  assert.doesNotMatch(bundle, /À venir en tête, puis les résultats/);
});

test("club competition creation keeps age category without weight category", () => {
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="club_competition_name"/);
  assert.match(bundle, /id="club_competition_date"/);
  assert.match(bundle, /id="club_competition_categorie_age"/);
  assert.doesNotMatch(bundle, /club_competition_categorie_poids/);
  assert.doesNotMatch(client, /clubCompetitionWeightCategoryOptions/);
});

test("family home shows one pill per child and remembers the last child", () => {
  assert.match(bundle, /id="homeChildPills" class="choice-chips child-pills" role="radiogroup" aria-label="Enfant suivi"/);
  assert.match(bundle, /@click="selectFilterJudoka\(child\)"/);
  assert.match(client, /kiroku_last_child_/);
  assert.match(client, /function rememberChild\(judokaId\)/);
  assert.match(client, /children\.find\(\(j\) => String\(j\.judokaId\) === remembered\) \|\| children\[0\] \|\| null/);
  assert.match(client, /\.filter\(\(j\) => String\(j\.judokaId\) !== selfId\)/);
  assert.doesNotMatch(bundle, /parentSubModes|openParentJudokaSelectionHub|Accueil parent/);
  assert.match(client, /mode === "parentHome" \? "family" : mode/);
  assert.match(client, /\{ key: "family", label: "Famille" \}/);
});

test("coach screens share the same four tabs and the home lists what is waiting", () => {
  assert.match(
    client,
    /coachSubModes = window\.Vue\.computed\(\(\) => \[\s*\{ key: "coachHome", label: "Accueil" \},\s*\{ key: "coach", label: "Compétitions" \},\s*\{ key: "coachJudoka", label: "Judokas" \},\s*\{ key: "coachDashboard", label: "Stats" \}\s*\]\)/
  );
  assert.match(bundle, /<nav v-if="showCoachSubTabs" class="mode-tabs coach-sub-tabs" aria-label="Navigation coach">/);
  assert.match(bundle, /@click="showCoachHome\(\)">Accueil<\/button>[\s\S]*@click="showCoachCompetitions\(\)">Compétitions<\/button>[\s\S]*@click="showCoachJudoka\(\)">Judokas<\/button>[\s\S]*aria-current="page">Stats<\/button>/);
  assert.doesNotMatch(bundle, /label: "Gestion des accès"/);
  assert.match(bundle, /class="coach-agenda"/);
  assert.match(client, /title: "Cette semaine"/);
  assert.match(client, /title: "Classements à saisir"/);
  assert.match(client, /title: "Bilans à écrire"/);
  assert.match(bundle, /@click="openClubCompetition\(item\.clubCompetitionId\)"/);
  assert.match(bundle, /id="homeClubFilter" class="pill-select"/);
});

test("coach judoka tab keeps an explicit judoka picker without preselection", () => {
  assert.match(client, /canFilterByJudoka = window\.Vue\.computed\(\(\) => getCurrentMode\(\) === "coachJudoka" && state\.judokas\.length > 0\)/);
  assert.match(client, /if \(mode !== "coachJudoka"\) \{\s*const children = getChildren\(\);/);
  assert.match(bundle, /Aucune compétition enregistrée pour ce judoka\./);
  assert.match(client, /profileButtonText: firstName \? `Fiche de \$\{firstName\}` : "Voir la fiche"/);
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

test("judoka profile reads as a season summary with bars and tappable results", () => {
  assert.match(bundle, /id="judokaView" class="panel hidden"/);
  assert.match(bundle, /id="judokaHero" class="judoka-hero"/);
  assert.match(bundle, /class="season-switch"[\s\S]*aria-label="Saison précédente"[\s\S]*id="judokaSeasonLabel"[\s\S]*aria-label="Saison suivante"/);
  assert.match(bundle, /id="judokaSeasonBalance" class="mini-stat-value">\{\{ seasonRecord \}\}/);
  assert.match(bundle, /id="judokaSeasonCombatCount"/);
  assert.match(bundle, /id="judokaVictoryRate"/);
  assert.match(bundle, /v-if="Number\(seasonWins\)"/);
  assert.match(bundle, /v-if="Number\(seasonLosses\)"/);
  assert.match(bundle, /<h3>Fin des combats gagnés<\/h3>[\s\S]*class="bar-list"/);
  assert.match(bundle, /id="judokaCompetitionResults"/);
  assert.match(bundle, /:key="result\.competitionId \|\|/);
  assert.match(bundle, /@click="openCompetitionFromProfile\(result\.competitionId\)"/);
  assert.match(bundle, /role="menuitem" @click="startProfileEdit\(\)">Modifier le profil/);
  assert.match(bundle, /id="judoka_couleur_ceinture"/);
  assert.match(bundle, /<label for="judoka_lateralite">Garde<\/label>/);
  assert.match(judokaScreenClient, /const isManagedProfile = /);
  assert.match(
    judokaScreenClient,
    /\(\) => state\.isCoach \|\| state\.isAdmin \|\| isOwnProfile\.value \|\| isManagedProfile\.value/
  );
  assert.match(judokaScreenClient, /formatCompetitionRanking/);
  assert.match(bundle, /class="result-badge classement-badge"[\s\S]*\{\{ result\.result \}\}/);
  assert.doesNotMatch(bundle, /id="competition_classement"/);
});

test("judoka forms do not expose birth year fields", () => {
  assert.doesNotMatch(bundle, /ann[eé]e[_ -]?naissance/i);
  assert.doesNotMatch(bundle, /naissance/i);
  assert.doesNotMatch(bundle, /birthYear|birth_year/i);
});

test("home action buttons share one stable height", () => {
  assert.match(bundle, /#homeAdminActions button\s*\{[\s\S]*?min-height:\s*64px;/);
});

test("every screen header uses a back arrow next to the title", () => {
  const backArrows = bundle.match(/class="icon-button page-back"/g) || [];
  assert.ok(backArrows.length >= 7, `flèches retour trouvées : ${backArrows.length}`);
  assert.doesNotMatch(bundle, /class="competition-header-actions"/);
  assert.match(bundle, /\.page-header\s*\{/);
  assert.match(bundle, /\.page-menu-list\s*\{/);
  assert.match(bundle, /\.judoka-hero\s*\{/);
  assert.match(bundle, /\.classement-badge\s*\{/);
  assert.match(client, /details\.page-menu\[open\]/);
});

test("competition list cards open on a single tap and show ranking and record", () => {
  assert.match(bundle, /class="card competition-card"/);
  assert.match(bundle, /class="card-button competition-open-button"/);
  assert.doesNotMatch(bundle, /Ouvrir les combats|card-open-hint/);
  assert.match(bundle, /\{\{ competition\.resultLabel \}\}/);
  assert.match(bundle, /\{\{ competition\.recordLabel \}\}/);
  assert.match(bundle, /v-if="competition\.needsRanking" class="pill pill-todo">Classement à saisir/);
  assert.match(client, /needsRanking: c\.competitionDate < today && !result/);
  assert.doesNotMatch(
    bundle,
    /@click="deleteCompetitionFromList\(competition\.competitionId, competition\.name\)"/
  );
  assert.doesNotMatch(client, /function deleteCompetitionFromList\(id,\s*name\)/);
});

test("combat cards open on tap and destructive actions are labelled", () => {
  assert.match(bundle, /class="card combat-card"[\s\S]*?:role="combat\.canEdit \? 'button' : null"[\s\S]*?@click="combat\.canEdit && showCombatForm\(combat\.combatId\)"/);
  assert.match(bundle, /:aria-label="combat\.canEdit \? 'Modifier le combat contre ' \+ combat\.opponent : null"/);
  assert.doesNotMatch(bundle, /Modifier le combat\s*<\/button>/);
  assert.match(bundle, /id="deleteCombatButton"[\s\S]*?Supprimer ce combat/);
  assert.match(bundle, /id="deleteCompetitionButton"[\s\S]*?>Supprimer la compétition<\/button>/);
  assert.match(bundle, /aria-label="Actions sur la compétition"/);
});

test("coach review saves automatically when leaving the field, and no objective is managed", () => {
  // Le bilan ne s'écrit qu'une fois la compétition commencée : pas de bloc avant sa date.
  assert.match(
    bundle,
    /v-if="showCoachAssessment && !competitionTiming\.isUpcoming" class="section coach-assessment-section"/
  );
  assert.match(
    client,
    /state\.isCoach \|\| state\.isParent \|\| state\.currentCompetition\.coachReview/
  );
  assert.match(bundle, /id="coachReviewText"[^>]*@blur="saveCoachReview\(\)"/);
  assert.match(bundle, /\{\{ coachReviewText \}\}/);
  assert.doesNotMatch(bundle, /coach-assessment-save/);
  assert.match(client, /ref\.coachReviewStatus = "Enregistré";/);
  assert.match(client, /if \(review === \(state\.currentCompetition\.coachReview \|\| ""\)\) return;/);
  // Aucune gestion d'objectif dans l'application.
  assert.doesNotMatch(bundle, /coachObjective|saveCoachObjective|Aucun objectif/);
  assert.doesNotMatch(client, /coachObjective|saveCoachObjective/);
});

test("coach dashboard exposes its core filters and readable metrics without a chat", () => {
  assert.match(bundle, /id="coachDashboardView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /const viewIds = \[\s*"loginView",\s*"homeView",\s*"judokaView",\s*"adminsView",\s*"coachDashboardView",\s*"competitionView"/
  );
  assert.match(bundle, /v-model="coachDashboardForm\.ageCategory"/);
  assert.match(bundle, /id="coachDashboardView" class="panel hidden" v-cloak>\s*<div class="dash-hero">/);
  assert.match(bundle, /class="mode-tabs coach-sub-tabs"/);
  assert.doesNotMatch(bundle, /coachChatWidget|Chat coach|api\/coach-chat|showCoachChat|mountCoachChatWidget/);
  assert.match(bundle, /id="coachDashboard_date_debut" type="date" v-model="coachDashboardForm\.dateFrom"/);
  assert.match(bundle, /id="coachDashboard_date_fin" type="date" v-model="coachDashboardForm\.dateTo"/);
  assert.match(client, /if \(dateFrom && dateTo && dateFrom > dateTo\) \{/);
  assert.match(client, /La date de début doit être antérieure ou égale à la date de fin\./);
  assert.match(
    bundle,
    /v-for="option in coachDashboardCompetitionSuggestions" :key="option\.competitionId"[\s\S]*@click="addCoachDashboardCompetition\(option\.competitionId\)"/
  );
  assert.match(client, /competitionIds: getSelectedCoachDashboardCompetitionIds\(\)/);
  assert.match(client, /function scheduleCoachDashboardRefresh\(\)/);
  assert.match(bundle, /@change="scheduleCoachDashboardRefresh\(\)"/);
  // STATS-1 : quatre chiffres de synthèse, chacun affiché une seule fois.
  assert.match(bundle, /class="dashboard-kpis"/);
  assert.equal((bundle.match(/coachDashboardStats\.analyzedCompetitions/g) || []).length, 1);
  assert.equal((bundle.match(/\{\{ coachDashboardVictoryTile\.value \}\}/g) || []).length, 1);
  // STAT-1 : sous 5 combats, ni pourcentage ni barre.
  assert.match(client, /const MIN_RATE_SAMPLE = 5;/);
  assert.match(client, /" · trop peu de combats"/);
  assert.match(bundle, /v-if="line\.showBar"/);
  // STAT-15 : la synthèse ne porte aucun jugement.
  assert.doesNotMatch(client, /Point fort|Point d'attention/);
  assert.doesNotMatch(bundle, /<h3>Volume de combats<\/h3>|<h3>Synthèse coach<\/h3>|coachDashboardTopPodiumLevel/);
  assert.match(bundle, /v-for="line in coachDashboardPodiumLines"/);
  assert.match(client, /"deuxième place", "deuxièmes places"/);
  // STATS-2 : répartitions en barres.
  assert.match(bundle, /v-for="entry in coachDashboardVictoriesByType"[\s\S]*v-if="entry\.showBar"[\s\S]*class="bar-fill" :style="\{ width: entry\.rate \+ '%' \}"/);
  assert.match(bundle, /v-for="entry in coachDashboardDefeatsByType"/);
  assert.match(bundle, /v-for="entry in coachDashboardTopWinTechniqueBars"/);
  assert.match(bundle, /v-for="line in coachDashboardByLateralMatchup"/);
  // STAT-3 : fins de combat utiles et triées, « Non renseignée » en complément.
  assert.match(client, /decisionType: "Non renseignée"/);
  // STAT-4 à STAT-12, STAT-16 : nouvelles sections.
  assert.match(bundle, /v-for="entry in coachDashboardDefeatTechniqueBars"/);
  // Le tour reste saisi, mais aucune statistique par tour.
  assert.doesNotMatch(bundle, /coachDashboardStageLines|coachDashboardByStage/);
  assert.match(bundle, /v-for="line in coachDashboardLevelLines"/);
  assert.match(bundle, /v-for="line in coachDashboardMonthLines"/);
  assert.match(bundle, /v-for="line in coachDashboardScoreHoldingLines"/);
  assert.match(bundle, /v-for="line in coachDashboardGroundLines"/);
  assert.match(bundle, /v-for="line in coachDashboardIpponLines"/);
  assert.match(bundle, /coachDashboardDiscipline\.shidoText/);
  // STAT-13 : plus de genre dans l'effectif ; STAT-14 : niveau compté par compétition.
  assert.doesNotMatch(client, /judokasByGender|judokaGender/);
  // « Saisies à compléter » : la tuile de synthèse seule, sans section ni liste.
  assert.doesNotMatch(bundle, /coachDashboardQualityIssues|"Voir les compétitions"|getDataQualityIssueDescription/);
  assert.match(client, /\(entry\) => entry\.count > 0/);
  assert.match(bundle, /\.bar-track\s*\{/);
  assert.match(bundle, /\.info-tip\s*\{/);
  assert.match(client, /function setupTooltipPositioning\(\)/);
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
  assert.match(bundle, /<span v-if="ageWeightLabel" id="competitionAgePoids" class="pill">/);
  assert.match(client, /errors\.ageCategory = competition\.ageCategory \? "" : "Choisissez la catégorie d'âge\.";/);
  assert.match(bundle, /id="competition_categorie_age_error" class="field-error" role="alert"/);
});

test("new competition form defaults the date to today", () => {
  assert.match(bundle, /function getCurrentLocalDate\(\)/);
  assert.match(bundle, /competitionDate: getCurrentLocalDate\(\)/);
});

test("coach can open club competition creation and participant management UI", () => {
  assert.match(bundle, /id="addClubCompetitionButton"/);
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /id="club_competition_categorie_age" v-model="clubCompetitionForm\.ageCategory"/
  );
  // CREA-9 : le niveau se choisit en boutons.
  assert.match(bundle, /id="club_competition_niveau"\s+class="choice-segmented choice-segmented-2"\s+role="radiogroup"/);
  assert.match(bundle, /@click="selectClubCompetitionLevel\(option\)"/);
  assert.match(bundle, /id="club_detail_niveau" v-model="clubCompetitionDetailForm\.level"/);
  assert.match(bundle, /Saisie après coup possible : ajoutez les judokas oubliés/);
  assert.match(bundle, /@click="setClubParticipantRanking\(p\.competitionId, option\.value\)"/);
  assert.doesNotMatch(bundle, /v-if="!clubCompetitionParticipantsLocked" class="section"/);
  assert.match(bundle, /v-if="clubCompetitionDetailEditing && \(!clubCompetitionParticipantsLocked \|\| \(!p\.hasCombats && !p\.hasResult\)\)" class="card-actions"/);
  assert.match(bundle, /@click="startClubCompetitionDetailEdit\(\)"/);
  assert.match(bundle, /v-if="!hasClubCompetitionFormAgeCategory"/);
  assert.match(bundle, /id="clubCompetitionParticipants"/);
  assert.match(bundle, /v-for="participant in clubCompetitionFormParticipantsPage"/);
  assert.match(client, /function showClubCompetitionForm\(\)/);
  assert.match(client, /function updateClubCompetitionAgeCategory\(\)/);
  assert.match(client, /"saveClubCompetition"/);
  assert.match(client, /detachClubCompetitionParticipant/);
  assert.match(client, /formatCompetitionRanking\(p\.result\) \|\| ""/);
  assert.match(bundle, /Aucun judoka disponible dans cette catégorie\./);
  assert.match(bundle, /v-else-if="!clubCompetitionAvailableJudokasFiltered\.length"/);
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
  assert.match(bundle, /type="button" class="autocomplete-option" @click="selectCompetitionOwner\(option\)"/);
  assert.match(bundle, /type="button" class="autocomplete-option" @click="selectFilterJudoka\(option\)"/);
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

test("combat quick entry uses buttons, checks the result first and offers « save and next »", () => {
  assert.match(bundle, /id="combatDecisionBlock" class="choice-field" :class="\{ hidden: !showCombatDecisionBlock \}"/);
  assert.match(bundle, /id="combat_resultat"[\s\S]*?role="radiogroup"[\s\S]*?aria-required="true"/);
  assert.match(bundle, /@click="selectCombatResult\(option\.value\)"/);
  assert.match(bundle, /@click="selectCombatStage\(option\)"/);
  assert.match(bundle, /@click="selectCombatDecision\(option\)"/);
  assert.match(bundle, /@click="selectCombatStance\(option\)"/);
  assert.match(bundle, /\.choice-button,\s*\.choice-chip\s*\{\s*min-height:\s*44px;/);
  assert.match(bundle, /function getCombatDecisionOptions\(result\)/);
  assert.match(bundle, /function getCombatFormFocusTarget\(isEditingExistingCombat\)/);
  assert.match(bundle, /preventScroll: target === "saveCombatButton"/);
  assert.match(bundle, /if \(result === "Victoire" \|\| result === "Défaite"\)/);
  assert.match(bundle, /Hansoku-make/);
  // COMBAT-2 : le résultat est vérifié avant l'appel serveur, l'erreur s'affiche sous le champ.
  assert.match(client, /"Choisissez le résultat du combat\."/);
  assert.match(bundle, /id="combat_resultat_error" class="field-error" role="alert"/);
  assert.match(client, /if \(!validateCombatForm\(\)\) return;/);
  // COMBAT-3 : enregistrer et saisir le suivant, avec l'étape suivante proposée.
  assert.match(bundle, /id="saveAndNextCombatButton"[\s\S]*?Enregistrer \+ suivant/);
  assert.match(client, /const next = \{ "1\/32": "1\/16", "1\/16": "1\/8", "1\/8": "1\/4", "1\/4": "1\/2", "1\/2": "Finale" \};/);
  // COMBAT-1 : la fin du combat ajoute le point correspondant en fin de déroulé, dans le bon camp.
  assert.match(client, /form\.points\.push\(createPointRow\(camp, form\.victoryType, \{ autoFromDecision: true \}\)\);/);
  // COMBAT-SCORE : score officiel IWY - IWY dans la saisie rapide.
  assert.match(bundle, /id="combat_score"[\s\S]*?@click="changeCombatOfficialScore\(side\.key, valueKey\.key, 1\)"/);
  // COMBAT-CHRONO : la saisie suit le combat (avant, pendant, fin) et le déroulé se réordonne.
  assert.match(bundle, /<h3>Avant le combat<\/h3>[\s\S]*<h3>Le combat<\/h3>[\s\S]*<h3>Fin du combat<\/h3>/);
  assert.match(bundle, /v-for="\(score, index\) in combatForm\.points"[\s\S]*?moveCombatPoint\(index, -1\)/);
  assert.match(bundle, /@keydown="onChoiceKeydown"/);
  // COMBAT-QUIT : quitter un formulaire modifié demande confirmation.
  assert.match(client, /Quitter sans enregistrer \?/);
  assert.doesNotMatch(bundle, /combat_points_subis/);
});

test("combat form and cards show what is left to fill in plain words", () => {
  assert.match(bundle, /id="combatDecisionBlock"[\s\S]*v-if="combatFormVictoryTypeIssues\.length"[\s\S]*v-for="issue in combatFormVictoryTypeIssues"/);
  assert.match(bundle, /id="combat_garde_adversaire"[\s\S]*v-if="combatFormOpponentStanceIssues\.length"[\s\S]*v-for="issue in combatFormOpponentStanceIssues"/);
  assert.match(bundle, /id="combat_points"[\s\S]*v-if="combatFormScoreIssues\.length"[\s\S]*v-for="issue in combatFormScoreIssues"/);
  assert.match(bundle, /À compléter : \{\{ issue\.shortLabel \}\}/);
  assert.doesNotMatch(bundle, /issue\.priority === 'high' \? 'Haute' : 'Moyenne'/);
  // COMBAT-5 : toucher « À compléter » sur une carte ouvre le formulaire sur le champ concerné.
  assert.match(bundle, /@click\.stop="openCombatIssue\(combat\.combatId, issue\.field\)"/);
  assert.match(client, /scores: "combat_points"/);
  assert.match(
    client,
    /form\.result === "Victoire" &&\s*form\.victoryType === "Ippon" &&\s*!judokaPoints\.some\(\(score\) => score\.value === "Ippon"\)/
  );
  assert.match(client, /Ippon indiqué, mais aucun point Ippon détaillé/);
  assert.match(client, /getCombatDecisionOptions\(form\.result\)\.length && !form\.victoryType/);
});


test("combat form lets the user pick a listed technique or type another one", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const view = fs.readFileSync(path.join(__dirname, "..", "assets", "views", "combat-form.html"), "utf8");
  const screen = fs.readFileSync(path.join(__dirname, "..", "assets", "dist", "app-screen-combat-form.js"), "utf8");
  assert.match(view, /<select[\s\S]*?class="combat-technique-select"[\s\S]*?Autre technique debout…[\s\S]*?Autre technique au sol…/);
  assert.match(view, /v-if="isCustomScoreTechnique\(score\)"/);
  // Seul l'adversaire propose des suggestions libres ; la technique reste une liste groupée.
  assert.match(view, /<datalist id="combat_adversaire_suggestions">/);
  assert.equal((view.match(/<datalist/g) || []).length, 1);
  assert.match(screen, /function isCustomScoreTechnique\(score\)/);
  assert.match(screen, /function selectScoreTechnique\(index, value\)/);
});
