# Agenda FFJDA — filtre UV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtrer l'agenda par UV (UV1–UV4, cumulatif) et afficher les UV des séances d'examen.

**Architecture:** Fonction pure `detectUvs(titre, typeEvenement)` dans `core/domain/ffjudo/uv.ts`, appliquée par `getFfjudoEvents` (champ `uvs`) ; filtre à bascule dans l'écran agenda.

**Tech Stack:** TypeScript (esbuild), `node --test`, Vue 3, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-agenda-filtre-uv-design.md`

## Global Constraints

- Pas de migration, pas de resynchro.
- `npm run build:core` avant les tests après modification de `core/**/*.ts` ; `npm test` en fin de tâche.
- Pas de `alert`/`confirm`/`prompt`. Mobile first, captures avant/après 375 px et desktop.

## Review Focus

1. « Stage UV2 » → aucune UV.
2. « TEC » dans un mot (« TECHNIQUE ») → pas d'UV3.
3. « UV1/2/3b » → UV1, UV2, UV3.
4. Aucune UV cochée → filtre inactif ; UV1 + UV2 cochées → seules les séances proposant les deux.
5. « Effacer les filtres » décoche les UV.

---

### Task 1: Détection des UV

**Files:** Create `core/domain/ffjudo/uv.ts` + shim `uv.js` ; Test `tests/ffjudo-parsers.test.js`.

**Interfaces:** Produces `detectUvs(titre: string, typeEvenement: string): ("UV1" | "UV2" | "UV3" | "UV4")[]` (triées, sans doublon).

- [ ] Tests (titres réels) : « Examen UV1/2/3b n°1 » → UV1,UV2,UV3 ; « PASSAGE DE GRADE 1ER & 2ÈME DAN UV1-UV2 » → UV1,UV2 ; « PASSAGE DE GRADE BFC UV1 UV2 UV3-B » → UV1,UV2,UV3 ; « CD29 - Examen UV2 + VOLET B UV3 » → UV2,UV3 ; « TEC - UV 3 » → UV3 ; « TEST EFFICACITE COMBAT DU 1ER AU 4EME DAN » (PASSAGE DE GRADE) → UV3 ; « SHIAI 1D 2D 3D BAR SUR AUBE » → UV3 ; « CD 22 : EXAMEN UV4 » → UV4 ; « ENGAGEMENT PERSONNEL UV 4 JUJITSU » → UV4 ; « (OCC) PASSAGE DE GRADE - TOULOUSE - UV3 1D, 2D & 3D ET UV4 3D & 4D » → UV3,UV4 ; « PASSAGE GRADES UV1 1er,2ième,3ième & 4ième DAN » → UV1 ; « CD 22 Stage UV2 n°1Cotes d'Armor » → [] ; « PASSAGE DE GRADE » → [] ; « CD56 STAGE JUJITSU TECHNIQUE » (STAGE) → [] ; « TOURNOI EXCELLENCE CADETS » (COMPETITION) → [].
- [ ] RED, implémentation, GREEN.

### Task 2: Champ `uvs` dans `getFfjudoEvents`

**Files:** Modify `core/services/ffjudo-agenda.service.ts`, `core/types.ts` (`FfjudoAgendaEvent.uvs: string[]`) ; Test `tests/ffjudo-sync.test.js`.

- [ ] Test : la ligne « Examen UV1/2/3b n°1 » (PASSAGE DE GRADE) sort avec `uvs: ["UV1","UV2","UV3"]` ; le test existant attend `uvs: []` pour un tournoi.
- [ ] RED, implémentation, GREEN.

### Task 3: Filtre UV dans l'écran

**Files:** Modify `assets/views/ffjudo-agenda.html`, `assets/app-screen-ffjudo-agenda.ts`, `assets/app.tailwind.css` ; Test `tests/ffjudo-agenda-visual.test.js`.

- [ ] Captures avant (liste agenda 375 / desktop).
- [ ] Test : boutons `#ffjudoAgendaUv1`…`Uv4` (`aria-pressed`) ; données avec séances UV1+UV2, UV2 seule, UV3 ; cocher UV1 → 1 ; cocher UV1 + UV2 → 1 (celle qui a les deux) ; UV2 seule → 2 ; étiquettes « UV1 · UV2 » sur la carte ; « Effacer les filtres » décoche.
- [ ] RED, implémentation, GREEN ; captures après comparées.

### Task 4: Règles

- [ ] `docs/spec.md` : AGD-012 (détection), AGD-013 (filtre cumulatif, étiquettes) ; `npm test`.
