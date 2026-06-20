---
title: Kiroku Functional Specification
version: 2.1
date_created: 2026-06-11
last_updated: 2026-06-20
owner: competitions-judo
tags:
  - design
  - app
  - mobile-first
  - functional-spec
---

# Introduction

This specification defines the functional behavior of Kiroku, a mobile-first application used to manage judo competitions and combats for a club.

## 1. Purpose & Scope

Kiroku allows a club to:
- manage judoka participation in competitions;
- record combats for each competition;
- let parents manage sports data for linked child judokas imported by the club;
- enforce role-based visibility and actions;
- keep the experience clear and usable on mobile devices.

This specification covers:
- roles and permissions;
- competition rules;
- combat rules;
- imported parent-child link behavior;
- judoka season statistics rules;
- user-facing authentication behavior;
- UI and UX expectations;
- acceptance criteria and business edge cases.

This specification does not define:
- deployment architecture;
- API contracts;
- database schema details;
- infrastructure configuration;
- server-side integration details.

## 2. Definitions

| Term | Definition |
|---|---|
| Kiroku | The application described by this specification. |
| Judoka | A club member profile that owns competitions and combats. |
| Parent | A user profile allowed to manage linked child judokas (read/write). |
| Coach | A user profile with sports access to all club judokas, competitions, combats, and global event dashboards. |
| Admin | A user profile responsible for access governance: invitations and structural role management. |
| Competition | An event that can be shared at the club level, containing combats for one or more judokas. |
| Combat | A single match linked to one competition and one judoka. |
| Mobile first | Design approach where the small-screen layout is the base layout. |

## 3. Functional Requirements, Constraints & Guidelines

### 3.1 Product goals

- **REQ-001**: The system shall allow tracking competitions and combats for judokas.
- **REQ-002**: The system shall enforce access rules based on the connected user's role.
- **REQ-003**: The system shall avoid orphaned functional data after deletions.
- **GUD-001**: The interface should remain compact, tactile, and readable on mobile devices.

### 3.2 Roles and access model

- **ROL-001**: A `JUDOKA` profile can access only its own competitions, combats, and statistics.
- **ROL-002**: A `PARENT` profile can access and edit data of linked child judokas.
- **ROL-003**: A `COACH` profile has read access to all judokas, competitions, and stats within the club, and can manage club competition events and their linked sports data. They cannot manage invitations.
- **ROL-004**: An `ADMIN` profile manages invitations and structural roles only. Admin rights do not include coach sports permissions and shall not allow creating, updating, finalizing, or deleting competitions or combats.
- **ROL-005**: A user invited as `PARENT` or `JUDOKA` keeps that underlying profile type after registration.
- **ROL-006**: `COACH` or `ADMIN` rights are structural roles granted on top of a user account without destroying the underlying profile type.

### 3.3 Competition rules

- **COMP-001**: A `JUDOKA` or `PARENT` can create, update, and delete only competitions linked to their scope.
- **COMP-002**: When a `PARENT` or `JUDOKA` creates an individual competition outside a club competition, the system shall prevent that same judoka from having another standalone individual competition with the same name and date.
- **COMP-002a**: Multiple judokas may have individual competitions with the same name and date when those participations are linked to the same club competition. If a matching club competition already exists, the UI should guide the user toward attaching the judoka's participation to that club event instead of creating an isolated duplicate.
- **COMP-003**: `COACH` profiles can view a global "Competition Dashboard" aggregating all judokas who participated in the same event.
- **COMP-004**: Competition lists shall be sorted by date descending.
- **COMP-005**: A competition must include a name and a date.
- **COMP-006**: A competition shall expose an age category chosen from the fixed list: `Poussinet`, `Poussin`, `Benjamin`, `Minime`, `Cadet`, `Junior`, `Senior`, `Vétéran`, and a weight category.
- **COMP-007**: A competition shall not use a location field (excluded from MVP).
- **COMP-008**: A competition shall not use an actual weigh-in field.
- **COMP-009**: Deleting a competition from a judoka profile shall remove all linked combats for that specific judoka.
- **COMP-013**: When opening the competition creation form, the date field shall be initialized to the current day by default.
- **COMP-014**: Competition creation shall not ask for the final ranking.
- **COMP-015**: Final ranking shall be entered and updated exclusively from a dedicated competition finalization screen. The competition edit form shall not expose a ranking field.
- **COMP-016**: Final ranking values shall be limited to supported ranking results: `1er`, `2e`, `3e`, `4e`, `5e`, `6e`, `7e`, `8e`, or `Non classé`.
- **COMP-016a**: The UI shall display podium rankings as medal emojis (`🥇`, `🥈`, `🥉`) wherever rankings are shown, while preserving the stored final ranking values `1er`, `2e`, and `3e`.
- **COMP-024**: A competition shall expose a level field chosen from: `Départemental`, `Régional`, `National`, `International`. The field is optional (empty by default).
- **COMP-017**: A `COACH` can create a club competition event and assign one or more judokas as participants.
- **COMP-018**: Assigning a judoka to a club competition creates an individual competition participation for that judoka.
- **COMP-019**: A linked participation remains visible and editable in the judoka's individual competition history.
- **COMP-019a**: Once at least one participant competition has a final ranking, the club competition is considered finished for participant management: adding or removing judokas shall be blocked and the detail screen shall show a finished-state banner. Editing event information, combats, final rankings, coach objective/review, deletion, and consultation remain available.
- **COMP-019b**: For an individual competition linked to a club competition, the inherited club fields (name, date, age category, and competition level) shall not be editable from the individual competition form; they are updated only from the club competition detail. Individual fields such as weight category, combats, final ranking, coach objective/review, and deletion remain available according to the usual permissions.
- **COMP-020**: Removing a judoka from a club competition detaches only the club link and shall not delete the individual competition, combats, or final ranking.
- **COMP-021**: A `JUDOKA` or `PARENT` can still create individual competitions outside a club competition.
- **COMP-022**: Deleting a club competition shall detach linked individual competitions by clearing the club link, without deleting those individual competitions, combats, or final rankings.
- **COMP-023**: The club competition detail screen shall display each participant's current final ranking (or "Non classé" if not yet set) alongside their name, so a `COACH` can see standings at a glance.
- **COMP-025**: When a `COACH` creates a club competition, the participant selection list shall stay hidden until an age category is selected, then show only judokas in that category.
- **COMP-026**: A club competition shall not ask for or store a weight category; weight is only meaningful on an individual judoka competition.
- **COMP-027**: A club competition shall require a competition level chosen from `Départemental`, `Régional`, `National`, or `International`, and linked individual participations shall inherit that level.

### 3.4 Combat rules

- **CBT-001**: A `JUDOKA` or `PARENT` can manage combats for their own scope. `COACH` users can manage combats for club competition participations.
- **CBT-004**: A combat must include a parent competition, a judoka, and a result.
- **CBT-005**: A combat may include an opponent name and match notes (free text for technical feedback).
- **CBT-005a**: Combat result values shall be limited to `Victoire`, `Défaite`, or `Egalité`.
- **CBT-005b**: To maintain simplicity, complex referee scoring details (Shido counters, scoreboard timelines, and penalty counts) shall not be structural fields; contextual technical details may still be typed in the free text match notes (e.g., "Perdu par Ippon sur Uchi-Mata", "Gagné aux pénalités au Golden Score").
- **CBT-005c**: A combat may optionally record the opponent's stance (`Droitier` or `Gaucher`).
- **CBT-005d**: A combat may optionally record a list of scoring techniques ("prises marquées"), one entry per point scored during the combat, regardless of the combat result.
- **CBT-005e**: Each scoring technique entry shall record a category (`Tachi-waza` or `Ne-waza`) and a value (`Ippon`, `Waza-ari`, or `Yuko`). When the category is `Tachi-waza`, the entry shall autocomplete known throw names while still accepting a free-text throw name typed by the user. When the category is `Ne-waza`, the entry shall record a sub-type (`Clé`, `Étranglement`, or `Osaekomi`).
- **CBT-005f**: A combat with result `Victoire` or `Défaite` shall record a decision type among `Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hansoku-make`, or `Forfait`. A combat with result `Egalité` shall use `Hiki wake`. Scoring technique entries remain optional and shall not replace the decision type.
- **CBT-006**: Deleting a combat shall not delete its parent competition.
- **CBT-007**: The combat form shall always show the detailed fields for opponent stance, scoring techniques, and notes.

### 3.5 Imported child link and judoka profile rules

- **CHD-001**: Parent-child links shall be created through club CSV import, not through an in-app parent child-management screen.
- **CHD-002**: A CSV-imported child judoka can be linked to a parent through `parentEmail`, including when the parent account is still pending invitation.
- **CHD-003**: A CSV-imported child profile with a direct account email shall be able to log in through Google once that imported `JUDOKA` profile exists, and shall only access its own judoka data. A separate invitation is not required when the profile already exists.
- **CHD-010**: A coach shall be able to set or update the age category of any judoka from the judoka profile view.
- **CHD-011**: The weight category field (judoka profile and competition form) shall be selected from a dropdown of the official FFJDA weight categories for the chosen age category (and gender, for the judoka profile), instead of free text. The list is empty for age categories without official weight divisions (Poussinet, Poussin). Vétéran reuses the Senior weight scale.
- **CHD-012**: The "année dans la catégorie" field shall only offer the years that actually exist for the selected age category: 2 years for Poussinet/Poussin/Benjamin/Minime, 3 years for Cadet/Junior, and no field at all for Senior/Vétéran (open/age-banded categories where the concept doesn't apply).
- **CHD-013**: A judoka profile may store the judoka's garde (`Droitier` or `Gaucher`) from the judoka profile form.

### 3.6 Judoka season statistics rules

- **STA-001**: The application shall provide a dedicated judoka profile view.
- **STA-002**: The judoka profile shall display the judoka category derived from the latest competition of the displayed season.
- **STA-003**: The judoka profile shall display a short competition-results list for the displayed season with date, competition name, final ranking, combat record, and a ranking badge.
- **STA-004**: The season shall run from September 1st to August 31st.
- **STA-005**: The judoka profile shall display the number of competitions for the displayed season.
- **STA-006**: The judoka profile shall display the number of combats for the displayed season.
- **STA-007**: The judoka profile shall display the victory rate for the displayed season.
- **STA-007a**: The displayed season shall use the current season when the judoka has competitions in it, otherwise it shall fall back to the most recent season containing competition data for that judoka.
- **STA-007b**: The judoka profile shall display a combat profile summary for the displayed season based on global Victory/Loss/Equality ratios and notes insights.
- **STA-007c**: Competition ranking badges shall distinguish podium, top 5, and non-classed results; 1st place shall use a gold badge, 2nd place a silver badge, and 3rd place a bronze badge.
- **STA-007d**: The judoka profile hero shall display the judoka's garde when it is known.
- **STA-008**: A `JUDOKA` shall be able to open only their own judoka profile from home.
- **STA-009**: A `PARENT` shall be able to open their own judoka profile and the profiles of linked children only.
- **STA-010**: `COACH` profiles shall be able to open the judoka profile of any judoka in the club.

### 3.7 Authentication behavior

- **AUTH-001**: The application shall provide Google login.
- **AUTH-002**: The application shall keep the connected session after the OAuth callback.
- **AUTH-003**: Application permissions shall come from the Kiroku user role, not from the Google account itself.
- **AUTH-004**: The login UI shall not expose password login.
- **AUTH-005**: The login UI shall not expose magic-link login or signup.
- **AUTH-006**: The connected header shall show user identity and provide an explicit logout action.
- **AUTH-007**: A child profile with a direct account email shall be able to log in through Google and be treated as a `JUDOKA` limited to their own data once the imported `JUDOKA` profile exists.
- **AUTH-008**: A user without an existing imported profile or an active invitation shall not be allowed to create an account in the application.
- **AUTH-009**: An `ADMIN` shall be able to manage pending access invitations from the dedicated admin screen.
- **AUTH-009a**: The invitation management screen shall allow searching pending invitations by invited email and shall paginate pending invitations with 5 invitations per page.
- **AUTH-010**: Each invitation shall define the target profile type among `PARENT` or `JUDOKA`.
- **AUTH-011**: CSV-imported profiles with an account email shall be able to connect with Google without re-entering first name or last name.
- **AUTH-011a**: A CSV-imported `JUDOKA` with an account email may also provide `parentEmail` to be linked to that parent.
- **AUTH-011b**: A CSV-imported `JUDOKA` row may set a `role` column of `COACH` to grant coach rights at import time; this requires an account email and is not available for `PARENT` rows.
- **AUTH-011c**: A CSV-imported `JUDOKA` row may set an `ageCategory` column to assign the judoka's age category (e.g. `Minime`) at import time.
- **AUTH-011d**: Re-importing a CSV row that matches an existing `JUDOKA` (by account email, or by first and last name when no email is given) shall not be treated as an import error; it shall update that judoka's `role` and `ageCategory` from the row instead of failing the row.
- **AUTH-011e**: Re-importing a CSV row that matches an existing `PARENT` by account email shall not be treated as an import error either; the row succeeds as a no-op update once first and last name are confirmed to match. A row whose email matches an existing account of the other profile type, or whose name does not match that account, shall still fail.
- **AUTH-011f**: A CSV-imported `JUDOKA` row may set a `genre` column (`Homme` or `Femme`) and an `anneeCategorie` column (the year within the age category, e.g. Cadet 1 / Cadet 2 / Cadet 3 — see **CHD-012** for valid values per category) at import time; re-importing an existing judoka updates both fields the same way `ageCategory` is updated.
- **AUTH-011g**: A CSV-imported `JUDOKA` row may set a `lateralite` column for the judoka's garde (`Droitier` or `Gaucher`) at import time; re-importing an existing judoka updates it the same way `ageCategory` is updated.
- **AUTH-011h**: A CSV-imported `JUDOKA` row may set a `couleur_ceinture` column for the judoka's belt color at import time; re-importing an existing judoka updates it the same way `ageCategory` is updated.
- **AUTH-011i**: After a CSV import, the admin UI shall show only a toast summary with the number of successful rows and failed rows; it shall not render a row-by-row import result list.
- **AUTH-012**: The underlying `JUDOKA` or `PARENT` profile type shall not be changed automatically after registration.
- **AUTH-013**: Admin and Coach elevations shall be managed separately from the invitation flow.

### 3.8 UI and UX rules

- **UIX-001**: The application shall be mobile first.
- **UIX-002**: Lists and forms shall remain separated.
- **UIX-003**: Main actions shall be visible, tactile, and explicit.
- **UIX-004**: The UI shall provide loading, empty, error, and success states.
- **UIX-004a**: Empty states that can be resolved by the current user shall include a direct contextual action, such as creating the first competition or adding the first combat.
- **UIX-005**: Deletions shall require explicit confirmation.
- **UIX-006**: After create or update operations, the application shall refresh relevant data and display the affected item.
- **UIX-007**: Action labels shall stay textual and explicit on mobile, not icon-only.
- **UIX-008**: Desktop-specific layout shall be a progressive enhancement over the small-screen baseline.
- **UIX-009**: The judoka profile view shall remain readable and actionable on mobile.
- **UIX-010**: For `PARENT`, the home screen shall open on a parent hub exposing three explicit cards: "Gérer les compétitions", "Choisir un judoka", and "Voir la fiche".
- **UIX-010a**: For `PARENT`, the parent hub shall keep an active judoka context selected by default, using the first linked child when possible.
- **UIX-010b**: For `PARENT`, competition creation shall require an active family profile before the creation form is opened.
- **UIX-011**: For `COACH`, the home screen shall open on a coach hub exposing three explicit cards: "Gérer les compétitions", "Rechercher un judoka", and "Voir les statistiques". For `ADMIN`, the home screen shall expose access governance without sports management actions.
- **UIX-011d**: For `COACH`, the top coach navigation shall stay limited to returning to "Accueil coach" and "Mon espace"; detailed coach actions shall be launched from the coach hub cards instead of duplicated as top navigation tabs.
- **UIX-011a**: When the connected user has an underlying `JUDOKA` profile, that judoka shall be selected by default as the active judoka context.
- **UIX-011b**: For `COACH`, the `Compétition` home mode shall stay club-centered and shall not expose a judoka selector or individual judoka context.
- **UIX-011c**: For `COACH`, a separate `Judoka` home mode shall allow selecting a judoka to consult their profile, upcoming competitions, and past competition history.
- **UIX-012**: The judoka profile view should visually emphasize performance through a dedicated summary hero and highlighted season statistics.
- **UIX-012a**: The judoka performance hero labels shall follow a logical sports-reading order: season, age category, year within category, weight category, gender, garde, then belt color.
- **UIX-013**: Competition and season results should use distinct visual badges and lightweight motion cues while remaining readable on mobile.
- **UIX-013a**: Home widgets shall not repeat the active tab label as a standalone title; when an active tab or useful context card already identifies the view, the redundant home header shall be hidden.
- **UIX-013b**: Competition cards in lists shall use a uniform open-only interaction. Destructive competition deletion shall be handled from the competition detail screen, not from list cards.
- **UIX-014**: User notifications should be displayed through toast notifications so the current screen remains readable while the message stays explicit.
- **UIX-015**: Coach competition cards should expose immediate follow-up signals: participant count, ranking progress, podium count, and missing coach reviews when available.
- **UIX-016**: The competition detail screen should show a compact sports summary before the combat list, including record, victory rate, detailed combats, and finalization status.
- **UIX-016a**: For `PARENT`, the competition detail screen shall show the coach follow-up block so objectives set by the coach are visible on the judoka's competition.
- **UIX-017**: Combat and competition detail screens shall make dashboard metric inputs visible: judoka garde when available, opponent garde, competition level, decision type, and scoring techniques. Missing values that reduce dashboard metric quality shall be surfaced as explicit inline indicators.
- **UIX-017a**: On the competition detail screen, each combat card shall list every data-entry quality issue detected on that combat — missing decision type, an `Ippon` decision with no matching `Ippon` score, no scores recorded, missing judoka garde, and missing opponent garde — each tagged with a priority level ("Haute" for the missing decision type and the inconsistent Ippon decision, "Moyenne" for the other criteria) shown alongside the message.
- **UIX-017b**: The combat form shall surface the same data-entry quality issues live while editing, scoped to the fields it owns (decision type, inconsistent Ippon decision, scores, opponent garde — judoka garde is edited on the judoka profile, not shown here), with the same priority levels, once a result has been selected. Each issue shall be displayed inline next to the field it concerns (decision type issues under "Type de décision", score issues under "Prises marquées", opponent garde issues under "Garde de l'adversaire") rather than grouped in a single block, so it stays visible while the coach is actively filling that field.
- **UIX-018**: Coach-facing helper copy shall use sports-field language ("bilan coach", "relire le combat", "debout et au sol") instead of technical dashboard wording where possible.
- **UIX-019**: The admin CSV import screen shall present import requirements as a short checklist and downloadable example rather than a long inline column description.
- **UIX-020**: The UI visual identity should use local Kiroku/dojo elements, including a local app mark, tatami-inspired surfaces, and restrained belt/podium accents; it shall not depend on a remote logo image.

### 3.9 Coach dashboard rules

- **DASH-001**: `COACH` users shall have access to a dedicated dashboard screen aggregating statistics across one or more competitions. `ADMIN` users shall not have sports dashboard access.
- **DASH-002**: The dashboard shall display, in order, the age category filter, the start/end date range, and the competition multi-select filter. All filters are optional; when none is set, the dashboard aggregates every competition and judoka. When both dates are set, the start date must be before or equal to the end date. The dashboard shall not offer a judoka gender filter or a judoka garde filter.
- **DASH-003**: The dashboard shall recompute statistics automatically whenever any filter changes, debounced by 300ms of inactivity, with no manual refresh button; this applies uniformly to the competition multi-select, the date range, and the age category filters. Changing the age category or the date range shall also update the set of competitions offered by the competition selector, and any previously selected competition that falls outside the new range shall be deselected automatically.
- **DASH-003a**: Before detailed metric sections, the dashboard shall display an "À retenir" summary with combats analyzed, victory rate, compact podium highlights sorted by competition level (`International`, `National`, `Régional`, `Départemental`) showing an abbreviated level, the best podium medal emoji and the count for that medal at each level with at least one podium, the main data-quality issue, and one short action-oriented insight.
- **DASH-004**: The dashboard shall display the victory rate (% of combats won) over the combats matching the active filters, labeled "Victoires totales", alongside the raw win count and the total combat count (e.g. "8/12 (67%)").
- **DASH-005**: The dashboard shall display the Tachi-waza Ippon victory rate labeled "Victoires Ippon debout" (% of combats won where at least one recorded score has category `Tachi-waza` and value `Ippon`) and, symmetrically, the Ne-waza Ippon victory rate labeled "Victoires Ippon au sol", each alongside its win count and the total combat count.
- **DASH-006**: The dashboard shall display a "Qualité des données" section, shown only when the active filtered scope has at least one combat, listing for each of 7 data-quality criteria (missing judoka garde, missing opponent garde, missing decision type, no scores recorded, missing competition level, missing judoka gender, and an Ippon decision with no matching Ippon score) the affected combat count, the total combat count, and the percentage, in the format "compte/total (taux%)". Only criteria with at least one affected combat shall be shown; when none of the 7 criteria has any affected combat, the section shall display a message indicating no data-quality issue was detected instead of an empty grid.
- **DASH-007**: The dashboard shall display a breakdown of victories and of defeats by decision type (`Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hansoku-make`, `Forfait`), each as a count, the total count for that result (all victories or all defeats), and a percentage of that total.
- **DASH-008**: The dashboard shall display the "Répartition des gardes" section with a "Face à la garde adverse" card showing the victory rate against "Garde opposée" and "Même garde" opponents, alongside the win count and the eligible combat count for each relative garde group. A combat is eligible for these two metrics only when the judoka garde and opponent garde are both known and the combat result is a win or loss; draws are excluded.
- **DASH-009**: The dashboard shall not display a standalone "Par niveau" performance section; competition-level analysis is limited to podium counts grouped inside the "Podiums" section.
- **DASH-010**: The dashboard shall display the number of distinct judokas matching the active filters who have at least one combat in scope, labeled "Judokas par genre" and broken down by gender (`Homme` / `Femme`).
- **DASH-011**: The dashboard shall display distinct judoka counts labeled "Judokas par garde" and broken down by judoka garde (`Droitier` / `Gaucher`).
- **DASH-012**: The dashboard competition selector shall allow searching competitions by name or date without clearing already selected competitions; when a club competition has generated several individual competition rows, the selector shall show a single option for that club competition and selecting it shall filter on all generated individual competitions.
- **DASH-013**: On mobile, the dashboard filters shall be collapsible so the statistics can be reviewed without scrolling through the full filter list.
- **DASH-014**: `COACH` users shall have access to a dedicated beta `Chat` tab in the coach navigation, separate from the dashboard statistics tab. The tab shall clearly display its beta status, indicate in the chat title that LLM quota is limited, and answer supported natural-language searches across recorded judoka, competition, combat, decision, notes, and score attributes, including finding judokas who won by `Osaekomi`, listing judokas by age category, and listing judokas who fought today.
- **DASH-015**: Coach navigation shall be flattened: coach users shall see one tab bar with `Mon espace`, `Compétition`, `Judoka`, `Chat`, and `Tableau de bord` in that order. Selecting a tab shall render the associated widget below the shared tab bar, and coach widgets shall not embed their own coach menu or dedicated back button.
- **DASH-016**: Every metric on the dashboard statistics tab shall expose a hover/focus info tooltip with a plain-language explanation of what it measures, attached either to the individual metric label (for standalone counters and rates) or to the section/card heading shared by several rows computed with the same formula (per competition level, per decision type, and the garde-matchup card); each "Qualité des données" criterion shall have its own tooltip since each one explains a distinct issue.
- **DASH-017**: The dashboard shall display a "Podiums" section with raw counts (no percentage) grouped by competition level (`Départemental`, `Régional`, `National`, `International`) for competitions in the filtered scope finalized with exactly a 1st, 2nd, or 3rd place ranking; competitions without a finalized ranking, with a non-podium ranking, or without a recognized level shall not be counted in any level.
- **DASH-018**: The dashboard statistics tab shall present its sections in the following order: Podiums, Volumes, Répartition des judokas, Répartition des gardes, Performance globale, Victoires par décision, Défaites par décision, then the "Qualité des données" data-reliability caveat last.

### 3.10 Internal MCP access rules

- **MCP-001**: The application shall expose a remote MCP server usable by standard MCP clients (e.g. Claude Desktop, Claude.ai connectors), open to any authenticated Kiroku user (`COACH`, `ADMIN`, `PARENT`, `JUDOKA`).
- **MCP-002**: MCP clients shall authenticate via an OAuth 2.1 authorization-code flow with mandatory PKCE (S256); the authorization step shall delegate to the existing Google/Supabase login rather than a separate credential.
- **MCP-003**: The OAuth authorization server shall support unauthenticated discovery (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`) and Dynamic Client Registration so that MCP clients can connect without manual configuration.
- **MCP-004**: The backend shall mint a short-lived Kiroku-signed JWT MCP access token derived from the authenticated Kiroku user instead of exposing the Supabase session token directly to MCP clients.
- **MCP-005**: The JWT MCP access token shall expire after a short duration and shall encode only scopes from the fixed Kiroku MCP scope vocabulary assigned at mint time for the caller's Kiroku role: full read/write sports scopes for `COACH`, access-governance scopes only for `ADMIN` with no judoka/competition/combat data scopes, and judoka/competition/combat read-write scopes limited to the caller's own perimeter (no club-wide dashboard access) for `PARENT` and `JUDOKA`.
- **MCP-006**: The remote MCP endpoint shall enforce the minted JWT MCP access token scopes on each request and shall expose only callable tools in `tools/list`, so a `PARENT` or `JUDOKA` caller can only read or write competitions/combats within their own managed scope and cannot reach the club-wide coach dashboard, and an `ADMIN` caller cannot reach judoka, competition, or combat data through MCP.
- **MCP-007**: The remote MCP endpoint shall implement the MCP JSON-RPC 2.0 wire protocol, including the `initialize` handshake, so that standard MCP clients can connect without bespoke client code.

## 4. Acceptance Criteria

- **AC-001**: Given a connected `JUDOKA`, when initial data is loaded, then only that user's competitions are visible.
- **AC-002**: Given a connected `PARENT`, when initial data is loaded, then competitions for the parent and linked children are visible, and no unrelated data is visible.
- **AC-003**: Given a connected `COACH`, when opening the Club Competition Dashboard, then they can see all club participants and results for any given tournament.
- **AC-004**: Given a parent attempting to save a competition for an unmanaged judoka, when the request is processed, then the save is rejected.
- **AC-005**: Given a competition save request missing name or date, when the request is processed, then the save is rejected.
- **AC-006**: Given a combat create request missing competition, judoka, or result, when the request is processed, then the save is rejected.
- **AC-007**: Given a competition deletion, when the operation succeeds, then no linked combat remains accessible for that judoka.
- **AC-008**: Given a combat deletion, when the operation succeeds, then the parent competition still exists.
- **AC-013**: Given a user reaching the login screen, when authentication options are displayed, then only Google login is available.
- **AC-014**: Given a connected session, when the app header is rendered, then user identity is displayed and a logout button is available.
- **AC-015**: Given the mobile layout, when primary actions are displayed, then controls remain textual, touch-friendly, and visible.
- **AC-016**: Given a CSV-imported child profile has a direct account email, when that child logs in with the same Google account, then only that child's profile, competitions, and combats are visible.
- **AC-017**: Given a Google account without judoka profile and without active invitation, when initial access is checked, then profile creation is rejected with an explicit invitation-required message.
- **AC-018**: Given an admin creates an invitation for a new email and a target profile type, when that invited user logs in, then profile creation is allowed exactly for that invited email and invited type.
- **AC-019**: Given an admin or coach role change, when the request succeeds, then the user's underlying `JUDOKA` or `PARENT` profile type remains unchanged.
- **AC-020**: Given an application notification on the current screen, when the UI reports it, then the message is shown as a dismissible toast without shifting the main screen layout.
- **AC-021**: Given a user opens the competition creation form, when the form is displayed, then the competition date is prefilled with the current day.
- **AC-022**: Given a user creates or edits a competition, when the form is displayed, then no ranking field is shown.
- **AC-023**: Given a user wants to set a final ranking, when they open the finalization screen, then only the ranking field is available (not accessible from the edit form).
- **AC-024**: Given a user typing combat details, when saving the combat, then they can optionally write any text in the notes field (e.g., "Perdu par Ippon sur Uchi-Mata").
- **AC-025**: Given a connected `COACH`, when they create a club competition with selected judokas, then one club event and one linked individual competition per selected judoka are created.
- **AC-025a**: Given a connected `COACH` selects `Minime` on the club competition creation form, when they choose participants, then only judokas with the `Minime` age category are selectable.
- **AC-025b**: Given a connected `ADMIN`, when they use the application, then competition, combat, ranking, and club competition management actions are not available and server-side mutations are rejected.
- **AC-025c**: Given a connected `ADMIN`, when they try to open sports dashboards or retrieve sports data through MCP, then access is rejected because admin rights do not include sports read permissions.
- **AC-026**: Given a linked participation, when the concerned judoka or parent updates combats or ranking, then only that participation is modified.
- **AC-027**: Given a coach removes a participant from a club competition, when the operation succeeds, then the individual competition and sports data remain available outside the club event.
- **AC-028**: Given a coach opens a club competition's detail screen, when the participant list is displayed, then each participant shows their current ranking badge ("1er", "2e", ..., "Non classé").
- **AC-030**: Given a connected `COACH`, when dashboard filters are set by competition, age category, gender, or garde, then the displayed rates and counts are computed only from combats matching the active filters.
- **AC-030a**: Given a connected `COACH`, when dashboard date filters are submitted with a start date after the end date, then the request is rejected with an explicit validation error and no misleading empty statistics are displayed.
- **AC-030b**: Given a connected `COACH`, when they ask the beta coach assistant for judokas who won by `Osaekomi`, for `Minime` judokas, for judokas who fought today, or for terms matching recorded attributes, then the response lists matching judokas and combats from stored data only.
- **AC-031**: Given a connected `PARENT` or `JUDOKA`, when they try to access the club-wide dashboard, then access is rejected.
- **AC-032**: Given an MCP client requests scopes outside the connected user's role perimeter, when the authorization or request is processed, then unsupported scopes are not granted and protected operations are rejected.
- **AC-033**: Given an MCP OAuth request, when PKCE is missing/invalid or the redirect URI does not exactly match the registered client URI, then the request is rejected.

## 5. Examples & Edge Cases

### Example: parent creates a competition
- the parent enters a competition name and date;
- the system checks that it doesn't already exist for the club;
- the parent does not enter a final ranking during creation;
- the created competition appears in the judoka's profile sorted by date descending.

### Edge case: parent tries to save for an unmanaged judoka
- the selected owner is outside the parent's managed scope;
- the request is rejected explicitly;
- no competition is created or modified.

## 6. Related Specifications / Further Reading

- `docs/spec-tech.md` - technical constraints, architecture, interfaces, and validation rules
