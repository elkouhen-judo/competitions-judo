# Backlog statistiques

Les stories STAT-17 à STAT-22 de la revue du 13/11/2026 sont implémentées (DASH-026, DASH-027, DASH-013 de `docs/spec.md`, PERF-009 de `docs/spec-tech.md`). Définitions dans `docs/metrics.md`.

Revue du 13/11/2026, vue du coach. Objectif : mesurer la progression du club, et non décrire une seule période.

Contraintes communes à toutes les stories :

- Aucune donnée propre à un judoka (DASH-026). Seuil de 2 judokas (DASH-027), appliqué à chaque période comparée.
- Pas de pourcentage sous 5 combats ou 5 points au dénominateur (DASH-011), dans chaque période comparée.
- `getCoachDashboard` reste à 3 requêtes Supabase (PERF-009).
- Le tour reste saisi sur le combat ; aucune statistique par tour n'est réintroduite.

## Décisions prises (13/11/2026)

- Période de comparaison (STAT-23) : la même fenêtre de dates, un an plus tôt.
- Maille de « Évolution » (STAT-24) : le trimestre de saison, puis la saison dès que la période couvre plus d'une saison. Le mois disparaît.
- Objectifs : les statistiques ne gèrent pas d'objectifs. La story « Objectifs atteints » est abandonnée.

## Comparer dans le temps

### STAT-23 — Écart avec la période précédente (P1, L)

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

### STAT-24 — « Évolution » par trimestre et par saison (P1, M)

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

## Lire juste

### STAT-25 — Résultats à niveau égal (P1, M) — après STAT-23

- Constat : un club qui monte du départemental au régional voit son taux de victoire baisser alors qu'il progresse.
- Constat : « Par niveau » donne le bilan de chaque niveau, sans lecture dans le temps.
- Règle : chaque ligne de « Par niveau » affiche le bilan de la période précédente au même niveau (`4/10 gagnés (40 %) · avant 3/12 (25 %)`).
- Règle : chaque ligne de « Podiums » affiche de même le rapport de la période précédente.
- Règle : une ligne « Participations par niveau » donne, pour chaque niveau, le nombre de participations des deux périodes.
- Acceptation : une montée en niveau se lit par la hausse des participations régionales ou nationales, sans regarder le taux global.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-010, DASH-012), `docs/metrics.md`, `tests/domain-model.test.js`.

### STAT-26 — Places de 5e et 7e (P2, S)

- Constat : les classements `5e` et `7e` sont saisis. Les statistiques ne comptent que les podiums.
- Règle : « Podiums » ajoute, par niveau, le nombre de participations classées dans les 7 premiers (`1er`, `2e`, `3e`, `5e`, `7e`).
- Règle : la tuile « Podiums » ne change pas.
- Acceptation : une participation classée `5e` compte dans « 7 premiers » et pas dans les podiums.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `docs/spec.md` (DASH-009, DASH-012), `docs/metrics.md`, `tests/domain-model.test.js`.

### STAT-27 — Participations sans combat saisi (P2, S)

- Constat : une participation classée sans aucun combat saisi compte dans les podiums et pas dans les taux de victoire. Rien ne le signale.
- Règle : la synthèse affiche le nombre de participations du périmètre et, parmi elles, celles sans combat saisi (`18 participations, dont 4 sans combat saisi`).
- Règle : seules les participations dont la date est passée comptent.
- Règle : la ligne n'apparaît pas quand toutes les participations ont au moins un combat.
- Acceptation : une participation passée sans combat fait apparaître la ligne ; une participation à venir ne la fait pas apparaître.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-007), `docs/metrics.md`, `tests/domain-model.test.js`.

## Suivre le travail

### STAT-28 — Activité du club (P2, M) — après STAT-23

- Constat : l'effectif n'est qu'un chiffre instantané. Le nombre de participations et de combats par judoka n'est pas suivi.
- Règle : une section « Activité » donne les judokas engagés, les participations, les compétitions et les combats par judoka engagé (moyenne à une décimale).
- Règle : chaque ligne affiche la valeur de la période précédente.
- Règle : la ligne « Effectif » de la synthèse est remplacée par cette section ; la garde de l'effectif garde son seuil de 5 judokas.
- Acceptation : la section se place après « Podiums » et se lit sans aucun nom de judoka.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-006, DASH-007), `docs/metrics.md`, `tests/domain-model.test.js`, `tests/coach-competition-stats-visual.test.js`.

### STAT-29 — Technique dans le temps (P2, M) — après STAT-23

- Constat : les indicateurs techniques existent, sans lecture dans le temps. On ne voit pas si le travail à l'entraînement se retrouve en compétition.
- Règle : ces lignes affichent la valeur de la période précédente : part des victoires par Ippon, part des points marqués au sol, part des points concédés au sol, victoires après avoir marqué le premier, shidos par combat.
- Règle : « Techniques qui gagnent » ajoute le nombre de techniques différentes marquées dans les combats gagnés, pour les deux périodes.
- Règle : une valeur de la période précédente n'est affichée que si son dénominateur atteint 5.
- Acceptation : « Shidos reçus » se lit `0,4 par combat (12 combats) · avant 0,9 (8 combats)`.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/domain/competitions/combat-technique-breakdown.ts`, `core/types.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `docs/spec.md` (DASH-015, DASH-022, DASH-024, DASH-025), `docs/metrics.md`, `tests/domain-model.test.js`.

## Pistes non retenues

- Objectifs atteints (taux d'objectifs du coach marqués « atteint ») : écarté, on ne gère pas d'objectifs.
- Profondeur dans le tableau (jusqu'à quel tour) : bon indicateur de progression, écarté avec les statistiques par tour.
- « Selon les gardes » reste affiché dès 2 judokas ; comparer deux sélections de compétitions permet encore de déduire le bilan d'un judoka (limite notée dans `docs/metrics.md`).
