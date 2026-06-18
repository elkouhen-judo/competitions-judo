---
title: Kiroku Domain-Driven Design Model
version: 1.0
date_created: 2026-06-17
last_updated: 2026-06-17
owner: competitions-judo
tags:
  - ddd
  - domain-model
  - architecture
---

# DDD Model - Kiroku

This document describes Kiroku's domain model using Domain-Driven Design (DDD) vocabulary: ubiquitous language, bounded contexts, aggregates, and the tactical patterns already embedded in `core/domain/*`, `core/services/*`, and `core/repositories/*`. It is descriptive (it documents the model that exists today) rather than aspirational, and it complements — not replaces — `docs/prd.md` (why), `docs/spec.md` (functional rules) and `docs/spec-tech.md` (technical contracts).

## 1. Domain Vision

Kiroku's reason to exist (per `docs/prd.md`) is to make a judoka's competitive history visible to their coach without asking the coach to type anything. Strategically, that places the domain into three subdomains of different value:

| Subdomain | Classification | Why |
|---|---|---|
| **Competition Tracking** (competitions, club competitions, combats) | **Core domain** | This is Kiroku's actual differentiator — the structured record of who fought whom, how, and with what result. All other capabilities exist to feed or read this data. |
| **Performance Insights** (season statistics, AI-generated analysis) | **Supporting subdomain** | Valuable to the coach and family, but derived entirely from Competition Tracking data; it could be rebuilt or swapped (e.g. a different stats engine, a different LLM provider) without changing what the product fundamentally tracks. |
| **Access & Membership** (judoka identity, roles, profile types, invitations) | **Generic subdomain** | A commodity capability (authentication, role-based access) that almost every multi-tenant club app needs; it is implemented in-house only because the scope is small, not because it is special to judo. |

This classification drives where to invest modeling effort: the **Competition Tracking** context owns the richest invariants and deserves the most design care; **Access & Membership** is kept deliberately thin (see `docs/spec-tech.md` `AUTH-*`).

## 2. Ubiquitous Language

The language below is the vocabulary actually used in code (function names, types, error messages) and in `docs/spec.md`'s functional rules. Business terms stay in French where the product already uses French (matching club vocabulary and Supabase column names); structural/technical terms stay in English.

| Term | Meaning | Bounded context |
|---|---|---|
| **Judoka** | A club member profile that owns competitions and combats. Identity (`judokaId`) never changes; `profileType` is fixed at creation. | Access & Membership |
| **Profile type** (`JUDOKA` \| `PARENT`) | The immutable underlying nature of an account: a practitioner, or a parent managing practitioners. | Access & Membership |
| **Access role** (`NORMAL` \| `COACH` \| `ADMIN`) | A reversible structural capability layered on top of a profile type. Losing the role never changes the profile type. | Access & Membership |
| **Managed judoka scope** | The set of judoka identities a `PARENT` is allowed to act on (their linked children). | Access & Membership |
| **Access invitation** | A pending, admin-issued authorization for an email to register with a given profile type. | Access & Membership |
| **Compétition** (Competition) | A single event a judoka participated in: name, date, age/weight category, level, and (once finalized) a ranking. | Competition Tracking |
| **Compétition de club** (Club Competition) | A club-wide event a coach organizes once and assigns to several judokas; spawns one individual Competition per participant. | Competition Tracking |
| **Combat** | A single match within a Competition: opponent, opponent's stance, result, decision type, winning/losing technique family, free-text notes. | Competition Tracking |
| **Classement** (Final ranking) | The competition's outcome (`1er`, `2e`, `3e`, `5e`, `7e`, `Non classé`), set only through finalization, never at creation. | Competition Tracking |
| **Finalisation** (Finalization) | The act of closing a competition by recording its final ranking; triggers analysis generation. | Competition Tracking → Performance Insights |
| **Garde de l'adversaire** (Opponent stance) | `Droitier` \| `Gaucher`, optionally recorded per combat. | Competition Tracking |
| **Catégorie de technique** (Technique category) | The family of the winning/losing technique: `Technique Avant`, `Technique Arrière`, `Contre`, `Ne waza`. | Competition Tracking |
| **Saison** (Season) | The fixed September 1 → August 31 window statistics are computed over. | Performance Insights |
| **Profil de combat** (Combat profile) | A judoka's seasonal breakdown of victories/losses by decision type (ippon, decision, penalty, forfeit). | Performance Insights |
| **Analyse IA** (AI analysis) | A short, Groq-generated French narrative attached to a finalized competition, with a self-reported confidence score. | Performance Insights |

## 3. Bounded Contexts and the Context Map

Kiroku is a single deployable (a modular monolith on Vercel + Supabase), so these are **logical**, not physically isolated, bounded contexts. They are nonetheless real: each owns its own language, invariants, and folder boundary (`core/domain/access/*` vs `core/domain/competitions/*` + `season*`).

```
 ┌─────────────────────────┐        Judoka identity, roles,        ┌──────────────────────────┐
 │   Access & Membership    │ ─────  managed-judoka scope (shared ─▶│   Competition Tracking    │
 │  (generic subdomain)      │        kernel via core/types.ts,      │      (core domain)        │
 │                           │        enforced by permission-policy) │                            │
 └─────────────────────────┘                                       └──────────────┬────────────┘
                                                                                     │ Competition + Combat
                                                                                     │ (read-only, via repositories)
                                                                                     ▼
                                                                       ┌──────────────────────────┐
                                                                       │   Performance Insights    │
                                                                       │   (supporting subdomain)   │
                                                                       │  season stats · AI analysis│
                                                                       └──────────────────────────┘
```

**Integration patterns actually in use:**

- **Shared Kernel**: `core/types.ts` defines canonical DTOs (`Judoka`, `Competition`, `Combat`, …) that all three contexts agree on. This is a deliberate, small shared kernel — acceptable because one team owns all three contexts.
- **Domain policy as a thin bridge**: `core/domain/access/permission-policy.ts` is the only module that knows about *both* a `Judoka` (Access & Membership) and a `Competition` (Competition Tracking). It is kept as pure, side-effect-free predicate functions (`canManageCompetition`, `canAccessCompetition`, `assertCan*`) precisely so neither context has to import the other's aggregates — only this policy crosses the boundary.
- **Anti-corruption / translation layer**: `core/services/domain-adapters.ts` translates Supabase's historical French snake_case rows (`id_judoka`, `categorie_age`, `garde_adversaire`, …) into the canonical camelCase domain language (`judokaId`, `ageCategory`, `opponentStance`, …) and back. This isolates every other module — domain, services, even the frontend — from the persistence model's accidental complexity.
- **Open host / single endpoint**: `/api/rpc` is the only door into all three contexts from the browser. It does no business logic itself; it dispatches by method name into the appropriate application service. A second open host, `/api/mcp` (plus its OAuth surface in `/api/mcp-oauth.js`), exposes a subset of the same application services to external MCP clients (Claude Desktop, Claude.ai connectors); it reuses the RPC method registry as its tool implementations (`core/services/mcp-server.service.ts`) rather than duplicating business logic, and layers its own scope-based authorization (`core/services/mcp-auth.service.ts`) on top of the existing `permission-policy.ts` role checks.
- **Downstream, read-only dependency**: Performance Insights never mutates Competition or Combat; it only reads them (via `competitionsRepository` / `combatsRepository`) to compute statistics or to build the Groq prompt.

## 4. Bounded Context: Access & Membership

**Purpose**: answer "who is this, and what are they allowed to touch?" — nothing about judo itself.

### Aggregates, entities, value objects

| Name | Kind | File | Notes |
|---|---|---|---|
| **Judoka** | Aggregate root (entity, identity = `judokaId`) | `core/domain/access/judoka.ts` | Owns `profileType` (immutable) and `accessRole` (mutable via `grantAdminRole()` / `revokeAdminRole()`, both invariant-checked: can't grant if already admin, can't self-revoke). |
| **PersonName** | Value object | `core/domain/access/person-name.ts` | Immutable `{firstName, lastName}` with a `displayName()` behavior; both parts required for a managed child. |
| **Email** | Value object | `core/domain/access/email.ts` | Normalizes (trim + lowercase) and validates; `createOptionalEmail` for nullable cases (a child without a direct account). |
| **ProfileType** | Value object (enum) | `core/domain/access/profile-type.ts` | `JUDOKA` \| `PARENT`, defaults to `JUDOKA`. |
| **AccessRole** | Value object (enum) | `core/domain/access/role.ts` | `NORMAL` \| `COACH` \| `ADMIN`, defaults to `NORMAL`. |
| **ManagedJudokaScope** | Value object | `core/domain/access/managed-judoka-scope.ts` | The immutable set of judoka ids a parent manages; exposes `includes()` / `toIds()`, never mutated in place. |
| **AccessInvitation** | Entity (identity = `email`) | `core/domain/access/access-invitation.ts` | A pending grant of a future profile type, created by an admin. |
| **AccessScope** | Value object (policy result) | `core/domain/access/permission-policy.ts` (`createAccessScope`) | `ALL` \| `MANAGED` \| `OWN` — the *kind* of visibility a resolved user has, with behavior (`canManageJudoka`, `visibleJudokaIds`) rather than a bare enum. This is itself a small domain concept worth a name: a **Data Visibility Scope**. |

### Domain policy (`permission-policy.ts`)

A stateless policy module, not an aggregate: `isAdmin`, `isCoach`, `isParent`, `resolveJudokaDataAccess`, `canManageCombatFor`, `canManageCompetition`, `canAccessJudokaProfile`, `canAccessCompetition`, `resolveCompetitionOwnerId`, each with an `assert*` counterpart that throws a French, user-facing message. These functions encode `docs/spec.md`'s `ROL-*` and `AUTH-*` rules as executable specifications.

### Application services (use cases)

`user-context.service.ts` (resolves "who is calling, and what can they see"), `admin.service.ts` (invitations, CSV import/account creation, admin/coach role grants, user deletion), `registration.service.ts` (turns an invitation into a `Judoka`).

### Invariants

- A judoka's `profileType` never changes after creation (`ROL-005`, `AUTH-012` in `docs/spec.md`).
- An admin cannot grant themselves admin twice, nor revoke their own admin rights (`judoka.ts`).
- A parent's visibility is strictly bounded by their `ManagedJudokaScope`; a `JUDOKA` without elevated roles only ever sees `OWN`.

## 5. Bounded Context: Competition Tracking (core domain)

**Purpose**: be the single, trustworthy record of what happened at a competition — this is the product.

### Aggregates and entities

| Name | Kind | File | Aggregate root? |
|---|---|---|---|
| **Competition** | Aggregate root (identity = `competitionId`) | `core/domain/competitions/competition.ts` | **Yes.** Owns `draft` (name, date, age/weight category, level), `result` (final ranking), and is the only path through which a `Combat` may be created (`recordCombat()`), enforcing `assertCanContainCombat()`. |
| **Combat** | Child entity (identity = `combatId`) | `core/domain/competitions/combat.ts` | No — lives inside the `Competition` aggregate's consistency boundary. `core/services/combats.service.ts` always re-loads the parent `Competition` and calls `competition.recordCombat(domainCombat)` before persisting, rather than constructing a `Combat` standalone. |
| **ClubCompetition** | Aggregate root (identity = `clubCompetitionId`) | `core/domain/competitions/club-competition.ts` | **Yes**, but it is a *coordinating* aggregate: its own invariant is only "at least one participant" (`createClubCompetitionParticipantIds`); the actual work — creating one `Competition` per participant — is a multi-aggregate process orchestrated by the `club-competitions.service.ts` application service, not by the `ClubCompetition` object itself. This is a deliberate, documented trade-off (see §8) rather than a textbook single-aggregate transaction. |

### Value objects

| Name | File | Values |
|---|---|---|
| **CombatResult** | `combat-result.ts` | `Victoire` \| `Défaite` \| `Egalité` (with legacy `V`/`D`/`E` alias normalization). |
| **CombatDecisionType** | `combat-decision-type.ts` | `Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hiki wake`, `Hansoku-make`, `Forfait` — cross-validated against `CombatResult` (`Hiki wake` only allowed for `Egalité`, etc.) via `isCombatDecisionTypeAllowed`. |
| **OpponentStance** | `opponent-stance.ts` | `""` \| `Droitier` \| `Gaucher`. |
| **CombatTechniqueCategory** | `combat-technique-category.ts` | `""` \| `Technique Avant` \| `Technique Arrière` \| `Contre` \| `Ne waza`. |
| **AgeCategory** | `competition.ts` | `Poussinet` … `Vétéran` (fixed list, `AGE_CATEGORIES`). |
| **Competition ranking** | `competition-results.ts` (`createCompetitionRanking`) | `1er`, `2e`, `3e`, `5e`, `7e`, `Non classé`, ordered by `getCompetitionResultRank` for badge derivation. |

All four enum-like value objects share the same shape: a `create*` factory that normalizes (accent/case-insensitive aliasing) and throws a French domain error on an invalid value, plus a `normalize*` sibling that returns `""` instead of throwing — used by the AI analysis prompt builder, which must tolerate partial data.

### Application services (use cases)

`competitions.service.ts` (`saveCompetition`, `getCompetitionDetail`, `finalizeCompetition`, `saveCoachObjective`/`saveCoachReview`, `deleteCompetition`), `combats.service.ts` (`ajouterCombat`, `updateCombat`, `deleteCombat`), `club-competitions.service.ts` (`saveClubCompetition`, `getClubCompetitionDetail`, `deleteClubCompetition`, `detachClubCompetitionParticipant`).

### Invariants (selected; full list in `docs/spec.md` `COMP-*` / `CBT-*`)

- A `Combat` must belong to the `Competition`'s owner judoka and reference that exact competition (`Competition.assertCanContainCombat`).
- A competition's final ranking can only be set through `finalize()`, never through `changeDetails()` — the edit form and the finalization screen are deliberately different use cases over the same aggregate.
- Deleting a `Competition` cascades to its `Combat`s (DB-level `on delete cascade`, mirrored by the domain rule that a `Combat` cannot outlive its parent).
- Detaching a `ClubCompetition` participant only clears `clubCompetitionId`; it never deletes the individual `Competition` or its `Combat`s.

## 6. Bounded Context: Performance Insights (supporting subdomain)

**Purpose**: turn raw Competition Tracking data into something a coach or parent can read in ten seconds — statistics today, narrative analysis since the Groq integration.

### Concepts

| Name | Kind | File | Notes |
|---|---|---|---|
| **SeasonBounds** | Value object | `core/domain/season.ts` | `{start, end, label}`, always September 1 → August 31; `isDateWithinSeason` is the membership predicate. |
| **JudokaProfile** | Read model (not persisted) | `core/domain/season-statistics.ts` (`buildJudokaProfileSnapshot`) | A computed aggregation over a judoka's `Competition[]`/`Combat[]` for a season: win/loss/draw counts, victory rate, per-competition combat record, ranking badge. Falls back to the latest season with data if the current one is empty. |
| **CombatProfile** | Value object | same file | Seasonal tally of victories/losses by decision type (ippon, decision, penalty, forfeit) — a denormalized read projection, not a new business rule. |
| **AI competition analysis** | Generated artifact, stored on the `Competition` (`aiAnalysis` field) | `core/services/ai-analysis.service.ts` + `core/infra/groq-client.js` | A French narrative (overall performance, recurring tactical patterns, self-reported confidence score) built from the same `Competition` + `Combat` data the rest of this context reads, sent to Groq, and persisted back onto the `Competition` row. |

### Application services (use cases)

`profile.service.ts` (`getJudokaProfile`), `ai-analysis.service.ts` (`generateCompetitionAnalysis`).

### A note on coupling: this context is triggered, not subscribed

Today, `competitions.service.ts#finalizeCompetition` directly calls `aiAnalysisService.generateCompetitionAnalysis(idCompetition)` after persisting the ranking (wrapped in try/catch so a Groq outage never blocks finalization). In strict DDD terms, the cleaner shape would be Competition Tracking publishing a **`CompetitionFinalized`** domain event and Performance Insights subscribing to it, so the core domain would not even import the supporting one. The current direct call is a deliberate, documented simplification for a single-process monolith with no message bus; §8 lists it as the primary candidate if the contexts are ever split.

## 7. Tactical Patterns in Use

- **Aggregate factories as the only way in**: every aggregate is built through a `create*` function (`createJudoka`, `createCompetition`, `createCombat`, `createClubCompetition`) that validates and normalizes on construction — there is no way to obtain an invalid aggregate instance.
- **Persisted vs. fresh construction**: `createCompetition` (requires an `ownerJudokaId`, allows a missing `competitionId`) vs. `createPersistedCompetition` (requires an existing `competitionId`) make the entity/not-yet-persisted distinction explicit in the type system rather than via a nullable-id convention scattered through services.
- **Specification-style predicates**: `isVictoryCombatResult`, `isCombatDecisionTypeAllowed`, `isDateWithinSeason` are small, composable, side-effect-free predicates — the lightweight end of the Specification pattern.
- **Assert-style guards**: every policy/aggregate exposes both a boolean predicate (`canManageCompetition`) and an `assert*` variant that throws a French, user-facing message — keeping the "is this allowed" question and the "refuse and explain why" concern next to each other without duplicating the rule.
- **Anti-corruption layer at the persistence boundary**: `domain-adapters.ts` (see §3) is the single seam where Supabase's snake_case French columns meet the domain's camelCase language.
- **Repository interfaces owned by the domain side**: `CompetitionsRepository`, `CombatsRepository`, etc. are defined as TypeScript interfaces next to the services that consume them (`core/repositories/*.ts`), with the Supabase-specific implementation behind that interface — domain/application code never serializes itself (`docs/prd.md` Implementation Decisions).

## 8. Known Trade-offs and Evolution Opportunities

These are intentional simplifications appropriate for a single-club, single-process MVP — listed so a future split or scale-up starts from an accurate map rather than rediscovering them:

1. **`ClubCompetition` is a coordinating aggregate, not a transactional one.** Creating a club competition writes one `ClubCompetition` row and N `Competition` rows in sequence from the application service, not atomically from a single aggregate boundary. Acceptable today (no concurrent club-competition creation in practice); would need a saga/process manager if that changed.
2. **No explicit domain events.** `CompetitionFinalized` (→ triggers AI analysis), `CompetitionCreated`/`CombatRecorded` (→ could feed a future club-wide live feed) are all implicit, expressed as direct function calls. Fine for one process; the first thing to introduce if Performance Insights or any future read-model ever needs to run asynchronously or out-of-process.
3. **Shared kernel via `core/types.ts` is intentionally small.** It currently holds DTOs, not behavior, which keeps the coupling between contexts cheap. If it starts growing business logic (not just shapes), that is a signal a context boundary is being blurred and the offending logic should move into the owning context's `core/domain/*`.
4. **Access & Membership and Competition Tracking are only bridged by `permission-policy.ts`.** This module is the de facto context map artifact in code. Any new cross-context rule belongs there, not inside either aggregate.

## 9. Related Reading

- `docs/prd.md` — product vision: problem, solution, and principles behind the domain modeled here.
- `docs/spec.md` — ID-tagged functional rules (`REQ-*`, `COMP-*`, `CBT-*`, `STA-*`, `AUTH-*`, `AC-*`), the source of the ubiquitous language above, that this document's invariants summarize.
- `docs/spec-tech.md` — architecture, data model, security; in particular `ARC-005`–`ARC-008` already describe the domain/service/repository layering this document explains in DDD terms.
- `docs/supabase-schema.md` — the persistence model the anti-corruption layer (`domain-adapters.ts`) translates to and from.
