---
title: Kiroku Product Requirements Document
version: 1.1
date_created: 2026-06-17
last_updated: 2026-06-18
owner: competitions-judo
tags:
  - product
  - prd
  - vision
---

# PRD - Kiroku

This document is the canonical product-vision entry point for Kiroku: why it exists, the product principles it follows, and what is deliberately out of scope. It does not enumerate feature-level requirements — those are ID-tagged and kept current in `docs/spec.md` (`REQ-*`, `COMP-*`, `CBT-*`, `CHD-*`, `STA-*`, `AUTH-*`, `UIX-*`, `DASH-*`, `MCP-*`, `AC-*`) and `docs/spec-tech.md` (`ARC-*`, `VCL-*`, `DAT-*`, `AUTH-*`, `SEC-*`, `CFG-*`), which are the source of truth for implementation and are updated per change, as described in `AGENTS.md`.

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

## Implementation Decisions

- The frontend is a mobile-first single-page app shell, with views progressively migrated to Vue 3, served without a build step at runtime and assembled from per-view partials.
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

- This PRD replaces `docs/produit.md` as the canonical product-vision document. The detailed, ID-tagged functional rules (`REQ-*`, `COMP-*`, `CBT-*`, `CHD-*`, `STA-*`, `AUTH-*`, `UIX-*`, `DASH-*`, `MCP-*`, `AC-*`) live in `docs/spec.md`, and the detailed technical contracts (`ARC-*`, `VCL-*`, `DAT-*`, `AUTH-*`, `SEC-*`, `CFG-*`) live in `docs/spec-tech.md`. Both remain the source of truth consulted and updated per `AGENTS.md`'s workflow for any change touching business rules or architecture; this PRD is not, and intentionally does not duplicate them feature-by-feature.
- The initial ADMIN seed account is `mehdi.elkouhen@gmail.com` (Mehdi EL KOUHEN), seeded on fresh deployments.
- MVP success is measured operationally: a parent can log a competition and 3 combats from the stands in under 3 minutes; a coach can see the weekend's full club results in 2 clicks the following Monday or at the dojo; submitted combat volume grows weekly without coach intervention.
