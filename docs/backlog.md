# Backlog

Les stories STAT-17 à STAT-22 de la revue du 13/11/2026 sont implémentées (DASH-026, DASH-027, DASH-013 de `docs/spec.md`, PERF-009 de `docs/spec-tech.md`). Définitions dans `docs/metrics.md`.

## Statistiques

Revue du 13/11/2026, vue du coach. Objectif : mesurer la progression du club, et non décrire une seule période.

Contraintes communes à toutes les stories :

- Aucune donnée propre à un judoka (DASH-026). Seuil de 2 judokas (DASH-027), appliqué à chaque période comparée.
- Pas de pourcentage sous 5 combats ou 5 points au dénominateur (DASH-011), dans chaque période comparée.
- `getCoachDashboard` reste à 3 requêtes Supabase (PERF-009).
- Le tour reste saisi sur le combat ; aucune statistique par tour n'est réintroduite.

### Décisions prises (13/11/2026)

- Période de comparaison (STAT-23) : la même fenêtre de dates, un an plus tôt.
- Maille de « Évolution » (STAT-24) : le trimestre de saison, puis la saison dès que la période couvre plus d'une saison. Le mois disparaît.
- Objectifs : les statistiques ne gèrent pas d'objectifs. La story « Objectifs atteints » est abandonnée.

### Comparer dans le temps

#### STAT-23 — Écart avec la période précédente (P1, L)

- Constat : chaque chiffre décrit la période filtrée. Comparer deux saisons oblige à changer les dates et à retenir les chiffres.
- Règle : la période précédente est la fenêtre `dateFrom`–`dateTo` décalée d'un an. Le club et la catégorie d'âge filtrés s'y appliquent.
- Règle : sans date de début ou de fin, ou quand des compétitions sont choisies, aucune comparaison n'est calculée.
- Règle : la réponse ajoute `previous`, les mêmes statistiques calculées sur la période précédente, ou `null` si la comparaison ne s'applique pas ou si le seuil de 2 judokas n'y est pas atteint.
- Règle : la lecture reste en un appel : la fonction SQL reçoit la date de début reculée d'un an, le partage en deux périodes se fait en TypeScript.
- Règle : les tuiles « Combats », « Victoires » et « Podiums » affichent l'écart (`+6 points`, `+12 combats`). Un écart de taux n'est affiché que si les deux périodes ont au moins 5 combats.
- Règle : l'écart est écrit sans jugement de couleur ; une info-bulle rappelle la période comparée.
- Acceptation : sur la saison en cours, la tuile « Victoires » affiche l'écart avec la même fenêtre de la saison précédente.
- Acceptation : une compétition choisie dans le filtre n'affiche aucun écart.
- Acceptation : `getCoachDashboard` fait toujours 3 requêtes Supabase.
- Fichiers : `core/services/coach-dashboard.service.ts`, `core/services/coach-dashboard-loader.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md`, `docs/metrics.md`, `tests/application-services.test.js`, `tests/loading-performance.test.js`, `tests/coach-competition-stats-visual.test.js`.

#### STAT-24 — « Évolution » par trimestre et par saison (P1, M)

- Constat : un mois compte rarement 5 combats. La section n'affiche alors presque jamais de taux.
- Constat : la section ne s'affiche qu'à partir de 2 mois et ne suit que les combats, les victoires et les podiums.
- Règle : une ligne par trimestre de saison (septembre–novembre, décembre–février, mars–mai, juin–août) quand la période tient dans une saison.
- Règle : une ligne par saison quand la période couvre plus d'une saison.
- Règle : chaque ligne donne les participations, les combats, les victoires et les podiums.
- Règle : la section s'affiche à partir de 2 lignes. Une ligne sans combat mais avec un podium reste listée (DASH-013).
- Acceptation : sur une saison, la section compte au plus 4 lignes.
- Acceptation : sur deux saisons, la section compte 2 lignes, une par saison.
- Acceptation : la somme des combats des lignes égale la tuile « Combats » quand toutes les compétitions ont une date.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/domain/season.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-013), `docs/metrics.md`, `tests/domain-model.test.js`.

### Lire juste

#### STAT-25 — Résultats à niveau égal (P1, M) — après STAT-23

- Constat : un club qui monte du départemental au régional voit son taux de victoire baisser alors qu'il progresse.
- Constat : « Par niveau » donne le bilan de chaque niveau, sans lecture dans le temps.
- Règle : chaque ligne de « Par niveau » affiche le bilan de la période précédente au même niveau (`4/10 gagnés (40 %) · avant 3/12 (25 %)`).
- Règle : chaque ligne de « Podiums » affiche de même le rapport de la période précédente.
- Règle : une ligne « Participations par niveau » donne, pour chaque niveau, le nombre de participations des deux périodes.
- Acceptation : une montée en niveau se lit par la hausse des participations régionales ou nationales, sans regarder le taux global.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-010, DASH-012), `docs/metrics.md`, `tests/domain-model.test.js`.

#### STAT-26 — Places de 5e et 7e (P2, S)

- Constat : les classements `5e` et `7e` sont saisis. Les statistiques ne comptent que les podiums.
- Règle : « Podiums » ajoute, par niveau, le nombre de participations classées dans les 7 premiers (`1er`, `2e`, `3e`, `5e`, `7e`).
- Règle : la tuile « Podiums » ne change pas.
- Acceptation : une participation classée `5e` compte dans « 7 premiers » et pas dans les podiums.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `docs/spec.md` (DASH-009, DASH-012), `docs/metrics.md`, `tests/domain-model.test.js`.

#### STAT-27 — Participations sans combat saisi (P2, S)

- Constat : une participation classée sans aucun combat saisi compte dans les podiums et pas dans les taux de victoire. Rien ne le signale.
- Règle : la synthèse affiche le nombre de participations du périmètre et, parmi elles, celles sans combat saisi (`18 participations, dont 4 sans combat saisi`).
- Règle : seules les participations dont la date est passée comptent.
- Règle : la ligne n'apparaît pas quand toutes les participations ont au moins un combat.
- Acceptation : une participation passée sans combat fait apparaître la ligne ; une participation à venir ne la fait pas apparaître.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-007), `docs/metrics.md`, `tests/domain-model.test.js`.

### Suivre le travail

#### STAT-28 — Activité du club (P2, M) — après STAT-23

- Constat : l'effectif n'est qu'un chiffre instantané. Le nombre de participations et de combats par judoka n'est pas suivi.
- Règle : une section « Activité » donne les judokas engagés, les participations, les compétitions et les combats par judoka engagé (moyenne à une décimale).
- Règle : chaque ligne affiche la valeur de la période précédente.
- Règle : la ligne « Effectif » de la synthèse est remplacée par cette section ; la garde de l'effectif garde son seuil de 5 judokas.
- Acceptation : la section se place après « Podiums » et se lit sans aucun nom de judoka.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-006, DASH-007), `docs/metrics.md`, `tests/domain-model.test.js`, `tests/coach-competition-stats-visual.test.js`.

#### STAT-29 — Technique dans le temps (P2, M) — après STAT-23

- Constat : les indicateurs techniques existent, sans lecture dans le temps. On ne voit pas si le travail à l'entraînement se retrouve en compétition.
- Règle : ces lignes affichent la valeur de la période précédente : part des victoires par Ippon, part des points marqués au sol, part des points concédés au sol, victoires après avoir marqué le premier, shidos par combat.
- Règle : « Techniques qui gagnent » ajoute le nombre de techniques différentes marquées dans les combats gagnés, pour les deux périodes.
- Règle : une valeur de la période précédente n'est affichée que si son dénominateur atteint 5.
- Acceptation : « Shidos reçus » se lit `0,4 par combat (12 combats) · avant 0,9 (8 combats)`.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/domain/competitions/combat-technique-breakdown.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-015, DASH-022, DASH-024, DASH-025), `docs/metrics.md`, `tests/domain-model.test.js`.

## Saisie d'un combat (revue du 13/11/2026, vue du directeur technique)

Objectif : un parent enregistre un combat en quelques secondes, le détail se complète ensuite.

Décisions prises (13/11/2026) :

- La saisie rapide est le mode par défaut pour tous les profils.
- L'adversaire figure dans l'écran rapide, en facultatif.
- Aucun rappel ni relance des familles n'est ajouté.

### SAISIE-1 — Écran rapide : le résultat d'abord (P1, M) — fait

- Constat : sur mobile, le formulaire fait environ trois écrans de haut. « Résultat », seul champ obligatoire, est tout en bas.
- Constat : la règle CBT-011 impose toutes les sections, toujours affichées, dans l'ordre du combat.
- Règle : un nouveau combat s'ouvre sur l'écran rapide : le tour proposé (CBT-020) en pastille modifiable, l'adversaire (facultatif, avec ses suggestions), le résultat, puis « Victoire par » ou « Défaite par ».
- Règle : la garde de l'adversaire, le score, les shidos, le déroulé et les notes sont repliés sous « Détailler ce combat ».
- Règle : « Enregistrer » et « Enregistrer + suivant » restent visibles en bas d'écran.
- Règle : l'appareil retient le dernier état, replié ou déplié, pour les combats suivants.
- Règle : aucune donnée, aucune règle de calcul et aucun appel serveur ne change.
- Règle : les déductions du score (CBT-017 à CBT-019) continuent de s'appliquer quand le détail est ouvert.
- Acceptation : à 375 px, le résultat et le bouton d'enregistrement sont visibles sans faire défiler.
- Acceptation : un combat s'enregistre en trois touchers : résultat, manière, « Enregistrer ».
- Acceptation : un combat enregistré en rapide puis rouvert contient les mêmes valeurs.
- Fichiers : `assets/views/combat-form.html`, `assets/app-screen-combat-form.ts`, `assets/app.tailwind.css`, `docs/spec.md` (CBT-011, CBT-013, UIX-034), `tests/combat-creation-visual.test.js`, `tests/mobile-first-index.test.js`.

### SAISIE-2 — Compléter plus tard (P1, S) — fait

- Constat : la carte d'un combat affiche déjà ses manques (« À compléter »). Elle n'y conduit pas.
- Règle : toucher « À compléter » sur la carte ouvre le combat avec le détail déplié, sur le premier manque.
- Règle : un combat qui a déjà un détail (score, déroulé, garde ou notes) s'ouvre déplié, quel que soit l'état retenu par l'appareil.
- Acceptation : un combat saisi en rapide se complète en deux touchers depuis la fiche de la compétition.
- Fichiers : `assets/views/competition.html`, `assets/app-screen-competition-form.ts`, `assets/app-screen-combat-form.ts`, `docs/spec.md` (UIX-030, UIX-034), `tests/combat-creation-visual.test.js`.

### SAISIE-3 — Des mots pour les parents (P2, S) — fait

- Constat : le vocabulaire (Waza-ari, Yuko, Hansoku-make, garde) suppose un pratiquant. Rien ne dit ce qui est facultatif.
- Règle : « Victoire par » et « Défaite par » portent la mention « facultatif » et une phrase d'aide.
- Règle : « Détailler ce combat » dit à quoi sert le détail : « Pour l'analyse du coach. Vous pourrez le compléter plus tard. »
- Règle : les libellés suivent UIX-032 (langage de terrain).
- Acceptation : l'écran rapide ne demande aucun terme de judo pour enregistrer une victoire ou une défaite.
- Fichiers : `assets/views/combat-form.html`, `docs/spec.md` (CBT-005, UIX-032), `tests/mobile-first-index.test.js`.

### SAISIE-4 — Documents alignés sur le produit (P3, S) — fait

- Constat : `docs/prd.md` exclut encore les compteurs de score, les shidos et le hors connexion, tous présents.
- Constat : `docs/spec.md` (COMP-012) autorise les classements 4e, 6e et 8e ; l'écran propose 1er, 2e, 3e, 5e, 7e et « Non classé ».
- Règle : le PRD décrit la saisie en deux temps et retire les exclusions qui ne sont plus vraies.
- Règle : COMP-012 liste les classements réellement proposés ; les valeurs 4e, 6e et 8e déjà enregistrées restent lisibles.
- Acceptation : aucune règle du PRD ou de la spec ne contredit un écran.
- Fichiers : `docs/prd.md`, `docs/spec.md`.

## Réinscription (revue du 13/11/2026)

Faits vérifiés dans le code :

- Le réimport d'un judoka existant met à jour sa catégorie d'âge, son année dans la catégorie, son genre, sa garde, sa ceinture et son club.
- La catégorie de poids n'est pas une colonne de l'import.
- Aucune donnée ne dit pour quelle saison un judoka est inscrit.

Décisions prises (13/11/2026) :

- Le passage de saison se fait par la réinscription : l'admin réimporte le CSV des inscrits, qui contient toutes leurs informations, dont le club.
- Un judoka non réinscrit reste dans l'application. Il ne peut pas participer à une compétition.
- Saison d'un import : l'écran d'import demande la saison, celle en cours par défaut.
- Mise en service : tous les judokas présents au déploiement sont considérés inscrits pour la saison en cours.
- Catégorie de poids : elle n'entre pas dans l'import. Elle est saisie compétition par compétition.

### INSCR-1 — Saison d'inscription posée par l'import (P1, M) — fait

- Règle : chaque ligne `JUDOKA` importée ou réimportée enregistre la saison d'inscription du judoka, choisie sur l'écran d'import (saison en cours par défaut).
- Règle : la saison est stockée sur le judoka (`judokas.saison_inscription`, année de début de saison). Seule la dernière saison est gardée.
- Règle : une ligne `PARENT` n'a pas de saison d'inscription.
- Règle : à la mise en service, les judokas existants reçoivent la saison en cours.
- Règle : le résumé de l'import donne le nombre de judokas inscrits pour la saison et le nombre de judokas du club non réinscrits.
- Règle : la migration est appliquée sur dev, vérifiée, puis sur prod, avant le déploiement de l'application.
- Acceptation : réimporter un judoka pour la saison 2027-2028 fait passer sa saison d'inscription à 2027.
- Acceptation : un judoka absent du réimport garde sa saison d'inscription précédente et toutes ses données.
- Fichiers : `supabase/migrations/20260612000000_initial_schema.sql`, `core/services/admin.service.ts`, `core/repositories/judokas.repository.ts`, `core/services/domain-adapters.ts`, `core/types.ts`, `assets/views/admins.html`, `docs/spec.md` (AUTH-019), `docs/supabase-schema.md`, `tests/application-services.test.js`, `tests/repository-mapping.test.js`, `tests/supabase-schema.test.js`.

### INSCR-2 — Pas de compétition pour un judoka non réinscrit (P1, M) — fait

- Règle : un judoka ne peut être inscrit à une compétition que s'il est inscrit pour la saison de la date de cette compétition.
- Règle : la règle vaut pour les deux chemins : participant d'une compétition club (coach) et compétition individuelle (famille ou judoka).
- Règle : le refus est fait côté serveur, écrans, API et MCP confondus.
- Règle : la liste des participants d'une compétition club ne propose que les judokas inscrits pour sa saison. Elle dit combien de judokas du club ne sont pas réinscrits.
- Règle : pour un judoka non réinscrit, « Nouvelle compétition » est remplacé par un message : « Non réinscrit pour la saison AAAA-AAAA. »
- Règle : les compétitions, combats, classements et statistiques déjà enregistrés restent lisibles et modifiables.
- Règle : la fiche du judoka et la liste « Judokas » du coach affichent « Non réinscrit ».
- Acceptation : en septembre, avant son réimport, un judoka ne peut être inscrit à aucune compétition de la nouvelle saison ; après, il le peut.
- Acceptation : une compétition de la saison précédente d'un judoka non réinscrit accepte encore un combat ou un classement.
- Fichiers : `core/services/competitions.service.ts`, `core/services/club-competitions.service.ts`, `core/domain/season.ts`, `assets/app-screen-club-competition.ts`, `assets/views/club-competition-form.html`, `assets/views/club-competition-detail.html`, `assets/views/home.html`, `assets/views/judoka.html`, `docs/spec.md`, `tests/application-services.test.js`, `tests/clubs.test.js`, `tests/coach-competition-stats-visual.test.js`.

## Pistes non retenues

- Objectifs atteints (taux d'objectifs du coach marqués « atteint ») : écarté, on ne gère pas d'objectifs.
- Rappels aux familles après une compétition : écarté.
- Profondeur dans le tableau (jusqu'à quel tour) : bon indicateur de progression, écarté avec les statistiques par tour.
- « Selon les gardes » reste affiché dès 2 judokas ; comparer deux sélections de compétitions permet encore de déduire le bilan d'un judoka (limite notée dans `docs/metrics.md`).
