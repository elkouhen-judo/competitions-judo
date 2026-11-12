# Backlog optimisation du chargement

Issu de la revue du 12/11/2026, faite par lecture du code. Les décomptes de requêtes sont exacts ; les temps ne sont pas mesurés (voir MESURE-1).

- Priorité : P1 (ralentit tous les écrans), P2 (ralentit un parcours), P3 (confort ou prévention).
- Effort : S (≤ 1 jour), M (2-3 jours), L (≥ 1 semaine).
- Chaque story donne le constat, la règle visée et le critère d'acceptation.

## Vue d'ensemble

La lenteur vient du nombre d'allers-retours vers Supabase, faits l'un après l'autre à chaque appel RPC, et non du volume de données.

| Action (profil coach) | Requêtes Supabase en série aujourd'hui | Cible |
|---|---|---|
| Ouverture de l'appli (`getInitialData`) | 9 + 1 par tranche de 100 compétitions | 3 étapes |
| Ouverture d'une compétition (`getCompetitionDetail`) | 9 ou plus | 3 étapes |
| Enregistrer un combat puis réaffichage | une vingtaine + 1 par point marqué | 6 étapes |

Une « étape » est un groupe de requêtes lancées en parallèle.

Il n'existe aucune pagination côté serveur. Les listes sont chargées en entier puis découpées par 10 dans le navigateur (`paginateList`). Les lots de 100 des dépôts servent à limiter la longueur de l'URL, pas à paginer.

## Avancement au 12/11/2026

Les 21 stories sont implémentées dans l'arbre de travail (tests : 352/352, hors ligne : 4/4). Rien n'est déployé ni commité.

Écarts assumés par rapport au texte des stories :

| Story | Écart |
|---|---|
| MESURE-1 | L'en-tête `Server-Timing` et la ligne de journal existent. Les temps en millisecondes ne sont pas relevés : `docs/metrics.md` donne les décomptes de requêtes et d'étapes. |
| INFRA-1 | `regions` vaut `dub1` : la base de production est en `eu-west-1`. La base dev est en `eu-central-1` ; le seuil de 20 ms n'y sera pas tenu. Latence non mesurée. |
| AUTH-1 | Les deux projets signent en ES256 : le jeton est vérifié par les clés publiques JWKS, lues une fois par instance puis gardées 10 minutes ; un identifiant de clé inconnu les fait relire au plus une fois toutes les 30 s. Un jeton HS256 n'est accepté qu'avec un `SUPABASE_JWT_SECRET` d'au moins 32 caractères. |
| CTX-1 | Sans migration : l'e-mail reste cherché avec `ilike`, l'index `lower(email)` n'est pas utilisé. |
| INIT-2 | Pas de vue SQL : le résultat de chaque combat est lu avec sa compétition (`combats(resultat)`). |
| DETAIL-1 | La compétition et ses combats sont lus en même temps que le contexte ; rien n'est renvoyé avant le contrôle d'accès. |
| DETAIL-2 | Les suggestions sont gardées dans le cache local par judoka : hors connexion, elles ne sont disponibles que si le formulaire a déjà été ouvert en ligne pour ce judoka. |
| ECRIT-2 | Les actions de « Gestion des accès » relisent l'écran de gestion, sans `getInitialData`. Les identifiants de compétition sont aléatoires, pour créer plusieurs participations en un envoi. |
| PAGE-1 | Le plafond `max rows` n'a pas été relevé : chaque liste demande le total (`count=exact`) et lit les pages manquantes, quel que soit le plafond. |
| PAGE-2 | Les compétitions club suivent la même règle de saison. Une saison passée se recharge à chaque ouverture de l'appli (bouton « Voir la saison ») ; hors connexion elle vient du cache. La recherche MCP garde tout l'historique. |
| PAGE-3 | La recherche accepte plusieurs mots (nom, prénom, e-mail). L'onglet Clubs ne lit plus que les coachs et un décompte par club. |
| ADMIN-1 | Avec la pagination, les admins ne peuvent plus être déduits de la liste des utilisateurs : ils gardent leur lecture, lancée en parallèle. |
| SHELL-2 | Le JS et le CSS restent servis par `/api/client` et `/api/styles`, avec l'empreinte en paramètre `v`. |

À vérifier avant mise en production :

1. Les requêtes à jointure (`coach_clubs(id_club)`, `parent_judokas!parent_judokas_id_parent_fkey(id_judoka)`, `judokas!inner(club_id)`, `combats(resultat)`, `combat_scores(*)`) n'ont été exécutées que sur un faux Supabase. Les tester sur dev avec un compte coach, un parent et un judoka.
2. La connexion sur dev, pour confirmer la vérification locale du jeton.
3. Le relevé `Server-Timing` avant et après déploiement.

## Ordre de traitement proposé

| Lot | Objectif | Stories |
|---|---|---|
| 1 | Mesurer, puis retirer du temps à tous les appels | MESURE-1, INFRA-1, AUTH-1, CTX-1 |
| 2 | Ouverture de l'appli et d'une compétition | INIT-1, INIT-2, DETAIL-1, DETAIL-2 |
| 3 | Enregistrements | ECRIT-1, ECRIT-2, ECRIT-3 |
| 4 | Pagination et volumes | PAGE-1 à PAGE-4 |
| 5 | Coach et admin | COACH-1, COACH-2, ADMIN-1 |
| 6 | Coquille de l'appli | SHELL-1 à SHELL-3 |

## 1. Mesure et socle

### MESURE-1 — Chronométrer chaque appel RPC (P1, S)

- Constat : aucun temps n'est mesuré. NAV-3 notait déjà « le temps de réponse du serveur n'a pas été mesuré ni optimisé ».
- Règle : `/api/rpc` renvoie un en-tête `Server-Timing` avec la durée totale, la durée d'authentification, le nombre de requêtes Supabase et leur durée cumulée.
- Règle : la même ligne est écrite dans les journaux Vercel, avec le nom de la méthode.
- Acceptation : l'onglet Réseau du navigateur affiche le détail pour `getInitialData`.
- Acceptation : un relevé avant/après est noté dans `docs/metrics.md` pour chaque lot.
- Fichiers : `api/rpc.js`, `core/infra/supabase-client.js`.

### INFRA-1 — Fonctions Vercel dans la région de la base (P1, S)

- Constat : `vercel.json` ne fixe aucune région ; les fonctions tournent par défaut à Washington (`iad1`). La région de la base Supabase n'a pas été vérifiée.
- Règle : relever la région du projet Supabase (prod et dev) dans son tableau de bord.
- Règle : fixer `regions` dans `vercel.json` sur la région Vercel la plus proche de la base.
- Acceptation : la latence d'une requête Supabase vue par la fonction (MESURE-1) est inférieure à 20 ms.
- Fichiers : `vercel.json`, `terraform/`.

### AUTH-1 — Vérifier le jeton sans appel réseau (P1, S)

- Constat : chaque RPC appelle `/auth/v1/user` avant tout traitement (`core/auth/session.js:29`).
- Règle : la signature et l'expiration du JWT sont vérifiées dans la fonction (secret JWT ou clés publiques JWKS du projet).
- Règle : l'email est lu dans le jeton vérifié.
- Limite assumée : une session révoquée reste valide jusqu'à l'expiration du jeton (1 h).
- Acceptation : un RPC ne fait plus aucun appel à `/auth/v1/`.
- Acceptation : un jeton expiré, falsifié ou signé par un autre projet est refusé (tests).
- Fichiers : `core/auth/session.js`, `core/config/env.js`, `tests/`.

### CTX-1 — Contexte utilisateur en une étape, une fois par appel (P1, M)

- Constat : chaque RPC refait 3 à 4 requêtes en série (judoka par email, `coach_clubs`, judokas des clubs). `getInitialData` lit le judoka par email deux fois (`core/index.js:283` puis `:297`).
- Règle : le contexte est calculé une seule fois par appel RPC et réutilisé par tous les services.
- Règle : le périmètre (clubs du coach, enfants du parent) se charge en une requête, par jointure PostgREST ou fonction SQL.
- Règle : la recherche par email utilise l'index `lower(email)` (`eq` sur une valeur normalisée, et non `ilike`).
- Acceptation : le contexte coûte 2 requêtes au plus, quel que soit le rôle.
- Fichiers : `core/services/user-context.service.ts`, `core/repositories/judokas.repository.ts`, `core/index.js`.

## 2. Ouverture de l'appli et d'une compétition

### INIT-1 — `getInitialData` en parallèle (P1, S)

- Constat : clubs, compétitions club, compétitions et bilans s'enchaînent en `await` alors qu'ils sont indépendants (`core/index.js:302-327`).
- Constat : `clubsRepository.listAll()` charge tous les clubs puis filtre en JavaScript.
- Règle : les lectures indépendantes partent ensemble (`Promise.all`).
- Règle : les clubs du coach sont filtrés par la requête.
- Acceptation : `getInitialData` tient en 3 étapes : contexte, listes, bilans.
- Fichiers : `core/index.js`, `core/repositories/clubs.repository.ts`.

### INIT-2 — Bilan V/D sans charger les combats (P1, S)

- Constat : `getCombatRecords` lit `select=*` sur tous les combats (notes comprises), par lots de 100 en série, pour compter victoires et défaites.
- Règle : la requête ne lit que `id_competition` et `resultat`, ou une vue SQL agrégée par compétition.
- Règle : les lots partent en parallèle.
- Acceptation : le bilan de l'accueil pèse moins de 50 octets par combat.
- Fichiers : `core/index.js`, `core/repositories/combats.repository.ts`, `supabase/migrations/`.

### DETAIL-1 — Combats et points en une requête (P1, M)

- Constat : `getCompetitionDetail` lit la compétition, puis les combats, puis les points, en série.
- Règle : les combats et leurs points se lisent ensemble (`select=*,combat_scores(*)`, la clé étrangère existe).
- Règle : la compétition et les combats partent en parallèle une fois l'accès vérifié.
- Acceptation : la fiche tient en 3 étapes : contexte, compétition, combats avec points.
- Fichiers : `core/services/competitions.service.ts`, `core/repositories/combats.repository.ts`.

### DETAIL-2 — Suggestions de saisie à la demande (P2, S)

- Constat : `loadCombatSuggestions` relit tous les combats du judoka et tous leurs points à chaque ouverture de fiche, même sans saisie.
- Règle : les suggestions se chargent à l'ouverture du formulaire de combat, par un RPC dédié.
- Règle : le navigateur les garde en mémoire par judoka jusqu'au prochain enregistrement.
- Acceptation : ouvrir une fiche ne lit aucun combat d'une autre compétition.
- Fichiers : `core/services/competitions.service.ts`, `assets/app-screen-combat-form.ts`.

## 3. Enregistrements

### ECRIT-1 — Points d'un combat en un envoi (P1, S)

- Constat : `replaceForCombat` supprime les points puis les insère un par un, en série (`core/repositories/combat-scores.repository.ts`).
- Règle : les points s'insèrent en une requête (tableau JSON).
- Acceptation : enregistrer un combat de 6 points coûte 3 écritures : combat, suppression, insertion.
- Fichiers : `core/repositories/combat-scores.repository.ts`, `core/infra/supabase-rest.js`.

### ECRIT-2 — Ne recharger que l'écran concerné (P1, M)

- Constat : enregistrer une compétition relance `getInitialData` complet, puis `getCompetitionDetail`. Enregistrer un combat relance toute la fiche.
- Règle : l'écriture renvoie l'élément enregistré ; le navigateur met à jour son état et son cache.
- Règle : `getInitialData` n'est rappelé qu'à l'ouverture, au retour en ligne et après un import.
- Acceptation : enregistrer un combat déclenche un seul appel RPC.
- Fichiers : `core/services/combats.service.ts`, `core/services/competitions.service.ts`, `assets/app-screen-combat-form.ts`, `assets/app-screen-competition-form.ts`, `assets/app-runtime.ts`.

### ECRIT-3 — Compétition club : écritures groupées (P2, M)

- Constat : `saveClubCompetition` met à jour puis crée les participations une par une ; la suppression détache chaque participation une par une.
- Règle : les créations partent en un envoi ; les mises à jour identiques partent en une requête filtrée sur `club_competition_id`.
- Acceptation : enregistrer une compétition club de 30 judokas coûte 5 écritures au plus.
- Fichiers : `core/services/club-competitions.service.ts`, `core/repositories/competitions.repository.ts`.

## 4. Pagination et volumes

### PAGE-1 — Plus aucune liste sans borne (P1, S)

- Constat : aucune requête de liste ne porte de `limit`. L'API Supabase plafonne une réponse à 1 000 lignes par défaut et tronque sans erreur.
- Constat : un lot de 100 compétitions peut dépasser 1 000 combats ; un coach peut dépasser 1 000 compétitions.
- Règle : relever le plafond `max rows` du projet Supabase.
- Règle : toute requête de liste porte un tri stable et une borne explicite.
- Règle : une réponse qui atteint la borne lit la suite ou lève une erreur ; elle ne tronque jamais en silence.
- Acceptation : un test charge 1 500 combats sur un lot et vérifie que les 1 500 sont comptés.
- Fichiers : `core/infra/supabase-rest.js`, `core/repositories/*.ts`, `tests/`.

### PAGE-2 — Chargement initial par saison (P2, M)

- Constat : `getInitialData` renvoie toutes les compétitions de toutes les saisons ; la réponse et le cache local grossissent chaque année.
- Règle : l'ouverture charge la saison en cours et les compétitions à venir.
- Règle : les saisons passées se chargent à la demande (« Voir la saison 2025-2026 »), puis restent en cache.
- Règle : le découpage par 10 dans le navigateur reste inchangé à l'intérieur d'une saison.
- Acceptation : la réponse de `getInitialData` ne grossit pas d'une saison à l'autre, à effectif constant.
- Acceptation : hors connexion, la saison en cours et les saisons déjà consultées restent lisibles.
- Fichiers : `core/index.js`, `core/services/competitions.service.ts`, `core/domain/season.js`, `assets/app-screen-home.ts`, `assets/app-runtime.ts`.

### PAGE-3 — Liste des utilisateurs paginée par le serveur (P3, M)

- Constat : `getAdminsManagement` charge tous les judokas et toutes les invitations ; la recherche et les pages se font dans le navigateur.
- Règle : le serveur renvoie une page de 10 et le total ; la recherche par nom part au serveur.
- Règle : la page suivante se lit par curseur (`nom`, `prenom`, `id_judoka`), et non par décalage.
- Acceptation : ouvrir « Gestion des accès » lit 10 utilisateurs, quel que soit l'effectif.
- Fichiers : `core/services/admin.service.ts`, `core/repositories/judokas.repository.ts`, `assets/app-screen-admins.ts`.

### PAGE-4 — Périmètre du coach sans liste d'identifiants dans l'URL (P3, S)

- Constat : `listByJudokaIds` et `listByIds` placent tous les identifiants des judokas dans l'URL, sans lot. Un grand club dépasse la longueur admise.
- Règle : les compétitions d'un coach se filtrent par club (jointure sur `judokas.club_id`), et non par liste d'identifiants.
- Acceptation : un club de 500 judokas charge ses compétitions en une requête.
- Fichiers : `core/repositories/competitions.repository.ts`, `core/repositories/judokas.repository.ts`.

## 5. Coach et admin

### COACH-1 — Statistiques calculées sur le périmètre filtré (P2, M)

- Constat : `getCoachDashboard` lit toutes les compétitions deux fois et tous les judokas, puis filtre en JavaScript par club, date et catégorie.
- Règle : club, dates et catégorie d'âge filtrent la requête.
- Règle : les compétitions sont lues une seule fois ; seuls les judokas du périmètre sont lus.
- Acceptation : un coach d'un club ne lit aucune ligne d'un autre club.
- Fichiers : `core/services/coach-dashboard.service.ts`, `core/services/coach-dashboard-loader.ts`.

### COACH-2 — Recherche de combats sans requête par compétition (P2, S)

- Constat : `loadCoachChatDatasets` lance une requête par compétition, toutes en même temps.
- Règle : les combats se lisent par lots, avec leurs points (même requête que DETAIL-1).
- Acceptation : une recherche sur 200 compétitions coûte 3 requêtes de combats au plus.
- Fichiers : `core/services/coach-dashboard.service.ts`.

### ADMIN-1 — Écran admin en parallèle (P3, S)

- Constat : `getAdminsManagement` lit admins, utilisateurs et invitations en série ; les admins sont un sous-ensemble des utilisateurs.
- Règle : les lectures partent ensemble ; les admins sont déduits de la liste des utilisateurs.
- Acceptation : l'écran tient en 2 étapes.
- Fichiers : `core/services/admin.service.ts`.

## 6. Coquille de l'appli

### SHELL-1 — Coquille servie depuis le cache (P2, S)

- Constat : le service worker interroge le réseau d'abord pour `/`, `/api/client` et `/api/styles`. Chaque lancement attend trois fonctions avant d'afficher les données en cache.
- Règle : la coquille s'affiche depuis le cache, puis se met à jour en arrière-plan.
- Règle : une nouvelle version s'applique au lancement suivant.
- Acceptation : au second lancement, l'accueil en cache s'affiche sans attendre le réseau.
- Fichiers : `api/service-worker.js`, `tests/offline-playwright.test.js`.

### SHELL-2 — JS et CSS minifiés, avec en-têtes de cache (P2, S)

- Constat : `/api/client` relit et concatène 17 fichiers et Vue à chaque requête (environ 400 Ko non minifiés), sans `Cache-Control`.
- Règle : le build produit un fichier JS minifié et un CSS minifié.
- Règle : l'URL porte l'empreinte du contenu ; la réponse est mise en cache un an (`immutable`).
- Acceptation : le JS pèse moins de 120 Ko compressé.
- Acceptation : une visite répétée ne retélécharge ni le JS ni le CSS.
- Fichiers : `scripts/build-assets.js`, `api/client.js`, `api/styles.js`, `api/app.js`, `Index.html`.

### SHELL-3 — Police sans blocage du rendu (P3, S)

- Constat : la feuille Google Fonts bloque le premier affichage (`Index.html:16`) et dépend d'un tiers, y compris hors connexion.
- Règle : la police est servie par l'appli, en `woff2`, avec `font-display: swap`.
- Acceptation : le premier affichage ne fait aucune requête vers `fonts.googleapis.com`.
- Fichiers : `Index.html`, `assets/app.tailwind.css`.
