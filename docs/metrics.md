---
title: Coach Dashboard Metrics
version: 3.0
date_updated: 2026-11-22
owner: competitions-judo
tags:
  - dashboard
  - metrics
  - documentation
---

# Tableau de bord coach — Définition des métriques

Ce document définit les règles de filtrage, les formules et les indicateurs du tableau de bord coach. Il complète les règles fonctionnelles `DASH-*` de `docs/spec.md`.

## 1. Périmètre et séquence de filtrage

Le calcul des métriques s'effectue selon un flux de filtrage cumulatif et séquentiel en deux étapes (Etape 1 puis Etape 2). Les filtres sont appliqués de la manière suivante :

### Tableau des filtres applicables

L'ordre ci-dessous correspond à l'ordre d'affichage dans l'IHM : catégorie d'âge, dates, puis le sélecteur de compétitions.

| Filtre UI              | Champ technique       | Niveau d'application       | Description / correspondance en base                                      |
| :--------------------- | :-------------------- | :------------------------- | :------------------------------------------------------------------------ |
| **Club**               | `clubId`              | **Étape 1 : Compétitions** | Club du résultat (MULTI-4) : club de la compétition club, sinon club actuel du judoka. Vide = tous les clubs du coach. Le coach n'y entre que s'il est inscrit dans un de ses clubs (MULTI-5). |
| **Catégorie d'âge**    | `ageCategory`         | **Étape 1 : Compétitions** | Filtre la table Compétitions sur le champ `categorie_age`.                |
| **Date début / fin**   | `dateFrom` / `dateTo` | **Étape 1 : Compétitions** | Filtre la table Compétitions sur le champ `date`. Si les deux dates sont renseignées, `dateFrom <= dateTo` est obligatoire. |
| **Compétitions**       | `competitionIds`      | **Étape 1 : Compétitions** | Sélecteur multi-compétitions avec recherche texte (nom ou date) côté client. Filtre la table Compétitions sur les identifiants sélectionnés ; vide = toutes les compétitions. |

*Période par défaut :* à la première ouverture, `dateFrom`/`dateTo` couvrent la saison en cours (du 1er septembre au 31 août). Ouvertes depuis une compétition club, les statistiques portent sur cette seule compétition (`competitionIds` = ses participations), sur la saison de sa date.

*Note :* le tableau de bord ne filtre ni ne ventile par genre ou par garde ; `gender` ne subsiste que dans les filtres de la recherche MCP (`CoachChatFilters`, périmètre distinct).

### Confidentialité et seuil de groupe (DASH-026, DASH-027)
* Les statistiques du coach ne contiennent ni identité, ni identifiant de judoka, ni nom d'adversaire, ni ligne par judoka. Le bilan d'un judoka se lit sur sa fiche.
* **Seuil de 2 judokas :** sont comptés les judokas qui ont un combat dans le périmètre ; sans aucun combat, les judokas propriétaires des compétitions retenues. Sous 2, la réponse vaut `stats = null` et `withheld = { analyzedCompetitions, totalCombats }`.
* *Limite connue :* avec peu de judokas, comparer deux sélections de compétitions permet encore de déduire le bilan d'un judoka.

### Logique d'exclusion et cas limites :
1. **Étape 1 :** Les filtres `ageCategory`, `dateFrom`/`dateTo` et `competitionIds` restreignent d'abord la liste des **compétitions** éligibles, puis l'ensemble des combats correspondants est extrait sans filtre supplémentaire au niveau combat.
2. **Filtres vides ou non sélectionnés :** Si un filtre n'est pas renseigné dans l'IHM, il est ignoré (aucune restriction n'est appliquée sur ce critère).
3. **Métadonnées manquantes :** Un combat sans niveau de compétition, sans fin ou sans technique reste dans le périmètre global ; il est seulement exclu des décomptes qui exigent cette valeur.
4. **Rafraîchissement :** Toute modification d'un filtre déclenche un nouveau calcul automatique côté serveur après un délai d'inactivité de 300 ms (anti-rebond), sans bouton "Actualiser".
5. **Liste des compétitions sélectionnables :** Les options proposées par le sélecteur de compétitions sont elles-mêmes restreintes par `ageCategory` et `dateFrom`/`dateTo` (mêmes règles qu'à l'Étape 1, sans tenir compte de `competitionIds`). Modifier la catégorie d'âge ou les dates met donc à jour la liste des compétitions proposées ; toute compétition déjà sélectionnée qui sort de ce nouveau périmètre est automatiquement retirée de la sélection.

---

## 2. Règles générales de calcul des taux
Sauf mention contraire explicite ci-dessous, tous les taux respectent les règles suivantes :
* **Formule de base :** `taux = round((numérateur / dénominateur) * 100)`, arrondi à l'entier le plus proche.
* **Division par zéro :** si le dénominateur est `0`, le taux vaut `0`.
* **Décompte d'abord :** chaque taux affiche d'abord son décompte (`3/8 gagnés (38 %)`).
* **Seuil de 5 (STAT-1) :** en dessous de 5 combats (ou 5 points) au dénominateur, ni pourcentage ni barre ne s'affichent. Une ligne de taux de victoire affiche alors « trop peu de combats » (`0/1 gagné · trop peu de combats`). La tuile « Victoires » affiche `victoires/combats` sous 5 combats.

---

## 3. Synthèse et sections de résultats

L'ordre ci-dessous suit l'affichage (SIMPL-3) : synthèse, Par niveau, Par club, Comment on gagne, Comment on perd, Évolution. Une section sans donnée est masquée.

### 3.1. Synthèse

| Métrique technique | Libellé IHM | Règle de calcul |
| :-- | :-- | :-- |
| `totalCombats`, `analyzedCompetitions` | **Combats · N compét.** | Combats restants après filtres ; compétitions analysées (une compétition club comptée une fois). |
| `victoryRate`, `victories` | **Victoires** | `victories / totalCombats`, seuil de 5 (section 2). |
| `byLevel[].podiums`, `byLevel[].rankedParticipations` | **Podiums sur N classés** | Somme des podiums de toutes les lignes « Par niveau » (niveau non renseigné compris), rapportée à la somme des participations classées. |
| — | Phrase de synthèse | `V victoires, D défaites sur N combats.` puis le fait le plus marquant : la fin de défaite la plus fréquente, sinon la technique qui gagne le plus. Aucun jugement (« point fort », « point d'attention »). |
| `engagedJudokas` | `12 judokas engagés · 10,0 combats par judoka` | Judokas distincts avec au moins un combat retenu ; `totalCombats / engagedJudokas` à une décimale. Ni genre ni garde. |
| `previous` | Écart sous les tuiles « Combats », « Victoires », « Podiums » | Voir 3.0. Écart signé (`+12 combats`, `−2 podiums`, `+6 points`), sans couleur de jugement ; une ligne rappelle la période comparée. |
| `participations`, `participationsWithoutCombat` | `18 participations, dont 4 sans combat saisi.` | Participations dont la date est passée (sans date : comptée), puis celles sans aucun combat saisi. Ligne masquée quand toutes ont un combat. |

*Note :* un judoka avec 5 combats compte pour `5` dans `totalCombats` et pour `1` dans les judokas engagés.

### 3.0. Période précédente (`previous`, STAT-23)
* Période comparée : la fenêtre `dateFrom`–`dateTo` décalée d'un an (le 29 février devient le 28), avec le même club et la même catégorie d'âge.
* Aucune comparaison (`previous = null`) sans date de début ou de fin, avec des compétitions choisies, si les deux fenêtres se recouvrent (période de plus d'un an), si la période précédente n'a aucune participation ou si elle compte moins de 2 judokas (DASH-027).
* `previous.stats` suit exactement les définitions de ce document.
* Écart de la tuile « Victoires » : en points de taux si les deux périodes ont au moins 5 combats, sinon en nombre de victoires.
* La période précédente ne s'affiche que sur les trois tuiles, jamais ligne par ligne (SIMPL-3).
* Lecture : la fonction `coach_dashboard_data` reçoit la date de début reculée d'un an ; le partage en deux périodes est fait en TypeScript. Toujours 3 requêtes Supabase.

### 3.2. Par niveau (`byLevel`)
*Le tour du combat reste saisi, mais aucune statistique par tour n'est calculée.*
* Une ligne par niveau (Départemental, Régional, National, International), puis « Niveau non renseigné » ; seules les lignes avec un combat ou une participation classée s'affichent.
* Combats : `combats`, `victories`, `defeats`, d'après le niveau de la compétition du combat. Taux `victories / combats`, seuil de 5 ; sans combat, « aucun combat saisi ».
* Podiums (STAT-11) : calcul par participation, pas par combat. `rankedParticipations` : participations du niveau dont le classement final est saisi (tout classement non vide) ; `podiums` : celles classées exactement `"1er"`, `"2e"` ou `"3e"`. Affichage : `6 podiums sur 14 participations classées`, sans pourcentage.
* Une compétition sans niveau reconnu est comptée sur la ligne « Niveau non renseigné ».
* Les sommes des lignes égalent `totalCombats` et la tuile « Podiums ».

### 3.3. Par club (`byClub`, MULTI-6)

* Calculé seulement sur « Tous mes clubs » d'un coach de plusieurs clubs (`clubId` vide) ; `null` sinon.
* Une ligne par club du coach : `engagedJudokas`, `participations` (passées), `combats`, `victories`, `podiums`.
* Club d'un résultat : celui de sa compétition club (`stats_club_id`, MULTI-4).
* Un club sous 2 judokas (DASH-027) : `withheld = true`, tous les chiffres à 0, affiché « moins de 2 judokas ».
* Le taux de victoire n'est affiché qu'à partir de 5 combats (DASH-011).

### 3.4. Évolution (`byPeriod`, STAT-24)
Une ligne par trimestre de saison (septembre–novembre, décembre–février, mars–mai, juin–août ; clé `AAAA-T1` à `AAAA-T4`, `AAAA` = début de saison) quand toutes les compétitions datées tiennent dans une saison ; sinon une ligne par saison (clé `AAAA`, « Saison AAAA-AAAA+1 »). Chaque ligne : `participations` (passées), `combats`, `victories`, `defeats`, `podiums`. Seules les lignes avec des combats ou un podium sont listées ; une ligne de podium sans combat affiche « aucun combat saisi ». Taux `victories / combats`, seuil de 5. La section ne s'affiche qu'à partir de 2 lignes. Quand toutes les compétitions ont une date, la somme des combats égale `totalCombats` et la somme des podiums égale la tuile « Podiums ».

---

## 4. Comment on gagne, comment on perd

### 4.1. Fin des combats gagnés (`victoriesByDecisionType`) et perdus (`defeatsByDecisionType`)
* Dénominateur : victoires (ou défaites) du périmètre.
* Seules les fins avec au moins un combat s'affichent, de la plus fréquente à la moins fréquente, puis une ligne « Non renseignée » (total moins la somme des lignes) : la somme des lignes égale le total.
* Affichage : `compte/total (taux %)`, pourcentage et barre à partir de 5.
* La même règle s'applique à la fiche saison du judoka (sans seuil).
* L'égalité (`Hiki wake`) n'entre dans aucune des deux sections.
* Une victoire par Ippon se lit ici : il n'y a plus de section « Ippon » à part.

### 4.2. Techniques qui gagnent (`topWinTechniques`)
Les 5 techniques les plus marquées par les judokas dans les combats gagnés (3 sur la fiche saison du judoka), ordre alphabétique à égalité. Barres relatives à la plus fréquente.

### 4.3. Techniques qui nous battent (`topDefeatTechniques`)
Les 5 techniques les plus marquées par les adversaires (`concededScores`) dans les **combats perdus** uniquement. Un point concédé dans un combat gagné n'est pas compté ; un point sans technique non plus.

### 4.4. Debout ou au sol (`groundShare`, STAT-7)
* `scored` : points marqués par les judokas dont la catégorie est connue (`Tachi-waza` ou `Ne-waza`) ; `ground` : ceux au sol. `conceded` : idem pour les points concédés.
* Un point sans technique n'est pas compté.
* Affichage, en fin de « Comment on gagne » (marqués) et de « Comment on perd » (concédés) : `Points marqués : 64 % debout, 36 % au sol (74 points)` ; sous 5 points, les décomptes (`2 debout, 1 au sol`).

### 4.5. Métriques retirées (SIMPL-3)
Ne sont plus calculées ni affichées (écran, API, MCP) : les podiums par place et les 7 premiers, la section « Activité », la section « Ippon », la ventilation des judokas par garde, le taux de victoire selon les gardes, la tenue du score, la discipline (shidos, défaites par Hansoku-make), le nombre de techniques différentes et les valeurs « avant » ligne par ligne.

---

## 5. Saisies à compléter (retirées, SIMPL-1)

Le tableau de bord ne compte plus les saisies manquantes : ni tuile, ni section, ni champ `dataQualityIssues` dans la réponse. Les combats incomplets restent comptés dans les statistiques qu'ils alimentent ; une donnée absente (garde, fin du combat, technique) les exclut seulement des sections qui en ont besoin.

---

## 6. Relevé de chargement (backlog optimisation du 12/11/2026)

Décomptes mesurés par `tests/loading-performance.test.js` sur un faux Supabase (profil coach). Une « étape » est un groupe de requêtes lancées en parallèle.

| Action | Avant (lecture du code) | Après (mesuré en test) |
| :--- | :--- | :--- |
| Contexte utilisateur | 3 à 4 requêtes en série, refaites par service | 2 requêtes, une fois par appel |
| Ouverture de l'appli (`getInitialData`) | 9 requêtes en série + 1 par tranche de 100 compétitions | 3 étapes au plus |
| Ouverture d'une compétition (`getCompetitionDetail`) | 9 requêtes en série ou plus | 4 requêtes, 3 étapes au plus |
| Enregistrer un combat de 6 points | une vingtaine de requêtes + 1 par point, puis rechargement de la fiche | 1 appel RPC, 6 étapes au plus, 3 écritures |
| Compétition club de 30 judokas | 1 écriture par participation | 2 écritures |
| Gestion des accès (`getAdminsManagement`) | 4 lectures en série, tous les judokas | 4 requêtes, 2 étapes, 10 utilisateurs |
| JS de la coquille | environ 400 Ko non minifiés, sans cache | 97 Ko compressés, cache d'un an |

Temps de réponse : non relevés. L'en-tête `Server-Timing` de `/api/rpc` (onglet Réseau) et les journaux Vercel donnent la durée totale, la durée d'authentification, le nombre de requêtes Supabase et leur durée cumulée. Le relevé en millisecondes reste à faire sur l'environnement dev, avant puis après déploiement.

## 7. Lecture du tableau de bord en un appel (STAT-17, 13/11/2026)

Relevé sur la base dev (`eu-central-1`), depuis un poste local, avec le vrai câblage de `core/` : 2 coachs, 5 compétitions, 16 combats. Chaque coach : 7 appels `getCoachDashboard` sur toute la période, alternés entre les deux lectures ; médianes.

| Lecture | Requêtes Supabase | Étapes | Durée totale | Durée Supabase cumulée |
| :--- | :--- | :--- | :--- | :--- |
| Avant : compétitions, puis combats par lots de 100 | 5 | 3 | 165 ms | 270 ms |
| Après : fonction `coach_dashboard_data` | 3 | 2 | 110 ms | 162 ms |

* La durée Supabase cumulée additionne des requêtes parallèles : elle dépasse la durée totale.
* Avant, le nombre de requêtes croît d'une par tranche de 100 participations ; après, il reste à 3.
* Les deux lectures renvoient une réponse identique sur 14 scénarios (toute la période, la saison, chaque compétition de chaque coach).
* Le relevé `Server-Timing` sur Vercel (région `dub1`) reste à faire après le déploiement de l'application.
