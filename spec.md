---
title: Kiroku Functional Specification
version: 1.0
date_created: 2026-06-11
last_updated: 2026-06-11
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
- let parents manage linked child judokas;
- enforce role-based visibility and actions;
- keep the experience clear and usable on mobile devices.

This specification covers:

- roles and permissions;
- competition rules;
- combat rules;
- child management rules;
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
| Parent | A user profile allowed to manage linked child judokas. |
| Admin | A user profile with full access to club data. |
| Competition | An event linked to one judoka and containing zero or more combats. |
| Combat | A single match linked to one competition and one judoka. |
| Mobile first | Design approach where the small-screen layout is the base layout. |

## 3. Functional Requirements, Constraints & Guidelines

### 3.1 Product goals

- **REQ-001**: The system shall allow tracking competitions and combats for judokas.
- **REQ-002**: The system shall enforce access rules based on the connected user's role.
- **REQ-003**: The system shall avoid orphaned functional data after deletions.
- **GUD-001**: The interface should remain compact, tactile, and readable on mobile devices.

### 3.2 Roles and access model

- **ROL-001**: A `JUDOKA` profile can access only its own competitions and combats unless admin rights are granted.
- **ROL-002**: A `PARENT` profile can access its own data and the data of linked child judokas unless broader admin rights are granted.
- **ROL-003**: An `ADMIN` right grants access to all data independently of the underlying `JUDOKA` or `PARENT` profile type.
- **ROL-004**: A user invited as `PARENT` keeps that profile type after registration.
- **ROL-005**: A user invited as `JUDOKA` keeps that profile type after registration.
- **ROL-006**: Admin rights may still be granted or revoked later without changing the underlying `JUDOKA` or `PARENT` profile type.

### 3.3 Competition rules

- **COMP-001**: A `JUDOKA` can create, update, and delete only their own competitions.
- **COMP-002**: A `PARENT` can create, update, and delete only competitions belonging to themselves or managed judokas.
- **COMP-003**: An `ADMIN` can create, update, and delete any competition.
- **COMP-004**: Competition lists shall be sorted by date descending.
- **COMP-005**: A competition must include a name and a date.
- **COMP-006**: A competition shall expose an age category and a weight category.
- **COMP-007**: A competition shall not use a location field.
- **COMP-008**: A competition shall not use an actual weigh-in field.
- **COMP-009**: A competition may store a final ranking or result used for season statistics.
- **COMP-010**: For `ADMIN`, the owner judoka must be selected explicitly before save.
- **COMP-011**: For `PARENT`, saving a competition for a judoka outside the managed scope must be rejected.
- **COMP-012**: Deleting a competition shall remove all linked combats from the user's perspective.
- **COMP-013**: When opening the competition creation form, the date field shall be initialized to the current day by default.
- **COMP-014**: Competition creation and main editing shall not ask for the final ranking.
- **COMP-015**: Final ranking shall be entered from a dedicated competition finalization action.
- **COMP-016**: Final ranking values shall be limited to supported ranking results: `1er`, `2e`, `3e`, `5e`, `7e`, or `Non classé`.

### 3.4 Combat rules

- **CBT-001**: A `JUDOKA` can create, update, and delete only their own combats.
- **CBT-002**: A `PARENT` can create, update, and delete only combats belonging to themselves or managed judokas.
- **CBT-003**: An `ADMIN` can create, update, and delete any combat.
- **CBT-004**: A combat must include a parent competition, a judoka, and a result.
- **CBT-005**: A combat may include an opponent name, a decision type, and match notes.
- **CBT-006**: Deleting a combat shall not delete its parent competition.

### 3.5 Child management rules

- **CHD-001**: Only `PARENT` users can manage children from a dedicated screen.
- **CHD-003**: Creating a child requires both first name and last name.
- **CHD-004**: A child with at least one competition cannot be deleted.
- **CHD-005**: A child with at least one combat cannot be deleted.
- **CHD-006**: If a removed child has no direct account, no other parent link, and no sports data, the child profile shall be fully removed.
- **CHD-007**: Otherwise only the parent-child link shall be removed.
- **CHD-008**: Non-admin users may assign or update an optional child email to let that child log in with Google and access only their own judoka data.

### 3.6 Judoka season statistics rules

- **STA-001**: The application shall provide a dedicated judoka profile view.
- **STA-002**: The judoka profile shall display the judoka category derived from the latest combat.
- **STA-003**: The judoka profile shall display the three best competition results of the displayed season.
- **STA-004**: The season shall run from September 1st to August 31st.
- **STA-005**: The judoka profile shall display the number of competitions for the displayed season.
- **STA-006**: The judoka profile shall display the number of combats for the displayed season.
- **STA-007**: The judoka profile shall display the victory/loss distribution for the displayed season.
- **STA-007a**: The displayed season shall use the current season when the judoka has competitions in it, otherwise it shall fall back to the most recent season containing competition data for that judoka.
- **STA-008**: A `JUDOKA` shall be able to open only their own judoka profile from home.
- **STA-009**: A `PARENT` shall be able to open their own judoka profile and the profiles of linked children only.
- **STA-010**: An `ADMIN` shall be able to open the judoka profile of any judoka.

### 3.7 Authentication behavior

- **AUTH-001**: The application shall provide Google login.
- **AUTH-002**: The application shall keep the connected session after the OAuth callback.
- **AUTH-003**: Application permissions shall come from the Kiroku user role, not from the Google account itself.
- **AUTH-004**: The login UI shall not expose password login.
- **AUTH-005**: The login UI shall not expose magic-link login or signup.
- **AUTH-006**: The connected header shall show user identity and provide an explicit logout action.
- **AUTH-007**: A child profile with a direct account email shall be able to log in through Google and be treated as a `JUDOKA` limited to their own data.
- **AUTH-008**: A user without an existing judoka profile or an active invitation shall not be allowed to create an account in the application.
- **AUTH-009**: An `ADMIN` shall be able to manage pending access invitations from the dedicated admin screen.
- **AUTH-010**: Each invitation shall define the target profile type among `PARENT` or `JUDOKA`.
- **AUTH-011**: The initial profile created after invitation shall use the invited profile type.
- **AUTH-012**: The underlying `JUDOKA` or `PARENT` profile type shall not be changed automatically after registration.
- **AUTH-013**: Admin elevation shall be managed separately from the invitation flow.

### 3.8 UI and UX rules

- **UIX-001**: The application shall be mobile first.
- **UIX-002**: Lists and forms shall remain separated.
- **UIX-003**: Main actions shall be visible, tactile, and explicit.
- **UIX-004**: The UI shall provide loading, empty, error, and success states.
- **UIX-005**: Deletions shall require explicit confirmation.
- **UIX-006**: After create or update operations, the application shall refresh relevant data and display the affected item.
- **UIX-007**: Action labels shall stay textual and explicit on mobile, not icon-only.
- **UIX-008**: Desktop-specific layout shall be a progressive enhancement over the small-screen baseline.
- **UIX-009**: The judoka profile view shall remain readable and actionable on mobile.
- **UIX-010**: For `PARENT` and `ADMIN`, the home screen shall be organized around an active judoka context.
- **UIX-011**: Home actions for opening a profile or adding a competition shall target the active judoka rather than a generic role-based menu.
- **UIX-012**: The judoka profile view should visually emphasize performance through a dedicated summary hero and highlighted season statistics.
- **UIX-013**: Competition and season results should use distinct visual badges and lightweight motion cues while remaining readable on mobile.
- **UIX-014**: User notifications should be displayed through toast notifications so the current screen remains readable while the message stays explicit.

## 4. Acceptance Criteria

- **AC-001**: Given a connected `JUDOKA`, when initial data is loaded, then only that user's competitions are visible.
- **AC-002**: Given a connected `PARENT`, when initial data is loaded, then competitions for the parent and linked children are visible, and no unrelated data is visible.
- **AC-003**: Given a connected `ADMIN`, when initial data is loaded, then all competitions are visible.
- **AC-004**: Given an admin saving a competition without selecting an owner judoka, when the request is processed, then the save is rejected.
- **AC-005**: Given a parent attempting to save a competition for an unmanaged judoka, when the request is processed, then the save is rejected.
- **AC-006**: Given a competition save request missing name or date, when the request is processed, then the save is rejected.
- **AC-007**: Given a combat create request missing competition, judoka, or result, when the request is processed, then the save is rejected.
- **AC-008**: Given a competition deletion, when the operation succeeds, then no linked combat remains accessible.
- **AC-009**: Given a combat deletion, when the operation succeeds, then the parent competition still exists.
- **AC-010**: Given a connected `PARENT` opening child management, when the screen loads, then the user can create, update, or remove managed children.
- **AC-011**: Given a child with competitions or combats, when deletion is attempted, then the operation is rejected with an explicit error.
- **AC-012**: Given a `PARENT` creates a first child, when the operation succeeds, then the user's profile type remains `PARENT`.
- **AC-013**: Given a `PARENT` removes the last linked child, when the operation succeeds, then the user's profile type remains `PARENT`.
- **AC-014**: Given a user reaching the login screen, when authentication options are displayed, then only Google login is available.
- **AC-015**: Given a connected session, when the app header is rendered, then user identity is displayed and a logout button is available.
- **AC-016**: Given the mobile layout, when primary actions are displayed, then controls remain textual, touch-friendly, and visible.
- **AC-017**: Given a parent sets an email on a child profile, when that child logs in with the same Google account, then only that child's profile, competitions, and combats are visible.
- **AC-018**: Given a Google account without judoka profile and without active invitation, when initial access is checked, then profile creation is rejected with an explicit invitation-required message.
- **AC-019**: Given an admin creates an invitation for a new email and a target profile type, when that invited user logs in, then profile creation is allowed exactly for that invited email and invited type.
- **AC-021**: Given an admin grants or revokes admin rights, when the request succeeds, then the user's `JUDOKA` or `PARENT` profile type remains unchanged.
- **AC-020**: Given an application notification on the current screen, when the UI reports it, then the message is shown as a dismissible toast without shifting the main screen layout.
- **AC-022**: Given a user opens the competition creation form, when the form is displayed, then the competition date is prefilled with the current day.
- **AC-023**: Given a user creates or edits a competition, when the form is displayed, then no ranking field is shown.
- **AC-024**: Given a user can edit a competition, when they finalize it, then only the ranking/result is entered and saved.

## 5. Examples & Edge Cases

### Example: admin creates a competition

- the admin selects a judoka owner;
- the admin enters a competition name and date;
- the admin does not enter a final ranking during creation;
- the created competition appears in descending date order after refresh.

### Edge case: parent tries to save for an unmanaged judoka

- the selected owner is outside the parent's managed scope;
- the request is rejected explicitly;
- no competition is created or modified.

### Edge case: child deletion

- if the child has at least one competition, deletion is rejected;
- if the child has at least one combat, deletion is rejected;
- if the child has no direct account, no other parent, and no sports data, the child profile is fully removed;
- otherwise only the parent-child link is removed.

## 6. Related Specifications / Further Reading

- `SPEC-TECH.md` - technical constraints, architecture, interfaces, and validation rules
