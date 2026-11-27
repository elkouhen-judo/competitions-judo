---
title: Ayumi Functional Specification
version: 2.2
date_created: 2026-06-11
last_updated: 2026-11-21
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

### 2.1 Interface vocabulary

- **VOC-001**: « Compétition club » names a club competition everywhere; « événement » is reserved for the FFJDA agenda.
- **VOC-002**: « Inscrit » alone means entered in a competition. Season registration is « réinscrit pour la saison ». An existing user is « compte existant ».
- **VOC-003**: « Fiche » names a judoka's page. « Profil sportif » names its editable sports information.
- **VOC-004**: « Bilan coach » names the coach's written review. « Résultat » names the win/loss record.
- **VOC-005**: Menus and tabs use « Ma famille » and « Mon espace »; the five coach tabs use full labels (« Accueil », « Judokas », « Agenda », « Compétitions », « Statistiques »); filters are cleared with « Effacer les filtres »; rights are removed with « Retirer ».
- **VOC-006**: An empty value is « Non renseigné(e) ». An address is « E-mail ». A participant without a place is « Non classé »; only the compact ranking buttons of a club competition show « NC » to fit 375 px (their accessible name stays « Non classé »).
- **VOC-007**: The interface addresses the user with « vous », uses « … » for ellipses and « » for quoted names, and agrees plurals instead of writing « (s) ».

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

- **CLUB-001**: A judoka may belong to several clubs at once (e.g. a judo club and a « pôle espoir »; a pôle is a club like any other). When they have at least one club, one of them is their main club. A judoka without a club is visible to no coach; parents and the judoka keep their usual access.
- **CLUB-002**: A coach is assigned to one or more clubs and only sees and manages the judokas of those clubs, their individual competitions and combats (including those recorded by parents), and the club competitions of those clubs.
- **CLUB-003**: Access follows the judoka's current clubs: the coaches of each of their clubs see the full history (individual competitions, combats); a club removed from the judoka loses access, a club added gains the full history.
- **CLUB-003a** (MULTI-4): Statistics count a participation for the club where it was obtained: the club of its club competition. A participation detached from a deleted club competition (COMP-018) counts for the judoka's current main club. A transfer therefore moves access (CLUB-003), not past results; statistics stay free of any data specific to one judoka (DASH-026).
- **CLUB-004**: A club competition belongs to exactly one club, fixed at creation. Only judokas belonging to that club (among their clubs) can be entered. A coach of a single club does not choose the club; a coach of several clubs must choose it.
- **CLUB-005**: Any request on a judoka, competition, combat, club competition, or dashboard outside the coach's clubs shall be refused server-side (screens, API, and MCP alike); another club's club competition is reported as not found.
- **CLUB-006**: Only admins manage clubs: create, rename (unique name, case-insensitive), assign coaches, set a judoka's clubs and main club (the first chosen by default; it must be one of their clubs). A club can only be deleted when it has no judoka, no coach, and no club competition.
- **CLUB-007**: The CSV import accepts an optional `club` column holding an existing club name. A `JUDOKA` row adds that club to the judoka's clubs, as main club when they had none; existing clubs are kept. A coach row also coaches it. An unknown club or a club on a `PARENT` row fails that row without writing.
- **CLUB-008**: A coach of several clubs gets a club filter ("Tous mes clubs" by default) on the coach home and the coach dashboard; it narrows club competitions, the judoka selector, and statistics. The home and the dashboard share one chosen club: changing it on one screen changes it on the other (MULTI-3). The chosen club is remembered on the device for that account; a club the coach no longer coaches falls back to "Tous mes clubs", and logging out forgets the choice (MULTI-2).
- **CLUB-009** (MULTI-1): For a coach of several clubs, on "Tous mes clubs", the club name is shown on the club competition cards, the coach agenda lines, the "Judokas" suggestions and the dashboard competition suggestions and chips. It is not repeated when one club is chosen. The club competition detail always shows its club under the title. A coach of a single club sees no club name.

### 3.3 Competition rules

- **COMP-001**: A competition must include a name and a date.
- **COMP-002**: A competition shall expose an age category chosen from the fixed list: `Poussinet`, `Poussin`, `Benjamin`, `Minime`, `Cadet`, `Junior`, `Senior`, `Vétéran`, and a weight category.
- **COMP-003**: A competition shall expose a level field chosen from: `Départemental`, `Régional`, `National`, `International`. The field is optional (empty by default).
- **COMP-004**: A competition shall not use an actual weigh-in field.
- **COMP-005**: A `JUDOKA` or `PARENT` can update and delete only competitions linked to their scope (deletion limited by COMP-038).
- **COMP-006** (MULTI-4): Only a `COACH` creates a competition, as a club competition of one of their clubs (COMP-019); each participant gets an individual competition (COMP-023). A `JUDOKA` or `PARENT` cannot create a competition: the home screen offers no « Nouvelle compétition » and the server refuses a save without an existing competition (screens, API and MCP alike).
- **COMP-007**: When opening the club competition creation form, the date field shall be initialized to the current day by default.
- **COMP-008**: Competition creation shall not ask for the final ranking.
- **COMP-009**: An individual competition outside a club competition only exists once detached from a deleted club competition (COMP-018). Editing it shall not give that judoka two standalone individual competitions with the same name and date.
- **COMP-010**: Multiple judokas may have individual competitions with the same name and date when those participations are linked to the same club competition.
- **COMP-011**: Final ranking shall be entered and updated exclusively from a dedicated competition finalization screen. The competition edit form shall not expose a ranking field.
- **COMP-012**: The final ranking is chosen among `1er`, `2e`, `3e`, `5e`, `7e` or `Non classé`, the places awarded in judo. Rankings `4e`, `6e` and `8e` already stored stay readable and are still accepted by the server.
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
- **COMP-026**: A club competition is considered finished once its date is today or in the past. Late entry stays possible on a finished club competition: the coach can still add judokas (which creates their individual participations), then record their combats and rankings. Editing event information, combats, final rankings, coach review, deletion, and consultation remain available. While the coach edits a finished club competition, a banner explains late entry and the removal rule of COMP-027.
- **COMP-027**: Removing a judoka from a club competition that has not started yet (date strictly in the future) deletes that judoka's individual competition outright, including its combats, rather than merely detaching the club link. On a finished club competition, a participant can be removed only while their participation has neither combats nor a ranking (e.g. added by mistake during late entry); otherwise removal is blocked so recorded results are never lost.
- **COMP-028**: The club competition creation form checks club, name, date, age category, level and at least one participant before sending, in screen order; each message shows under its field, which receives the focus. All six fields carry the required mark.
- **COMP-029**: A coach attached to no club sees only the warning banner and the back action on the creation form.
- **COMP-030**: Leaving a modified creation form (back arrow) asks for confirmation; the form has no separate "Annuler" button. The level is chosen with four buttons that can be browsed with the keyboard arrows.
- **COMP-031**: On the creation form, the list offers only judokas not yet added (UIX-043); touching one adds it. « Tout ajouter » adds every listed judoka (club, category and search), across pages. Added judokas are shown as removable chips above the list. The search lists only matching names.
- **COMP-032**: Changing the age category or the club of the creation form announces how many checked judokas were removed and why. The form tells how many judokas of the club have no age category.
- **COMP-033**: Saving a new club competition opens its detail.
- **COMP-034** (COACH-2): Coming back from a participant's competition, the club competition detail lines show the combats and ranking just saved, without reloading. No line, card or agenda group asks for a coach review.
- **COMP-036** (COACH-4): A participant's competition opened from the club competition detail offers « Suivant : <judoka> », which opens the next participant in the order of the detail list, the last leading back to the first. It is offered only with at least 2 participants.
- **COMP-037** (COACH-7): Editing a club competition uses the same controls as creating one: the level with four buttons, judokas to add as chips, the others as rows to touch, and « Tout ajouter ». Leaving the edit (« Annuler » or back arrow) with unsaved changes asks for confirmation.
- **COMP-038** (PART-1): A participation linked to a club competition is removed only with « Retirer » on the club competition (COMP-027). Its own detail offers no « Supprimer la compétition », and the server refuses its direct deletion for every profile (screens, API and MCP alike) with « Retirez ce judoka depuis la compétition club. ». A detached competition (COMP-018) can still be deleted.
- **COMP-039** (FICHE-5): On a competition screen, the ranking comes first, under the competition pills. While no ranking is saved it is highlighted (yellow frame) with « À saisir »; once saved it shows « Enregistré ». On the competition day, the existing order still puts the combats first.
- **COMP-040** (FICHE-6): The summary shows three tiles: the number of combats, of victories (in green) and of defeats, each agreed in number.
- **COMP-041** (FICHE-7): Each combat card starts with a round « V », « D » or « N » letter, so the result reads without colour. The « Bilan coach » section comes after the combats; when empty, parents and judokas read « Le coach n'a pas encore écrit de bilan. ».
- **COMP-042** (FICHE-8): From 1100 px wide, the competition screen lists on its left the other competitions of the same judoka, under « À venir » (soonest first) and « Passées » (latest first), each with its date and its ranking or « Classement à saisir ». The open competition is highlighted; touching another opens it in place, keeping the back destination. The list is hidden below 1100 px and when the judoka has a single competition.

### 3.4 Combat rules

- **CBT-001**: A combat must include a parent competition, a judoka, and a result.
- **CBT-002**: Combat result values shall be limited to `Victoire`, `Défaite`, or `Egalité`.
- **CBT-003**: A combat may include an opponent name and match notes (free text for technical feedback).
- **CBT-004**: Shido counts are structural fields of the official score (see CBT-007d). Other referee details (scoreboard clock, golden score, penalty reasons) shall not be structural fields; they may be typed in the free text match notes (e.g., "Gagné au Golden Score").
- **CBT-005**: A combat with result `Victoire` or `Défaite` shall record a decision type among `Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hansoku-make`, or `Forfait`. A combat with result `Egalité` shall use `Hiki wake`. Scoring technique entries remain optional and shall not replace the decision type. The form labels the decision field `Victoire par` or `Défaite par` according to the result, marks it « facultatif » and explains each ending in plain words; only the result is required to save.
- **CBT-006**: A combat may optionally record the opponent's stance (`Droitier` or `Gaucher`).
- **CBT-006a**: A combat may optionally record its round in the competition (`Poule`, `1/32`, `1/16`, `1/8`, `1/4`, `1/2`, `Repêchage`, `Place de 3`, `Finale`). The round is shown on the combat card; when every combat of a competition has a round, the combats are listed in that bracket order. All rounds are visible in the form without horizontal scrolling. The form and the combat card show `1/4`, `1/2` and `Place de 3` as « Quart de finale », « Demi-finale » and « Combat pour la 3e place »; the stored value does not change (SAISIE-6).
- **CBT-007**: A combat may optionally record a single chronological list of points ("Déroulé"), one entry per point scored during the combat, regardless of the combat result. Each entry shall record who scored it (`Judoka` or `Adversaire`) and its rank in the combat across both sides. Season and coach statistics count only the judoka's points.
- **CBT-007a**: A combat may optionally record its official score in the `IWY - IWY` format: the number of Ippon, Waza-ari and Yuko of the judoka, then of the opponent (e.g. `1 0 2 - 0 1 0`). Ippon counts are 0 or 1; Waza-ari and Yuko counts are integers from 0 to 9. In the combat form, the official score is the count of the points of the "Déroulé" per side and value.
- **CBT-007b**: The official score is entered with − / + counters in the "Le combat" section. A + on Ippon, Waza-ari or Yuko appends a point of that side and value at the end of the "Déroulé"; a − removes the latest matching point, preferably one without technique. The score stays "Non renseigné" until a counter is touched or a point exists. An "Effacer" action, available while the "Déroulé" is empty, resets it to "Non renseigné". The combat card shows the score only when it is filled in.
- **CBT-007c**: A combat update that does not carry the official score (e.g. the MCP tool `combats.save`) shall keep the stored score unchanged.
- **CBT-007d**: The official score may record the number of shidos of each side, from 0 to 3. Shidos have their own − / + counters and do not create points. The combat card writes the score in words, without zero counts: « Hugo : 1 Ippon, 1 Waza-ari · Adversaire : 1 Shido » (judoka first name, then « Adversaire ») (SAISIE-7). In the form, the score is read from the counters only; a text summary is shown only while the score is "Non renseigné".
- **CBT-007e**: Opening a stored combat rebuilds the "Déroulé" in combat order. Combats saved without a global rank list the judoka's points first, then the opponent's. When the stored score counts more points than the stored list, the missing points are added at the end without technique.
- **CBT-007f**: Choosing `Victoire par` / `Défaite par` `Ippon`, `Waza-ari` or `Yuko` appends the matching point (judoka for a victory, opponent for a defeat) at the end of the "Déroulé" when no such point exists. This automatic point is removed if the result or decision changes before its technique is chosen.
- **CBT-008**: Each point shall record a value (`Ippon`, `Waza-ari`, or `Yuko`). Its technique is optional: a point without technique is saved as is. The technique is chosen from one list grouped by family (Te-waza, Koshi-waza, Ashi-waza, Sutemi-waza, Osaekomi-waza, Shime-waza, Kansetsu-waza); the category (`Tachi-waza` shown as `Debout`, `Ne-waza` shown as `Au sol`) is deduced from the technique. The techniques already scored by the judoka are listed first. "Autre technique debout…" and "Autre technique au sol…" accept a free-text name.
- **CBT-009**: A `JUDOKA` or `PARENT` can manage combats for their own scope. `COACH` users can manage combats for club competition participations.
- **CBT-010**: Deleting a combat shall not delete its parent competition.
- **CBT-011**: The combat form shows three cards: "Le combat" (round, result, then "Préciser la victoire / la défaite (facultatif)"), "Score" (optional), then opponent, opponent stance and notes (all optional). The round proposed by CBT-020 is shown as a pill with "Changer", which opens the list of rounds; touching a round closes it. "Victoire par" / "Défaite par" opens on demand and stays open once a way is chosen or deduced (SAISIE-8). "Enregistrer" and "Enregistrer + suivant" stay visible while scrolling, on mobile and desktop. At 375 px, the result and the save button are visible without scrolling on a new combat. A new combat, including after « Enregistrer + suivant », gives the focus to no field, so the mobile keyboard does not hide the result (SAISIE-1).
- **CBT-011a** (SAISIE-9): The score has two modes. "Rapide" (default for a new combat) shows the score counters (Ippon, Waza-ari, Yuko, Shido per side), without the order. "Précis" shows each point in order with its technique, the score of each side computed from it, and "+ Point <Prénom>" / "+ Point adversaire" which ask the value. Both modes fill the same points; switching from "Rapide" to "Précis" keeps them and says « Points repris du score rapide : vérifiez leur ordre. ». A combat with at least one point technique reopens in "Précis".
- **CBT-012**: Points of the "Déroulé" can be moved earlier or later and removed one by one.
- **CBT-013**: Leaving the combat form (back arrow or "Annuler") with unsaved changes asks for confirmation.
- **CBT-014**: The opponent field suggests the opponents already met by the judoka of the competition. Typing or choosing an opponent already met fills the opponent stance with the stance recorded at the most recent combat against them, unless a stance is already chosen (name match ignores case).
- **CBT-015** (SIMPL-1): Neither the combat form, the combat card, the competition detail nor the statistics show a reminder of missing data (no « À compléter », no « Niveau à compléter », no « Points détaillés » count, no priority tag). A combat is completed by opening it again from its card.
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
- **STA-008**: A competition dated after today stays in « Compétitions de la saison » with « Dans N jours » instead of a ranking. It is not counted in the season totals (competitions, combats, victories) nor used as the latest competition.
- **STA-009**: A competition's win/loss record shows no zero counter (« 1D », « 2V 1D »), as on the home and competition screens.
- **STA-008**: The judoka profile hero shall display the judoka's garde when it is known.
- **STA-009**: The judoka profile shall display a short competition-results list for the displayed season with date, competition name, final ranking, combat record, and a ranking badge.
- **STA-010**: Competition ranking badges shall distinguish podium, top 5, and non-classed results; 1st place shall use a gold badge, 2nd place a silver badge, and 3rd place a bronze badge.
- **STA-011**: The judoka profile shall display the number of competitions for the displayed season.
- **STA-012**: The judoka profile shall display the number of combats for the displayed season.
- **STA-013**: The judoka profile shall display the victory rate for the displayed season in one tile with the season record (`70%`, `Victoires`, `7V 3D`), next to the competitions and combats tiles.
- **STA-014**: The judoka profile shall display a combat profile summary for the displayed season based on global Victory/Loss/Equality ratios and notes insights.

### 3.7 Authentication behavior

- **AUTH-001**: The application shall provide Google login.
- **AUTH-002**: The application shall keep the connected session after the OAuth callback.
- **AUTH-003**: Application permissions shall come from the Ayumi user role, not from the Google account itself.
- **AUTH-004**: The login UI shall not expose password login.
- **AUTH-005**: The login UI shall not expose magic-link login or signup.
- **AUTH-006**: The connected header shall show user identity and provide an explicit logout action.
- **AUTH-006a** (NAV-5): The header is one line: logo, « Ayumi - 歩み », and the account pill with the user's first name and one role. « Suivi de compétitions » is shown only while nobody is connected; then the header shows no account pill.
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
- **AUTH-019a** (INSCR-1): The admin CSV import shall ask for the registration season (current season by default; previous or next season may be chosen). Every imported or re-imported `JUDOKA` row shall store that season on the judoka (`judokas.saison_inscription`, the season's start year; only the latest is kept). `PARENT` rows have no registration season. A judoka absent from a re-import keeps its previous season and all its data. The import summary shall give the number of judokas registered for the season and the number of judokas of the imported clubs not re-registered. Judokas existing when the rule was deployed are registered for the 2026-2027 season; a self-registered judoka is registered for the current season.
- **AUTH-019b** (INSCR-2): A judoka may be entered in a club competition (MULTI-4: the only way a competition is created) only if the competition's season (September to August) is not later than the judoka's registration season. The server shall refuse otherwise (screens, API and MCP alike). Competitions, combats, rankings and statistics already recorded stay readable and editable. The club competition participant lists shall propose only judokas registered for the competition's season and say how many judokas are not; changing the date to another season removes non-registered judokas from the selection with a notice. For a non-registered judoka, the family home shows « Non réinscrit pour la saison AAAA-AAAA. »; the judoka profile and the coach's judoka picker show « Non réinscrit ».
- **AUTH-020**: Re-importing a CSV row that matches an existing `PARENT` by account email shall not be treated as an import error either; the row succeeds as a no-op update once first and last name are confirmed to match. A row whose email matches an existing account of the other profile type, or whose name does not match that account, shall still fail.
- **AUTH-021**: After a CSV import, the admin UI shall show only a toast summary with the number of successful rows and failed rows; it shall not render a row-by-row import result list.
- **AUTH-022**: The underlying `JUDOKA` or `PARENT` profile type shall not be changed automatically after registration.
- **AUTH-023**: Admin and Coach elevations shall be managed separately from the invitation flow.
- **AUTH-024** (ADMIN-1): From « Utilisateurs », an admin names a `JUDOKA` with an account e-mail coach (« Nommer coach ») or removes the coach role (« Retirer le rôle coach », after confirmation). A `PARENT` cannot be coach. A former `ADMIN` named coach keeps admin rights through the separate admin flag (ROL-004a). Removing the coach role also removes the coached clubs; the judoka keeps their own club and data. The current admin's own card offers neither action.

### 3.8 UI and UX rules

- **UIX-001**: The application shall be mobile first.
- **UIX-002**: Lists and forms shall remain separated.
- **UIX-003**: Main actions shall be visible, tactile, and explicit.
- **UIX-004**: Action labels shall stay textual and explicit on mobile, not icon-only.
- **UIX-005**: Desktop-specific layout shall be a progressive enhancement over the small-screen baseline.
- **UIX-006**: The UI visual identity should use local Ayumi/dojo elements, including a local app mark, tatami-inspired surfaces, and restrained belt/podium accents; it shall not depend on a remote logo image.
- **UIX-007**: The UI shall provide loading, empty, error, and success states.
- **UIX-008**: Empty states that can be resolved by the current user shall include a direct contextual action, such as adding the first combat.
- **UIX-009**: Deletions shall require explicit confirmation.
- **UIX-010**: After create or update operations, the application shall refresh relevant data and display the affected item.
- **UIX-011**: User notifications should be displayed through toast notifications so the current screen remains readable while the message stays explicit.
- **UIX-012**: For `PARENT`, the home screen shall open on the family space: one card per child (initials, first name, belt bar, « <catégorie> · <ceinture> »), the « À faire » card (UIX-013c), the next competition with its countdown « J-N », the block « La saison de <Prénom> » with its « Sa fiche » link, then the other competitions as rows (« À venir », « Compétitions passées »). « Mon espace » shows the same blocks for the judoka, titled « Ma saison » and « Ma fiche ».
- **UIX-012a**: The season block counts the competitions already held in the current season, their combats and podiums, then a bar of wins and losses labelled « N victoires » and « N défaites ». Without a competition held, it shows only its title and link.
- **UIX-012b**: The next competition is shown once: it is not repeated in the list below. A list row starts with a drawn medal (1er, 2e, 3e), the place, « ? » when the ranking is missing (« À saisir ») or a calendar for an upcoming competition.
- **UIX-013**: For `PARENT`, a child shall always be selected: the last child chosen on the device, otherwise the first child. The parent profile itself is never offered as a child.
- **UIX-013a** (FAM-1): When a child (or, in « Mon espace », the judoka) has no competition and belongs to no club, the empty state says so: « <Prénom> n'est rattaché à aucun club : aucun coach ne peut l'inscrire. Demandez au club de le rattacher. » (« Vous n'êtes rattaché à aucun club… » for the judoka).
- **UIX-013c** (ACCUEIL-5): On the home of a parent (for the chosen child) or of a judoka, the most recent competition dated today or earlier without ranking shows an « À faire » card: « Quelle place pour <Prénom> à <compétition> ? » (« Quelle place à <compétition> ? » for the judoka) with the ranking buttons. Touching a place saves it (as on the competition screen, offline included), shows « Classement enregistré : <place>. » with « Voir la compétition », and the card moves to the next competition without ranking, if any. Child cards show the child's initials.
- **UIX-015**: For `COACH`, the home screen shall show what is waiting: a greeting with the number of rankings to enter; the next club competition as a highlighted card (name, date, club when several, countdown « J-N », first three entrants' initials and « +N », « N inscrits »), which opens it; « À faire » with the club competitions whose rankings are missing and their total; « Derniers podiums » with the three most recent podiums (drawn medal, judoka, belt bar, competition and place), each opening the judoka's competition. « À faire » shows at most 5 lines, then « + N autres dans « Compétitions » », which opens the « Compétitions » tab (COACH-6). Without upcoming competition nor ranking to enter, « Rien en attente » offers « Voir les compétitions ». For `ADMIN`, access governance is reached from the account menu.
- **UIX-016** (NAV-7): For `COACH`, the same five tabs shall be shown on every coach tab screen (home, statistics, FFJDA agenda): « Accueil », « Judokas », « Agenda », « Compétitions » and « Statistiques », in that order (the course of a season: roster, planning, follow-up, analysis), each with an icon. On mobile they form a bar fixed at the bottom of the screen; content and action bars stay above it. On desktop they are tabs at the top, without icons. Detail screens keep their back arrow and show no tab bar. « Mon espace », « Ma famille » and « Gestion des accès » are in the account menu opened from the header.
- **UIX-016f** (MEDAL-1): Rankings 1er, 2e and 3e show a drawn gold, silver or bronze dot before the text, never an emoji; on ranking buttons and on ranking badges.
- **UIX-016a**: The home lists shall load the current season and upcoming competitions; a « Voir la saison AAAA-AAAA » button shall load the previous season on demand, as long as an older competition exists.
- **UIX-016b**: A past season already viewed shall stay readable offline.
- **UIX-016c**: « Gestion des accès » shall list users by pages of 10 loaded from the server; the search by name or e-mail shall be applied by the server.
- **UIX-016d** (ADMIN-2): « Utilisateurs » offers « Tous », « Sans club » and « Non réinscrits » (registration season before the current one). Both filters list `JUDOKA` profiles only, are applied by the server with the search and pagination, and are kept after an action on a user.
- **UIX-016g** (ADMIN-3): « Utilisateurs » starts with the search « Nom, e-mail ou club »; a search word also matches the users of clubs whose name contains it (server side). A fourth filter « Coachs » lists `COACH` users. Each user is one line: name, « rôle · catégorie · clubs » (main club first), e-mail, a « Sans club » / « Non réinscrit » pill for judokas, and a « … » menu. The menu offers « Modifier les clubs » (under the line: chosen clubs as removable chips and an « Ajouter un club… » menu, then « Club principal » chips when 2 clubs or more are chosen; « Enregistrer » is disabled while unchanged, then an in-app confirmation naming the coaches who lose access), « Nommer coach » / « Retirer le rôle coach », then, apart, « Supprimer le compte… ». « Afficher plus » adds the next page under the list. The access-management tabs stay at the top on mobile.
- **UIX-016e**: In the coach « Judokas » tab, while no judoka is chosen, the judokas of the coach's clubs (or of the chosen club) are listed by age category then name, 10 per page, each with category, weight, club and a « Non réinscrit » badge when relevant. Typing in the search filters this list. Touching a judoka chooses them and shows their competitions and « Fiche de … ».
- **UIX-017**: When the connected user has an underlying `JUDOKA` profile, that judoka shall be selected by default as the active judoka context.
- **UIX-018**: For `COACH`, the `Compétition` home mode shall stay club-centered and shall not expose a judoka selector or individual judoka context.
- **UIX-019**: For `COACH`, a separate `Judoka` home mode shall allow selecting a judoka to consult their profile, upcoming competitions, and past competition history.
- **UIX-020**: The judoka profile view shall remain readable and actionable on mobile.
- **UIX-021**: The judoka profile view shall open on an identity card (initials ringed with the belt color, name, « <club> · Ceinture <couleur> · <genre> »), the season as a segmented control from the oldest known season to the current one, three figures (competitions, combats, « N % de victoires ») with the wins and losses bar, « Comment finissent ses combats » (won and lost, each with its decision types), « Techniques qui gagnent », then the season's competitions as rows (UIX-012b, « J-N » for an upcoming one).
- **UIX-022**: The judoka identity card shall read in a sports order: name, club, belt color and gender, then four columns « Catégorie », « Année », « Poids », « Garde » (« — » when not set).
- **UIX-044** (BELT-1): A belt color is shown as a flat bar next to the name (or a ring around the profile initials), never as a shaded avatar; a two-color belt shows both halves; a belt not set shows nothing. The color always comes with its text (« Minime · Orange », « Ceinture orange »).
- **UIX-023**: Competition and season results should use distinct visual badges and lightweight motion cues while remaining readable on mobile.
- **UIX-024**: Home widgets shall not repeat the active tab label as a standalone title; when an active tab or useful context card already identifies the view, the redundant home header shall be hidden.
- **UIX-025**: Competition cards in lists shall use a uniform open-only interaction. Destructive competition deletion shall be handled from the competition detail screen, not from list cards.
- **UIX-026**: Coach competition cards should expose immediate follow-up signals: participant count, ranking progress and podium count. Missing coach reviews are not signalled.
- **UIX-027**: The competition detail screen shall show pills (countdown, category, level, ranking), then a compact record (wins and losses without zero counters, victory rate). Before the competition date, it shows no result entry and no coach follow-up block; from the competition date, the ranking is chosen on the page with buttons.
- **UIX-028**: For `PARENT`, the competition detail screen shall show the coach follow-up block, from the competition date, so the review written by the coach is visible on the judoka's competition. The application manages no coach objective: none is entered, stored by the application, shown or returned by the API.
- **UIX-029**: Combat and competition detail screens shall make dashboard metric inputs visible: judoka garde when available, opponent garde, competition level, decision type, and scoring techniques.
- **UIX-030**: An action card shall open its useful destination or corresponding section directly, without requiring an intermediate mode change.
- **UIX-031**: Changing home mode shall preserve the active judoka; an explicit selection action may reset that context.
- **UIX-032**: The coach dashboard shall provide direct navigation back to the coach home and the personal space from the current view.
- **UIX-033**: Autocomplete options shall be usable with keyboard and touch interactions.
- **UIX-034**: View URLs shall include the navigation context required to restore a journey after reload.
- **UIX-039**: Coach-facing and parent-facing helper copy shall use plain sports-field language ("bilan coach", "relire le combat", "points marqués", "debout et au sol", "droitier ou gaucher") instead of technical dashboard wording where possible.
- **UIX-040**: The admin CSV import screen shall present import requirements as a short checklist and downloadable example rather than a long inline column description.
- **UIX-041**: Opening an existing combat in the mobile form shall preserve the recorded result and shall not autofocus the result field when a result is already set. The form shall focus the first useful missing detail instead. A combat that already has detail (score, points, opponent stance or notes) opens with the detail unfolded. A new combat focuses the opponent field.
- **UIX-036**: Combat creation actions shall remain hidden while a competition detail is loading and shall require a loaded, editable parent competition before opening the combat form.
- **UIX-035**: Each home shall open on its useful content (competition list, children pills or coach to-do list) rather than on explanatory cards.
- **UIX-037**: Competition lists in destination screens shall include competitions dated today or later, listed first by ascending date with an « Aujourd'hui » or « À venir » badge, followed by past competitions from most recent to oldest.
- **UIX-038** (CONFIRM-1): The application shall never open a native browser dialog (`alert`, `confirm`, `prompt`). Every confirmation (deletions, removals, revoking rights, cancelling an invitation, leaving a modified club competition or combat form) uses the application's own dialog: the message, a confirmation button named after the action (red for a destructive one) and a cancel button that receives the focus; Escape or a tap outside the dialog cancels.
- **UIX-042** (RETOUR-1): On a touch screen, sliding a finger from the left edge (first 24 px) to the right by at least 80 px, mostly horizontally, goes back exactly like the screen's back arrow, including its confirmations; an arrow follows the finger from the edge and fills in once the distance is reached. Screens without a back arrow ignore the gesture, as does an open dialog. Safari on iPhone or iPad outside the installed app keeps its own gesture and the application adds none.
- **UIX-043**: A multiple choice among an open list (judokas, clubs) shall not be a list of checkboxes where some are checked. Chosen items are removable chips (« × »); the others are offered apart, as rows to touch (« + ») or an « Ajouter … » menu, without the chosen ones. Checkboxes or toggle chips stay allowed when the full list is short and fixed (for example the agenda UV filter).

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
- **DASH-002**: The dashboard opens with its title « Statistiques » and a pill summarising the active filters (DASH-031); the filters are folded until the pill is touched. Unfolded, they show, in order, the club filter (coaches of several clubs only), the age category filter, the start/end date range, and the competition multi-select filter. All filters are optional and may be cleared. On first opening, the date range is the current season (1 September to 31 August) and the club is the one chosen on the home screen; the other filters are unset. The filters chosen by the coach are kept while the application stays open, except the club, which follows the one chosen on the home screen (CLUB-008); "Effacer les filtres" returns to the current season with every category and keeps the club. Statistics opened from a club competition (DASH-019) keep their own scope and do not change the home club. When both dates are set, the start date must be before or equal to the end date; otherwise the message shows under the dates and no statistics are requested. The collapsed filter summary shows a range equal to a season as "Saison AAAA-AAAA" and other dates in the application format (`1 sept. 2026`). The dashboard shall not offer a judoka gender filter or a judoka garde filter.
- **DASH-003**: The dashboard shall recompute statistics automatically whenever any filter changes, debounced by 300ms of inactivity, with no manual refresh button; this applies uniformly to the competition multi-select, the date range, and the age category filters. Changing the age category or the date range shall also update the set of competitions offered by the competition selector, and any previously selected competition that falls outside the new range shall be deselected automatically.
- **DASH-004**: The dashboard competition selector shall be an autocomplete: selected competitions are shown as removable chips, and typing in the search field shows up to 8 matching, not-yet-selected suggestions by name or date instead of an exhaustive browsable list; no suggestion is shown while the search field is empty. Selecting a suggestion adds it as a chip and clears the search field. When a club competition has generated several individual competition rows, the selector shall show a single option for that club competition and selecting it shall filter on all generated individual competitions.
- **DASH-005**: On mobile, the dashboard filters shall be collapsible so the statistics can be reviewed without scrolling through the full filter list.
- **DASH-006** (SIMPL-3): The dashboard statistics tab shall present, after the filters, a synthesis block, then in this order: Par niveau, Par club (DASH-030), Comment on gagne, Comment on perd, Évolution. A section without data is hidden. The combat stage (tour) stays recorded on each combat, but no statistic is computed or shown per stage.
- **DASH-007**: The synthesis block shall display three tiles (combats analyzed with the number of competitions, victories, and podiums over ranked participations), one neutral sentence, the engaged judokas line (DASH-029), the compared period (DASH-028) and, when some exist, the past participations without any recorded combat (`18 participations, dont 4 sans combat saisi.`; participations dated after today are not counted). The sentence gives the record (`12 victoires, 8 défaites sur 20 combats`), then the most notable fact, in this priority: the most frequent defeat ending, the most scored winning technique; it never contains a judgement such as "Point fort" or "Point d'attention". The competitions analyzed count shall count only competitions dated today or earlier (or without a date), and a club competition linked to multiple judoka participations only once.
- **DASH-008**: Every tile of the synthesis block and every statistics section shall expose an info tooltip, reachable by hover, focus and touch, with one plain-language sentence saying what it measures and on which combats, consistent with `docs/metrics.md`. On mobile, an open tooltip stays within the screen.
- **DASH-009** (SIMPL-3): Podiums are counted per participation, not per combat: a participation finalized with exactly `1er`, `2e` or `3e` is a podium; a participation with a ranking other than `Non classé` is a ranked participation. They are shown on the "Par niveau" line of the competition level, a competition without a recognized level being counted on the "Niveau non renseigné" line. No percentage is shown for podiums.
- **DASH-010** (SIMPL-3): The "Par niveau" section lists, for each competition level present (`Départemental`, `Régional`, `National`, `International`, in that order), then "Niveau non renseigné", the win count over combats (DASH-011) and, when the level has ranked participations, the podiums over them (`6 podiums sur 14 participations classées`). A level with ranked participations and no combat reads "aucun combat saisi". The sums of the lines equal the combat count and the "Podiums" tile.
- **DASH-011**: Every rate on the dashboard shows its count first (`3/8 gagnés`). Below 5 combats (or points) in the denominator, the percentage and the bar are not shown, and win-rate lines read "trop peu de combats" instead (`0/1 gagné · trop peu de combats`). The "Victoires" tile shows `victoires/combats` below 5 combats and the percentage with the win count from 5 combats.
- **DASH-012** (SIMPL-3): The "Podiums" tile shows the podiums over the ranked participations, all lines of "Par niveau" included. The dashboard shows no ranking in the first seven.
- **DASH-013**: The "Évolution" section lists one line per season quarter (September–November, December–February, March–May, June–August) when the dated competitions of the scope fall in one season, otherwise one line per season. Each line gives the participations, combats, victories and podiums; only lines with combats or a podium are listed, and a line with a podium and no combat reads "aucun combat saisi". It is shown only from 2 lines.
- **DASH-014** (SIMPL-3): The dashboard shows no statistic by garde: no win rate by judoka garde against opponent garde, no breakdown of the engaged judokas by garde. The garde stays recorded on the judoka and the combat.
- **DASH-015** (SIMPL-3): The "Comment on gagne" section shows the endings of the won combats (DASH-016), the 5 most scored techniques in won combats, then one line on the points scored by the judokas in won combats whose technique category is known: `Points marqués : 64 % debout, 36 % au sol (74 points)`, or the counts below 5 points (`2 debout, 1 au sol`). The "Comment on perd" section shows the same for lost combats: endings, techniques of the opponents (DASH-022), and `Points concédés : …` (points conceded in lost combats only). Draws enter neither line. Each section is hidden when it has neither ending nor technique.
- **DASH-016**: The endings of the won and of the lost combats ("Comment on gagne", "Comment on perd" and the judoka season profile) show only endings with at least one combat, from the most to the least frequent, plus a "Non renseignée" line for combats without ending, so that the lines add up to the victories (or defeats).
- **DASH-017** (SIMPL-1): The statistics carry no count of missing entries (screen, API and MCP alike). A combat with a missing value is left out only of the sections that need that value.
- **DASH-018**: The application shall not offer a natural-language coach chat. Combat search for coaches is available only through the MCP `combats.search` tool.
- **DASH-019**: The club competition detail shall offer "Statistiques de la compétition" once at least 2 participants have a recorded combat (DASH-027). It opens the statistics tab on that competition only, over the season of its date, shown as a chip; a "Retour à …" action goes back to the competition detail. The coach's own filters are set aside and come back on the next opening of the "Stats" tab.
- **DASH-022**: "Techniques qui nous battent", in "Comment on perd", ranks the techniques of the points scored by opponents in lost combats only, and is hidden when no such point has a technique. The dashboard ranks 5 techniques; the judoka season profile keeps 3.
- **DASH-023**: A statistics loading failure shall never be shown as "Aucun combat trouvé". It shows "Statistiques indisponibles pour le moment." (or, offline, that statistics need a connection) with a "Réessayer" action, and keeps the last statistics displayed.
- **DASH-024** (SIMPL-3): The dashboard shows no separate Ippon section, no score holding (who scores first, leading, trailing), no discipline (shidos, Hansoku-make defeats) and no count of distinct winning techniques. An Ippon ending is read in "Comment on gagne" and a Hansoku-make in the endings.
- **DASH-028**: When the filters set both a start and an end date, select no competition and span at most one year, the server also computes the same statistics over the same date window one year earlier (same club and age category) and returns them as `previous`, unless that period has no participation or fewer than 2 judokas (DASH-027). The read stays a single call: the data function receives the start date pushed back one year and the split is done in TypeScript. The "Combats", "Victoires" and "Podiums" tiles show the signed difference (`+12 combats`, `−2 podiums`; the "Victoires" difference is in rate points only when both periods have at least 5 combats, otherwise in victories), without any judgement colour, and a line recalls the compared period. The previous period is shown on these three tiles only, never line by line (SIMPL-3).
- **DASH-029** (SIMPL-3): Under the synthesis sentence, one line gives without any judoka name the engaged judokas (distinct judokas with at least one combat) and the combats per engaged judoka, with one decimal: `12 judokas engagés · 10,0 combats par judoka`. It shows neither gender nor garde.
- **DASH-030** (MULTI-6): On "Tous mes clubs" of a coach of several clubs, a "Par club" section, after "Par niveau", gives each club its engaged judokas, past participations, combats, victories and podiums; a result counts for the club of its club competition (CLUB-003a). A club under 2 judokas (DASH-027) is listed with "moins de 2 judokas" and no figure; a victory rate needs 5 combats (DASH-011). The section is absent when one club is chosen, for a coach of a single club, and from statistics opened from a club competition. The response field is `byClub` (null otherwise); `getCoachDashboard` keeps its 3 Supabase requests (PERF-009).
- **DASH-026**: Outside a judoka's own profile, statistics shall carry no information specific to one judoka: no identity, no judoka identifier, no opponent name, no line per judoka. This applies to the "Stats" tab, "Statistiques de la compétition" and the MCP `coach.dashboard` tool, which returns the same response. A judoka's record is read on their profile, from the "Judokas" tab.
- **DASH-027**: Group statistics require at least 2 judokas: those with a combat in the filtered scope or, when the scope has no combat, the owners of its competitions. Below this threshold, the server returns no statistics, only the number of combats and competitions, and the tab shows "Trop peu de judokas pour des statistiques de groupe." with a "Voir les judokas" action. The rule is applied server-side, so it also covers the MCP tool.
- **DASH-031**: The statistics screen starts with the title « Statistiques » and, beside it, one pill summarising the active filters (club, category, period, chosen competitions; « Tous mes clubs, toutes catégories » when none). Touching the pill shows or hides the filters; they are hidden when the screen opens.
- **DASH-032**: Under the three key figures (the victory rate in green), one bar shows the victories, draws and defeats of the filtered combats, each segment sized by its count and labelled « N V », « N N », « N D ».
- **DASH-033**: « Comment on gagne » and « Comment on perd » show their total in the heading (« · 24 victoires ») and each ending on one line: label, bar, count; victory bars are green, defeat bars dark.

### 3.11 Internal MCP access rules

- **MCP-001**: The application shall expose a remote MCP server usable by standard MCP clients (e.g. Claude Desktop, Claude.ai connectors), open to any authenticated Ayumi user (`COACH`, `ADMIN`, `PARENT`, `JUDOKA`).
- **MCP-002**: The remote MCP endpoint shall implement the MCP JSON-RPC 2.0 wire protocol, including the `initialize` handshake, so that standard MCP clients can connect without bespoke client code.
- **MCP-003**: MCP clients shall authenticate via an OAuth 2.1 authorization-code flow with mandatory PKCE (S256); the authorization step shall delegate to the existing Google/Supabase login rather than a separate credential.
- **MCP-004**: The OAuth authorization server shall support unauthenticated discovery (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`) and Dynamic Client Registration so that MCP clients can connect without manual configuration.
- **MCP-005**: The backend shall mint a short-lived Ayumi-signed JWT MCP access token derived from the authenticated Ayumi user instead of exposing the Supabase session token directly to MCP clients.
- **MCP-006**: The JWT MCP access token shall expire after a short duration and shall encode only scopes from the fixed Ayumi MCP scope vocabulary assigned at mint time for the caller's Ayumi role: full read/write sports scopes for `COACH`, access-governance scopes only for `ADMIN` with no judoka/competition/combat data scopes, and judoka/competition/combat read-write scopes limited to the caller's own perimeter (no club-wide dashboard access) for `PARENT` and `JUDOKA`.
- **MCP-007**: The remote MCP endpoint shall enforce the minted JWT MCP access token scopes on each request and shall expose only callable tools in `tools/list`, so a `PARENT` or `JUDOKA` caller can only read or write competitions/combats within their own managed scope and cannot reach the club-wide coach dashboard, and an `ADMIN` caller cannot reach judoka, competition, or combat data through MCP.
- **MCP-008** (MULTI-7): For a coach, `clubs.list` returns their clubs (`clubId`, `name`); it requires the coach dashboard scope, so parents and judokas do not see it. `judokas.search` and `competitions.search` accept a `clubId` filter and give each result its `clubId` and `clubName`; a judoka matches the filter of each of their clubs and also gives `clubIds` (their clubs coached by the caller) (a competition belongs to the club of its club competition, CLUB-003a). `coach.dashboard` accepts exactly the screen filters (DASH-002): `clubId`, `dateFrom`, `dateTo`, `ageCategory`, `competitionIds`. A club the coach does not coach is refused (CLUB-005). `competitions.save` only updates an existing competition (COMP-006).

### 3.12 FFJDA agenda rules

- **AGD-001**: Only a `COACH` opens « Agenda FFJDA », from the « Agenda » tab (UIX-016); it is no longer in the account menu. Other profiles see no tab nor entry, and the server refuses `getFfjudoEvents` to them with « Accès refusé. ».
- **AGD-002**: The agenda never edits its events and keeps no link to a competition. It only offers to create a club competition from a competition event (AGD-018).
- **AGD-003**: The agenda lists the upcoming events (start date today or later, Paris time), sorted by start date then title, grouped by month.
- **AGD-004**: The agenda covers the national agenda of ffjudo.com and the events published by the Pays de la Loire, Bretagne and Nouvelle-Aquitaine ligue sites, which also relay other ligues' events.
- **AGD-005**: An event seen on several sites is listed once.
- **AGD-006**: Each card shows the date (or date range) with its weekday (AGD-017), title, town (or place), type, organiser with its ligue, the registration closing (AGD-014), and a « ffjudo.com » link opening the source page in a new tab. The date sits in a tile on the left (weekday above the day number); a range adds « → » and its end date (AGD-021).
- **AGD-007**: The agenda filters by ligue, type and month, combined, in the browser. A committee belongs to the ligue of its department; national federation events belong to `National`; an unknown organiser belongs to `Autre`; an event without type is `Non renseigné`.
- **AGD-008**: The heading shows « Mis à jour le dd/mm/yyyy à hh:mm » for the last successful synchronisation, or « Pas encore synchronisé ».
- **AGD-009**: States: loading « Chargement de l'agenda… » ; no event « Aucun événement à venir. » (filters hidden) ; no match « Aucun événement pour ces filtres. » with « Effacer les filtres » ; failure « Impossible de charger l'agenda. » with « Réessayer » ; offline without a list loaded in the session « L'agenda n'est pas disponible hors connexion. ».
- **AGD-010**: The agenda never stores or shows organisers' contact details (name, phone, e-mail) nor the FFJDA level code.
- **AGD-011**: The agenda is synchronised once a week (Monday). A source that fails keeps its events from the previous synchronisation; an upcoming event that disappeared is removed only when every site that listed it was read successfully.
- **AGD-012**: A grade session's UVs are read in its title: `UV` followed by its number, including chained lists (`UV1/2/3b`, `UV1-UV2`, `UV 1`); for a `PASSAGE DE GRADE` event, `TEC`, `test efficacité combat` and `shiai` also mean `UV3`. Only `PASSAGE DE GRADE` events and titles naming a UV are read; a title containing `stage` (preparation session) carries no UV; a title without a recognizable UV carries none and stays reachable through the type filter.
- **AGD-013**: The agenda offers four toggle buttons « UV1 » to « UV4 » under « Passages d'UV ». Toggling several keeps only the sessions offering all toggled UVs (UV1 + UV2: sessions where both can be passed); the toggles combine with the other filters and « Effacer les filtres » clears them. Each session card shows its UVs (`UV1 · UV2 · UV3`).
- **AGD-014**: While the registration closing date is today or later, the card shows « Inscriptions jusqu'au jj/mm ». Once it is past, the card shows « Inscriptions closes », in muted italic text, not as an alert. Without a known closing date, nothing is shown.
- **AGD-015**: A session with UVs shows the targeted dans (1 to 6) read in its title, before its UVs: `1er dan · UV1 · UV2`, `1er/2e dan · UV1`, `1er au 4e dan · UV3` (three or more consecutive dans). Recognized forms: `1ER DAN`, `2EME`/`2E`/`2IEME DAN`, lists joined by `/`, `,`, `&`, `+`, `-` or `ET`, ranges `DU 1ER AU 4EME DAN` and `1ER A 4EME DAN`, `1D`, and `SHODAN` to `ROKUDAN`. A title without a recognizable dan shows none; nothing is guessed.
- **AGD-016**: When at least one UV is toggled, the `PASSAGE DE GRADE` events without a recognized UV that match the other filters are counted under the list: « 2 passages de grade sans UV renseignée », with « Afficher ». « Afficher » lists them in an « UV non renseignées » group after the months, without untoggling the UVs. Untoggling every UV or « Effacer les filtres » hides the group again.
- **AGD-017**: Card dates show the short weekday: `sam. 28/11`, `sam. 28/11 → dim. 29/11`.
- **AGD-018**: A card whose type is « Compétition » offers « Créer la compétition ». It opens « Nouvelle compétition » prefilled with the event title, in normal case (AGD-022), as name and its start date; every field stays editable and nothing is saved before « Enregistrer ». Other types (grade session, stage, training, kata, unknown) offer no button. Leaving the form returns to the agenda; an untouched prefilled form leaves without confirmation. The created club competition keeps no link to the event, so one event can give one club competition per age category.
- **AGD-019**: The prefilled level comes from the organiser: a « Comité » gives `Départemental`, a « Ligue » gives `Régional`, the federation (or the national agenda without organiser) gives `National`. Any other organiser leaves the level empty.
- **AGD-020**: The prefilled age category is the one named by the title (Poussinet, Poussin, Benjamin, Minime, Cadet, Junior, Senior or Vétéran, masculine, feminine or plural), only when the title names exactly one. Otherwise the coach chooses it. Age codes such as `U15` are not read.
- **AGD-021**: Under the title « Agenda FFJDA » and its last update, each active filter (ligue, type, month, UVs) shows as a pill next to a « Filtres » button. The button opens or folds the filter panel (UV1 to UV4, ligue, type, month, « Effacer les filtres »), folded when the agenda opens. The registration closing is a pill: yellow while open, muted once closed. « Créer la compétition » is the card's main button.
- **AGD-022**: Titles, towns and organisers written in capitals are shown in normal case: small words (de, du, la…) in lower case, other words capitalised. Words already in mixed case stay as they are; acronyms with digits (CD56, UV2) and FFJDA, FFJ, UV, TEC, CD stay in capitals.

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
- **AC-013**: Given a coach opens the club competition creation form, when the form is displayed, then the competition date is prefilled with the current day.
- **AC-014**: Given a user creates or edits a competition, when the form is displayed, then no ranking field is shown.
- **AC-015**: Given a user wants to set a final ranking, when they open the finalization screen, then only the ranking field is available (not accessible from the edit form).
- **AC-016**: Given a user typing combat details, when saving the combat, then they can optionally write any text in the notes field (e.g., "Perdu par Ippon sur Uchi-Mata").
- **AC-017**: Given a connected `COACH`, when they create a club competition with selected judokas, then one club event and one linked individual competition per selected judoka are created.
- **AC-018**: Given a connected `COACH` selects `Minime` on the club competition creation form, when they choose participants, then only judokas with the `Minime` age category are selectable.
- **AC-019**: Given a linked participation, when the concerned judoka or parent updates combats or ranking, then only that participation is modified.
- **AC-020**: Given a coach removes a participant from a club competition that has not started yet, when the operation succeeds, then that judoka's individual competition and its combats are permanently deleted.
- **AC-021**: Given a coach attempts to remove a participant with a combat or a ranking from a club competition whose date is today or in the past, when the request is processed, then it is rejected and the participant stays linked.
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

### Example: coach creates a club competition
- the coach chooses the club (several clubs only), name, date, age category, level and participants;
- the coach does not enter a final ranking during creation;
- each participant gets an individual competition, shown in their profile sorted by date descending.

### Edge case: parent tries to save for an unmanaged judoka
- the selected owner is outside the parent's managed scope;
- the request is rejected explicitly;
- no competition is created or modified.

## 6. Related Specifications / Further Reading

- `docs/spec-tech.md` - technical constraints, architecture, interfaces, and validation rules
