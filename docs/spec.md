---
title: Ayumi Functional Specification
version: 2.2
date_created: 2026-06-11
last_updated: 2026-06-21
owner: competitions-judo
tags:
  - design
  - app
  - mobile-first
  - functional-spec
---

# Introduction

This specification defines the functional behavior of Ayumi, a mobile-first application used to manage judo competitions and combats for a club.

## 1. Purpose & Scope

Ayumi allows a club to:
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
| Ayumi | The application described by this specification. |
| Judoka | A club member profile that owns competitions and combats. |
| Parent | A user profile allowed to manage linked child judokas (read/write). |
| Club | A judo club. A judoka belongs to at most one club; a coach coaches one or more clubs. |
| Coach | A user profile with sports access to the judokas, competitions, combats, and dashboards of the clubs they coach. |
| Admin | A user profile responsible for access governance: invitations, structural roles, and clubs. |
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
- **ROL-003**: A `COACH` profile has access to the judokas of the clubs they coach, to those judokas' competitions, combats, and stats, and can manage the club competition events of those clubs and their linked sports data. They cannot manage invitations.
- **ROL-004**: An `ADMIN` profile manages invitations, structural roles, and clubs only. Admin rights alone do not include coach sports permissions and shall not allow creating, updating, finalizing, or deleting competitions or combats.
- **ROL-004a**: Admin rights are a separate flag: a `COACH` can also be admin and then keeps all coach permissions for their clubs. Granting admin rights to a coach shall not remove the coach role.
- **ROL-005**: `COACH` or `ADMIN` rights are structural roles granted on top of a user account without destroying the underlying profile type.
- **ROL-006**: A user invited as `PARENT` or `JUDOKA` keeps that underlying profile type after registration.

### 3.2a Club rules

- **CLUB-001**: A judoka belongs to at most one club. A judoka without a club is visible to no coach; parents and the judoka keep their usual access.
- **CLUB-002**: A coach is assigned to one or more clubs and only sees and manages the judokas of those clubs, their individual competitions and combats (including those recorded by parents), and the club competitions of those clubs.
- **CLUB-003**: Access follows the judoka's current club: after a transfer, the new club's coaches see the full history and the former club's coaches lose access.
- **CLUB-004**: A club competition belongs to exactly one club, fixed at creation. Only judokas of that club can be entered. A coach of a single club does not choose the club; a coach of several clubs must choose it.
- **CLUB-005**: Any request on a judoka, competition, combat, club competition, or dashboard outside the coach's clubs shall be refused server-side (screens, API, and MCP alike); another club's club competition is reported as not found.
- **CLUB-006**: Only admins manage clubs: create, rename (unique name, case-insensitive), assign coaches, set or clear a judoka's club. A club can only be deleted when it has no judoka, no coach, and no club competition.
- **CLUB-007**: The CSV import accepts an optional `club` column holding an existing club name. A `JUDOKA` row is assigned to that club; a coach row also coaches it. An unknown club or a club on a `PARENT` row fails that row without writing.
- **CLUB-008**: A coach of several clubs gets a club filter ("Tous mes clubs" by default) on the coach home and the coach dashboard; it narrows club competitions, the judoka selector, and statistics.

### 3.3 Competition rules

- **COMP-001**: A competition must include a name and a date.
- **COMP-002**: A competition shall expose an age category chosen from the fixed list: `Poussinet`, `Poussin`, `Benjamin`, `Minime`, `Cadet`, `Junior`, `Senior`, `Vétéran`, and a weight category.
- **COMP-003**: A competition shall expose a level field chosen from: `Départemental`, `Régional`, `National`, `International`. The field is optional (empty by default).
- **COMP-004**: A competition shall not use an actual weigh-in field.
- **COMP-005**: A `JUDOKA` or `PARENT` can create, update, and delete only competitions linked to their scope.
- **COMP-006**: A `JUDOKA` or `PARENT` can still create individual competitions outside a club competition.
- **COMP-007**: When opening the competition creation form, the date field shall be initialized to the current day by default.
- **COMP-008**: Competition creation shall not ask for the final ranking.
- **COMP-009**: When a `PARENT` or `JUDOKA` creates an individual competition outside a club competition, the system shall prevent that same judoka from having another standalone individual competition with the same name and date.
- **COMP-010**: Multiple judokas may have individual competitions with the same name and date when those participations are linked to the same club competition. If a matching club competition already exists, the UI should guide the user toward attaching the judoka's participation to that club event instead of creating an isolated duplicate.
- **COMP-011**: Final ranking shall be entered and updated exclusively from a dedicated competition finalization screen. The competition edit form shall not expose a ranking field.
- **COMP-012**: Final ranking values shall be limited to supported ranking results: `1er`, `2e`, `3e`, `4e`, `5e`, `6e`, `7e`, `8e`, or `Non classé`.
- **COMP-013**: The UI shall display podium rankings as medal emojis (`1er 🥇`, `2e 🥈`, `3e 🥉`) wherever rankings are shown, while preserving the stored final ranking values `1er`, `2e`, and `3e`.
- **COMP-014**: Competition lists shall be sorted by date descending.
- **COMP-015**: `COACH` profiles can view a global "Competition Dashboard" aggregating all judokas who participated in the same event.
- **COMP-016**: The club competition detail screen shall display each participant's current final ranking (or "Non classé" if not yet set) alongside their name, so a `COACH` can see standings at a glance.
- **COMP-017**: Deleting a competition from a judoka profile shall remove all linked combats for that specific judoka.
- **COMP-018**: Deleting a club competition shall detach linked individual competitions by clearing the club link, without deleting those individual competitions, combats, or final rankings.
- **COMP-019**: A `COACH` can create a club competition event and assign one or more judokas as participants.
- **COMP-020**: When a `COACH` creates a club competition, the participant selection list shall stay hidden until an age category is selected, then show only judokas in that category.
- **COMP-021**: A club competition shall not ask for or store a weight category; weight is only meaningful on an individual judoka competition.
- **COMP-022**: A club competition shall require a competition level chosen from `Départemental`, `Régional`, `National`, or `International`, and linked individual participations shall inherit that level.
- **COMP-023**: Assigning a judoka to a club competition creates an individual competition participation for that judoka.
- **COMP-024**: A linked participation remains visible and editable in the judoka's individual competition history.
- **COMP-025**: For an individual competition linked to a club competition, the inherited club fields (name, date, age category, and competition level) shall not be editable from the individual competition form; they are updated only from the club competition detail. Individual fields such as weight category, combats, final ranking, coach review, and deletion remain available according to the usual permissions.
- **COMP-026**: A club competition is considered finished once its date is today or in the past. Late entry stays possible on a finished club competition: the coach can still add judokas (which creates their individual participations), then record their combats and rankings. Editing event information, combats, final rankings, coach review, deletion, and consultation remain available. The detail screen shows a finished-state banner explaining late entry and the removal rule of COMP-027.
- **COMP-027**: Removing a judoka from a club competition that has not started yet (date strictly in the future) deletes that judoka's individual competition outright, including its combats, rather than merely detaching the club link. On a finished club competition, a participant can be removed only while their participation has neither combats nor a ranking (e.g. added by mistake during late entry); otherwise removal is blocked so recorded results are never lost.
- **COMP-028**: The club competition creation form checks club, name, date, age category, level and at least one participant before sending, in screen order; each message shows under its field, which receives the focus. All six fields carry the required mark.
- **COMP-029**: A coach attached to no club sees only the warning banner and the back action on the creation form.
- **COMP-030**: Leaving a modified creation form (back arrow) asks for confirmation; the form has no separate "Annuler" button. The level is chosen with four buttons that can be browsed with the keyboard arrows.
- **COMP-031**: On the creation form, "Tout sélectionner" checks every judoka of the listed scope (club, category and search), across pages, and becomes "Tout désélectionner" when all are checked. Checked judokas are shown as removable chips above the list. The search lists only matching names.
- **COMP-032**: Changing the age category or the club of the creation form announces how many checked judokas were removed and why. The form tells how many judokas of the club have no age category.
- **COMP-033**: Saving a new club competition opens its detail.

### 3.4 Combat rules

- **CBT-001**: A combat must include a parent competition, a judoka, and a result.
- **CBT-002**: Combat result values shall be limited to `Victoire`, `Défaite`, or `Egalité`.
- **CBT-003**: A combat may include an opponent name and match notes (free text for technical feedback).
- **CBT-004**: Shido counts are structural fields of the official score (see CBT-007d). Other referee details (scoreboard clock, golden score, penalty reasons) shall not be structural fields; they may be typed in the free text match notes (e.g., "Gagné au Golden Score").
- **CBT-005**: A combat with result `Victoire` or `Défaite` shall record a decision type among `Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hansoku-make`, or `Forfait`. A combat with result `Egalité` shall use `Hiki wake`. Scoring technique entries remain optional and shall not replace the decision type. The form labels the decision field `Victoire par` or `Défaite par` according to the result.
- **CBT-006**: A combat may optionally record the opponent's stance (`Droitier` or `Gaucher`).
- **CBT-006a**: A combat may optionally record its round in the competition (`Poule`, `1/32`, `1/16`, `1/8`, `1/4`, `1/2`, `Repêchage`, `Place de 3`, `Finale`). The round is shown on the combat card; when every combat of a competition has a round, the combats are listed in that bracket order. All rounds are visible in the form without horizontal scrolling.
- **CBT-007**: A combat may optionally record a single chronological list of points ("Déroulé"), one entry per point scored during the combat, regardless of the combat result. Each entry shall record who scored it (`Judoka` or `Adversaire`) and its rank in the combat across both sides. Season and coach statistics count only the judoka's points.
- **CBT-007a**: A combat may optionally record its official score in the `IWY - IWY` format: the number of Ippon, Waza-ari and Yuko of the judoka, then of the opponent (e.g. `1 0 2 - 0 1 0`). Ippon counts are 0 or 1; Waza-ari and Yuko counts are integers from 0 to 9. In the combat form, the official score is the count of the points of the "Déroulé" per side and value.
- **CBT-007b**: The official score is entered with − / + counters in the "Le combat" section. A + on Ippon, Waza-ari or Yuko appends a point of that side and value at the end of the "Déroulé"; a − removes the latest matching point, preferably one without technique. The score stays "Non renseigné" until a counter is touched or a point exists. An "Effacer" action, available while the "Déroulé" is empty, resets it to "Non renseigné". The combat card shows the score only when it is filled in.
- **CBT-007c**: A combat update that does not carry the official score (e.g. the MCP tool `combats.save`) shall keep the stored score unchanged.
- **CBT-007d**: The official score may record the number of shidos of each side, from 0 to 3. Shidos have their own − / + counters and do not create points. The combat card appends `· Shidos J - A` when at least one shido is recorded. In the form, the score is read from the counters only; a text summary is shown only while the score is "Non renseigné".
- **CBT-007e**: Opening a stored combat rebuilds the "Déroulé" in combat order. Combats saved without a global rank list the judoka's points first, then the opponent's. When the stored score counts more points than the stored list, the missing points are added at the end without technique.
- **CBT-007f**: Choosing `Victoire par` / `Défaite par` `Ippon`, `Waza-ari` or `Yuko` appends the matching point (judoka for a victory, opponent for a defeat) at the end of the "Déroulé" when no such point exists. This automatic point is removed if the result or decision changes before its technique is chosen.
- **CBT-008**: Each point shall record a value (`Ippon`, `Waza-ari`, or `Yuko`). Its technique is optional: a point without technique is saved and flagged "À compléter : technique d'un point". The technique is chosen from one list grouped by family (Te-waza, Koshi-waza, Ashi-waza, Sutemi-waza, Osaekomi-waza, Shime-waza, Kansetsu-waza); the category (`Tachi-waza` shown as `Debout`, `Ne-waza` shown as `Au sol`) is deduced from the technique. The techniques already scored by the judoka are listed first. "Autre technique debout…" and "Autre technique au sol…" accept a free-text name.
- **CBT-009**: A `JUDOKA` or `PARENT` can manage combats for their own scope. `COACH` users can manage combats for club competition participations.
- **CBT-010**: Deleting a combat shall not delete its parent competition.
- **CBT-011**: The combat form follows the combat in time: "Avant le combat" (round, opponent, opponent stance), "Le combat" (score counters, shidos, "Déroulé"), then "Fin du combat" (result, decision, notes). All sections are always shown.
- **CBT-012**: Points of the "Déroulé" can be moved earlier or later and removed one by one.
- **CBT-013**: Leaving the combat form (back arrow or "Annuler") with unsaved changes asks for confirmation.
- **CBT-014**: The opponent field suggests the opponents already met by the judoka of the competition. Typing or choosing an opponent already met fills the opponent stance with the stance recorded at the most recent combat against them, unless a stance is already chosen (name match ignores case).
- **CBT-015**: "À compléter" reminders on the form and the combat card ask for the judoka's points only for a victory by `Ippon`, `Waza-ari` or `Yuko`; never after a defeat, a draw, a `Décision`, a `Hansoku-make` or a `Forfait`.
- **CBT-016**: Choice groups (round, stance, result, decision) can be browsed with the keyboard arrows.
- **CBT-017**: The score decides the combat ending when it is certain: an Ippon of one side only sets the result (`Victoire` for the judoka, `Défaite` for the opponent) and the decision `Ippon`; otherwise 3 shidos of one side only set the result against that side and the decision `Hansoku-make`. The deduced values fill an empty result or replace previously deduced values, never a result or decision chosen by hand. When the score no longer decides the ending, deduced values are cleared. Replacing a deduced result by hand also clears the deduced decision. Opening a stored combat never recomputes its ending.
- **CBT-018**: Without a certain ending, a score lead proposes the ending (`Waza-ari` if the Waza-ari counts differ, else `Yuko`) as a "D'après le score : …" button under an empty result. The proposal is applied only when touched.
- **CBT-019**: A result chosen by hand that contradicts a certain ending of CBT-017 (including `Egalité` with an Ippon) shows "Le score indique une victoire / une défaite. Vérifiez le résultat." under the result. The warning does not prevent saving.
- **CBT-020**: A new combat proposes its round from the last saved combat of the competition: `Poule` after `Poule`; after a win the next bracket round (`1/32`→…→`1/2`→`Finale`, `Repêchage`→`Place de 3`); after a defeat `Repêchage` from `1/4` and `Place de 3` from `1/2` or `Repêchage`; otherwise no round. The proposed round stays editable.

### 3.5 Imported child link and judoka profile rules

- **CHD-001**: Parent-child links shall be created through club CSV import, not through an in-app parent child-management screen.
- **CHD-002**: A CSV-imported child judoka can be linked to a parent through `parentEmail`, including when the parent account is still pending invitation.
- **CHD-003**: A CSV-imported child profile with a direct account email shall be able to log in through Google once that imported `JUDOKA` profile exists, and shall only access its own judoka data. A separate invitation is not required when the profile already exists.
- **CHD-004**: A coach shall be able to set or update the age category of any judoka from the judoka profile view.
- **CHD-005**: The weight category field (judoka profile and competition form) shall be selected from a dropdown of the official FFJDA weight categories for the chosen age category (and gender, for the judoka profile), instead of free text. The list is empty for age categories without official weight divisions (Poussinet, Poussin). Vétéran reuses the Senior weight scale.
- **CHD-006**: The "année dans la catégorie" field shall only offer the years that actually exist for the selected age category: 2 years for Poussinet/Poussin/Benjamin/Minime, 3 years for Cadet/Junior, and no field at all for Senior/Vétéran (open/age-banded categories where the concept doesn't apply).
- **CHD-007**: A judoka profile may store the judoka's garde (`Droitier` or `Gaucher`) from the judoka profile form.

### 3.6 Judoka season statistics rules

- **STA-001**: The application shall provide a dedicated judoka profile view.
- **STA-002**: A `JUDOKA` shall be able to open only their own judoka profile from home.
- **STA-003**: A `PARENT` shall be able to open their own judoka profile and the profiles of linked children only.
- **STA-004**: `COACH` profiles shall be able to open the judoka profile of any judoka in the club.
- **STA-005**: The season shall run from September 1st to August 31st.
- **STA-006**: The displayed season shall use the current season when the judoka has competitions in it, otherwise it shall fall back to the most recent season containing competition data for that judoka.
- **STA-007**: The judoka profile shall display the judoka category derived from the latest competition of the displayed season.
- **STA-008**: The judoka profile hero shall display the judoka's garde when it is known.
- **STA-009**: The judoka profile shall display a short competition-results list for the displayed season with date, competition name, final ranking, combat record, and a ranking badge.
- **STA-010**: Competition ranking badges shall distinguish podium, top 5, and non-classed results; 1st place shall use a gold badge, 2nd place a silver badge, and 3rd place a bronze badge.
- **STA-011**: The judoka profile shall display the number of competitions for the displayed season.
- **STA-012**: The judoka profile shall display the number of combats for the displayed season.
- **STA-013**: The judoka profile shall display the victory rate for the displayed season.
- **STA-014**: The judoka profile shall display a combat profile summary for the displayed season based on global Victory/Loss/Equality ratios and notes insights.

### 3.7 Authentication behavior

- **AUTH-001**: The application shall provide Google login.
- **AUTH-002**: The application shall keep the connected session after the OAuth callback.
- **AUTH-003**: Application permissions shall come from the Ayumi user role, not from the Google account itself.
- **AUTH-004**: The login UI shall not expose password login.
- **AUTH-005**: The login UI shall not expose magic-link login or signup.
- **AUTH-006**: The connected header shall show user identity and provide an explicit logout action.
- **AUTH-007**: A user without an existing imported profile or an active invitation shall not be allowed to create an account in the application.
- **AUTH-008**: An `ADMIN` shall be able to manage pending access invitations from the dedicated admin screen.
- **AUTH-009**: The invitation management screen shall allow searching pending invitations by invited email and shall paginate pending invitations with 5 invitations per page.
- **AUTH-010**: Each invitation shall define the target profile type among `PARENT` or `JUDOKA`.
- **AUTH-011**: A child profile with a direct account email shall be able to log in through Google and be treated as a `JUDOKA` limited to their own data once the imported `JUDOKA` profile exists.
- **AUTH-012**: CSV-imported profiles with an account email shall be able to connect with Google without re-entering first name or last name.
- **AUTH-013**: A CSV-imported `JUDOKA` with an account email may also provide `parentEmail` to be linked to that parent.
- **AUTH-014**: A CSV-imported `JUDOKA` row may set a `role` column of `COACH` to grant coach rights at import time; this requires an account email and is not available for `PARENT` rows.
- **AUTH-015**: A CSV-imported `JUDOKA` row may set an `ageCategory` column to assign the judoka's age category (e.g. `Minime`) at import time.
- **AUTH-016**: A CSV-imported `JUDOKA` row may set a `genre` column (`Homme` or `Femme`) and an `anneeCategorie` column (the year within the age category, e.g. Cadet 1 / Cadet 2 / Cadet 3 — see **CHD-006** for valid values per category) at import time; re-importing an existing judoka updates both fields the same way `ageCategory` is updated.
- **AUTH-017**: A CSV-imported `JUDOKA` row may set a `lateralite` column for the judoka's garde (`Droitier` or `Gaucher`) at import time; re-importing an existing judoka updates it the same way `ageCategory` is updated.
- **AUTH-018**: A CSV-imported `JUDOKA` row may set a `couleur_ceinture` column for the judoka's belt color at import time; re-importing an existing judoka updates it the same way `ageCategory` is updated.
- **AUTH-019**: Re-importing a CSV row that matches an existing `JUDOKA` (by account email, or by first and last name when no email is given) shall not be treated as an import error; it shall update that judoka's `role` and `ageCategory` from the row instead of failing the row.
- **AUTH-020**: Re-importing a CSV row that matches an existing `PARENT` by account email shall not be treated as an import error either; the row succeeds as a no-op update once first and last name are confirmed to match. A row whose email matches an existing account of the other profile type, or whose name does not match that account, shall still fail.
- **AUTH-021**: After a CSV import, the admin UI shall show only a toast summary with the number of successful rows and failed rows; it shall not render a row-by-row import result list.
- **AUTH-022**: The underlying `JUDOKA` or `PARENT` profile type shall not be changed automatically after registration.
- **AUTH-023**: Admin and Coach elevations shall be managed separately from the invitation flow.

### 3.8 UI and UX rules

- **UIX-001**: The application shall be mobile first.
- **UIX-002**: Lists and forms shall remain separated.
- **UIX-003**: Main actions shall be visible, tactile, and explicit.
- **UIX-004**: Action labels shall stay textual and explicit on mobile, not icon-only.
- **UIX-005**: Desktop-specific layout shall be a progressive enhancement over the small-screen baseline.
- **UIX-006**: The UI visual identity should use local Ayumi/dojo elements, including a local app mark, tatami-inspired surfaces, and restrained belt/podium accents; it shall not depend on a remote logo image.
- **UIX-007**: The UI shall provide loading, empty, error, and success states.
- **UIX-008**: Empty states that can be resolved by the current user shall include a direct contextual action, such as creating the first competition or adding the first combat.
- **UIX-009**: Deletions shall require explicit confirmation.
- **UIX-010**: After create or update operations, the application shall refresh relevant data and display the affected item.
- **UIX-011**: User notifications should be displayed through toast notifications so the current screen remains readable while the message stays explicit.
- **UIX-012**: For `PARENT`, the home screen shall open on the family space: one pill per child, then that child's competitions grouped as « À venir » and « Passées », with « Nouvelle compétition » and the child's profile on one line.
- **UIX-013**: For `PARENT`, a child shall always be selected: the last child chosen on the device, otherwise the first child. The parent profile itself is never offered as a child.
- **UIX-014**: For `PARENT`, competition creation shall require an active family profile before the creation form is opened.
- **UIX-015**: For `COACH`, the home screen shall list what is waiting: club competitions of the week, rankings to enter and coach reviews to write; each line opens the club competition. For `ADMIN`, access governance is reached from the account menu.
- **UIX-016**: For `COACH`, the same four tabs shall be shown on every coach screen: « Accueil », « Compétitions », « Judokas » and « Stats ». « Mon espace », « Ma famille » and « Gestion des accès » are in the account menu opened from the header.
- **UIX-016a**: The home lists shall load the current season and upcoming competitions; a « Voir la saison AAAA-AAAA » button shall load the previous season on demand, as long as an older competition exists.
- **UIX-016b**: A past season already viewed shall stay readable offline.
- **UIX-016c**: « Gestion des accès » shall list users by pages of 10 loaded from the server; the search by name or e-mail shall be applied by the server.
- **UIX-017**: When the connected user has an underlying `JUDOKA` profile, that judoka shall be selected by default as the active judoka context.
- **UIX-018**: For `COACH`, the `Compétition` home mode shall stay club-centered and shall not expose a judoka selector or individual judoka context.
- **UIX-019**: For `COACH`, a separate `Judoka` home mode shall allow selecting a judoka to consult their profile, upcoming competitions, and past competition history.
- **UIX-020**: The judoka profile view shall remain readable and actionable on mobile.
- **UIX-021**: The judoka profile view should visually emphasize performance through a dedicated summary hero and highlighted season statistics.
- **UIX-022**: The judoka performance hero labels shall follow a logical sports-reading order: season, age category, year within category, weight category, gender, garde, then belt color.
- **UIX-023**: Competition and season results should use distinct visual badges and lightweight motion cues while remaining readable on mobile.
- **UIX-024**: Home widgets shall not repeat the active tab label as a standalone title; when an active tab or useful context card already identifies the view, the redundant home header shall be hidden.
- **UIX-025**: Competition cards in lists shall use a uniform open-only interaction. Destructive competition deletion shall be handled from the competition detail screen, not from list cards.
- **UIX-026**: Coach competition cards should expose immediate follow-up signals: participant count, ranking progress, podium count, and missing coach reviews when available.
- **UIX-027**: The competition detail screen shall show pills (countdown, category, level, ranking), then a compact record (wins and losses without zero counters, victory rate, detailed combats). Before the competition date, it shows no result entry and no coach follow-up block; from the competition date, the ranking is chosen on the page with buttons.
- **UIX-028**: For `PARENT`, the competition detail screen shall show the coach follow-up block, from the competition date, so the review written by the coach is visible on the judoka's competition. The application manages no coach objective: none is entered, stored by the application, shown or returned by the API.
- **UIX-029**: Combat and competition detail screens shall make dashboard metric inputs visible: judoka garde when available, opponent garde, competition level, decision type, and scoring techniques. Missing values that reduce dashboard metric quality shall be surfaced as explicit inline indicators.
- **UIX-030**: An action card shall open its useful destination or corresponding section directly, without requiring an intermediate mode change.
- **UIX-031**: Changing home mode shall preserve the active judoka; an explicit selection action may reset that context.
- **UIX-032**: The coach dashboard shall provide direct navigation back to the coach home and the personal space from the current view.
- **UIX-033**: Autocomplete options shall be usable with keyboard and touch interactions.
- **UIX-034**: View URLs shall include the navigation context required to restore a journey after reload.
- **UIX-030**: On the competition detail screen, each combat card shall list every data-entry quality issue detected on that combat — missing combat ending, an `Ippon` decision with no matching `Ippon` score, no scores recorded, missing judoka right/left side, and missing opponent right/left side — each tagged with a priority level ("Haute" for the missing combat ending and the inconsistent Ippon decision, "Moyenne" for the other criteria) shown alongside the message.
- **UIX-031**: The combat form shall surface the same data-entry quality issues live while editing, scoped to the fields it owns (combat ending, inconsistent Ippon decision, scores, opponent right/left side — judoka right/left side is edited on the judoka profile, not shown here), with the same priority levels, once a result has been selected. Each issue shall be displayed inline next to the field it concerns (combat-ending issues under "Comment le combat s'est terminé", score issues under "Points marqués", opponent right/left side issues under "Adversaire droitier ou gaucher") rather than grouped in a single block, so it stays visible while the coach is actively filling that field.
- **UIX-032**: Coach-facing and parent-facing helper copy shall use plain sports-field language ("bilan coach", "relire le combat", "points marqués", "debout et au sol", "droitier ou gaucher") instead of technical dashboard wording where possible.
- **UIX-033**: The admin CSV import screen shall present import requirements as a short checklist and downloadable example rather than a long inline column description.
- **UIX-034**: Opening an existing combat in the mobile form shall preserve the recorded result and shall not autofocus the result field when a result is already set. The form shall focus the first useful missing detail instead.
- **UIX-036**: Combat creation actions shall remain hidden while a competition detail is loading and shall require a loaded, editable parent competition before opening the combat form.
- **UIX-035**: Each home shall open on its useful content (competition list, children pills or coach to-do list) rather than on explanatory cards.
- **UIX-037**: Competition lists in destination screens shall include competitions dated today or later, listed first by ascending date with an « Aujourd'hui » or « À venir » badge, followed by past competitions from most recent to oldest.

### 3.9 Offline usage rules

- **OFF-001**: After a first successful connected load, the application shall remain openable offline and shall display the latest locally available data for the connected user's known scope.
- **OFF-002**: Offline data shall be clearly identified in one global status area as data from the latest successful load; entities shall not each carry a stale or unsynchronized badge.
- **OFF-003**: Initial Google login, admin invitation management, CSV import, competition or combat deletion, club competition participant management, and club competition creation or update shall be unavailable offline.
- **OFF-004**: Coach dashboard results shall require a connected backend call unless the screen explicitly labels a locally cached read-only snapshot.
- **OFF-005**: A `JUDOKA`, `PARENT`, or `COACH` may create or update combats offline only inside the locally known authorized scope.
- **OFF-006**: A `JUDOKA`, `PARENT`, or `COACH` may save a final ranking offline for an individual competition inside the locally known authorized scope.
- **OFF-007**: Offline mutations shall be stored as pending operations and synchronized when network access returns.
- **OFF-008**: Pending offline operations shall be summarized in one global synchronization status until they are synchronized, rejected, cancelled, or corrected by the user.
- **OFF-009**: If a pending offline operation is rejected during synchronization because permissions, validation rules, or source data changed, the global status and notification shall expose an actionable error instead of silently discarding the operation.

### 3.10 Coach dashboard rules

- **DASH-001**: `COACH` users shall have access to a dedicated dashboard screen aggregating statistics across one or more competitions. `ADMIN` users shall not have sports dashboard access.
- **DASH-002**: The dashboard shall display, in order, the club filter (coaches of several clubs only), the age category filter, the start/end date range, and the competition multi-select filter. All filters are optional and may be cleared. On first opening, the date range is the current season (1 September to 31 August) and the club is the one chosen on the home screen; the other filters are unset. The filters chosen by the coach are kept while the application stays open, and "Réinitialiser" returns to the current season with every club and category. When both dates are set, the start date must be before or equal to the end date; otherwise the message shows under the dates and no statistics are requested. The collapsed filter summary shows a range equal to a season as "Saison AAAA-AAAA" and other dates in the application format (`1 sept. 2026`). The dashboard shall not offer a judoka gender filter or a judoka garde filter.
- **DASH-003**: The dashboard shall recompute statistics automatically whenever any filter changes, debounced by 300ms of inactivity, with no manual refresh button; this applies uniformly to the competition multi-select, the date range, and the age category filters. Changing the age category or the date range shall also update the set of competitions offered by the competition selector, and any previously selected competition that falls outside the new range shall be deselected automatically.
- **DASH-004**: The dashboard competition selector shall be an autocomplete: selected competitions are shown as removable chips, and typing in the search field shows up to 8 matching, not-yet-selected suggestions by name or date instead of an exhaustive browsable list; no suggestion is shown while the search field is empty. Selecting a suggestion adds it as a chip and clears the search field. When a club competition has generated several individual competition rows, the selector shall show a single option for that club competition and selecting it shall filter on all generated individual competitions.
- **DASH-005**: On mobile, the dashboard filters shall be collapsible so the statistics can be reviewed without scrolling through the full filter list.
- **DASH-006**: The dashboard statistics tab shall present, after the filters, a synthesis block, then in this order: Podiums, Par niveau, Évolution, Fin des combats gagnés, Techniques qui gagnent, Fin des combats perdus, Techniques qui nous battent, Ippon : debout ou au sol, Debout ou au sol, Selon les gardes, Tenue du score, Discipline. A section without data is hidden. The combat stage (tour) stays recorded on each combat, but no statistic is computed or shown per stage.
- **DASH-007**: The synthesis block shall display four tiles (combats analyzed with the number of competitions, victories, podiums over ranked participations, and combats to complete), one neutral sentence and the engaged headcount. The sentence gives the record (`12 victoires, 8 défaites sur 20 combats`), then the most notable fact, in this priority: the most frequent defeat ending, the most scored winning technique; it never contains a judgement such as "Point fort" or "Point d'attention". The headcount gives the distinct judokas with at least one combat, then, from 5 judokas only, their garde (`Droitier` / `Gaucher`), without gender. The competitions analyzed count shall count a club competition linked to multiple judoka participations only once. The "Saisies à compléter" tile shows the highest count among the per-combat criteria of DASH-017; no list of combats or competitions is shown.
- **DASH-008**: Every tile of the synthesis block and every statistics section shall expose an info tooltip, reachable by hover, focus and touch, with one plain-language sentence saying what it measures and on which combats, consistent with `docs/metrics.md`. On mobile, an open tooltip stays within the screen.
- **DASH-009**: The dashboard shall display a "Podiums" section with raw counts (no percentage) grouped by competition level (`Départemental`, `Régional`, `National`, `International`) for competitions in the filtered scope finalized with exactly a 1st, 2nd, or 3rd place ranking; competitions without a finalized ranking, with a non-podium ranking, or without a recognized level shall not be counted in any level.
- **DASH-010**: The "Par niveau" section lists, for each competition level present (`Départemental`, `Régional`, `National`, `International`, in that order), the combats, victories and defeats; combats of a competition without level are grouped on a "Niveau non renseigné" line. The sum of the combats of the section equals the combat count.
- **DASH-011**: Every rate on the dashboard shows its count first (`3/8 gagnés`). Below 5 combats (or points) in the denominator, the percentage and the bar are not shown, and win-rate lines read "trop peu de combats" instead (`0/1 gagné · trop peu de combats`). The "Victoires" tile shows `victoires/combats` below 5 combats and the percentage with the win count from 5 combats.
- **DASH-012**: The "Podiums" section shows, for each level, the podium places and the ratio to the ranked participations at that level (`3 podiums sur 12 participations classées`); the "Podiums" tile shows the same ratio, all levels included.
- **DASH-013**: The "Évolution" section lists, for each month of the scope with combats or a podium (competition month), the combats, victories and podiums; a month with a podium and no combat reads "aucun combat saisi". It is shown only from 2 months.
- **DASH-014**: The "Selon les gardes" section shows four lines (droitier contre droitier, droitier contre gaucher, gaucher contre droitier, gaucher contre gaucher) with the win count over eligible combats. A combat is eligible only when the judoka garde and opponent garde are both known and the result is a win or loss; draws are excluded.
- **DASH-015**: The "Ippon : debout ou au sol" section counts the victories with at least one Ippon point of the judoka, and shows the standing (`Tachi-waza`) and ground (`Ne-waza`) share of them; it is hidden without such a victory. The "Debout ou au sol" section shows the ground share of the points scored and of the points conceded, among points whose technique category is known.
- **DASH-016**: The "Fin des combats gagnés" and "Fin des combats perdus" sections (and the judoka season profile) show only endings with at least one combat, from the most to the least frequent, plus a "Non renseignée" line for combats without ending, so that the lines add up to the victories (or defeats).
- **DASH-017**: The statistics carry, for the "Saisies à compléter" tile only, the count of each criterion: missing judoka garde, missing opponent garde, missing combat ending, no scores recorded, missing competition level, and an Ippon victory with no Ippon point. The competition level is counted per competition, over the competitions of the scope; the other criteria per combat. There is no "Saisies à compléter" section.
- **DASH-018**: The application shall not offer a natural-language coach chat. Combat search for coaches is available only through the MCP `combats.search` tool.
- **DASH-019**: The club competition detail shall offer "Statistiques de la compétition" once at least 2 participants have a recorded combat (DASH-027). It opens the statistics tab on that competition only, over the season of its date, shown as a chip; a "Retour à …" action goes back to the competition detail. The coach's own filters are set aside and come back on the next opening of the "Stats" tab.
- **DASH-022**: The "Techniques qui nous battent" section ranks the techniques of the points scored by opponents in lost combats only, and is hidden when no such point has a technique. The dashboard ranks 5 techniques; the judoka season profile keeps 3.
- **DASH-023**: A statistics loading failure shall never be shown as "Aucun combat trouvé". It shows "Statistiques indisponibles pour le moment." (or, offline, that statistics need a connection) with a "Réessayer" action, and keeps the last statistics displayed.
- **DASH-024**: The "Tenue du score" section, read from the combat timeline, counts the combats where the judoka scores first, the victories among them, the combats lost after leading and the combats won after trailing. Leading compares Ippon, then Waza-ari, then Yuko. Only combats whose points all carry a rank are counted, and that number is shown.
- **DASH-025**: The "Discipline" section shows the average number of shidos received per combat, over the combats whose score is recorded (shown), and the number of defeats by Hansoku-make; it is hidden when no combat has a recorded score.
- **DASH-026**: Outside a judoka's own profile, statistics shall carry no information specific to one judoka: no identity, no judoka identifier, no opponent name, no line per judoka. This applies to the "Stats" tab, "Statistiques de la compétition" and the MCP `coach.dashboard` tool, which returns the same response. A judoka's record is read on their profile, from the "Judokas" tab.
- **DASH-027**: Group statistics require at least 2 judokas: those with a combat in the filtered scope or, when the scope has no combat, the owners of its competitions. Below this threshold, the server returns no statistics, only the number of combats and competitions, and the tab shows "Trop peu de judokas pour des statistiques de groupe." with a "Voir les judokas" action. The rule is applied server-side, so it also covers the MCP tool.

### 3.11 Internal MCP access rules

- **MCP-001**: The application shall expose a remote MCP server usable by standard MCP clients (e.g. Claude Desktop, Claude.ai connectors), open to any authenticated Ayumi user (`COACH`, `ADMIN`, `PARENT`, `JUDOKA`).
- **MCP-002**: The remote MCP endpoint shall implement the MCP JSON-RPC 2.0 wire protocol, including the `initialize` handshake, so that standard MCP clients can connect without bespoke client code.
- **MCP-003**: MCP clients shall authenticate via an OAuth 2.1 authorization-code flow with mandatory PKCE (S256); the authorization step shall delegate to the existing Google/Supabase login rather than a separate credential.
- **MCP-004**: The OAuth authorization server shall support unauthenticated discovery (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`) and Dynamic Client Registration so that MCP clients can connect without manual configuration.
- **MCP-005**: The backend shall mint a short-lived Ayumi-signed JWT MCP access token derived from the authenticated Ayumi user instead of exposing the Supabase session token directly to MCP clients.
- **MCP-006**: The JWT MCP access token shall expire after a short duration and shall encode only scopes from the fixed Ayumi MCP scope vocabulary assigned at mint time for the caller's Ayumi role: full read/write sports scopes for `COACH`, access-governance scopes only for `ADMIN` with no judoka/competition/combat data scopes, and judoka/competition/combat read-write scopes limited to the caller's own perimeter (no club-wide dashboard access) for `PARENT` and `JUDOKA`.
- **MCP-007**: The remote MCP endpoint shall enforce the minted JWT MCP access token scopes on each request and shall expose only callable tools in `tools/list`, so a `PARENT` or `JUDOKA` caller can only read or write competitions/combats within their own managed scope and cannot reach the club-wide coach dashboard, and an `ADMIN` caller cannot reach judoka, competition, or combat data through MCP.

## 4. Acceptance Criteria

- **AC-001**: Given a connected `JUDOKA`, when initial data is loaded, then only that user's competitions are visible.
- **AC-002**: Given a connected `PARENT`, when initial data is loaded, then competitions for the parent and linked children are visible, and no unrelated data is visible.
- **AC-003**: Given a connected `COACH`, when opening the Club Competition Dashboard, then they can see all club participants and results for any given tournament.
- **AC-004**: Given a connected `ADMIN`, when they use the application, then competition, combat, ranking, and club competition management actions are not available and server-side mutations are rejected.
- **AC-005**: Given a connected `ADMIN`, when they try to open sports dashboards or retrieve sports data through MCP, then access is rejected because admin rights do not include sports read permissions.
- **AC-006**: Given a connected `PARENT` or `JUDOKA`, when they try to access the club-wide dashboard, then access is rejected.
- **AC-007**: Given an admin or coach role change, when the request succeeds, then the user's underlying `JUDOKA` or `PARENT` profile type remains unchanged.
- **AC-008**: Given a parent attempting to save a competition for an unmanaged judoka, when the request is processed, then the save is rejected.
- **AC-009**: Given a competition save request missing name or date, when the request is processed, then the save is rejected.
- **AC-010**: Given a combat create request missing competition, judoka, or result, when the request is processed, then the save is rejected.
- **AC-011**: Given a competition deletion, when the operation succeeds, then no linked combat remains accessible for that judoka.
- **AC-012**: Given a combat deletion, when the operation succeeds, then the parent competition still exists.
- **AC-013**: Given a user opens the competition creation form, when the form is displayed, then the competition date is prefilled with the current day.
- **AC-014**: Given a user creates or edits a competition, when the form is displayed, then no ranking field is shown.
- **AC-015**: Given a user wants to set a final ranking, when they open the finalization screen, then only the ranking field is available (not accessible from the edit form).
- **AC-016**: Given a user typing combat details, when saving the combat, then they can optionally write any text in the notes field (e.g., "Perdu par Ippon sur Uchi-Mata").
- **AC-017**: Given a connected `COACH`, when they create a club competition with selected judokas, then one club event and one linked individual competition per selected judoka are created.
- **AC-018**: Given a connected `COACH` selects `Minime` on the club competition creation form, when they choose participants, then only judokas with the `Minime` age category are selectable.
- **AC-019**: Given a linked participation, when the concerned judoka or parent updates combats or ranking, then only that participation is modified.
- **AC-020**: Given a coach removes a participant from a club competition that has not started yet, when the operation succeeds, then that judoka's individual competition and its combats are permanently deleted.
- **AC-021**: Given a coach attempts to remove a participant from a club competition whose date is today or in the past, when the request is processed, then it is rejected and the participant stays linked.
- **AC-022**: Given a coach opens a club competition's detail screen, when the participant list is displayed, then each participant shows their current ranking badge ("1er", "2e", ..., "Non classé").
- **AC-023**: Given a user reaching the login screen, when authentication options are displayed, then only Google login is available.
- **AC-024**: Given a CSV-imported child profile has a direct account email, when that child logs in with the same Google account, then only that child's profile, competitions, and combats are visible.
- **AC-025**: Given a Google account without judoka profile and without active invitation, when initial access is checked, then profile creation is rejected with an explicit invitation-required message.
- **AC-026**: Given an admin creates an invitation for a new email and a target profile type, when that invited user logs in, then profile creation is allowed exactly for that invited email and invited type.
- **AC-027**: Given a connected session, when the app header is rendered, then user identity is displayed and a logout button is available.
- **AC-028**: Given the mobile layout, when primary actions are displayed, then controls remain textual, touch-friendly, and visible.
- **AC-029**: Given an application notification on the current screen, when the UI reports it, then the message is shown as a dismissible toast without shifting the main screen layout.
- **AC-030**: Given a previously connected user opens the app offline, when cached data exists for that user, then the app displays it with an explicit offline/stale-data indicator.
- **AC-031**: Given a connected user records a combat while offline inside their known scope, when the save action is submitted, then the combat is available locally, the global status reports a pending synchronization, and no backend success is claimed.
- **AC-032**: Given pending offline operations exist, when network access returns, then the app replays them through the authenticated backend API and clears the pending state only after server confirmation.
- **AC-033**: Given a pending offline operation is rejected during synchronization, when the error is displayed, then the operation remains in local storage and the global status exposes the failure for correction.
- **AC-034**: Given the user is offline, when they attempt an admin, deletion, import, login, or club competition participant-management action, then the action is blocked with an explicit offline message.
- **AC-035**: Given a connected `COACH`, when dashboard filters are set by competition, age category, or date range, then the displayed rates and counts are computed only from combats matching the active filters.
- **AC-036**: Given a connected `COACH`, when dashboard date filters are submitted with a start date after the end date, then the request is rejected with an explicit validation error and no misleading empty statistics are displayed.
- **AC-038**: Given an MCP client requests scopes outside the connected user's role perimeter, when the authorization or request is processed, then unsupported scopes are not granted and protected operations are rejected.
- **AC-039**: Given an MCP OAuth request, when PKCE is missing/invalid or the redirect URI does not exactly match the registered client URI, then the request is rejected.

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
