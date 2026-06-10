# Competition Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each judoka to manage their own competitions while admins can manage every competition.

**Architecture:** Keep the existing Google Apps Script backend and vanilla client. Use `Competitions.id_judoka` as the ownership source of truth, add small backend helpers for ownership checks, and update the UI to expose competition management to users who can manage the current competition.

**Tech Stack:** Google Apps Script JavaScript, HTML Service, vanilla HTML/CSS/JavaScript, Node.js `node:test` static verification.

---

## File Structure

- Modify: `Code.js`
  - Add ownership checks for competitions.
  - Require and write `id_judoka` in `Competitions`.
  - Allow non-admin owners to save and delete their own competitions.
- Modify: `Index.html`
  - Show competition creation to all authenticated users.
  - Show edit/delete controls when `canManageCompetition` is true.
  - Add admin-only owner selector to the competition form.
- Create: `tests/competition-ownership.test.js`
  - Static tests protecting backend and client ownership behavior.

## Task 1: Add Ownership Test Coverage

**Files:**
- Create: `tests/competition-ownership.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const code = fs.readFileSync(path.join(__dirname, "..", "Code.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "Index.html"), "utf8");

test("competitions are filtered by explicit owner for non-admin users", () => {
  assert.match(code, /function canManageCompetition\(user,\s*competition\)/);
  assert.match(code, /String\(competition\.id_judoka\)\s*===\s*String\(user\.id_judoka\)/);
  assert.match(code, /return competitions\.filter\(c =>\s*canManageCompetition\(user,\s*c\)\s*\)/);
});

test("saving a competition is allowed for owners and writes id_judoka", () => {
  assert.doesNotMatch(code, /Création et modification de compétition réservées aux admins/);
  assert.match(code, /const ownerJudokaId = resolveCompetitionOwnerId\(user,\s*competition\)/);
  assert.match(code, /sheet\.getRange\(i \+ 1,\s*judokaIdIndex \+ 1\)\.setValue\(ownerJudokaId\)/);
  assert.match(code, /sheet\.appendRow\(\[\s*idCompetition,\s*ownerJudokaId,/);
});

test("deleting a competition requires admin or owner and keeps cascade delete", () => {
  assert.match(code, /if \(!canManageCompetition\(user,\s*competition\)\)/);
  assert.match(code, /Suppression de cette compétition non autorisée/);
  assert.match(code, /combatSheet\.deleteRow\(i \+ 1\)/);
});

test("client shows competition management based on canManageCompetition", () => {
  assert.match(html, /let canManageCurrentCompetition = false;/);
  assert.match(html, /canManageCurrentCompetition = Boolean\(data\.canManageCompetition\);/);
  assert.match(html, /classList\.toggle\("hidden",\s*!canManageCurrentCompetition\)/);
  assert.match(html, /id="competitionOwnerBlock" class="hidden full-row"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/competition-ownership.test.js`

Expected: FAIL because `canManageCompetition`, `resolveCompetitionOwnerId`, `canManageCurrentCompetition`, and the owner selector do not exist yet.

## Task 2: Implement Backend Ownership Rules

**Files:**
- Modify: `Code.js`
- Test: `tests/competition-ownership.test.js`

- [ ] **Step 1: Write minimal implementation**

Add helpers after `isAdmin(user)`:

```javascript
function canManageCompetition(user, competition) {
  if (isAdmin(user)) {
    return true;
  }

  return String(competition.id_judoka) === String(user.id_judoka);
}

function resolveCompetitionOwnerId(user, competition) {
  const ownerJudokaId = isAdmin(user)
    ? competition.id_judoka
    : user.id_judoka;

  if (!ownerJudokaId) {
    throw new Error("Judoka propriétaire obligatoire.");
  }

  return ownerJudokaId;
}
```

Update `getCompetitionsForUser(user)` to:

```javascript
if (isAdmin(user)) {
  return competitions;
}

return competitions.filter(c => canManageCompetition(user, c));
```

Update `getCompetitionDetail(id_competition)` to reject non-owners before combat filtering and return `canManageCompetition`.

Update `saveCompetition(competition)` to use headers `id_competition`, `id_judoka`, `nom`, `date`, `lieu`, remove the admin-only guard, check ownership before modifying existing rows, and append rows as `[idCompetition, ownerJudokaId, competition.nom, competition.date, competition.lieu || ""]`.

Update `deleteCompetition(id_competition)` to read the competition row as an object, call `canManageCompetition(user, competition)`, and keep the existing cascade delete loop.

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/competition-ownership.test.js`

Expected: PASS.

## Task 3: Implement Client Ownership Controls

**Files:**
- Modify: `Index.html`
- Test: `tests/competition-ownership.test.js`

- [ ] **Step 1: Write minimal implementation**

Add `let canManageCurrentCompetition = false;` near current state.

Show `homeAdminActions` for everyone by removing the `isAdmin` toggle and renaming the concept in place as a competition creation toolbar.

Add an admin-only owner block in the competition form:

```html
<div id="competitionOwnerBlock" class="hidden full-row">
  <label for="competition_id_judoka">Judoka propriétaire</label>
  <select id="competition_id_judoka"></select>
</div>
```

In `openCompetition()`, assign `canManageCurrentCompetition = Boolean(data.canManageCompetition);`.

In `renderCompetitionDetail()`, toggle `competitionAdminActions` with `!canManageCurrentCompetition`.

In `showCompetitionForm()`, show and fill the owner selector only for admins. Include `id_judoka` in `saveCompetition()` payload when admin.

- [ ] **Step 2: Run ownership and existing tests**

Run: `node --test tests/*.test.js`

Expected: PASS.

## Task 4: Final Verification

**Files:**
- Read: `Code.js`
- Read: `Index.html`
- Run: `tests/*.test.js`

- [ ] **Step 1: Check handler names**

Run: `rg -n "function saveCompetition|function deleteCompetition|function getCompetitionDetail|function showCompetitionForm|function saveCompetition\\(\\)" Code.js Index.html`

Expected: Existing Apps Script and client handler names remain present.

- [ ] **Step 2: Run final tests**

Run: `node --test tests/*.test.js`

Expected: PASS.

- [ ] **Step 3: Record git limitation if needed**

Run: `git status --short`

Expected: Shows modified files. Commit may fail if `.git` remains read-only in this sandbox.
