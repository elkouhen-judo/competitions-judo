# Coach Club Competitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build club-level competitions created by coaches, with linked judoka participations that remain editable by the coach and by each scoped judoka/parent.

**Architecture:** Add `club_competitions` as the shared event aggregate and keep existing `competitions` rows as per-judoka participations. Link participations with nullable `competitions.club_competition_id`, so detaching a judoka removes only the club grouping while preserving sports data.

**Tech Stack:** Node.js CommonJS domain/services, Supabase SQL schema, browser Vue 3 global runtime, Node test runner.

---

## File Map

- Create `core/domain/competitions/club-competition.js`: value object/aggregate helpers for club events and participant ids.
- Modify `core/domain/competitions/competition.js`: carry optional `clubCompetitionId` on existing competition entities.
- Modify `core/services/domain-adapters.js`: map SQL `club_competition_id` and club event fields to read models.
- Create `core/repositories/club-competitions.repository.js`: Supabase persistence for club events.
- Modify `core/repositories/competitions.repository.js`: persist nullable `club_competition_id`, list linked participations, detach links.
- Create `core/services/club-competitions.service.js`: coach/admin workflow for creating/editing club events and assigning/detaching participants.
- Modify `core/services/competitions.service.js` and `core/services/combats.service.js`: allow coach/admin sports-data writes for linked participations while preserving scoped writes for judoka/parent.
- Modify `core/domain/access/permission-policy.js`: add explicit coach sports-management predicates.
- Modify `core/index.js`: wire repository/service and expose RPC methods.
- Modify `supabase/migrations/20260612000000_initial_schema.sql`: add `club_competitions` and nullable FK.
- Modify `docs/supabase-schema.md`, `spec.md`, `spec-tech.md`: update functional and technical source of truth.
- Modify `assets/app-runtime.js`, `assets/app-screen-home.js`, `assets/app-screen-competition.js`, `assets/app-screen-projections.js`, `Index.html`: add coach club competition UI entry points and participant detail state.
- Tests: extend `tests/domain-model.test.js`, `tests/repository-mapping.test.js`, `tests/application-services.test.js`, `tests/supabase-schema.test.js`, `tests/mobile-first-index.test.js`, `tests/vercel-deployment.test.js`.

---

## Task 1: Schema And Repository Mapping

**Files:**
- Modify: `supabase/migrations/20260612000000_initial_schema.sql`
- Modify: `docs/supabase-schema.md`
- Modify: `core/repositories/competitions.repository.js`
- Create: `core/repositories/club-competitions.repository.js`
- Test: `tests/supabase-schema.test.js`
- Test: `tests/repository-mapping.test.js`

- [ ] **Step 1: Write failing schema test**

Add to `tests/supabase-schema.test.js`:

```js
test("supabase schema stores club competitions and linked participations", () => {
  assert.match(schema, /create table if not exists public\.club_competitions/i);
  assert.match(schema, /id_club_competition text primary key/i);
  assert.match(schema, /competitions_club_competition_id_fkey[\s\S]*references public\.club_competitions \(id_club_competition\)[\s\S]*on delete set null/i);
  assert.match(schema, /add column if not exists club_competition_id text/i);
  assert.match(schema, /grant select,\s*insert,\s*update,\s*delete on table public\.club_competitions to service_role/i);
});
```

- [ ] **Step 2: Run schema test and verify red**

Run: `node --test tests/supabase-schema.test.js`

Expected: FAIL because `club_competitions` and `club_competition_id` are absent.

- [ ] **Step 3: Implement schema**

In `supabase/migrations/20260612000000_initial_schema.sql`, add table creation after `competitions`:

```sql
create table if not exists public.club_competitions (
  id_club_competition text primary key,
  nom text not null,
  date date not null,
  categorie_age text not null default '',
  categorie_poids text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_competitions_nom_not_blank check (btrim(nom) <> '')
);
```

Add migration for existing databases after the `alter table public.competitions` block:

```sql
alter table public.competitions
  add column if not exists club_competition_id text;

alter table public.competitions
  drop constraint if exists competitions_club_competition_id_fkey;

alter table public.competitions
  add constraint competitions_club_competition_id_fkey
  foreign key (club_competition_id)
  references public.club_competitions (id_club_competition)
  on update cascade
  on delete set null;

create index if not exists competitions_club_competition_id_idx
  on public.competitions (club_competition_id);
```

Add RLS, service policy, revokes/grants, and updated_at trigger following existing table patterns:

```sql
drop trigger if exists club_competitions_set_updated_at on public.club_competitions;
create trigger club_competitions_set_updated_at
before update on public.club_competitions
for each row
execute function public.set_updated_at();

alter table public.club_competitions enable row level security;

drop policy if exists "Service role access on club_competitions" on public.club_competitions;
create policy "Service role access on club_competitions"
on public.club_competitions
for all
to service_role
using (true)
with check (true);

revoke all on table public.club_competitions from anon, authenticated;
grant select, insert, update, delete on table public.club_competitions to service_role;
```

- [ ] **Step 4: Write failing repository mapping test**

Add to `tests/repository-mapping.test.js`:

```js
test("repositories map club competitions and participation links", async () => {
  const calls = [];
  const clubRepository = require("../core/repositories/club-competitions.repository")({
    supabaseDelete: async (table, query) => calls.push(["delete", table, query]),
    supabaseInsert: async (table, record) => calls.push(["insert", table, record]),
    supabasePatch: async (table, query, record) => calls.push(["patch", table, query, record]),
    supabaseSelect: async (table, query) => {
      calls.push(["select", table, query]);
      return [];
    },
    supabaseSelectOne: async (table, query) => {
      calls.push(["selectOne", table, query]);
      return null;
    },
    eqFilter: (field, value) => `${field}=eq.${value}`
  });

  await clubRepository.insert({
    clubCompetitionId: "CLUB1",
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    ageCategory: "Minime",
    weightCategory: "-50kg"
  });

  assert.deepEqual(calls[0], ["insert", "club_competitions", {
    id_club_competition: "CLUB1",
    nom: "Tournoi Nantes",
    date: "2026-06-14",
    categorie_age: "Minime",
    categorie_poids: "-50kg"
  }]);
});
```

- [ ] **Step 5: Implement club repository and participation persistence**

Create `core/repositories/club-competitions.repository.js`:

```js
module.exports = function createClubCompetitionsRepository(deps) {
  const { supabaseDelete, supabaseInsert, supabasePatch, supabaseSelect, supabaseSelectOne, eqFilter } = deps;

  function toClubCompetitionRecord(event) {
    return {
      id_club_competition: event.clubCompetitionId,
      nom: event.name,
      date: event.competitionDate,
      categorie_age: event.ageCategory || "",
      categorie_poids: event.weightCategory || ""
    };
  }

  async function listAll() {
    return supabaseSelect("club_competitions", "select=*&order=date.desc");
  }

  async function getById(idClubCompetition) {
    return supabaseSelectOne("club_competitions", `select=*&${eqFilter("id_club_competition", idClubCompetition)}`);
  }

  async function insert(event) {
    return supabaseInsert("club_competitions", toClubCompetitionRecord(event));
  }

  async function update(idClubCompetition, event) {
    const record = toClubCompetitionRecord({ ...event, clubCompetitionId: idClubCompetition });
    delete record.id_club_competition;
    return supabasePatch("club_competitions", eqFilter("id_club_competition", idClubCompetition), record);
  }

  async function remove(idClubCompetition) {
    return supabaseDelete("club_competitions", eqFilter("id_club_competition", idClubCompetition));
  }

  return { getById, insert, listAll, remove, update };
};
```

Modify `core/repositories/competitions.repository.js`:

```js
function toCompetitionRecord(competition) {
  const draft = competition && competition.draft;
  if (!draft) {
    throw new Error("Competition domain draft required.");
  }
  return {
    id_judoka: competition.ownerJudokaId,
    club_competition_id: competition.clubCompetitionId || null,
    nom: draft.name,
    date: draft.competitionDate,
    categorie_age: draft.ageCategory,
    categorie_poids: draft.weightCategory,
    classement: competition.result || ""
  };
}

async function listByClubCompetition(idClubCompetition) {
  return supabaseSelect("competitions", `select=*&${eqFilter("club_competition_id", idClubCompetition)}&order=nom.asc`);
}

async function detachFromClubCompetition(idCompetition) {
  return supabasePatch("competitions", eqFilter("id_competition", idCompetition), {
    club_competition_id: null
  });
}
```

Export `listByClubCompetition` and `detachFromClubCompetition`.

- [ ] **Step 6: Run targeted tests and commit**

Run:

```bash
node --test tests/supabase-schema.test.js tests/repository-mapping.test.js
```

Expected: PASS.

Commit:

```bash
git add supabase/migrations/20260612000000_initial_schema.sql docs/supabase-schema.md core/repositories/competitions.repository.js core/repositories/club-competitions.repository.js tests/supabase-schema.test.js tests/repository-mapping.test.js
git commit -m "Add club competition persistence"
```

---

## Task 2: Domain Objects And Access Policy

**Files:**
- Create: `core/domain/competitions/club-competition.js`
- Modify: `core/domain/competitions/competition.js`
- Modify: `core/domain/access/permission-policy.js`
- Test: `tests/domain-model.test.js`

- [ ] **Step 1: Write failing domain tests**

Add to `tests/domain-model.test.js`:

```js
const {
  createClubCompetition,
  createClubCompetitionParticipantIds
} = require("../core/domain/competitions/club-competition");
```

Add tests:

```js
test("club competition domain normalizes event details and participant ids", () => {
  const event = createClubCompetition({
    clubCompetitionId: "CLUB1",
    name: " Tournoi Nantes ",
    competitionDate: "2026-06-14",
    ageCategory: " minime ",
    weightCategory: " -50kg ",
    participantJudokaIds: ["J1", "J2", "J1"]
  });

  assert.equal(event.clubCompetitionId, "CLUB1");
  assert.equal(event.name, "Tournoi Nantes");
  assert.equal(event.competitionDate, "2026-06-14");
  assert.equal(event.ageCategory, "Minime");
  assert.equal(event.weightCategory, "-50kg");
  assert.deepEqual(event.participantJudokaIds, ["J1", "J2"]);
  assert.throws(() => createClubCompetition({ name: "", competitionDate: "2026-06-14" }), /Nom et date obligatoires/);
  assert.throws(() => createClubCompetitionParticipantIds([]), /Au moins un judoka/);
});

test("competition domain carries optional club competition link", () => {
  const competition = createCompetition({
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    clubCompetitionId: "CLUB1"
  }, "J1");

  assert.equal(competition.clubCompetitionId, "CLUB1");
  assert.equal(competition.changeDetails({ name: "Tournoi Nantes 2", competitionDate: "2026-06-15" }).clubCompetitionId, "CLUB1");
});

test("permission policy grants coach sports management without admin invitations", () => {
  const coach = { judokaId: "C1", profileType: "JUDOKA", accessRole: "COACH" };
  assert.equal(permissions.canManageClubCompetition(coach), true);
  assert.equal(permissions.canManageCompetition(coach, { ownerJudokaId: "J1" }, createManagedJudokaScope([])), true);
  assert.equal(permissions.canManageChildrenProfile(coach), false);
});
```

- [ ] **Step 2: Run domain tests and verify red**

Run: `node --test tests/domain-model.test.js`

Expected: FAIL because `club-competition.js` and coach management predicates are missing.

- [ ] **Step 3: Implement club competition domain**

Create `core/domain/competitions/club-competition.js`:

```js
const { createCompetitionAgeCategory, createCompetitionDetailsDraft } = require("./competition");
const { createJudokaId, createOptionalCompetitionId } = require("../shared/identity");

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createClubCompetitionParticipantIds(values) {
  const ids = [...new Set((values || []).map(value => createJudokaId(value, "Judoka participant obligatoire.")))];
  if (!ids.length) {
    throw new Error("Au moins un judoka doit être sélectionné.");
  }
  return ids;
}

function createClubCompetition(event = {}) {
  const details = createCompetitionDetailsDraft(event);
  return {
    clubCompetitionId: createOptionalCompetitionId(event.clubCompetitionId),
    name: details.name,
    competitionDate: details.competitionDate,
    ageCategory: createCompetitionAgeCategory(details.ageCategory),
    weightCategory: cleanText(details.weightCategory),
    participantJudokaIds: event.participantJudokaIds ? createClubCompetitionParticipantIds(event.participantJudokaIds) : []
  };
}

module.exports = {
  createClubCompetition,
  createClubCompetitionParticipantIds
};
```

`createOptionalCompetitionId` uses generic text normalization, so it can be reused for `clubCompetitionId`.

- [ ] **Step 4: Carry club link in competition domain**

Modify `core/domain/competitions/competition.js` record creation:

```js
const clubCompetitionId = competition && competition.clubCompetitionId
  ? createOptionalCompetitionId(competition.clubCompetitionId)
  : null;

const record = {
  competitionId,
  clubCompetitionId,
  ownerJudokaId: resolvedOwnerJudokaId,
  draft,
  name: draft.name,
  competitionDate: draft.competitionDate,
  ageCategory: draft.ageCategory,
  weightCategory: draft.weightCategory,
  result
};
```

Update `changeDetails`:

```js
return createCompetition({
  ...details,
  competitionId: record.competitionId,
  clubCompetitionId: record.clubCompetitionId,
  result: details.result !== undefined ? details.result : record.result
}, record.ownerJudokaId);
```

- [ ] **Step 5: Update permission policy**

Modify `core/domain/access/permission-policy.js`:

```js
function canManageClubCompetition(user) {
  return isAdmin(user) || isCoach(user);
}
```

Change `canManageCombatFor` and `canManageCompetition` so `COACH` returns `true` for sports data:

```js
if (isAdmin(user) || isCoach(user)) return true;
```

Export `canManageClubCompetition`.

- [ ] **Step 6: Run targeted tests and commit**

Run: `node --test tests/domain-model.test.js`

Expected: PASS.

Commit:

```bash
git add core/domain/competitions/club-competition.js core/domain/competitions/competition.js core/domain/access/permission-policy.js tests/domain-model.test.js
git commit -m "Add club competition domain rules"
```

---

## Task 3: Services And RPC Wiring

**Files:**
- Create: `core/services/club-competitions.service.js`
- Modify: `core/services/domain-adapters.js`
- Modify: `core/index.js`
- Modify: `core/services/competitions.service.js`
- Modify: `core/services/combats.service.js`
- Test: `tests/application-services.test.js`
- Test: `tests/vercel-deployment.test.js`

- [ ] **Step 1: Write failing service tests**

Add to `tests/application-services.test.js`:

```js
const createClubCompetitionsService = require("../core/services/club-competitions.service");
const { createClubCompetition } = require("../core/domain/competitions/club-competition");
```

Add tests:

```js
test("coach creates a club competition with linked judoka participations", async () => {
  const insertedClubEvents = [];
  const insertedCompetitions = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: {
      insert: async event => insertedClubEvents.push(event),
      getById: async () => null
    },
    competitionsRepository: {
      insert: async (competition, idCompetition) => insertedCompetitions.push([idCompetition, competition]),
      listByClubCompetition: async () => []
    },
    judokasRepository: {
      listByIds: async ids => ids.map(id => ({ id_judoka: id, prenom: `P${id}`, nom: "TEST" }))
    },
    userContextService: {
      getCurrentUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition,
    buildClubCompetitionId: () => "CLUB1",
    buildCompetitionId: () => `COMP${insertedCompetitions.length + 1}`,
    createClubCompetition,
    createCompetition
  });

  const result = await service.methods.saveClubCompetition("coach@example.com", {
    name: "Tournoi Nantes",
    competitionDate: "2026-06-14",
    participantJudokaIds: ["J1", "J2"]
  });

  assert.equal(result.clubCompetitionId, "CLUB1");
  assert.equal(insertedClubEvents.length, 1);
  assert.equal(insertedCompetitions.length, 2);
  assert.deepEqual(insertedCompetitions.map(row => row[1].ownerJudokaId), ["J1", "J2"]);
});

test("detaching a club participant keeps the individual competition", async () => {
  const calls = [];
  const service = createClubCompetitionsService({
    clubCompetitionsRepository: { getById: async () => ({ id_club_competition: "CLUB1", nom: "Tournoi", date: "2026-06-14" }) },
    competitionsRepository: {
      getById: async () => ({ id_competition: "COMP1", id_judoka: "J1", club_competition_id: "CLUB1", nom: "Tournoi", date: "2026-06-14" }),
      detachFromClubCompetition: async id => calls.push(["detach", id])
    },
    userContextService: {
      getCurrentUserContext: async () => ({
        user: { id_judoka: "COACH1", profile_type: "JUDOKA", role: "COACH" },
        managedJudokaScope: createManagedJudokaScope([])
      })
    },
    canManageClubCompetition: permissions.canManageClubCompetition
  });

  const result = await service.methods.detachClubCompetitionParticipant("coach@example.com", "CLUB1", "COMP1");

  assert.deepEqual(calls, [["detach", "COMP1"]]);
  assert.match(result.message, /sans supprimer ses résultats/);
});
```

- [ ] **Step 2: Run service tests and verify red**

Run: `node --test tests/application-services.test.js`

Expected: FAIL because `club-competitions.service.js` is missing.

- [ ] **Step 3: Implement service**

Create `core/services/club-competitions.service.js`:

```js
const { toCanonicalJudoka, toCompetitionReadModel, toJudokaReadModel } = require("./domain-adapters");

module.exports = function createClubCompetitionsService(deps) {
  const {
    clubCompetitionsRepository,
    competitionsRepository,
    judokasRepository,
    userContextService,
    canManageClubCompetition,
    buildClubCompetitionId,
    buildCompetitionId,
    createClubCompetition,
    createCompetition
  } = deps;

  function assertCanManage(user) {
    if (!canManageClubCompetition(toCanonicalJudoka(user))) {
      throw new Error("Gestion des compétitions club réservée aux coachs.");
    }
  }

  async function assertParticipantIdsExist(ids) {
    const rows = await judokasRepository.listByIds(ids);
    const found = new Set(rows.map(row => String(row.id_judoka)));
    const missing = ids.filter(id => !found.has(String(id)));
    if (missing.length) {
      throw new Error("Judoka participant introuvable.");
    }
    return rows;
  }

  async function saveClubCompetition(email, input) {
    const userContext = await userContextService.getCurrentUserContext(email);
    assertCanManage(userContext.user);

    const clubCompetitionId = input.clubCompetitionId || buildClubCompetitionId();
    const event = createClubCompetition({ ...input, clubCompetitionId });
    await assertParticipantIdsExist(event.participantJudokaIds);

    if (input.clubCompetitionId) {
      await clubCompetitionsRepository.update(clubCompetitionId, event);
    } else {
      await clubCompetitionsRepository.insert(event);
    }

    const existing = input.clubCompetitionId
      ? await competitionsRepository.listByClubCompetition(clubCompetitionId)
      : [];
    const existingJudokaIds = new Set(existing.map(row => String(row.id_judoka)));

    for (const judokaId of event.participantJudokaIds) {
      if (existingJudokaIds.has(String(judokaId))) continue;
      const competition = createCompetition({
        name: event.name,
        competitionDate: event.competitionDate,
        ageCategory: event.ageCategory,
        weightCategory: event.weightCategory,
        clubCompetitionId
      }, judokaId);
      await competitionsRepository.insert(competition, buildCompetitionId());
    }

    return {
      success: true,
      clubCompetitionId,
      message: input.clubCompetitionId ? "Compétition club modifiée." : "Compétition club créée."
    };
  }

  async function getClubCompetitionDetail(email, idClubCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    assertCanManage(userContext.user);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) throw new Error("Compétition club introuvable.");
    const participations = await competitionsRepository.listByClubCompetition(idClubCompetition);
    const judokas = await judokasRepository.listByIds(participations.map(row => row.id_judoka));
    return {
      clubCompetition: event,
      participations: participations.map(toCompetitionReadModel),
      judokas: judokas.map(toJudokaReadModel)
    };
  }

  async function detachClubCompetitionParticipant(email, idClubCompetition, idCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    assertCanManage(userContext.user);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) throw new Error("Compétition club introuvable.");
    const participation = await competitionsRepository.getById(idCompetition);
    if (!participation || String(participation.club_competition_id || "") !== String(idClubCompetition)) {
      throw new Error("Participation introuvable.");
    }
    await competitionsRepository.detachFromClubCompetition(idCompetition);
    return {
      success: true,
      message: "La participation a été retirée de la compétition club sans supprimer ses résultats."
    };
  }

  return {
    methods: {
      detachClubCompetitionParticipant,
      getClubCompetitionDetail,
      saveClubCompetition
    }
  };
};
```

- [ ] **Step 4: Wire service in `core/index.js`**

Add imports:

```js
const createClubCompetitionsRepository = require("./repositories/club-competitions.repository");
const createClubCompetitionsService = require("./services/club-competitions.service");
const { createClubCompetition } = require("./domain/competitions/club-competition");
```

Instantiate repository and service:

```js
const clubCompetitionsRepository = createClubCompetitionsRepository(repositoryDeps);

const clubCompetitionsService = createClubCompetitionsService({
  clubCompetitionsRepository,
  competitionsRepository,
  judokasRepository,
  userContextService,
  canManageClubCompetition: permissions.canManageClubCompetition,
  buildClubCompetitionId: ids.buildCompetitionId,
  buildCompetitionId: ids.buildCompetitionId,
  createClubCompetition,
  createCompetition
});
```

Add methods:

```js
...clubCompetitionsService.methods,
```

- [ ] **Step 5: Ensure adapters expose club link**

In `core/services/domain-adapters.js`, add `clubCompetitionId` mappings in canonical and read model competition functions:

```js
clubCompetitionId: competition.clubCompetitionId !== undefined ? competition.clubCompetitionId : competition.club_competition_id,
```

- [ ] **Step 6: Update vercel structural tests**

Add expectations in `tests/vercel-deployment.test.js`:

```js
assert.match(coreIndex, /createClubCompetitionsService/);
assert.match(coreIndex, /\.\.\.clubCompetitionsService\.methods/);
assert.match(client, /saveClubCompetition/);
```

- [ ] **Step 7: Run targeted tests and commit**

Run:

```bash
node --test tests/application-services.test.js tests/vercel-deployment.test.js
```

Expected: PASS.

Commit:

```bash
git add core/services/club-competitions.service.js core/services/domain-adapters.js core/index.js tests/application-services.test.js tests/vercel-deployment.test.js
git commit -m "Add club competition services"
```

---

## Task 4: Coach UI Entry Points

**Files:**
- Modify: `Index.html`
- Modify: `assets/app-runtime.js`
- Modify: `assets/app-screen-home.js`
- Modify: `assets/app-screen-competition.js`
- Modify: `assets/app-screen-projections.js`
- Test: `tests/mobile-first-index.test.js`
- Test: `tests/vercel-deployment.test.js`

- [ ] **Step 1: Write failing UI structure tests**

Add to `tests/mobile-first-index.test.js`:

```js
test("coach can open club competition creation and participant management UI", () => {
  assert.match(bundle, /id="addClubCompetitionButton"/);
  assert.match(bundle, /id="clubCompetitionFormView" class="panel hidden" v-cloak/);
  assert.match(bundle, /id="clubCompetitionParticipants"/);
  assert.match(bundle, /v-for="participant in clubCompetitionParticipants"/);
  assert.match(client, /function showClubCompetitionForm\(\)/);
  assert.match(client, /"saveClubCompetition"/);
  assert.match(client, /detachClubCompetitionParticipant/);
});
```

- [ ] **Step 2: Run UI test and verify red**

Run: `node --test tests/mobile-first-index.test.js`

Expected: FAIL because club competition UI does not exist.

- [ ] **Step 3: Add home action**

In `assets/app-screen-home.js`, extend default state:

```js
canCreateClubCompetition: false,
```

In `syncHomeContext()`:

```js
canCreateClubCompetition: state.isCoach || state.isAdmin,
```

Register action:

```js
showClubCompetitionForm: screens.competition.showClubCompetitionForm,
```

In `Index.html`, add button near home actions:

```html
<button id="addClubCompetitionButton" v-if="canCreateClubCompetition" class="home-context-action" @click="showClubCompetitionForm()">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"></path><path d="M8 3v4"></path><path d="M16 3v4"></path><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M7 13h4"></path><path d="M13 13h4"></path><path d="M7 17h4"></path></svg>
  <span class="button-copy">
    <span>Créer une compétition club</span>
    <span class="button-meta">Affecter plusieurs judokas</span>
  </span>
</button>
```

- [ ] **Step 4: Add club competition form view**

In `Index.html`, add a panel before `competitionFormView`:

```html
<section id="clubCompetitionFormView" class="panel hidden" v-cloak>
  <div class="panel-header">
    <div>
      <h2>{{ clubCompetitionFormTitle }}</h2>
      <p class="subtitle">Créer un événement partagé et sélectionner les judokas concernés.</p>
    </div>
  </div>
  <div class="panel-body">
    <div class="form-grid">
      <label>Nom<input id="club_competition_name" v-model.trim="clubCompetitionForm.name"></label>
      <label>Date<input id="club_competition_date" type="date" v-model="clubCompetitionForm.competitionDate"></label>
      <label>Catégorie âge<input id="club_competition_age" v-model.trim="clubCompetitionForm.ageCategory"></label>
      <label>Catégorie poids<input id="club_competition_weight" v-model.trim="clubCompetitionForm.weightCategory"></label>
    </div>
    <div id="clubCompetitionParticipants" class="list">
      <label v-for="participant in clubCompetitionParticipants" :key="participant.judokaId" class="checkbox-row">
        <input type="checkbox" :value="participant.judokaId" v-model="clubCompetitionForm.participantJudokaIds">
        <span>{{ participant.name }}</span>
      </label>
    </div>
    <div class="form-actions mobile-action-bar">
      <button class="button-secondary" type="button" @click="cancelClubCompetitionForm()">Annuler</button>
      <button id="saveClubCompetitionButton" type="button" @click="saveClubCompetition()">Créer la compétition club</button>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Add screen methods**

In `assets/app-screen-competition.js`, add default state and methods:

```js
const defaultClubCompetitionFormViewState = {
  clubCompetitionFormTitle: "Créer une compétition club",
  clubCompetitionParticipants: [],
  clubCompetitionForm: {
    clubCompetitionId: "",
    name: "",
    competitionDate: "",
    ageCategory: "",
    weightCategory: "",
    participantJudokaIds: []
  }
};
```

Mount view model with:

```js
clubCompetitionFormViewModel = ui.createMountedViewModel("clubCompetitionFormView", defaultClubCompetitionFormViewState, {
  cancelClubCompetitionForm,
  saveClubCompetition
});
```

Implement:

```js
function showClubCompetitionForm() {
  clearMessage();
  ensureClubCompetitionFormViewModel();
  clubCompetitionFormViewModel.clubCompetitionParticipants = state.judokas.map(j => ({
    judokaId: String(j.judokaId || ""),
    name: getJudokaDisplayName(j) || "Judoka"
  }));
  Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
    clubCompetitionId: "",
    name: "",
    competitionDate: getCurrentLocalDate(),
    ageCategory: "",
    weightCategory: "",
    participantJudokaIds: []
  });
  showView("clubCompetitionFormView");
}

function cancelClubCompetitionForm() {
  showView("homeView");
}

function saveClubCompetition() {
  const form = clubCompetitionFormViewModel.clubCompetitionForm;
  app.runServer(
    "saveClubCompetition",
    [form],
    response => {
      showSuccess(response.message);
      app.reloadInitialData();
    },
    showError
  );
}
```

Export `showClubCompetitionForm`.

- [ ] **Step 6: Run targeted UI tests and commit**

Run:

```bash
node --test tests/mobile-first-index.test.js tests/vercel-deployment.test.js
```

Expected: PASS.

Commit:

```bash
git add Index.html assets/app-screen-home.js assets/app-screen-competition.js assets/app-screen-projections.js assets/app-runtime.js tests/mobile-first-index.test.js tests/vercel-deployment.test.js
git commit -m "Add coach club competition UI"
```

---

## Task 5: Functional Specs And Technical Specs

**Files:**
- Modify: `spec.md`
- Modify: `spec-tech.md`
- Modify: `docs/supabase-schema.md`

- [ ] **Step 1: Update `spec.md`**

Change current read-only coach rules:

```md
- **ROL-003**: A `COACH` profile has read access to all judokas, competitions, and stats within the club, and can manage club competition events and their linked participations.
```

Add competition rules:

```md
- **COMP-017**: A `COACH` or `ADMIN` can create a club competition event and assign one or more judokas as participants.
- **COMP-018**: Assigning a judoka to a club competition creates an individual competition participation for that judoka.
- **COMP-019**: A linked participation remains visible and editable in the judoka's individual competition history.
- **COMP-020**: Removing a judoka from a club competition detaches only the club link and shall not delete the individual competition, combats, or final ranking.
- **COMP-021**: A `JUDOKA` or `PARENT` can still create individual competitions outside a club competition.
```

Add acceptance criteria:

```md
- **AC-025**: Given a connected `COACH`, when they create a club competition with selected judokas, then one club event and one linked individual competition per selected judoka are created.
- **AC-026**: Given a linked participation, when the concerned judoka or parent updates combats or ranking, then only that participation is modified.
- **AC-027**: Given a coach removes a participant from a club competition, when the operation succeeds, then the individual competition and sports data remain available outside the club event.
```

- [ ] **Step 2: Update `spec-tech.md`**

Add data constraints:

```md
- **DAT-019**: `club_competitions.id_club_competition` is the club event business identifier.
- **DAT-020**: `competitions.club_competition_id` optionally links an individual competition participation to a club competition.
- **DAT-021**: Deleting or detaching a club competition link shall not delete combats or rankings for individual competitions.
```

Update `DAT-001` to include `club_competitions`.

- [ ] **Step 3: Update `docs/supabase-schema.md`**

Document the new table and nullable FK using the same style as the existing schema doc.

- [ ] **Step 4: Commit docs**

Run: `npm test`

Expected: PASS.

Commit:

```bash
git add spec.md spec-tech.md docs/supabase-schema.md
git commit -m "Update specs for club competitions"
```

---

## Task 6: Full Verification And PR

**Files:**
- No code changes unless verification reveals a defect.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: 74+ tests pass, 0 fail. The exact count may increase after new tests.

- [ ] **Step 2: Check git status**

Run: `git status --short --branch`

Expected: current implementation branch with no unstaged tracked changes. Existing unrelated `?? .github/` may remain untracked and must not be included.

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin coach-club-competitions
```

Expected: branch pushed.

- [ ] **Step 4: Create PR**

Run:

```bash
gh pr create --base main --head coach-club-competitions --title "Add coach club competitions" --body "## Résumé
- Ajoute les compétitions club créées par coach/admin.
- Lie chaque participant à une compétition individuelle conservée dans son parcours.
- Autorise le coach et les familles/judokas concernés à saisir les résultats selon leur périmètre.

## Tests
- npm test"
```

Expected: PR URL printed.

---

## Self-Review

- Spec coverage: club event creation, participant assignment, scoped writes, detaching without deleting sports data, existing individual creation, schema migration, and UI entry points are covered.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: the plan consistently uses `clubCompetitionId` in domain/read models and `club_competition_id` in SQL records.
