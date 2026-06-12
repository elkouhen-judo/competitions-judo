---
title: Kiroku Technical Specification
version: 1.0
date_created: 2026-06-11
last_updated: 2026-06-11
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

This specification does not redefine product behavior already described in `SPEC.md`.

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

- **ARC-001**: `Index.html` shall provide the mobile-first frontend app shell.
- **ARC-002**: `api/*` shall provide the Vercel serverless backend surface.
- **ARC-003**: `supabase/migrations/*` shall contain one canonical SQL schema file for a fresh deployment.
- **ARC-004**: `tests/*` shall contain automated Node.js validation for deployment, schema, and UI structure expectations.
- **ARC-005**: Backend RPC code shall compose shared auth/runtime helpers in `api/_core.js`, domain models and policies in `core/domain/*`, application orchestration in `core/services/*`, and persistence adapters in `core/repositories/*`.
- **ARC-006**: Domain objects shall not expose Supabase record serialization methods; repositories shall translate domain objects to persistence records.
- **ARC-007**: Domain code should express business concepts through value objects and aggregate language such as `PersonName`, domain identifiers, competition/combat drafts, `ManagedJudokaScope`, and competition combat recording behavior.

### 3.2 Vercel routing and runtime injection

- **VCL-001**: Vercel shall route `/api/rpc` directly to the RPC endpoint.
- **VCL-002**: Vercel shall route all non-API paths to `/api/app`.
- **VCL-003**: `/api/app` shall return `Index.html` with runtime config injected into the HTML.
- **VCL-004**: Runtime config shall expose only public Supabase values required by the browser.
- **VCL-005**: The canonical production application URL shall be `https://competitions-judo.vercel.app/`.

### 3.3 Data model constraints

- **DAT-001**: Main business tables are `judokas`, `parent_judokas`, `competitions`, and `combats`.
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
- **DAT-012**: `judokas.role` shall store the access level among `NORMAL` and `ADMIN`.
- **DAT-013**: If admin rights are revoked, `judokas.role` shall resolve back to `NORMAL` without changing `judokas.profile_type`.
- **DAT-014**: Result values in `combats` shall remain constrained to `V`, `D`, or `E`.
- **DAT-015**: Unused competition fields for location and actual weigh-in shall remain absent.
- **DAT-016**: `competitions.classement` shall store the final ranking/result used by judoka season statistics.
- **DAT-017**: Judoka season statistics shall be computed on a season running from September 1st to August 31st.
- **DAT-018**: Fresh deployments shall seed the initial `ADMIN` user `Mehdi EL KOUHEN` with email `mehdi.elkouhen@gmail.com`.

### 3.4 Authentication and authorization

- **AUTH-001**: Authentication shall use Google through Supabase Auth.
- **AUTH-002**: The OAuth callback shall complete in the browser runtime.
- **AUTH-003**: The browser shall persist the Supabase session locally.
- **AUTH-004**: Business API calls shall send `Authorization: Bearer <access_token>` to `/api/rpc`.
- **AUTH-005**: The backend shall validate the access token through Supabase `/auth/v1/user`.
- **AUTH-006**: The backend shall resolve the verified email from Supabase before applying business permissions.
- **AUTH-007**: Effective application permissions shall be derived from `judokas.role` plus `judokas.profile_type`.
- **AUTH-008**: Password-based login shall remain unsupported.
- **AUTH-009**: Magic-link login shall remain unsupported.
- **AUTH-010**: Backend profile registration shall create only the initial invited profile.
- **AUTH-011**: A child profile may store a verified email to support direct Google login without changing the child role to `PARENT` or `ADMIN`.
- **AUTH-012**: Backend profile registration shall reject any email that is neither already linked to a judoka profile nor present in `access_invitations`.
- **AUTH-013**: Backend profile registration shall create the initial profile type from `access_invitations.invited_profile_type`.
- **AUTH-014**: Backend profile registration shall always create the initial access role as `NORMAL`.
- **AUTH-015**: Child management permissions shall be restricted to users whose immutable `profile_type` is `PARENT`.
- **AUTH-016**: A Supabase `before-user-created` hook shall reject Google signups whose verified email is neither already linked to `judokas.email` nor present in `access_invitations`.
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
```

Constraints:

- `appUrl`, `supabaseUrl`, and `supabaseAnonKey` are public runtime values;
- `appUrl` shall resolve to the canonical public application origin so OAuth redirects do not land on protected deployment URLs;
- the service role key is never injected.

### 4.4 `/api/rpc` request contract

Method:

- `POST` only.

Headers:

- `Authorization: Bearer <Supabase access token>`
- `Content-Type: application/json`

Body example:

```json
{
  "method": "saveCompetition",
  "args": [
    {
      "competitionId": "COMP123",
      "ownerJudokaId": "JUDO123",
      "name": "Tournoi regional",
      "competitionDate": "2026-06-11",
      "ageCategory": "Cadet",
      "weightCategory": "-55 kg"
    }
  ]
}
```

Success response:

```json
{
  "result": {
    "success": true,
    "message": "Competition modifiee.",
    "competitionId": "COMP123"
  }
}
```

Error response:

```json
{
  "error": "Message d'erreur explicite."
}
```

### 4.5 Exposed business methods

| Method | Purpose | Main result shape |
|---|---|---|
| `getInitialData` | Load current user context and visible competitions | `{ user, isAdmin, isParent, canManageChildren, competitions, judokas }` |
| `registerProfile` | Create the initial invited profile after login | RPC-backed profile creation result |
| `getChildrenManagement` | Load child management context | `{ user, isParent, children }` |
| `saveAccessInvitation` | Create one pending access invitation | `{ success, email, invitedProfileType, message }` |
| `deleteAccessInvitation` | Remove one pending access invitation | `{ success, message }` |
| `saveManagedChild` | Create or update a managed child | `{ success, judokaId, message }` |
| `deleteManagedChild` | Remove or delete a managed child | `{ success, message }` |
| `getCompetitionDetail` | Load one competition and its visible combats | `{ competition, combats, isAdmin, isParent, canManageCompetition, canEditCompetition, judokas }` |
| `saveCompetition` | Create or update one competition | `{ success, competitionId, message }` |
| `ajouterCombat` | Create one combat | `{ success, message }` |
| `updateCombat` | Update one combat | `{ success, message }` |
| `deleteCompetition` | Delete one competition | `{ success, message }` |
| `deleteCombat` | Delete one combat | `{ success, message }` |

### 4.6 Browser-facing domain contracts

Business RPC responses and browser-submitted business payloads use domain names, not Supabase persistence column names. Persistence aliases such as `id_judoka`, `nom`, or `resultat` are adapter/repository concerns only.

#### Judoka

| Field | Type | Required | Notes |
|---|---|---:|---|
| `judokaId` | string | Yes | Business identifier |
| `accountEmail` | string or null | No | Can be null for child-only profiles, or set to enable direct child login |
| `firstName` | string | Yes | Displayed in UI |
| `lastName` | string | Yes | Displayed in UI |
| `accessRole` | string | Yes | `NORMAL` or `ADMIN` |
| `profileType` | string | Yes | Immutable `JUDOKA` or `PARENT` profile type |

#### Competition

| Field | Type | Required | Notes |
|---|---|---:|---|
| `competitionId` | string | No on create | Generated on create |
| `ownerJudokaId` | string | Yes for parent/admin create | Owner judoka |
| `name` | string | Yes | Competition name |
| `competitionDate` | string | Yes | Normalized date string |
| `ageCategory` | string | No | Age category |
| `weightCategory` | string | No | Weight category |
| `seasonResult` | string | No | Final result used by season statistics |

#### Combat

| Field | Type | Required | Notes |
|---|---|---:|---|
| `combatId` | string | No on create | Generated on create |
| `judokaId` | string | Yes | Concerned judoka |
| `competitionId` | string | Yes | Parent competition |
| `opponent` | string | No | Opponent name |
| `result` | string | Yes | `V`, `D`, or `E` |
| `victoryType` | string | No | Decision type |
| `notes` | string | No | Match notes |

## 5. Test Automation Strategy

- **TST-001**: Use the Node.js built-in test runner for automated validation.
- **TST-002**: Run targeted tests first when changes affect deployment, auth, schema, or mobile-first structure.
- **TST-003**: Use `node --test tests/vercel-deployment.test.js` for Vercel routing, auth, and RPC contract changes.
- **TST-004**: Use `node --test tests/mobile-first-index.test.js` for mobile UI structure expectations.
- **TST-005**: Use `node --test tests/supabase-schema.test.js` for schema, constraints, and privilege rules.
- **TST-006**: Use `npm test` for the complete suite.
- **TST-007**: Pre-existing failures must be distinguished from regressions introduced by the current change.

## 6. Rationale & Context

Kiroku uses a simple frontend but strict server-side authorization. The main technical risk is unauthorized access to sports data or invalid parent-child scope expansion. For that reason:

- authorization comes from application data in `judokas`, not from third-party identity claims;
- business tables are protected from direct client access;
- the serverless API is the only entry point for business mutations;
- deletion rules rely on constrained relationships and cascade behavior;
- secret handling is isolated from browser code.

The system also supports child profiles without email addresses, while optionally allowing a child email for direct login. It also enforces first-time access through admin-managed invitations. This affects deletion logic, registration checks, and profile lifecycle handling.

## 7. Dependencies & External Integrations

### External Systems

- **EXT-001**: Supabase Auth - validates Google-authenticated user sessions and returns verified email identity.
- **EXT-002**: Supabase Database - stores judokas, parent links, competitions, combats, and RPC logic.
- **EXT-003**: Vercel - hosts the app shell and serverless API endpoints.

### Third-Party Services

- **SVC-001**: Google OAuth via Supabase Auth - provides end-user authentication.

### Infrastructure Dependencies

- **INF-001**: Environment variable `SUPABASE_URL` is required.
- **INF-002**: Environment variable `SUPABASE_ANON_KEY` is required.
- **INF-003**: Environment variable `SUPABASE_SERVICE_ROLE_KEY` is required.

### Technology Platform Dependencies

- **PLT-002**: Node.js version must be `>=20`.
- **PLT-003**: The frontend runtime depends on browser support for `fetch`, DOM APIs, and local storage.

### Compliance Dependencies

- **COM-001**: Secrets must remain server-side only.
- **COM-002**: Direct browser access to business tables must remain revoked for `anon` and `authenticated`.

## 8. Validation Criteria

- **VAL-001**: All role-based access paths must be enforceable server-side.
- **VAL-002**: No business-table client privilege may be granted to Supabase `anon` or `authenticated`.
- **VAL-003**: Competition deletion must preserve cascade delete behavior for combats.
- **VAL-004**: The login flow must remain Google-only.
- **VAL-005**: The runtime app shell must inject only public Supabase values.
- **VAL-006**: The database model must keep text business identifiers.
- **VAL-007**: Existing automated tests for deployment, schema, and mobile-first behavior must remain aligned with this specification.

## 9. Related Specifications / Further Reading

- `SPEC.md` - product behavior, roles, user flows, and acceptance criteria
- `tests/vercel-deployment.test.js` - deployment, auth, and RPC behavior checks
- `tests/mobile-first-index.test.js` - mobile-first UI behavior checks
- `tests/supabase-schema.test.js` - schema and privilege checks
