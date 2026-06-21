---
title: Kiroku Technical Specification
version: 1.4
date_created: 2026-06-11
last_updated: 2026-06-21
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
- **ARC-003**: `supabase/migrations/*` shall contain a single canonical SQL schema file for fresh deployments and idempotent updates on existing deployments.
- **ARC-004**: `tests/*` shall contain automated Node.js validation for deployment, schema, and UI structure expectations.
- **ARC-005**: Backend RPC code shall compose shared auth/runtime helpers in `api/_core.js`, domain models and policies in `core/domain/*`, application orchestration in `core/services/*`, and persistence adapters in `core/repositories/*`.
- **ARC-006**: Domain objects shall not expose Supabase record serialization methods; repositories shall translate domain objects to persistence records.
- **ARC-007**: Domain code should express business concepts through value objects and aggregate language such as `PersonName`, domain identifiers, competition/combat drafts, `ManagedJudokaScope`, and competition combat recording behavior.
- **ARC-008**: Application services may normalize inbound and persistence records into canonical DTOs, but business invariants shall be enforced by domain factories, value objects, aggregate commands, and access scopes.
- **ARC-009**: Browser screens may be migrated progressively to Vue 3 while preserving existing screen IDs and global action entry points until the full frontend migration is complete. The Vue 3 browser runtime shall be vendored locally and served through `/api/client` before screen scripts.
- **ARC-010**: `api/mcp-oauth.js` shall implement the OAuth 2.1 authorization endpoint (`/mcp/authorize`, delegating end-user authentication to the existing Google/Supabase login), the token endpoint (`/mcp/token`, exchanging a PKCE-verified authorization code for a short-lived Kiroku-signed JWT MCP access token), Dynamic Client Registration (RFC 7591, `/mcp/register`, returning a self-contained signed `client_id` rather than persisting registrations server-side), and the unauthenticated `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` discovery metadata — consolidated into a single Vercel function to stay within the Hobby plan serverless function limit (see `tests/vercel-deployment.test.js`).
- **ARC-011**: `api/mcp.js` shall expose a remote MCP server speaking JSON-RPC 2.0 over HTTP, secured by Kiroku-issued JWT MCP access tokens, independent from Supabase access tokens.
- **ARC-012**: The beta coach assistant shall be exposed through the existing `/api/rpc` channel. When Groq is configured, Groq shall only translate the coach's question into a validated structured search query (`entity`, `filters`, `limit`); the backend shall execute that query server-side against Supabase-backed judokas, competitions, combats, combat decisions, notes, and combat scores. If Groq is unavailable or not configured, supported deterministic intents shall still work.

### 3.2 Vercel routing and runtime injection

- **VCL-001**: Vercel shall route `/api/rpc` directly to the RPC endpoint.
- **VCL-001a**: Vercel shall route `/service-worker.js` to `/api/service-worker` and `/manifest.webmanifest` to `/api/manifest` before the catch-all app shell route.
- **VCL-002**: Vercel shall route all remaining non-API paths to `/api/app`.
- **VCL-003**: `/api/app` shall return `Index.html` assembled with its view partials (`assets/views/*.html`) and with runtime config injected into the HTML.
- **VCL-004**: Runtime config shall expose only public Supabase values required by the browser.
- **VCL-005**: The canonical production application URL shall be `https://competitions-judo.vercel.app/`.
- **VCL-005a**: The canonical local development URL shall be `http://localhost:3100`, served via `vercel dev --listen 3100`.
- **VCL-005b**: A separate Vercel project (`competitions-judo-dev`, production URL `https://competitions-judo-dev.vercel.app/`) shall provide a dev deployment environment, backed by its own Supabase project (independent schema and auth configuration from production), deployed from the `dev` git branch. Every dual-environment npm script carries an explicit suffix: `:prod` (`dev:prod`, `db:pull-env:prod`, `app:deploy:prod`, `redeploy:prod`) targets production; `:dev` (`dev:dev`, `db:pull-env:dev`, `app:deploy:dev`, `redeploy:dev`) targets the dev project explicitly (via `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` overrides), so no script silently mixes environments and no bare script name leaves the environment implicit.
- **VCL-006**: `npm run build:assets` (`scripts/build-assets.js`, esbuild transpilation) shall run via `postinstall` so the compiled `assets/dist/*` files consumed by `/api/client` exist before Vercel bundles the serverless functions.
- **VCL-006a**: `npm run build:core` (`scripts/build-core.js`, esbuild transpilation) shall run via `postinstall` (after `build:assets`) so the compiled `core-dist/*` files required by `.ts`-backed `core/` modules (via thin `core/**/*.js` shims) exist before Vercel bundles the serverless functions.
- **VCL-007**: The browser shall register a root-scoped service worker that caches the app shell (`/`, `/api/styles`, `/api/client`, `/manifest.webmanifest`) and shall keep `/api/rpc` network-only.
- **VCL-008**: Browser RPC calls shall fail explicitly when offline and shall abort with a user-facing slow-network error when the mobile network does not answer in time.
- **VCL-009**: `terraform/` shall manage, as code, the Vercel project name/`node_version` and the Supabase Auth `site_url`/`uri_allow_list` for both environments (prod and dev), kept in sync with VCL-005b/CFG-011. `terraform/modules/kiroku_project` shall hold environment-agnostic resource definitions (no hardcoded environment values); `terraform/environments/prod` and `terraform/environments/dev` shall each be an independent root module with its own state, calling that shared module with environment-specific values, so each environment can be planned/applied on its own without touching the other's state. Project creation, build/install commands (owned by `vercel.json`, VCL-006/VCL-006a), and sensitive environment variables stay outside Terraform's scope — see `terraform/README.md` for rationale and the required one-time `terraform import`.
- **VCL-010**: Offline business data caching shall be implemented in browser storage and shall not change the `/api/rpc` network-only service worker strategy.
- **VCL-011**: Offline mutation replay shall call the same authenticated `/api/rpc` methods used by connected actions; no offline path shall bypass server-side authorization or validation.
- **VCL-012**: Cached business data and pending offline operations shall be partitioned by authenticated user identity so a later user on the same browser cannot read another user's sports data.
- **VCL-013**: Pending offline operations shall include a stable local operation identifier, operation type, payload, user identity, creation timestamp, and status among `pending`, `syncing`, `synced`, `failed`, or `conflict`.
- **VCL-014**: Offline synchronization shall replay pending operations in creation order and mark an operation as synchronized only after the backend confirms success.
- **VCL-015**: If replay fails because of backend permission, validation, or conflict errors, the browser shall keep the local operation with the backend error details needed to render an actionable user-facing state.

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
- **DAT-015**: The unused competition field for actual weigh-in shall remain absent.
- **DAT-016**: `competitions.classement` shall store the final ranking/result used by judoka season statistics, among `1er`, `2e`, `3e`, `4e`, `5e`, `6e`, `7e`, `8e`, `Non classé`, or an empty value before finalization.
- **DAT-022**: `competitions.niveau` shall store the competition level as a text field among `Départemental`, `Régional`, `National`, `International`, or empty string.
- **DAT-023**: `judokas.annee_naissance` shall remain absent; the application shall not store judoka birth years for privacy reasons.
- **DAT-024**: `judokas.categorie_age` shall store the age category as a text field among `Poussinet`, `Poussin`, `Benjamin`, `Minime`, `Cadet`, `Junior`, `Senior`, `Vétéran`, or empty string.
- **DAT-026**: `combat_scores` shall store the repeatable list of scoring techniques for a combat (one row per score), each referencing `combats.id_combat` with cascade delete, and an explicit `ordre` column preserving entry order.
- **DAT-017**: Judoka season statistics shall be computed on a season running from September 1st to August 31st.
- **DAT-018**: Fresh deployments shall seed the initial `ADMIN` user `Mehdi EL KOUHEN` with email `mehdi.elkouhen@gmail.com`.
- **DAT-019**: `club_competitions.id_club_competition` is the club event business identifier.
- **DAT-020**: `competitions.club_competition_id` optionally links an individual competition participation to a club competition.
- **DAT-021**: Deleting a club competition shall detach every linked individual competition by clearing `competitions.club_competition_id`, preserving those individual competitions, combats, and rankings.
- **DAT-027**: `judokas.genre` shall store the judoka's gender as a text field among `Homme`, `Femme`, or empty string.
- **DAT-028**: `judokas.annee_categorie` shall store the year within the age category as a text field, validated against the valid year count for that age category (`1`/`2` for Poussinet/Poussin/Benjamin/Minime, `1`/`2`/`3` for Cadet/Junior, not applicable for Senior/Vétéran), or empty string.
- **DAT-029**: `judokas.categorie_poids` and `competitions.categorie_poids` shall be validated against the official FFJDA weight category list for the given age category (and gender, for judokas) defined in `core/domain/category-reference.ts`. Age categories without official weight divisions (Poussinet, Poussin) shall use an empty value rather than free text. Vétéran reuses the Senior weight scale.
- **DAT-030**: `club_competitions` shall not contain a weight category column; club events only share name, date, age category, and participant links, while linked individual `competitions` keep their own optional `categorie_poids`.
- **DAT-031**: `club_competitions.niveau` shall store the shared club event level, propagated to linked individual `competitions.niveau` when participants are created or resynchronized.
- **DAT-032**: `judokas.lateralite` shall store the judoka's handedness as a text field among `Droitier`, `Gaucher`, or empty string.
- **DAT-033**: Removing a single participant from a club competition whose date is strictly in the future shall delete that judoka's individual competition row, cascading to its combats per DAT-010, instead of clearing `competitions.club_competition_id`; removing a participant from a club competition whose date is today or in the past is rejected per COMP-019a.

### 3.4 Authentication and authorization

- **AUTH-001**: Authentication shall use Google through Supabase Auth.
- **AUTH-002**: The OAuth callback shall complete in the browser runtime.
- **AUTH-003**: The browser shall persist the Supabase session locally.
- **AUTH-004**: Business API calls shall send `Authorization: Bearer <access_token>` to `/api/rpc`.
- **AUTH-005**: The backend shall validate the access token through Supabase `/auth/v1/user`.
- **AUTH-006**: A Google signup shall be allowed when the email already exists on an imported `judokas` profile.
- **AUTH-006a**: The backend shall resolve the verified email from Supabase before applying business permissions.
- **AUTH-007**: Effective application permissions shall be derived from `judokas.role` plus `judokas.profile_type`. `COACH` grants sports visibility and mutations over club sports data; `ADMIN` grants access governance only and does not inherit coach permissions.
- **AUTH-008**: Password-based login shall remain unsupported.
- **AUTH-009**: Magic-link login shall remain unsupported.
- **AUTH-010**: Backend profile registration shall create only the initial invited profile.
- **AUTH-011**: A child profile may store a verified email to support direct Google login without changing the child role to `PARENT`, `COACH`, or `ADMIN`.
- **AUTH-012**: Backend profile registration shall reject any email that is neither already linked to a judoka profile nor present in `access_invitations`.
- **AUTH-013**: Backend profile registration shall create the initial profile type from `access_invitations.invited_profile_type`.
- **AUTH-014**: Backend profile registration shall always create the initial access role as `NORMAL`.
- **AUTH-015**: Child management mutations shall be restricted to users whose immutable `profile_type` is `PARENT`.
- **AUTH-016**: A Supabase `before-user-created` hook shall reject Google signups whose verified email is neither linked to an existing imported profile nor present in `access_invitations`, except for pre-seeded admin accounts explicitly allowed by the backend.
- **AUTH-017**: When Google signup is rejected by the invitation hook, the browser shall return to the login screen with an explicit invitation-required message rather than a generic OAuth failure.
- **AUTH-018**: Browser logout shall call Supabase Auth logout when possible, clear the locally persisted session, and return to the login screen.
- **AUTH-019**: MCP authentication shall chain Google login to Supabase session verification, then Kiroku email and role resolution, then OAuth 2.1 authorization-code issuance, then Kiroku-signed JWT MCP access token exchange.
- **AUTH-020**: Any authenticated Kiroku user (`COACH`, `ADMIN`, `PARENT`, or `JUDOKA`) may obtain an MCP authorization code or access token; the scopes minted at the authorize step (not a hard rejection) are what constrain a `PARENT`/`JUDOKA` caller to their own perimeter.
- **AUTH-021**: MCP authorization shall assign scopes only from a fixed Kiroku MCP scope vocabulary based on the resolved caller role (full sports read/write for `COACH`, access-governance scopes only and no judoka/competition/combat scopes for `ADMIN`, judoka/competition/combat read-write limited to the caller's own managed judokas for `PARENT`/`JUDOKA`), and `/api/mcp` shall enforce those scopes again on each authenticated MCP request and filter `tools/list` to callable tools only.
- **AUTH-022**: The MCP token endpoint shall require PKCE (`code_verifier` matching the `code_challenge` bound to the authorization code via SHA-256) before issuing an access token; requests without a valid verifier shall be rejected with `invalid_grant`.
- **AUTH-023**: The MCP authorization endpoint shall verify that the requested `redirect_uri` exactly matches one of the URIs registered for the `client_id`, and shall never redirect to an unregistered URI.

### 3.5 Security and secrets

- **SEC-001**: Business Supabase operations shall run server-side only.
- **SEC-002**: Supabase roles `anon` and `authenticated` shall not have direct access to business tables.
- **SEC-003**: Business table grants shall be limited to the server-side `service_role`.
- **SEC-004**: `SUPABASE_SERVICE_ROLE_KEY` shall never be sent to the browser.
- **SEC-005**: When the service role key is an `sb_secret_...` key, it shall be sent only in the `apikey` header and not as `Authorization: Bearer`.
- **SEC-006**: Missing or invalid bearer tokens shall cause explicit request rejection.
- **SEC-007**: MCP JWT signing (access tokens, authorization codes, and registered client identifiers) shall use a dedicated server-side secret (`MCP_JWT_SECRET`) distinct from Supabase and Google credentials, with each token kind segregated by a distinct `aud` claim.

### 3.6 Platform and configuration

- **PLT-001**: Node.js version shall remain `>=20`.
- **CFG-001**: `SUPABASE_URL` is required.
- **CFG-002**: `SUPABASE_ANON_KEY` is required.
- **CFG-003**: `SUPABASE_SERVICE_ROLE_KEY` is required.
- **CFG-004**: Google Auth provider must be enabled in Supabase Auth.
- **CFG-005**: Google OAuth callback `https://<project-ref>.supabase.co/auth/v1/callback` must be allowed in Google configuration.
- **CFG-006**: The public Vercel URL must be allowed in Supabase redirect URLs.
- **CFG-006a**: The public Vercel URL is `https://competitions-judo.vercel.app/`.
- **CFG-006b**: `http://localhost:3100` must also be allowed in Supabase redirect URLs to support local development.
- **CFG-007**: Supabase Auth must configure the `before-user-created` hook to call `public.hook_check_invited_signup`.
- **CFG-008**: The hook migration shall grant `supabase_auth_admin` the schema, function, table, and RLS access needed to read `judokas` and `access_invitations`.
- **CFG-011**: Each deployment environment (production, dev) shall use its own dedicated Supabase project (own `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, own Google OAuth redirect URI, own copy of the schema migration); environment variables and data shall never be shared across Supabase projects.
- **CFG-012**: Environment configuration shall provide `MCP_JWT_SECRET`; `MCP_TOKEN_TTL_SECONDS` is optional and configures the MCP token lifetime when set.
- **CFG-013**: `GROQ_API_KEY` is optional and enables the beta coach chat natural-language parser. `GROQ_MODEL` is optional and defaults to the configured lightweight Groq chat model when unset.

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
| `/api/client` | Vercel serverless endpoint | Concatenates frontend JS, including files compiled from `assets/*.ts` into `assets/dist/*` |
| `assets/dist/*` | Build output (gitignored) | esbuild-transpiled `assets/*.ts` sources, produced by `npm run build:assets` (`scripts/build-assets.js`) |
| `core-dist/*` | Build output (gitignored) | esbuild-transpiled `core/**/*.ts` sources, produced by `npm run build:core` (`scripts/build-core.js`) and required via thin `core/**/*.js` shims |

### 4.2 Vercel routing contract

| Route | Destination | Behavior |
|---|---|---|
| `/api/rpc` | `/api/rpc` | Receives POST JSON requests for business actions |
| `/service-worker.js` | `/api/service-worker` | Serves the root-scoped service worker that caches the app shell |
| `/manifest.webmanifest` | `/api/manifest` | Serves the installable app manifest |
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
```

## 5. Related Specifications / Further Reading

- `docs/spec.md` - functional requirements, roles, acceptance criteria, and business edge cases
