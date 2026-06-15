const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "Index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "assets", "app.css"), "utf8");
const notificationsClient = fs.readFileSync(
  path.join(__dirname, "..", "assets", "app-notifications.js"),
  "utf8"
);
const judokaScreenClient = fs.readFileSync(
  path.join(__dirname, "..", "assets", "app-screen-judoka.js"),
  "utf8"
);
const client = [
  "vendor/vue.global.prod.js",
  "app-ui.js",
  "app-notifications.js",
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
]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "assets", file), "utf8"))
  .join("\n");
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

test("notifications use a toast layer without shifting the main layout", () => {
  assert.match(bundle, /id="toastLayer" class="toast-layer"/);
  assert.match(bundle, /\.toast-layer\s*\{/);
  assert.match(bundle, /\.toast-close\s*\{/);
  assert.match(bundle, /showToast\("success", message,\s*4000\)/);
  assert.match(bundle, /showToast\("error", error\.message \|\| error,\s*7000\)/);
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
  assert.match(bundle, /class="brand-logo-image"/);
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
    /id="competitionAdminActions" class="competition-management-actions" :class="\{ hidden: !canEditCompetition \}"/
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

test("child management screen is available in the mobile action flow", () => {
  assert.match(bundle, /id="manageChildrenButton"/);
  assert.match(bundle, /id="childrenView" class="panel hidden"/);
  assert.match(bundle, /id="childrenList"/);
  assert.match(bundle, /id="child_prenom"/);
  assert.match(bundle, /id="child_nom"/);
  assert.match(bundle, /id="child_email"/);
  assert.match(bundle, /id="saveChildButton"/);
});

test("club competition creation keeps only the shared event basics", () => {
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="club_competition_name"/);
  assert.match(bundle, /id="club_competition_date"/);
  assert.doesNotMatch(bundle, /id="club_competition_age"/);
  assert.doesNotMatch(bundle, /id="club_competition_weight"/);
});

test("parent home keeps visible competitions when no judoka is selected", () => {
  assert.doesNotMatch(bundle, /if \(\(state\.isAdmin \|\| state\.isParent\) && !activeJudoka\) \{/);
  assert.match(bundle, /let filteredComps = state\.competitions;/);
  assert.match(
    bundle,
    /if \(activeJudokaId\) \{\s*filteredComps = state\.competitions\.filter\(\s*\(?c\)? => String\(c\.ownerJudokaId\) === String\(activeJudokaId\)\s*\);/
  );
});

test("admin management screen is available in the mobile action flow", () => {
  assert.match(bundle, /id="manageAdminsButton"/);
  assert.match(bundle, /id="adminsView" class="panel hidden"/);
  assert.match(bundle, /id="adminsList"/);
  assert.match(bundle, /id="accessInvitationsList"/);
  assert.match(bundle, /id="accessInvitationFilter"/);
  assert.match(bundle, /id="invite_email"/);
  assert.match(bundle, /id="invite_profile_type"/);
  assert.match(bundle, /id="saveInvitationButton"/);
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
  assert.match(bundle, /Compétitions du judoka actif/);
  assert.match(bundle, /id="judokaView" class="panel hidden"/);
  assert.match(bundle, /Résumé performance/);
  assert.match(bundle, /Profil de combat/);
  assert.match(bundle, /id="judokaCompetitionResults"/);
  assert.match(bundle, /:key="result\.competitionId \|\|/);
  assert.match(bundle, /id="judokaSeasonCombatCount"/);
  assert.match(bundle, /id="judokaSeasonBalance"/);
  assert.match(bundle, /id="judokaVictoryRate"/);
  assert.match(bundle, /Taux de victoire/);
  assert.match(bundle, /Victoires ippon/);
  assert.match(bundle, /v-if="Number\(combatProfile\.penalties\)"/);
  assert.match(bundle, /v-if="Number\(combatProfile\.forfeits\)"/);
  assert.match(bundle, /id="competitionFinalizationView" class="panel hidden"/);
  assert.match(bundle, /id="finalization_classement"/);
  assert.doesNotMatch(bundle, /id="competition_classement"/);
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

test("competition list exposes direct delete actions without nesting buttons", () => {
  assert.match(bundle, /class="card competition-card"/);
  assert.match(bundle, /class="card-button competition-open-button"/);
  assert.match(bundle, /Ouvrir les combats/);
  assert.match(client, /canDelete: \(state\.isAdmin \|\| state\.isParent\) && !state\.isCoach/);
  assert.match(
    bundle,
    /@click="deleteCompetitionFromList\(competition\.competitionId, competition\.name\)"/
  );
  assert.match(bundle, /function deleteCompetitionFromList\(id,\s*name\)/);
  assert.doesNotMatch(bundle, /<button class="card card-button"[\s\S]*?<button/);
});

test("mobile actions stay explicit instead of icon-only", () => {
  assert.match(
    bundle,
    /@click="showCombatForm\(combat\.combatId\)"[\s\S]*?>[\s\S]*?Modifier\s*<\/button>/
  );
  assert.match(
    bundle,
    /@click="deleteCombat\(combat\.combatId\)"[\s\S]*?>[\s\S]*?Supprimer\s*<\/button>/
  );
  assert.match(
    bundle,
    /@click="deleteCompetitionFromList\(competition\.competitionId, competition\.name\)"[\s\S]*?>[\s\S]*?Supprimer\s*<\/button>/
  );
  assert.match(bundle, /Créer mon profil/);
  assert.doesNotMatch(bundle, /title="Éditer"/);
  assert.doesNotMatch(bundle, /title="Supprimer"/);
});

test("login screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.doesNotMatch(html, /vue@3\/dist\/vue\.global\.prod\.js/);
  assert.match(client, /vue v3\./);
  assert.match(bundle, /id="loginView" class="panel hidden" v-cloak/);
  assert.match(bundle, /function mountViewModel\(id, viewModel, actions = \{\}\)/);
  assert.match(bundle, /function createMountedViewModel\(id,\s*defaultState,\s*actions = \{\}\)/);
  assert.match(bundle, /ui\.createMountedViewModel\("loginView", defaultLoginState,/);
  assert.match(bundle, /v-model\.trim="registration\.firstName"/);
  assert.match(bundle, /@submit\.prevent="submitProfileRegistration\(\)"/);
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
  assert.match(bundle, /class="combat-profile-grid"/);
  assert.match(bundle, /v-if="!hasCompetitionResults"/);
  assert.match(bundle, /v-for="result in competitionResultsPage"/);
  assert.match(bundle, /:class="\[result\.resultClass, result\.badgeClass\]"/);
  assert.doesNotMatch(bundle, /lastCompetitionHtml|bestResultsHtml/);
  assert.match(bundle, /function ensureJudokaViewModel\(\)/);
});

test("judoka profile client script stays parseable", () => {
  assert.doesNotThrow(() => new Function(judokaScreenClient));
});

test("children screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="childrenView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="childrenList"/);
  assert.match(bundle, /v-for="child in children"/);
  assert.match(bundle, /@click="editManagedChild\(child\.judokaId\)"/);
  assert.match(bundle, /@click="deleteManagedChild\(child\.judokaId, child\.fullName\)"/);
  assert.doesNotMatch(bundle, /childrenListHtml/);
  assert.match(
    bundle,
    /id="child_prenom" autocomplete="given-name" v-model\.trim="childForm\.firstName"/
  );
  assert.match(bundle, /id="saveChildButton" @click="saveManagedChild\(\)"/);
  assert.match(bundle, /function ensureChildrenViewModel\(\)/);
});

test("admins screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="adminsView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /id="invite_email" autocomplete="email" placeholder="email@gmail.com" v-model\.trim="accessInvitationForm\.email"/
  );
  assert.match(bundle, /id="accessInvitationsList"/);
  assert.match(bundle, /v-for="invitation in accessInvitations"/);
  assert.match(bundle, /@click="deleteAccessInvitation\(invitation\.email\)"/);
  assert.match(bundle, /id="adminsList"/);
  assert.match(bundle, /v-for="admin in adminsPage"/);
  assert.match(bundle, /@click="revokeAdminRole\(admin\.judokaId, admin\.fullName\)"/);
  assert.doesNotMatch(
    bundle,
    /accessInvitationsSummaryHtml|accessInvitationsListHtml|adminsListHtml/
  );
  assert.match(bundle, /id="saveAdminButton" @click="saveAdminRole\(\)"/);
  assert.match(bundle, /function ensureAdminsViewModel\(\)/);
});

test("competition detail screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="competitionView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="competitionTitle">\{\{ competitionTitle \}\}<\/h2>/);
  assert.match(bundle, /id="combatsList">[\s\S]*v-for="combat in combats"/);
  assert.doesNotMatch(bundle, /combatsHtml/);
  assert.match(
    bundle,
    /id="finalizeCompetitionButton" class="button-secondary" :class="\{ hidden: !canFinalizeCompetition \}" @click="showCompetitionFinalizationForm\(\)"/
  );
  assert.match(bundle, /function ensureCompetitionDetailViewModel\(\)/);
});

test("competition form keeps age and weight categories without place or actual weight", () => {
  assert.match(
    bundle,
    /<select id="competition_categorie_age" v-model="competitionForm\.ageCategory">[\s\S]*<option value="">Non renseignée<\/option>[\s\S]*<option value="Poussinet">Poussinet<\/option>[\s\S]*<option value="Poussin">Poussin<\/option>[\s\S]*<option value="Benjamin">Benjamin<\/option>[\s\S]*<option value="Minime">Minime<\/option>[\s\S]*<option value="Cadet">Cadet<\/option>[\s\S]*<option value="Junior">Junior<\/option>[\s\S]*<option value="Senior">Senior<\/option>[\s\S]*<option value="Vétéran">Vétéran<\/option>[\s\S]*<\/select>/
  );
  assert.match(
    bundle,
    /id="competition_categorie_poids" placeholder="ex: -73kg" v-model\.trim="competitionForm\.weightCategory"/
  );
  assert.match(
    bundle,
    /id="competitionResultBlock" :class="\{ hidden: !showCompetitionResultBlock \}"/
  );
  assert.match(bundle, /id="competition_result" v-model="competitionForm\.result"/);
  assert.match(bundle, /competitionFormViewModel\.showCompetitionResultBlock = true;/);
  assert.match(bundle, /competitionFormViewModel\.showCompetitionResultBlock = false;/);
  assert.doesNotMatch(bundle, /id="competition_lieu"/);
  assert.doesNotMatch(bundle, /id="competition_poids_pesee"/);
  assert.match(bundle, /<span id="competitionAgePoids"/);
});

test("new competition form defaults the date to today", () => {
  assert.match(bundle, /function getCurrentLocalDate\(\)/);
  assert.match(bundle, /competitionDate: getCurrentLocalDate\(\)/);
});

test("competition form screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="competitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="competition_nom" v-model\.trim="competitionForm\.name"/);
  assert.match(bundle, /id="competition_date" v-model="competitionForm\.competitionDate"/);
  assert.match(bundle, /@click="saveCompetition\(\)"/);
  assert.match(bundle, /function ensureCompetitionFormViewModel\(\)/);
});

test("coach can open club competition creation and participant management UI", () => {
  assert.match(bundle, /id="addClubCompetitionButton"/);
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="clubCompetitionParticipants"/);
  assert.match(bundle, /v-for="participant in clubCompetitionFormParticipantsPage"/);
  assert.match(client, /function showClubCompetitionForm\(\)/);
  assert.match(client, /"saveClubCompetition"/);
  assert.match(client, /detachClubCompetitionParticipant/);
});

test("competition finalization screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="competitionFinalizationView" class="panel hidden" v-cloak/);
  assert.match(
    bundle,
    /id="competitionFinalizationSubtitle" class="subtitle">\{\{ finalizationSubtitle \}\}<\/p>/
  );
  assert.match(bundle, /id="finalization_classement" v-model="finalizationForm\.result"/);
  assert.match(bundle, /@click="finalizeCompetition\(\)"/);
  assert.match(bundle, /function ensureCompetitionFinalizationViewModel\(\)/);
});

test("owner autocomplete provides disambiguation metadata", () => {
  assert.match(bundle, /class="autocomplete-option-copy"/);
  assert.match(bundle, /class="autocomplete-option-meta"/);
  assert.doesNotMatch(css, /\.autocomplete-dropdown\s*\{[\s\S]*display:\s*none;/);
  assert.match(bundle, /v-for="option in ownerOptions"/);
  assert.match(bundle, /v-for="option in filterOptions"/);
  assert.match(bundle, /@blur="hideHomeFilterOptions\(\)"/);
  assert.match(bundle, /@blur="hideCompetitionOwnerOptions\(\)"/);
  assert.match(bundle, /@pointerdown\.prevent="selectCompetitionOwner\(option\)"/);
  assert.match(bundle, /@pointerdown\.prevent="selectFilterJudoka\(option\)"/);
  assert.match(client, /function hideHomeFilterOptions\(\)/);
  assert.match(client, /function hideCompetitionOwnerOptions\(\)/);
  assert.match(client, /refreshHomeFilterOptions\(""\)/);
  assert.match(client, /refreshCompetitionOwnerOptions\(""\)/);
  assert.match(
    client,
    /window\.setTimeout\(\(\) => \{\s*homeViewModel\.showFilterOptions = false;/
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
  assert.match(bundle, /function renderCombatDecisionOptions\(result\)/);
  assert.match(bundle, /function syncCombatDecisionVisibility\(clearValueWhenHidden\)/);
  assert.match(bundle, /if \(result === "Victoire" \|\| result === "Défaite"\)/);
  assert.match(bundle, /if \(result === "Egalité"\)/);
  assert.match(bundle, /Hansoku-make/);
  assert.match(bundle, /const shouldShow = getCombatDecisionOptions\(result\)\.length > 0;/);
  assert.match(
    bundle,
    /id="combat_resultat" v-model="combatForm\.result" @change="syncCombatDecisionVisibility\(true\)"/
  );
});

test("combat form screen is mounted through Vue 3 for the progressive screen migration", () => {
  assert.match(bundle, /id="combatFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="combat_adversaire" v-model\.trim="combatForm\.opponent"/);
  assert.match(
    bundle,
    /<option v-for="option in combatDecisionOptions" :key="option" :value="option">\{\{ option \}\}<\/option>/
  );
  assert.match(bundle, /id="saveCombatButton" @click="saveCombat\(\)"/);
  assert.match(bundle, /@click="showCombatForm\(\)"/);
  assert.match(bundle, /const combatId = id && typeof id === "object" && "type" in id \? "" : id;/);
  assert.match(bundle, /function ensureCombatFormViewModel\(\)/);
});
