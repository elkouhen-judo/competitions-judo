# Mobile First Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the judo competition app faster and easier to use on phones during competitions.

**Architecture:** Keep the existing Google Apps Script structure and modify only the client-facing `Index.html`, plus a lightweight local Node verification script. CSS remains mobile-first, while tablet and desktop layouts are progressive enhancements.

**Tech Stack:** Google Apps Script HTML service, vanilla HTML/CSS/JavaScript, Node.js built-in `node:test` and `assert` for local static verification.

---

## File Structure

- Create: `tests/mobile-first-index.test.js`
  - Reads `Index.html` and checks for mobile-first UI markers that protect the intended ergonomics.
- Modify: `Index.html`
  - Updates CSS for compact mobile layout, sticky mobile actions, scan-friendly cards, and responsive desktop enhancement.
  - Updates rendered competition and combat card markup to remove noisy fields and emphasize high-value information.

## Task 1: Add Static Mobile-First Verification

**Files:**
- Create: `tests/mobile-first-index.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "Index.html"), "utf8");

test("competition cards avoid redundant mobile action rows", () => {
  assert.equal(html.includes("<span class=\"meta-label\">Action</span>"), false);
  assert.equal(html.includes("<span class=\"meta-value\">Ouvrir</span>"), false);
});

test("mobile action bars are available for primary form and detail actions", () => {
  assert.match(html, /\.mobile-action-bar\s*\{/);
  assert.match(html, /class="mobile-action-bar primary-action"/);
  assert.match(html, /class="form-actions mobile-action-bar"/);
});

test("combat cards expose result as a first-class badge", () => {
  assert.match(html, /\.result-badge\s*\{/);
  assert.match(html, /<span class="result-badge/);
});

test("small-screen layout is the base and desktop is progressive", () => {
  assert.match(html, /@media \(min-width: 721px\)/);
  assert.match(html, /\.topbar\s*\{[\s\S]*?padding: 12px 12px 8px;/);
  assert.match(html, /\.app-shell\s*\{[\s\S]*?padding: 0 0 calc\(96px \+ env\(safe-area-inset-bottom\)\);/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mobile-first-index.test.js`

Expected: FAIL because `tests/mobile-first-index.test.js` is new and `Index.html` still contains the redundant Action/Ouvrir row and lacks the new mobile action bar and result badge classes.

- [ ] **Step 3: Commit**

Git is not currently usable in this workspace because `.git` is empty. Skip the commit step here and record the limitation in the final response.

## Task 2: Update Mobile-First Layout CSS

**Files:**
- Modify: `Index.html`
- Test: `tests/mobile-first-index.test.js`

- [ ] **Step 1: Write minimal implementation**

In the `Index.html` `<style>` block:

- Set `.app-shell` mobile padding to `0 0 calc(96px + env(safe-area-inset-bottom))`.
- Reduce `.topbar` mobile padding to `12px 12px 8px`.
- Add `.mobile-action-bar` for sticky bottom mobile actions.
- Add `.result-badge`, `.combat-card`, `.combat-header`, `.combat-comment`, and `.card-meta` styles.
- Keep `@media (min-width: 721px)` as the desktop enhancement layer and make `.mobile-action-bar` static there.

- [ ] **Step 2: Run test to verify it passes for CSS markers**

Run: `node --test tests/mobile-first-index.test.js`

Expected: Still FAIL if markup is not updated yet, but CSS-related assertions should no longer be the failing assertions.

## Task 3: Simplify Competition Cards

**Files:**
- Modify: `Index.html`
- Test: `tests/mobile-first-index.test.js`

- [ ] **Step 1: Write minimal implementation**

In `renderCompetitions()`, remove this generated block from each card:

```html
<div class="meta-row">
  <span class="meta-label">Action</span>
  <span class="meta-value">Ouvrir</span>
</div>
```

Keep the button card itself clickable through the existing `onclick="openCompetition(this.dataset.id)"`.

- [ ] **Step 2: Run test to verify partial progress**

Run: `node --test tests/mobile-first-index.test.js`

Expected: The competition-card test passes. Remaining failures should point to combat badge or mobile action markup if those are not implemented yet.

## Task 4: Make Combat Cards Scannable

**Files:**
- Modify: `Index.html`
- Test: `tests/mobile-first-index.test.js`

- [ ] **Step 1: Write minimal implementation**

In `renderCombats()`, change each combat card to:

```html
<article class="card combat-card">
  <div class="combat-header">
    <p class="card-title">${escapeHtml(c.adversaire || "Adversaire non renseigné")}</p>
    <span class="result-badge result-${escapeAttribute(String(c.resultat || "").toLowerCase())}">${formatResultat(c.resultat)}</span>
  </div>
  <!-- existing admin judoka row when relevant -->
  <p class="combat-comment">${escapeHtml(c.commentaire || "Aucun commentaire")}</p>
  <div class="card-actions">
    <button class="button-secondary" data-id="${escapeAttribute(c.id_combat)}" onclick="showCombatForm(this.dataset.id)">Éditer</button>
    <button class="button-danger" data-id="${escapeAttribute(c.id_combat)}" onclick="deleteCombat(this.dataset.id)">Supprimer</button>
  </div>
</article>
```

Keep the admin-only judoka row between the header and comment.

- [ ] **Step 2: Run test to verify partial progress**

Run: `node --test tests/mobile-first-index.test.js`

Expected: The combat badge test passes. Remaining failures should point only to action-bar markup if not implemented yet.

## Task 5: Apply Sticky Mobile Action Bars

**Files:**
- Modify: `Index.html`
- Test: `tests/mobile-first-index.test.js`

- [ ] **Step 1: Write minimal implementation**

Update the detail action wrapper:

```html
<div class="mobile-action-bar primary-action">
  <button onclick="showCombatForm()">Ajouter un combat</button>
</div>
```

Update both form action wrappers:

```html
<div class="form-actions mobile-action-bar">
```

Keep the existing buttons and handlers unchanged.

- [ ] **Step 2: Run test to verify all static checks pass**

Run: `node --test tests/mobile-first-index.test.js`

Expected: PASS for all tests.

## Task 6: Final Verification

**Files:**
- Read: `Index.html`
- Run: `tests/mobile-first-index.test.js`

- [ ] **Step 1: Verify no Apps Script handlers were renamed**

Run: `rg -n "onclick=\"|function showCombatForm|function saveCombat|function renderCompetitions|function renderCombats" Index.html`

Expected: Existing handler names are still present.

- [ ] **Step 2: Run final test suite**

Run: `node --test tests/mobile-first-index.test.js`

Expected: PASS.

- [ ] **Step 3: Report Git limitation**

Mention that no commit was created because the workspace `.git` directory is empty and `git rev-parse --show-toplevel` fails.
