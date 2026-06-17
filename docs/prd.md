---
title: Kiroku Product Requirements Document
version: 1.0
date_created: 2026-06-17
last_updated: 2026-06-17
owner: competitions-judo
tags:
  - product
  - prd
  - vision
---

# PRD - Kiroku

This document is the canonical product-vision and requirements entry point for Kiroku. It replaces the former `docs/produit.md`. Detailed, ID-tagged functional rules continue to live in `docs/spec.md` (`REQ-*`, `COMP-*`, `CBT-*`, `STA-*`, `AUTH-*`, `UIX-*`, `AC-*`), and detailed technical contracts continue to live in `docs/spec-tech.md` (`ARC-*`, `VCL-*`, `DAT-*`, `AUTH-*`, `SEC-*`, `CFG-*`). Both remain the source of truth for implementation and are updated per change, as described in `AGENTS.md`.

## Problem Statement

In a judo club, competition results are scattered and easily lost: text messages between parents, fading memories, misplaced pool sheets. The coach rarely has time to centralize this information, which leaves key questions unanswered during training:

- How many competitions has this judoka entered this season?
- What is their win/loss ratio over their last few tournaments?
- Are their losses tied to specific technical weaknesses or repeated mistakes?
- What feedback should be shared with the judoka to help them progress?

The coach is the one who needs this information most, but is the least available to type it in. Parents and judokas are present at competitions and willing to log results, but only if doing so is fast enough to fit between matches in the stands.

## Solution

Kiroku is a mobile-first competitive tracking notebook for a judo club, fed by families and consulted by the coach. It gives the coach an instant, centralized view of a judoka's competitive history, progression pace, and fighting profile, without imposing any administrative entry burden on them.

Core product principles:

- **Zero mandatory coach input**: the product must remain useful even if the coach only ever reads it.
- **Asynchronous entry by family**: a parent (or the judoka) creates the competition and logs combats from their child's or their own space.
- **Minimal entry friction**: the combat entry form must be simple enough for a non-judoka parent to fill out unaided.
- **Online-first for the MVP**: the application requires network connectivity; offline support is explicitly deferred.

The product is built around two primary views:

1. **Judoka Profile (Coach/Family view)**: a per-season performance aggregator (number of combats, win/loss ratio, competition history).
2. **Club Competition Dashboard (Coach view)**: for a given event (e.g. *Interclubs de Nantes*), the full set of results entered by club families for that competition.

Primary usage loop:

1. **Entry**: a parent creates a competition and logs their child's combats, one at a time.
2. **Aggregation**: the system automatically updates the relevant judoka's profile and feeds the global Competition view.
3. **Consultation**: the coach opens Kiroku to debrief the weekend or prepare a class.
4. **Feedback**: the coach and judoka discuss concrete data on the mat.

What Kiroku is not:
- A club administration tool (memberships, dues, attendance).
- A social network or video analysis tool.
- A messaging system.

## User Stories

### Roles and access

1. As a JUDOKA, I want to see only my own competitions, combats, and statistics, so that my data stays private from other club members.
2. As a PARENT, I want to access and edit data for my linked children, so that I can record their competition results on their behalf.
3. As a COACH, I want read access to all judokas, competitions, and stats in the club, so that I can review the whole club's performance without administrative overhead.
4. As a COACH, I want to manage club competition events and their linked sports data, so that I can organize and track team participation in tournaments.
5. As an ADMIN, I want to manage access invitations and structural roles, so that I can control who joins the club's tracker without taking on sports management duties.
6. As a user invited as PARENT or JUDOKA, I want my underlying profile type to stay fixed after registration, so that the system's permission model remains predictable.
7. As a COACH or ADMIN, I want my elevated rights granted on top of my existing account, so that I don't lose my original profile type when I take on club responsibilities.

### Competitions

8. As a JUDOKA or PARENT, I want to create, update, and delete competitions within my own scope, so that I can keep my child's or my own competition history accurate.
9. As a PARENT or JUDOKA, I want the system to detect duplicate competitions (same name/date) in the club, so that I don't accidentally create redundant entries.
10. As a COACH, I want a global Competition Dashboard aggregating all judokas who participated in the same event, so that I can review the whole club's weekend results at once.
11. As a user, I want competition lists sorted by date descending, so that I see the most recent events first.
12. As a user, I want to be required to enter a name and date when creating a competition, so that every competition record is identifiable.
13. As a user, I want to choose an age category and a weight category for a competition, so that results can be compared with peers later.
14. As a user, I want competitions to skip location and actual weigh-in fields, so that data entry stays fast and minimal.
15. As a JUDOKA or PARENT, I want all combats tied to a competition removed automatically when I delete that competition, so that I don't end up with orphaned combat records.
16. As a user, I want the competition creation form's date to default to today, so that I can fill it out quickly during a competition.
17. As a user, I want competition creation to skip the final ranking field, so that I'm not forced to know the outcome before the event ends.
18. As a user, I want a dedicated finalization screen for entering the final ranking, so that the ranking is recorded once results are known.
19. As a user, I want ranking options limited to 1er/2e/3e/5e/7e/Non classé, so that I can record results quickly without typing free text.
20. As a user, I want an optional level field (Départemental/Régional/National/International) on a competition, so that I can capture the competitive stakes when known.
21. As a COACH, I want to create a club competition event and assign judokas as participants, so that I can track team-wide participation in one tournament.
22. As a COACH, I want assigning a judoka to a club competition to automatically create their individual competition participation, so that I don't have to enter the same competition twice.
23. As a JUDOKA or PARENT, I want a club-linked participation to remain visible and editable in my individual competition history, so that I keep one consistent place to manage my results.
24. As a COACH, I want removing a judoka from a club competition to only detach the club link, so that the judoka's individual competition, combats, and ranking are preserved.
25. As a JUDOKA or PARENT, I want to still create individual competitions outside of any club event, so that I can track competitions the coach didn't organize.
26. As a COACH, I want deleting a club competition to cascade to every linked individual participation and its combats, so that cleaning up a cancelled or duplicated club event is a single action.
27. As a COACH, I want to see each participant's current final ranking on the club competition detail screen, so that I can see standings at a glance.
28. As a COACH, I want the participant list to stay hidden until I pick an age category, and then show only judokas in that category, so that I don't have to scroll through irrelevant judokas.

### Combats

29. As a JUDOKA or PARENT, I want to manage combats within my own scope, so that I can record my own or my child's matches.
30. As a COACH, I want to manage combats for club competition participations, so that I can fill in results I witnessed directly.
31. As a user, I want every combat to require a parent competition, a judoka, and a result, so that incomplete combat records can't be saved.
32. As a user, I want to optionally add an opponent name and free-text match notes to a combat, so that I can capture technical context (e.g. "Lost by Ippon on Uchi-Mata").
33. As a user, I want combat results limited to Victoire/Défaite/Egalité, so that statistics stay consistent across the club.
34. As a user, I want technical details captured as free text rather than structured scoring fields (Shido, Ippon counters), so that data entry stays simple for non-judoka parents.
35. As a user, I want deleting a combat to leave its parent competition intact, so that I don't lose competition-level data by mistake.

### Child management

36. As a PARENT, I want a dedicated screen to manage my children, so that I can add, edit, or remove the kids I track.
37. As a PARENT, I want both first and last name required when creating a child, so that every judoka profile is identifiable.
38. As a PARENT, I want the system to prevent deleting a child who has at least one competition or combat, so that I don't accidentally destroy sports history.
39. As a PARENT, I want a child with no account, no other parent link, and no sports data fully removed when I delete them, so that the system doesn't keep useless empty profiles.
40. As a PARENT, I want only the parent-child link removed when the child still has other data or links, so that shared or historical data isn't lost.
41. As a non-admin user, I want to assign or update an optional email on a child profile, so that the child can log in with Google and see only their own data.
42. As a PARENT, I want to set an age category when creating or editing a child, so that the right competition options are offered for that judoka.
43. As a COACH, I want to set or update any judoka's age category from their profile view, so that I can correct or complete data the family didn't fill in.

### Judoka season statistics

44. As a user, I want a dedicated judoka profile view, so that I can see one judoka's performance in one place.
45. As a user, I want the judoka profile to show the age category derived from the latest competition of the season, so that I don't have to track it separately.
46. As a user, I want a short list of the season's competitions with date, name, ranking, and combat record, so that I get a quick performance overview.
47. As a user, I want the season to run from September 1st to August 31st, so that statistics match the actual judo competition calendar.
48. As a user, I want to see the number of competitions and combats for the season, so that I can gauge a judoka's activity level.
49. As a user, I want to see the victory rate for the season, so that I can gauge a judoka's performance level.
50. As a user, I want the displayed season to automatically fall back to the most recent season with data if the current one is empty, so that the profile is never blank for an active judoka.
51. As a user, I want a combat profile summary based on Victory/Loss/Equality ratios and notes insights, so that I get qualitative context beyond raw numbers.
52. As a user, I want distinct ranking badges for podium, top-5, and non-classed results (gold/silver/bronze for 1st-3rd), so that I can scan results visually.
53. As a JUDOKA, I want to open only my own judoka profile from home, so that I land directly on relevant data.
54. As a PARENT, I want to open my own profile and my linked children's profiles, so that I can check on the whole family from one place.
55. As a COACH, I want to open the judoka profile of any judoka in the club, so that I can prepare for any student's matches.

### Authentication

56. As a user, I want to log in with Google, so that I don't need to create or remember another password.
57. As a user, I want my session to persist after the OAuth callback, so that I'm not logged out unexpectedly.
58. As a user, I want my application permissions to come from my Kiroku role rather than my Google account, so that access control stays under the club's control.
59. As a user, I want the login screen to expose only Google login (no password, no magic link), so that there's a single, simple way in.
60. As a user, I want the connected header to show my identity and an explicit logout action, so that I always know who's logged in and can leave cleanly.
61. As a child with a direct account email, I want to log in through Google and be treated as a JUDOKA limited to my own data once invited, so that I can use the app myself once I'm old enough.
62. As a user without an existing judoka profile or active invitation, I want account creation rejected, so that the club's data stays restricted to actual members.
63. As an ADMIN, I want a dedicated screen to manage pending access invitations, so that I can control who is allowed to register.
64. As an ADMIN, I want to search pending invitations by email and paginate them (5 per page), so that I can manage invitations even as the list grows.
65. As an ADMIN, I want each invitation to define a target profile type (PARENT or JUDOKA), so that the right starting permissions are set up automatically.
66. As a user, I want my initial profile to use the invited profile type, so that I don't have to configure my own role.
67. As a user, I want my underlying JUDOKA or PARENT type to never change automatically after registration, so that my access model stays stable over time.
68. As an ADMIN, I want admin and coach elevations managed separately from the invitation flow, so that granting sports oversight doesn't require re-inviting someone.

### UI and UX

69. As a mobile user, I want the application designed mobile-first, so that I can use it comfortably from my phone in the stands or on the mat.
70. As a user, I want lists and forms kept in separate views, so that I'm not overwhelmed by long scrolling screens.
71. As a user, I want main actions visible, tactile, and explicit, so that I can act quickly without hunting for tiny controls.
72. As a user, I want clear loading, empty, error, and success states, so that I always know what the application is doing.
73. As a user, I want deletions to require explicit confirmation, so that I don't lose data with an accidental tap.
74. As a user, I want the app to refresh and display the affected item after a create or update, so that I get immediate confirmation my action worked.
75. As a mobile user, I want action labels to stay textual rather than icon-only, so that I'm never unsure what a button does.
76. As a desktop user, I want the desktop layout to be a progressive enhancement of the mobile baseline, so that I'm not given a degraded experience on a bigger screen.
77. As a PARENT, I want my home screen organized around an active child judoka context, so that I act on the right child's data by default.
78. As a COACH, I want my home screen to expose the global Club Competition Dashboard, so that I can review weekend results immediately after logging in.
79. As an ADMIN, I want my home screen to expose access governance without sports management actions, so that I'm not tempted to act outside my role.
80. As a user with an underlying JUDOKA profile, I want that judoka selected by default as my active context, so that I don't need to pick myself from a list every time.
81. As a user, I want the judoka profile to visually emphasize performance through a summary hero and highlighted stats, so that I immediately see what matters.
82. As a user, I want competition and season results to use distinct badges and lightweight motion cues, so that the screen stays both readable and engaging.
83. As a user, I want notifications shown as toasts rather than blocking the screen, so that I keep working while staying informed.

## Implementation Decisions

- The frontend is a mobile-first single-page app shell, with views progressively migrated to Vue 3, served without a build step at runtime and assembled from per-view partials.
- The backend is a serverless RPC surface: a single endpoint executes authenticated business methods; app-shell serving and routing are handled separately from that RPC endpoint.
- Backend code separates shared auth/runtime composition, the domain model (entities, value objects, business policies), application services (use-case orchestration), and repositories (persistence adapters), so business rules don't leak into persistence or transport code.
- Domain objects never serialize themselves to persistence records; translating between domain objects and stored records is a repository responsibility.
- Business identifiers are text-based, to support import from the club's pre-existing spreadsheet records. Core data covers judokas, parent-child links, club competitions, individual competitions, combats, and access invitations.
- A judoka's profile type (JUDOKA/PARENT) is immutable after creation; a structural role (NORMAL/COACH/ADMIN) is layered on top and fully reversible without affecting profile type.
- Authentication is Google-only via a managed auth provider; the browser persists the session and sends bearer tokens to the backend, which verifies them against the auth provider and resolves permissions from the stored role and profile type, never from the Google account itself.
- Registration is gated by an invitation list: a server-side hook rejects signups for emails without an existing judoka record or a pending invitation, except for pre-seeded admin accounts.
- Business data is reachable only through a privileged server-side role; public and authenticated client-side roles have no direct table access, and server secrets never reach the browser.
- Season statistics are computed on a fixed September-to-August window, not the calendar year.
- The app installs as a PWA: a root-scoped service worker caches the app shell while keeping business RPC calls network-only, and calls fail explicitly (rather than silently) when offline or on a slow connection.

## Testing Decisions

- Good tests assert observable behavior — the functional rules in `docs/spec.md` and the deployment/schema contracts in `docs/spec-tech.md` — not incidental implementation structure, except where the project has deliberately chosen to lock specific source patterns (see below).
- `tests/*` holds native Node.js test automation. `tests/vercel-deployment.test.js` and `tests/mobile-first-index.test.js` are a known, deliberate exception: they assert regex patterns against the esbuild-compiled bundle and the assembled shell HTML, to prevent code-shape regressions (e.g. an accidental ternary, an over-long function, inline vs. extracted call arguments) from creeping back in. Any change to `assets/*.ts` or `assets/views/*.html` that alters a locked pattern must update the corresponding assertion in the same change.
- Domain and service-level business rules (role access, competition/combat invariants, child-deletion guards, season statistics) should be tested at the domain and service layers, independent of the auth provider or hosting transport.
- Schema and deployment expectations (routing, runtime config injection, migration shape) are validated against the actual built artifacts and SQL migration files, not mocked.

## Out of Scope

- Club administrative management (memberships/licenses, dues, attendance tracking).
- Social networking features or video analysis tooling.
- A messaging/communication system between users.
- Offline support — the MVP requires network connectivity; offline handling is deferred entirely.
- Competition location and actual weigh-in fields.
- Structured scoring detail (Shido counters, Ippon counters) — captured as free text instead.
- Storing judoka birth years (a deliberate privacy decision).
- Password-based and magic-link authentication.

## Further Notes

- This PRD replaces `docs/produit.md` as the canonical product-vision document. The detailed, ID-tagged functional rules (`REQ-*`, `COMP-*`, `CBT-*`, `STA-*`, `AUTH-*`, `UIX-*`, `AC-*`) continue to live in `docs/spec.md`, and the detailed technical contracts (`ARC-*`, `VCL-*`, `DAT-*`, `AUTH-*`, `SEC-*`, `CFG-*`) continue to live in `docs/spec-tech.md`. Both remain the source of truth consulted and updated per `AGENTS.md`'s workflow for any change touching business rules or architecture.
- The initial ADMIN seed account is `mehdi.elkouhen@gmail.com` (Mehdi EL KOUHEN), seeded on fresh deployments.
- MVP success is measured operationally: a parent can log a competition and 3 combats from the stands in under 3 minutes; a coach can see the weekend's full club results in 2 clicks the following Monday or at the dojo; submitted combat volume grows weekly without coach intervention.
