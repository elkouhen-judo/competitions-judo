# Agenda FFJDA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un agenda en lecture seule des événements FFJDA (national + ligues Pays de la Loire, Bretagne, Nouvelle-Aquitaine), synchronisé chaque jour par un cron Vercel, filtrable par ligue, type et mois.

**Architecture:** Analyseurs purs dans `core/domain/ffjudo/`, service de synchro dans `core/services/` (fetch injecté), dépôt Supabase dans `core/repositories/`, fonction `api/ffjudo-sync.js` déclenchée par Vercel Cron, méthode RPC `getFfjudoEvents`, écran Vue `ffjudoAgendaView`.

**Tech Stack:** Node ≥ 20, TypeScript compilé par esbuild (`core-dist/`), Supabase REST (service role), Vue 3 vendored, `node --test`, Playwright pour les captures.

**Spec:** `docs/superpowers/specs/2026-11-22-agenda-ffjda-design.md`

## Prérequis (avant la tâche 1)

Le dépôt contient un travail en cours non commité qui touche `docs/spec.md`, `core/types.ts`, `tests/mobile-first-index.test.js`, `assets/app-runtime-*.ts`. Le porteur doit le commiter ou le remiser avant de commencer ; sinon chaque commit de ce plan n'indexe que ses propres hunks (`git add -p`).

## Global Constraints

- Sources figées : `https://pays-de-la-loire-judo.ffjudo.com/evenement`, `https://judo-bretagne.ffjudo.com/evenement`, `https://nouvelle-aquitaine-judo.ffjudo.com/evenement`, `https://www.ffjudo.com/evenements/agenda/{N}`. Jamais d'URL `?mois=` ni `/recherches`.
- Au plus 1 requête par seconde vers ffjudo.com ; `User-Agent: Ayumi-agenda/1.0 (+https://competitions-judo.vercel.app/)` ; timeout 15 s par requête.
- `contactNom`, `contactTelephone`, `contactEmail`, `contenu`, `intro`, `commentaires` ne sont jamais copiés hors de l'analyseur (ni table, ni journal, ni fixture).
- Tables `ffjudo_events`, `ffjudo_sync_runs` : RLS activée, `revoke all … from anon, authenticated`, grants `service_role` seulement (SEC-002/003).
- Le niveau FFJDA (`niveau`) n'est pas stocké ni interprété.
- Après toute modification de `core/**/*.ts` : `npm run build:core` avant `node --test`. `npm test` à la fin de chaque tâche.
- Au plus 12 fichiers fonction dans `api/` (hors `_*.js`).
- Pas de `alert`/`confirm`/`prompt` dans l'UI.
- Commits sur `main`, message en français expliquant le pourquoi, après validation de la description technique par le porteur (AGENTS.md) ; pied de commit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Apostrophe ou guillemet dans un titre du JSON intégré → l'analyse ne s'arrête pas au premier `'` (tâche 1, test `parses JSON containing apostrophes`).
2. Une source répond 500 ou change de gabarit → les événements de cette source restent en base, le journal marque la source en `error` (tâche 5, test `keeps events of a failed source`).
3. Événement de fin décembre lu sur la page nationale en novembre (« 06.01 ») → l'année est l'année suivante, pas l'année courante (tâche 2, test `infers next year for early months`).
4. Libellé de comité tronqué (« Comité LOIRE ATLANTIQUE JUD ») ou inconnu → ligue résolue ou vide, jamais d'exception (tâche 3).
5. Aucun événement à venir ou filtres sans résultat → messages distincts, pas d'écran blanc (tâche 8, captures).

---

### Task 1: Analyseur des pages de ligue

**Files:**
- Create: `core/domain/ffjudo/ligue-page-parser.ts`, `core/domain/ffjudo/types.ts` (type-only, pas d'entrée esbuild), shim `core/domain/ffjudo/ligue-page-parser.js`
- Create: `tests/fixtures/ffjudo/ligue-pays-de-la-loire.html` (copie réduite de la page réelle : en-tête + `<input name="evenements">` avec ~15 événements dont 1 `local`, 1 titre avec apostrophe, contacts remplacés par `""`)
- Test: `tests/ffjudo-parsers.test.js`

**Interfaces:**
- Produces (`core/domain/ffjudo/types.ts`):
  ```ts
  export interface FfjudoEvent {
    eventKey: string;            // "fed:<id>" | "loc:<host>:<id_evenement>" | "nat:<slug>:<YYYY-MM-DD>"
    titre: string;
    dateDebut: string;           // YYYY-MM-DD (Europe/Paris)
    dateFin: string;             // "" si absente
    inscriptionOuverture: string;
    inscriptionCloture: string;
    typeEvenement: string;       // libelleType FFJDA, "" si inconnu
    lieu: string; ville: string; codePostal: string;
    proprietaire: string;
    sourceUrl: string;
    siteWeb: string;
    sources: string[];           // hosts où l'événement a été vu
  }
  ```
- Produces: `parseLiguePage(html: string, host: string): FfjudoEvent[]` (shim `module.exports = require("../../../core-dist/domain/ffjudo/ligue-page-parser.js")`, exporte aussi `default`).

- [ ] **Step 1: Write the failing tests** in `tests/ffjudo-parsers.test.js`:
  - `parses every event of the embedded JSON` : nombre d'événements = nombre dans la fixture.
  - `builds keys`: événement `federal` id `1143` → `eventKey === "fed:1143"` ; événement `local` id_evenement `2732` → `"loc:pays-de-la-loire-judo.ffjudo.com:2732"`.
  - `converts unix timestamps to Paris dates`: `date_debut "1795305600"` → `"2026-11-21"` ; `dateCloture ""` → `""`.
  - `builds source url`: `https://pays-de-la-loire-judo.ffjudo.com/evenement/<slug>/<id_evenement>`.
  - `parses JSON containing apostrophes`: titre de la fixture contenant `'` restitué entier.
  - `never exposes contacts`: `JSON.stringify(result)` ne contient aucune valeur des clés de contact de la fixture ni les clés `contact*`.
  - `returns [] without embedded input`: `parseLiguePage("<html></html>", host)` → `[]`.
- [ ] **Step 2:** `npm run build:core && node --test tests/ffjudo-parsers.test.js` → FAIL (module absent).
- [ ] **Step 3: Implement `parseLiguePage`.** Décoder les entités HTML de tout le document (`&quot;`, `&#039;`, `&amp;`, `&lt;`, `&gt;`, numériques), trouver `name="evenements" value='`, puis lire le JSON par décodage incrémental depuis cette position (parcours de profondeur d'accolades en respectant les chaînes JSON) — pas de regex jusqu'à `'`. Aplatir `{année:{mois:[…]}}`. Dates : `Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" })`.
- [ ] **Step 4:** `npm run build:core && node --test tests/ffjudo-parsers.test.js` → PASS.
- [ ] **Step 5: Commit** `feat(agenda): analyse le calendrier JSON des pages de ligue FFJDA`.

### Task 2: Analyseur de la page nationale

**Files:**
- Create: `core/domain/ffjudo/national-page-parser.ts` + shim `.js`
- Create: `tests/fixtures/ffjudo/national-page-1.html` (cartes `a.agenda__list__item` réelles + `<nav class="pagination-listing">`, scripts retirés)
- Test: `tests/ffjudo-parsers.test.js`

**Interfaces:**
- Consumes: `FfjudoEvent` (tâche 1).
- Produces: `parseNationalPage(html: string, today: string): { events: FfjudoEvent[]; lastPage: number }` — `today` au format `YYYY-MM-DD`.

- [ ] **Step 1: Write the failing tests:**
  - `parses national cards`: 24 événements ; premier : titre, `sourceUrl` `https://www.ffjudo.com/evenement/<slug>`, `lieu`, `typeEvenement` = texte de `.agenda__list__item__categorie`.
  - `reads last page`: `lastPage === 4`.
  - `infers next year for early months`: carte `06.01` avec `today "2026-11-22"` → `dateDebut "2027-01-06"` ; carte `28.11` → `"2026-11-28"`. Règle : mois de la carte < mois de `today` − 1 → année suivante.
  - `builds national key`: `eventKey === "nat:<slug>:<dateDebut>"`, `proprietaire === ""`, `sources` = `["www.ffjudo.com"]`.
  - `empty page`: `parseNationalPage("<html></html>", today)` → `{ events: [], lastPage: 1 }`.
- [ ] **Step 2:** build:core + test → FAIL.
- [ ] **Step 3: Implement** par regex sur les blocs `<a href="…/evenement/…" class="agenda__list__item">…</a>` (pas de dépendance DOM) ; textes nettoyés (entités, espaces).
- [ ] **Step 4:** build:core + test → PASS.
- [ ] **Step 5: Commit** `feat(agenda): analyse l'agenda national ffjudo.com`.

### Task 3: Rattachement organisateur → ligue

**Files:**
- Create: `core/domain/ffjudo/ligues.ts` + shim `.js`
- Test: `tests/ffjudo-parsers.test.js`

**Interfaces:**
- Produces: `LIGUES: readonly string[]` (libellés d'affichage : 13 ligues métropolitaines — `Auvergne-Rhône-Alpes`, `Bourgogne-Franche-Comté`, `Bretagne`, `Centre-Val de Loire`, `Corse`, `Grand Est`, `Hauts-de-France`, `Île-de-France`, `Normandie`, `Nouvelle-Aquitaine`, `Occitanie`, `Pays de la Loire`, `Provence-Alpes-Côte d'Azur` — plus `Guadeloupe`, `Guyane`, `Martinique`, `Mayotte`, `Nouvelle-Calédonie`, `Polynésie`, `Réunion`) et `NATIONAL_LIGUE = "National"`.
- Produces: `resolveLigue(proprietaire: string, sourceHost: string): string` — `""` si inconnue.

- [ ] **Step 1: Write the failing tests:**
  - `"Ligue PAYS-DE-LA-LOIRE JUDO"` → `"Pays de la Loire"` ; `"Ligue AUVERGNE-RHONE-ALPES JUDO"` → `"Auvergne-Rhône-Alpes"`.
  - `"Comité VENDEE JUDO"` → `"Pays de la Loire"` ; `"Comité LOIRE ATLANTIQUE JUD"` → `"Pays de la Loire"` ; `"Comité DEUX SEVRES JUDO"` → `"Nouvelle-Aquitaine"` ; `"Comité COTES D ARMOR JUDO"` → `"Bretagne"` ; `"Comité BOUCHES DU RHONE JUD"` → `"Provence-Alpes-Côte d'Azur"` ; `"Comité MAYOTTE"` → `"Mayotte"`.
  - `""` avec host `www.ffjudo.com` → `"National"` ; `""` avec host `judo-bretagne.ffjudo.com` (événement `local`) → `"Bretagne"`.
  - `"Comité INCONNU JUDO"` → `""` (pas d'exception).
- [ ] **Step 2:** build:core + test → FAIL.
- [ ] **Step 3: Implement.** Normaliser (majuscules, sans accents, `-`/`'` → espace, suffixes `JUDO`/`JUD`/`JU` retirés). Table département → ligue (les 101 départements, noms normalisés) ; correspondance par égalité, puis par préfixe pour les libellés tronqués. Table host → ligue pour les 3 sites synchronisés.
- [ ] **Step 4:** build:core + test → PASS.
- [ ] **Step 5: Commit** `feat(agenda): rattache chaque organisateur FFJDA à sa ligue`.

### Task 4: Schéma et dépôt

**Files:**
- Modify: `supabase/migrations/20260612000000_initial_schema.sql` (création idempotente + RLS + revoke + grants, aux emplacements des blocs existants)
- Create: `core/repositories/ffjudo-events.repository.ts`
- Modify: `core/repositories/types.ts` (types de lignes), `core/infra/supabase-rest.js` (ajout `supabaseUpsertMany`)
- Test: `tests/supabase-schema.test.js`, `tests/repository-mapping.test.js`

**Interfaces:**
- Table `ffjudo_events` : colonnes et types de la spec (`event_key text primary key`, `titre text not null`, `date_debut date not null`, `date_fin date`, `inscription_ouverture date`, `inscription_cloture date`, `type_evenement text not null default ''`, `lieu`, `ville`, `code_postal`, `proprietaire`, `ligue` `text not null default ''`, `source_url text not null`, `site_web text not null default ''`, `sources text[] not null default '{}'`, `synced_at timestamptz not null`) ; index sur `date_debut`.
- Table `ffjudo_sync_runs` : `id bigint generated always as identity primary key`, `started_at timestamptz not null`, `finished_at timestamptz`, `status text not null` (`ok` | `partial` | `error`), `sources jsonb not null default '{}'` (`{host: {status, count, error}}`), `event_count integer not null default 0`.
- Produces: `supabaseUpsertMany(table, payloads, onConflict): Promise<void>` (POST `?on_conflict=<col>`, `Prefer: resolution=merge-duplicates,return=minimal`, lots de 500), ajouté à `SupabaseRestDeps`.
- Produces: `createFfjudoEventsRepository(deps)` →
  ```ts
  upsertEvents(rows: FfjudoEventRow[]): Promise<void>;
  listFutureEventKeys(fromDate: string): Promise<{ event_key: string; sources: string[] }[]>;
  deleteEvents(eventKeys: string[]): Promise<void>;          // lots de 100 (PERF-004)
  listUpcoming(fromDate: string): Promise<FfjudoEventRow[]>; // order=date_debut.asc,titre.asc,event_key.asc
  insertRun(run: FfjudoSyncRunRow): Promise<void>;
  getLastSuccessfulRun(): Promise<FfjudoSyncRunRow | null>;  // status in (ok, partial), order=finished_at.desc
  ```

- [ ] **Step 1: Write the failing tests:** schéma — `create table if not exists public.ffjudo_events`, `… ffjudo_sync_runs`, `enable row level security` sur les deux, `revoke all on table public.ffjudo_events from anon, authenticated`, idem runs, grants `service_role`, absence de colonne `contact` ou `niveau`. Dépôt — avec des deps factices, `upsertEvents` appelle `supabaseUpsertMany("ffjudo_events", rows, "event_key")` ; `deleteEvents` de 250 clés → 3 appels ; `listUpcoming` passe `date_debut=gte.<date>` et un `order` stable.
- [ ] **Step 2:** build:core + test → FAIL.
- [ ] **Step 3: Implement** migration, `supabaseUpsertMany`, dépôt ; ajouter le dépôt à `core/index.js` comme les autres (`repositoryDeps`).
- [ ] **Step 4:** build:core + `node --test tests/supabase-schema.test.js tests/repository-mapping.test.js` → PASS.
- [ ] **Step 5:** Appliquer la migration sur le projet Supabase **dev** uniquement (procédure habituelle du projet) et vérifier les deux tables avec le MCP Supabase dev (lecture seule).
- [ ] **Step 6: Commit** `feat(agenda): tables et dépôt des événements FFJDA`.

### Task 5: Service de synchronisation

**Files:**
- Create: `core/services/ffjudo-sync.service.ts` + shim `.js`
- Test: `tests/ffjudo-sync.test.js`

**Interfaces:**
- Consumes: `parseLiguePage`, `parseNationalPage`, `resolveLigue`, dépôt tâche 4.
- Produces:
  ```ts
  createFfjudoSyncService(deps: {
    repository: FfjudoEventsRepository;
    fetchText: (url: string) => Promise<string>;   // lève si statut ≠ 2xx
    sleep: (ms: number) => Promise<void>;
    now: () => Date;
  }): { runSync(): Promise<FfjudoSyncReport> }
  // FfjudoSyncReport = { status: "ok" | "partial" | "error"; eventCount: number; sources: Record<string, { status: "ok" | "error"; count: number; error?: string }> }
  ```
- Constantes exportées : `LIGUE_SOURCES` (3 URLs), `NATIONAL_FIRST_PAGE = "https://www.ffjudo.com/evenements/agenda/1"`, `MAX_NATIONAL_PAGES = 10`, `REQUEST_DELAY_MS = 1000`.

- [ ] **Step 1: Write the failing tests** (fetch factice renvoyant les fixtures) :
  - `merges duplicates across ligues`: même `fed:1143` dans 2 ligues → 1 ligne, `sources` des 2 hosts.
  - `sets ligue on each row` via `resolveLigue`.
  - `waits between requests`: `sleep(1000)` appelé entre chaque `fetchText` ; pages nationales lues jusqu'à `lastPage` (borné à 10).
  - `keeps events of a failed source`: Bretagne lève → statut `partial`, aucun `deleteEvents` d'une clé dont une source est Bretagne.
  - `deletes vanished future events`: clé future en base, absente de la synchro, toutes ses sources en `ok` → supprimée ; clé passée jamais supprimée (`listFutureEventKeys(today)`).
  - `records a run`: `insertRun` appelé avec statut, compteurs, erreurs ; aucune clé `contact` dans le rapport.
  - `all sources fail`: statut `error`, aucune écriture d'événement.
- [ ] **Step 2:** build:core + test → FAIL.
- [ ] **Step 3: Implement** : lire séquentiellement, analyser, fusionner par `eventKey` (union de `sources`, champs non vides prioritaires), upsert, suppression ciblée, journal.
- [ ] **Step 4:** build:core + test → PASS.
- [ ] **Step 5: Commit** `feat(agenda): synchronisation quotidienne des événements FFJDA`.

### Task 6: Point d'entrée cron

**Files:**
- Create: `api/ffjudo-sync.js`
- Modify: `vercel.json` (`crons`, `functions["api/ffjudo-sync.js"].maxDuration = 60`), `core/config/env.js` (`getCronSecret()`, lève si absent), `core/index.js` (export `ffjudoSyncService` câblé avec `fetch` + `AbortSignal.timeout(15000)` + User-Agent des contraintes)
- Test: `tests/vercel-deployment.test.js`, `tests/ffjudo-sync.test.js`

**Interfaces:**
- `GET /api/ffjudo-sync` : `Authorization: Bearer <CRON_SECRET>` requis, sinon `401 { error: "Non autorisé." }` ; succès `200` avec le `FfjudoSyncReport` ; statut `error` → `500` avec le rapport.
- `vercel.json` : `"crons": [{ "path": "/api/ffjudo-sync", "schedule": "0 4 * * *" }]`.

- [ ] **Step 1: Write the failing tests:** déploiement — `crons` contient l'entrée exacte ; nombre de fonctions ≤ 12 (existant, doit rester vert avec 11). Handler — sans en-tête → 401 ; mauvais secret → 401 ; bon secret (service factice) → 200 et rapport.
- [ ] **Step 2:** `npm test` → FAIL sur les nouveaux tests.
- [ ] **Step 3: Implement** ; comparaison du secret en temps constant (`crypto.timingSafeEqual`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Sur dev : définir `CRON_SECRET` dans le projet Vercel `competitions-judo-dev`, déployer dev, appeler une fois `curl -H "Authorization: Bearer $CRON_SECRET" https://competitions-judo-dev.vercel.app/api/ffjudo-sync`, vérifier le rapport (`status` `ok`, ~400 événements) et l'absence de doublons (`select event_key, count(*) … having count(*) > 1` → 0 ligne). **Pas de prod.**
- [ ] **Step 6: Commit** `feat(agenda): cron Vercel quotidien pour l'agenda FFJDA`.

### Task 7: Lecture RPC

**Files:**
- Create: `core/services/ffjudo-agenda.service.ts` + shim `.js`
- Modify: `core/index.js` (ajouter `...ffjudoAgendaService.methods` à `methods`), `core/types.ts` (`RpcMethods.getFfjudoEvents`, types `FfjudoAgendaEvent`, `FfjudoAgenda`)
- Test: `tests/application-services.test.js`

**Interfaces:**
- Produces: `getFfjudoEvents(email: string): Promise<FfjudoAgenda>` avec
  `FfjudoAgenda = { events: FfjudoAgendaEvent[]; lastSyncAt: string /* ISO, "" si jamais */ }` et
  `FfjudoAgendaEvent = { eventKey, titre, dateDebut, dateFin, inscriptionCloture, typeEvenement, lieu, ville, ligue, proprietaire, sourceUrl }` (camelCase).
- Accessible à tout utilisateur reconnu par le contexte (`userContextService.getIdentity(email)` non nul), sinon `Error("Accès refusé.")`.

- [ ] **Step 1: Write the failing tests:** utilisateur `JUDOKA` → événements à partir d'aujourd'hui (Europe/Paris) dans l'ordre du dépôt ; `lastSyncAt` = `finished_at` du dernier run réussi ; email inconnu → rejet ; aucun champ hors de `FfjudoAgendaEvent`.
- [ ] **Step 2:** build:core + test → FAIL.
- [ ] **Step 3: Implement** (2 lectures en parallèle, PERF-002).
- [ ] **Step 4:** build:core + `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(agenda): lecture des événements FFJDA pour tous les profils`.

### Task 8: Écran « Agenda FFJDA »

**Files:**
- Create: `assets/views/ffjudo-agenda.html` (vue `ffjudoAgendaView`), `assets/app-screen-ffjudo-agenda.ts`
- Modify: `api/app.js` (`VIEW_PARTIAL_FILES["ffjudo-agenda"]`), `Index.html` (emplacement du partiel), `scripts/build-assets.js` (entrée), `assets/global.d.ts` + `assets/types.ts` (`AppScreens.ffjudoAgenda`, `createKirokuFfjudoAgendaScreen`), `assets/app-runtime*.ts` (instanciation + restauration de navigation comme `coachDashboardView`), `assets/views/home.html` + `assets/app-screen-home.ts` (entrée « Agenda FFJDA » visible pour tous les profils)
- Test: `tests/mobile-first-index.test.js`, nouveau `tests/ffjudo-agenda-visual.test.js` (Playwright, données RPC simulées comme les tests visuels existants)

**Interfaces:**
- Consumes: `getFfjudoEvents` via `app.runServer("getFfjudoEvents", [], onSuccess, onError)`.
- Produces: `screens.ffjudoAgenda.showFfjudoAgenda(): void`.
- Modèle : `assets/app-screen-coach-dashboard.ts` (création, `showView`, retour accueil).

Comportement :
- Filtres `Ligue` (options = ligues présentes dans les données, triées, `National` en premier, `Autre` pour `""`), `Type` (valeurs présentes), `Mois` (mois présents, libellé « décembre 2026 ») ; option « Toutes/Tous » par défaut ; filtrage côté navigateur.
- Groupes par mois, cartes : date `dd/mm` (ou `dd/mm → dd/mm` si `dateFin` différente), titre, `ville` (sinon `lieu`), type, `proprietaire — ligue`, lien `Voir sur ffjudo.com` (`target="_blank" rel="noopener"`), mention « Inscriptions jusqu'au dd/mm » si `inscriptionCloture` future.
- En-tête : « Mis à jour le dd/mm/yyyy à hh:mm » ; si `lastSyncAt` vide : « Pas encore synchronisé ».
- États et textes exacts : chargement « Chargement de l'agenda… » ; vide « Aucun événement à venir. » ; filtres sans résultat « Aucun événement pour ces filtres. » + bouton « Effacer les filtres » ; erreur « Impossible de charger l'agenda. » + bouton « Réessayer » ; hors ligne sans liste déjà chargée dans la session « L'agenda n'est pas disponible hors connexion. » (mise en cache persistante laissée hors de ce plan, cf. spec « Laissé au constructeur »).

- [ ] **Step 1:** Captures **avant** (accueil JUDOKA et COACH, 375 px et 1280 px) dans `output/playwright/agenda-before-*.png`.
- [ ] **Step 2: Write the failing tests:** `mobile-first-index` — la vue `ffjudoAgendaView` existe dans le HTML assemblé, l'entrée d'accueil existe, pas de `alert(`/`confirm(`/`prompt(` ; respecter les patterns verrouillés (`showHome()` < 300 caractères, `createMountedViewModel` sur une ligne). Visuel — liste groupée, filtre Ligue = « Bretagne » ne montre que des cartes Bretagne, état vide, état erreur.
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4: Implement** la vue, l'écran, l'entrée d'accueil, la navigation (hash restauré, VCL-020).
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Captures **après** (accueil + agenda, 375 px et 1280 px, états liste/vide/erreur) dans `output/playwright/agenda-after-*.png` ; comparer visuellement avec l'avant (texte long, petit écran, contraste) et corriger.
- [ ] **Step 7: Commit** `feat(agenda): écran Agenda FFJDA filtrable par ligue`.

### Task 9: Documentation

**Files:**
- Modify: `docs/spec.md` (nouvelle section « 3.12 FFJDA agenda rules » : `AGD-001`… — visibilité tous profils, événements à venir triés, filtres ligue/type/mois, lien source, états, aucune donnée de contact, synchro quotidienne, conservation en cas d'échec de source) ; `docs/spec-tech.md` (`DAT` pour les deux tables, `ARC` pour `api/ffjudo-sync.js` et le cron, `SEC` pour `CRON_SECRET` et l'exclusion des contacts, `CFG-015: CRON_SECRET is required for /api/ffjudo-sync`).
- Test: aucun nouveau ; `npm test`.

- [ ] **Step 1:** Rédiger les règles (une règle = une responsabilité, identifiants stables).
- [ ] **Step 2:** `npm test` → PASS ; `git status` propre hors fichiers attendus.
- [ ] **Step 3: Commit** `docs(agenda): règles fonctionnelles et techniques de l'agenda FFJDA`.

## Après le plan

- Description technique au porteur, validation, puis push.
- Production : seulement après l'accord de la FFJDA et le feu vert explicite du porteur (`CRON_SECRET` prod, migration prod, déploiement via `/deploy`).
