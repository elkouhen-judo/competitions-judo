# Backlog

## Multi-club (revue du 21/11/2026, vue du coach de plusieurs clubs)

Objectif : un coach de plusieurs clubs sait toujours de quel club il parle, et lit chaque club séparément ou ensemble sans fausser les chiffres.

### Faits vérifiés dans le code

- Le serveur cloisonne bien les clubs : compétition club d'un autre club traitée comme introuvable, participants hors club refusés, club du tableau de bord revérifié (CLUB-005). Aucune faille trouvée.
- Le nom du club n'apparaît que dans les filtres « Club » (accueil, statistiques, création d'une compétition club) et l'écran admin. Les cartes de compétition club, l'agenda du coach, la fiche d'une compétition club, la liste « Judokas » et les suggestions de compétitions des statistiques ne le donnent pas.
- Le club choisi sur l'accueil (`state.selectedClubId`) vit en mémoire : il revient à « Tous mes clubs » à chaque rechargement. Le choix de l'enfant, lui, est retenu sur l'appareil (ACCUEIL-2).
- Le filtre club des statistiques ne suit le club de l'accueil qu'à la première ouverture (DASH-002). Changer de club sur l'accueil ensuite ne change pas les statistiques.
- Les statistiques filtrent sur le club actuel du judoka (`judokas.club_id`, fonction `coach_dashboard_data`). Un judoka passé du club A au club B emporte tout son historique dans B : les saisons passées de A perdent ses résultats, la comparaison d'une année sur l'autre (DASH-028) est faussée.
- Sur « Tous mes clubs », le périmètre des statistiques ajoute le profil du coach lui-même (`judokaIds: [coach]`), même s'il n'est inscrit dans aucun de ses clubs.
- Sur « Tous mes clubs », les statistiques additionnent les clubs. Rien ne permet de voir les clubs côte à côte.
- L'outil MCP `coach.dashboard` n'accepte ni `clubId` ni dates, et décrit des filtres `gender`, `handedness`, `categoryYear` que le service ignore. `judokas.search` et `competitions.search` n'ont pas de filtre club.
- Un profil `PARENT` ne peut pas devenir `COACH` (`admin.service.ts`). Un coach parent d'un judoka doit donc avoir deux comptes.

### Décisions prises (21/11/2026)

- MULTI-3 : un seul filtre club pour l'accueil et les statistiques.
- MULTI-4 : seul le coach crée une compétition, et il la rattache à un club. Une famille ou un judoka ne crée plus de compétition hors compétition club (fin de COMP-006).
- MULTI-4 : aucune compétition n'a été créée par une famille à ce jour : aucune reprise de données. Pas de nouvelle colonne : le club d'un résultat est celui de sa compétition club ; une participation détachée (COMP-018) compte pour le club actuel du judoka.

### Questions ouvertes

- Coach parent : faut-il permettre à un compte coach de suivre ses enfants (onglet « Famille »), ou garder deux comptes ? Hors backlog tant que ce n'est pas tranché.

### Savoir de quel club on parle

#### MULTI-1 — Le club affiché partout où il manque (P1, S) — fait

- Constat : sur « Tous mes clubs », deux « Interclubs » du même jour, l'un par club, sont indiscernables sur l'accueil, l'agenda et dans les statistiques.
- Règle : pour un coach de plusieurs clubs, le nom du club s'affiche sur les cartes de compétition club, les lignes de l'agenda, la fiche d'une compétition club (sous le titre), les suggestions de la liste « Judokas » et les suggestions de compétitions des statistiques.
- Règle : le nom n'est pas répété quand un club précis est choisi dans le filtre ; il reste sur la fiche d'une compétition club.
- Règle : un coach d'un seul club ne voit aucun nom de club.
- Règle : aucune donnée nouvelle n'est lue ; le nom vient de `state.clubs`.
- Acceptation : sur « Tous mes clubs », deux compétitions de même nom et même date se distinguent par leur club.
- Acceptation : un coach d'un seul club voit les mêmes écrans qu'avant.
- Fichiers : `assets/app-screen-home.ts`, `assets/views/home.html`, `assets/app-screen-club-competition.ts`, `assets/views/club-competition-detail.html`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (CLUB-008, UIX-015), `tests/clubs.test.js`, `tests/mobile-first-index.test.js`.

#### MULTI-2 — Le club choisi est retenu sur l'appareil (P2, S) — fait

- Constat : chaque rechargement remet l'accueil sur « Tous mes clubs ». Le coach qui ne suit qu'un club à la fois le rechoisit à chaque ouverture.
- Règle : le club choisi sur l'accueil est retenu sur l'appareil, par compte, comme le choix de l'enfant (ACCUEIL-2).
- Règle : un club retenu qui n'est plus coaché revient à « Tous mes clubs ».
- Règle : la déconnexion efface le choix retenu.
- Acceptation : après un rechargement, l'accueil s'ouvre sur le club choisi avant.
- Acceptation : un coach retiré du club retenu retrouve « Tous mes clubs » sans erreur.
- Fichiers : `assets/app-screen-home.ts`, `assets/app-runtime.ts`, `assets/app-auth.ts`, `docs/spec.md` (CLUB-008), `tests/clubs.test.js`.

#### MULTI-3 — Un même club sur l'accueil et les statistiques (P2, S) — fait

- Constat : après une première ouverture de « Stats », changer de club sur l'accueil ne change pas les statistiques. Le coach lit les chiffres d'un autre club sans le voir.
- Règle : le filtre club de l'accueil et celui des statistiques ne font qu'un : changer l'un change l'autre.
- Règle : les statistiques ouvertes depuis une compétition club (DASH-019) gardent leur périmètre et ne modifient pas le club de l'accueil.
- Règle : « Réinitialiser » des statistiques garde le club choisi.
- Acceptation : choisir le club B sur l'accueil puis ouvrir « Stats » affiche les statistiques de B, même après une ouverture précédente sur A.
- Fichiers : `assets/app-screen-coach-dashboard.ts`, `assets/app-screen-home.ts`, `docs/spec.md` (DASH-002, CLUB-008), `tests/coach-competition-stats-visual.test.js`.

### Lire juste par club

#### MULTI-4 — Un résultat reste au club où il a été obtenu (P1, L) — fait

- Constat : les statistiques filtrent sur le club actuel du judoka. Après un changement de club, ses résultats passés quittent le club A et entrent dans le club B.
- Constat : le coach de A et B qui transfère un judoka voit la progression des deux clubs faussée d'une saison sur l'autre.
- Règle : une participation liée à une compétition club compte pour le club de cette compétition (`club_competitions.club_id`).
- Règle : seul le coach crée une compétition, depuis une compétition club ; une famille ou un judoka ne crée plus de compétition (COMP-006), écrans, API et MCP confondus.
- Règle : une participation détachée d'une compétition club supprimée (COMP-018) compte pour le club actuel du judoka.
- Règle : l'accès suit toujours le club actuel du judoka (CLUB-003) ; seule l'attribution des statistiques change.
- Règle : le filtre club des statistiques et la comparaison de période (DASH-028) utilisent cette attribution.
- Règle : `getCoachDashboard` reste à 3 requêtes Supabase (PERF-009).
- Règle : la migration est appliquée sur dev, vérifiée, puis sur prod, avant le déploiement.
- Acceptation : un judoka passé de A à B garde ses podiums de la saison passée dans A ; ceux de la nouvelle saison comptent dans B.
- Acceptation : sans changement de club, les chiffres sont identiques avant et après.
- Fichiers : `supabase/migrations/`, `core/services/coach-dashboard.service.ts`, `core/services/coach-dashboard-loader.ts`, `core/services/competitions.service.ts`, `core/repositories/competitions.repository.ts`, `docs/spec.md` (CLUB-003, DASH-028), `docs/spec-tech.md`, `docs/supabase-schema.md`, `docs/metrics.md`, `tests/application-services.test.js`, `tests/loading-performance.test.js`, `tests/supabase-schema.test.js`.

#### MULTI-5 — Le coach hors des statistiques de ses clubs (P3, S) — fait

- Constat : sur « Tous mes clubs », le profil du coach est ajouté au périmètre des statistiques. Un coach qui combat encore compte ses propres résultats dans ceux de ses clubs.
- Règle : le périmètre des statistiques ne contient que les judokas des clubs choisis.
- Règle : le coach inscrit dans un de ses clubs y compte comme tout judoka.
- Acceptation : un coach sans club de judoka ne modifie pas les chiffres de « Tous mes clubs » en saisissant une compétition.
- Fichiers : `core/services/coach-dashboard.service.ts`, `tests/application-services.test.js`.

#### MULTI-6 — Comparer ses clubs (P2, M) — fait

- Constat : sur « Tous mes clubs », les statistiques additionnent les clubs. Le coach ne voit pas lequel progresse.
- Règle : sur « Tous mes clubs », une section « Par club » donne, pour chaque club, les judokas engagés, les participations, les combats, les victoires et les podiums.
- Règle : un club sous le seuil de 2 judokas (DASH-027) est listé sans chiffres ; un taux n'est affiché qu'à partir de 5 combats (DASH-011).
- Règle : la section n'apparaît pas pour un coach d'un seul club ni quand un club est choisi.
- Règle : aucune donnée propre à un judoka (DASH-026) ; `getCoachDashboard` reste à 3 requêtes (PERF-009).
- Acceptation : la somme des combats des clubs égale la tuile « Combats ».
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md`, `docs/metrics.md`, `tests/domain-model.test.js`, `tests/coach-competition-stats-visual.test.js`.

### Assistant MCP

#### MULTI-7 — Le club dans les outils MCP du coach (P2, S) — fait

- Constat : `coach.dashboard` ne peut viser ni un club ni une période, et annonce des filtres (`gender`, `handedness`, `categoryYear`) que le service ignore.
- Constat : `judokas.search` et `competitions.search` ne filtrent pas par club et ne disent pas le club des résultats.
- Règle : `coach.dashboard` accepte `clubId`, `dateFrom` et `dateTo`, les mêmes filtres que l'écran (DASH-002), et plus aucun autre.
- Règle : un outil `clubs.list` donne les clubs du coach (identifiant et nom).
- Règle : `judokas.search` et `competitions.search` acceptent un filtre club ; chaque résultat donne le nom de son club.
- Règle : un club non coaché est refusé comme à l'écran (CLUB-005).
- Acceptation : « statistiques du club B cette saison » se fait en deux appels : `clubs.list`, puis `coach.dashboard`.
- Fichiers : `core/services/mcp-server.service.ts`, `core/services/coach-mcp-tools.ts`, `core/services/coach-assistant-search.ts`, `docs/spec.md` (MCP-*), `tests/` (tests MCP).
