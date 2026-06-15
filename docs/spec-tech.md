---
title: Kiroku Technical Specification
version: 1.1
date_created: 2026-06-11
last_updated: 2026-06-14
owner: competitions-judo
tags:
  - architecture
  - technical-spec
  - supabase
  - vercel
  - security
---

# Introduction

This specification defines the technical constraints, interfaces, data contracts, security rules, and validation criteria for Kiroku.

## 1. Purpose & Scope

This specification covers:
- runtime surfaces;
- deployment routing behavior;
- Supabase data model constraints;
- authentication and session verification;
- security and secret handling;
- server-side API contracts;
- test automation and validation expectations.

This specification does not redefine product behavior already described in `docs/spec.md`.

## 2. Definitions

| Term | Definition |
|---|---|
| Supabase | Backend platform used for authentication, database access, and RPC support. |
| Vercel | Hosting platform serving the app shell and serverless API endpoints. |
| OAuth | Authentication flow used here for Google login through Supabase Auth. |
| RPC | Remote procedure call exposed through `/api/rpc`. |
| Service role | Privileged Supabase server role used by backend business operations. |
| Anon key | Public Supabase key used by the browser for session-related auth requests. |

## 3. Technical Requirements, Constraints & Guidelines

### 3.1 Runtime surfaces

- **ARC-001**: `Index.html` shall provide the mobile-first frontend app shell; each Vue view shall live in its own partial under `assets/views/*.html`, assembled into the shell by `api/app.js` (`renderIndexHtml`) without a build step.
- **ARC-002**: `api/*` shall provide the Vercel serverless backend surface.
- **ARC-003**: `supabase/migrations/*` shall contain one canonical SQL schema file for a fresh deployment.
- **ARC-004**: `tests/*` shall contain automated Node.js validation for deployment, schema, and UI structure expectations.
- **ARC-005**: Backend RPC code shall compose shared auth/runtime helpers in `api/_core.js`, domain models and policies in `core/domain/*`, application orchestration in `core/services/*`, and persistence adapters in `core/repositories/*`.
- **ARC-006**: Domain objects shall not expose Supabase record serialization methods; repositories shall translate domain objects to persistence records.
- **ARC-007**: Domain code should express business concepts through value objects and aggregate language such as `PersonName`, domain identifiers, competition/combat drafts, `ManagedJudokaScope`, and competition combat recording behavior.
- **ARC-008**: Application services may normalize inbound and persistence records into canonical DTOs, but business invariants shall be enforced by domain factories, value objects, aggregate commands, and access scopes.
- **ARC-009**: Browser screens may be migrated progressively to Vue 3 while preserving existing screen IDs and global action entry points until the full frontend migration is complete. The Vue 3 browser runtime shall be vendored locally and served through `/api/client` before screen scripts.

### 3.2 Vercel routing and runtime injection

- **VCL-001**: Vercel shall route `/api/rpc` directly to the RPC endpoint.
- **VCL-002**: Vercel shall route all non-API paths to `/api/app`.
- **VCL-003**: `/api/app` shall return `Index.html` assembled with its view partials (`assets/views/*.html`) and with runtime config injected into the HTML.
- **VCL-004**: Runtime config shall expose only public Supabase values required by the browser.
- **VCL-005**: The canonical production application URL shall be `https://competitions-judo.vercel.app/`.

### 3.3 Data model constraints

- **DAT-001**: Main business tables are `judokas`, `parent_judokas`, `club_competitions`, `competitions`, and `combats`.
- **DAT-001a**: `access_invitations` shall store admin-managed pending access invitations for first-time users together with the invited target profile type.
- **DAT-002**: Business identifiers shall remain text fields.
- **DAT-003**: `judokas.id_judoka` is the judoka business identifier.
- **DAT-004**: `parent_judokas.id_parent` and `parent_judokas.id_judoka` define the parent-child link.
- **DAT-005**: `competitions.id_competition` is the competition business identifier.
- **DAT-006**: `combats.id_combat` is the combat business identifier.
- **DAT-007**: `competitions.id_judoka` references the owning judoka.
- **DAT-008**: `combats.id_judoka` references the concerned judoka.
- **DAT-009**: `combats.id_competition` references the parent competition.
- **DAT-010**: Competition deletion shall cascade to combats.
- **DAT-011**: `judokas.profile_type` shall store the immutable underlying profile type among `JUDOKA` and `PARENT`.
- **DAT-012**: `judokas.role` shall store the structural access level among `NORMAL`, `COACH`, and `ADMIN`.
- **DAT-013**: If privileged rights are revoked, `judokas.role` shall resolve back to `NORMAL` without changing `judokas.profile_type`.
- **DAT-014**: Result values in `combats` shall use the strict canonical labels `Victoire`, `Défaite`, or `Egalité`. Legacy values or complex scoring states are deprecated for the MVP baseline.
- **DAT-015**: Unused competition fields for location and actual weigh-in shall remain absent.
- **DAT-016**: `competitions.classement` shall store the final ranking/result used by judoka season statistics.
- **DAT-017**: Judoka season statistics shall be computed on a season running from September 1st to August 31st.
- **DAT-018**: Fresh deployments shall seed the initial `ADMIN` user `Mehdi EL KOUHEN` with email `mehdi.elkouhen@gmail.com`.
- **DAT-019**: `club_competitions.id_club_competition` is the club event business identifier.
- **DAT-020**: `competitions.club_competition_id` optionally links an individual competition participation to a club competition.
- **DAT-021**: Deleting or detaching a club competition link shall not delete combats or rankings for individual competitions.

### 3.4 Authentication and authorization

- **AUTH-001**: Authentication shall use Google through Supabase Auth.
- **AUTH-002**: The OAuth callback shall complete in the browser runtime.
- **AUTH-003**: The browser shall persist the Supabase session locally.
- **AUTH-004**: Business API calls shall send `Authorization: Bearer <access_token>` to `/api/rpc`.
- **AUTH-005**: The backend shall validate the access token through Supabase `/auth/v1/user`.
- **AUTH-006**: The backend shall resolve the verified email from Supabase before applying business permissions.
- **AUTH-007**: Effective application permissions shall be derived from `judokas.role` plus `judokas.profile_type`. `COACH` and `ADMIN` profiles grant structural read visibility over all club data.
- **AUTH-008**: Password-based login shall remain unsupported.
- **AUTH-009**: Magic-link login shall remain unsupported.
- **AUTH-010**: Backend profile registration shall create only the initial invited profile.
- **AUTH-011**: A child profile may store a verified email to support direct Google login without changing the child role to `PARENT`, `COACH`, or `ADMIN`.
- **AUTH-012**: Backend profile registration shall reject any email that is neither already linked to a judoka profile nor present in `access_invitations`.
- **AUTH-013**: Backend profile registration shall create the initial profile type from `access_invitations.invited_profile_type`.
- **AUTH-014**: Backend profile registration shall always create the initial access role as `NORMAL`.
- **AUTH-015**: Child management mutations shall be restricted to users whose immutable `profile_type` is `PARENT`.
- **AUTH-016**: A Supabase `before-user-created` hook shall reject Google signups whose verified email is not present in `access_invitations`, except for pre-seeded admin accounts explicitly allowed by the backend.
- **AUTH-017**: When Google signup is rejected by the invitation hook, the browser shall return to the login screen with an explicit invitation-required message rather than a generic OAuth failure.
- **AUTH-018**: Browser logout shall call Supabase Auth logout when possible, clear the locally persisted session, and return to the login screen.

### 3.5 Security and secrets

- **SEC-001**: Business Supabase operations shall run server-side only.
- **SEC-002**: Supabase roles `anon` and `authenticated` shall not have direct access to business tables.
- **SEC-003**: Business table grants shall be limited to the server-side `service_role`.
- **SEC-004**: `SUPABASE_SERVICE_ROLE_KEY` shall never be sent to the browser.
- **SEC-005**: When the service role key is an `sb_secret_...` key, it shall be sent only in the `apikey` header and not as `Authorization: Bearer`.
- **SEC-006**: Missing or invalid bearer tokens shall cause explicit request rejection.

### 3.6 Platform and configuration

- **PLT-001**: Node.js version shall remain `>=20`.
- **CFG-001**: `SUPABASE_URL` is required.
- **CFG-002**: `SUPABASE_ANON_KEY` is required.
- **CFG-003**: `SUPABASE_SERVICE_ROLE_KEY` is required.
- **CFG-004**: Google Auth provider must be enabled in Supabase Auth.
- **CFG-005**: Google OAuth callback `https://<project-ref>.supabase.co/auth/v1/callback` must be allowed in Google configuration.
- **CFG-006**: The public Vercel URL must be allowed in Supabase redirect URLs.
- **CFG-006a**: The public Vercel URL is `https://competitions-judo.vercel.app/`.
- **CFG-007**: Supabase Auth must configure the `before-user-created` hook to call `public.hook_check_invited_signup`.
- **CFG-008**: The hook migration shall grant `supabase_auth_admin` the schema, function, table, and RLS access needed to read `judokas` and `access_invitations`.

## 4. Interfaces & Data Contracts

### 4.1 Runtime surfaces

| Surface | Type | Purpose |
|---|---|---|
| `Index.html` | Frontend app shell | Browser UI |
| `assets/views/*.html` | Frontend view partials | One Vue view per file, assembled into `Index.html` by `/api/app` |
| `/api/app` | Vercel serverless endpoint | Returns HTML and injects runtime config |
| `/api/rpc` | Vercel serverless endpoint | Executes authenticated business methods |
| `api/_core.js` | Shared backend core | Shared auth, Supabase helpers, and method composition |
| `core/domain/*` | Backend domain model | Entities, value objects, business policies, and domain services |
| `core/services/*` | Backend application services | Use-case orchestration over the domain |
| `core/repositories/*` | Backend persistence adapters | Data access for business aggregates and mapping from domain objects to Supabase records |
| `supabase/migrations/*` | SQL migrations | Schema and DB-side logic |

### 4.2 Vercel routing contract

| Route | Destination | Behavior |
|---|---|---|
| `/api/rpc` | `/api/rpc` | Receives POST JSON requests for business actions |
| `/(.*)` | `/api/app` | Serves the application shell for all other paths |

### 4.3 `/api/app` response contract

The endpoint returns HTML with runtime configuration injected into the page:

```html
<script>
  window.KIROKU_RUNTIME_CONFIG = {
    runtime: "vercel",
    appUrl: "<public-app-url>",
    supabaseUrl: "<public-supabase-url>",
    supabaseAnonKey: "<public-anon-key>"
  };
</script>
