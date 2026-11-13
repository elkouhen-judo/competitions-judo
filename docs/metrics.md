---
title: Coach Dashboard Metrics
version: 1.9
date_updated: 2026-06-20
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
| **Catégorie d'âge**    | `ageCategory`         | **Étape 1 : Compétitions** | Filtre la table Compétitions sur le champ `categorie_age`.                |
| **Date début / fin**   | `dateFrom` / `dateTo` | **Étape 1 : Compétitions** | Filtre la table Compétitions sur le champ `date`. Si les deux dates sont renseignées, `dateFrom <= dateTo` est obligatoire. |
| **Compétitions**       | `competitionIds`      | **Étape 1 : Compétitions** | Sélecteur multi-compétitions avec recherche texte (nom ou date) côté client. Filtre la table Compétitions sur les identifiants sélectionnés ; vide = toutes les compétitions. |

*Période par défaut :* à la première ouverture, `dateFrom`/`dateTo` couvrent la saison en cours (du 1er septembre au 31 août). Ouvertes depuis une compétition club, les statistiques portent sur cette seule compétition (`competitionIds` = ses participations), sur la saison de sa date.

*Note :* les filtres par genre (`gender`) et par garde (`handedness`) ont été retirés du tableau de bord ; `gender` ne subsiste que dans les filtres de la recherche MCP (`CoachChatFilters`, périmètre distinct). Les statistiques "Judokas par genre"/"Judokas par garde" (section 3.2) restent inchangées — ce ne sont que les filtres qui ont été supprimés.

### Logique d'exclusion et cas limites :
1. **Étape 1 :** Les filtres `ageCategory`, `dateFrom`/`dateTo` et `competitionIds` restreignent d'abord la liste des **compétitions** éligibles, puis l'ensemble des combats correspondants est extrait sans filtre supplémentaire au niveau combat.
2. **Filtres vides ou non sélectionnés :** Si un filtre n'est pas renseigné dans l'IHM, il est ignoré (aucune restriction n'est appliquée sur ce critère).
3. **Métadonnées manquantes :** Un combat dont les métadonnées judoka sont absentes peut rester dans le périmètre global, mais il est exclu des sous-décomptes qui exigent une valeur reconnue (`Homme`/`Femme`, `Droitier`/`Gaucher`).
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

L'ordre ci-dessous suit l'affichage : synthèse, Podiums, Par judoka, Par tour, Par niveau, Évolution, fins de combat et techniques (section 4), Ippon, Debout ou au sol, Selon les gardes, Tenue du score, Discipline, puis Saisies à compléter (section 5). Une section sans donnée est masquée.

### 3.1. Synthèse

| Métrique technique | Libellé IHM | Règle de calcul |
| :-- | :-- | :-- |
| `totalCombats`, `analyzedCompetitions` | **Combats · N compét.** | Combats restants après filtres ; compétitions analysées (une compétition club comptée une fois). |
| `victoryRate`, `victories` | **Victoires** | `victories / totalCombats`, seuil de 5 (section 2). |
| `podiumsByLevel` | **Podiums sur N classés** | Somme des podiums de tous les niveaux, rapportée à la somme des participations classées (`rankedParticipations`). |
| `dataQualityIssues` | **Saisies à compléter** | Plus grand `count` parmi les critères comptés par combat (`unit = "combat"`). |
| — | Phrase de synthèse | `V victoires, D défaites sur N combats.` puis le fait le plus marquant : le tour avec le plus de défaites (tour renseigné), sinon la fin de défaite la plus fréquente, sinon la technique qui gagne le plus. Aucun jugement (« point fort », « point d'attention »). |
| `engagedJudokas`, `judokasByHandedness` | **Effectif** | Judokas **distincts** avec au moins un combat retenu, puis ventilés par garde (`Droitier` / `Gaucher`). Le genre n'est pas affiché. |

*Note :* un judoka avec 5 combats compte pour `5` dans `totalCombats` et pour `1` dans l'effectif.

### 3.2. Podiums (`podiumsByLevel`)
Par niveau (`Départemental`, `Régional`, `National`, `International`) :
* `podiums` : nombre de participations du périmètre classées exactement `"1er"`, `"2e"` ou `"3e"`.
* `rankedParticipations` : participations du niveau dont le classement final est saisi (tout classement non vide).
* Affichage : `🥉 1 troisième place · 1 podium sur 4 participations classées`.
* Calcul par compétition, pas par combat. Une compétition sans niveau reconnu n'est comptée dans aucun niveau.

### 3.3. Par judoka (`byJudoka`)
Une ligne par judoka du périmètre : `combats`, `victories`, `defeats`, `podiums`, puis `vsRightHanded` et `vsLeftHanded` : combats gagnés ou perdus contre un adversaire droitier (ou gaucher), et victoires parmi eux. Affichage : `contre gauchers 1/5 (20 %)`, pourcentage à partir de 5 combats. La somme des `combats` vaut `totalCombats`.

### 3.4. Par tour (`byStage`) et Par niveau (`byLevel`)
* Une ligne par étape présente, dans l'ordre du tableau (Poule, 1/32, 1/16, 1/8, 1/4, 1/2, Finale, Repêchage, Place de 3), puis « Tour non renseigné ».
* Une ligne par niveau présent (Départemental, Régional, National, International), puis « Niveau non renseigné ».
* Chaque ligne : `combats`, `victories`, `defeats` ; taux `victories / combats`, seuil de 5. La somme des combats vaut `totalCombats`.

### 3.5. Évolution (`byMonth`)
Une ligne par mois (`AAAA-MM`, mois de la date de compétition) qui compte des combats : `combats`, `victories`, `defeats`, `podiums` (participations du mois classées sur le podium). Taux `victories / combats`, seuil de 5. La section ne s'affiche qu'à partir de 2 mois.

### 3.6. Ippon : debout ou au sol (`ipponVictories`)
* Dénominateur `total` : victoires avec au moins un point `Ippon` du judoka.
* `standing` : parmi elles, celles avec un Ippon `Tachi-waza` ; `ground` : avec un Ippon `Ne-waza`.
* Affichage : `Debout 3/4`, `Au sol 1/4`, pourcentage à partir de 5. Masquée sans victoire avec point Ippon.

### 3.7. Debout ou au sol (`groundShare`)
* `scored.ground / scored.counted` : points marqués au sol, parmi les points marqués dont la catégorie est connue (`Tachi-waza` ou `Ne-waza`).
* `conceded.ground / conceded.counted` : idem pour les points concédés.
* Un point sans technique n'est pas compté.

### 3.8. Selon les gardes (`byLateralMatchup`)
Quatre lignes : droitier contre droitier, droitier contre gaucher, gaucher contre droitier, gaucher contre gaucher (garde du judoka, puis de l'adversaire). Un combat est exclu si son résultat n'est ni `"Victoire"` ni `"Défaite"`, ou si l'une des deux gardes n'est pas `"Droitier"`/`"Gaucher"`. Taux `victories / combats`, seuil de 5. Seules les lignes avec au moins un combat s'affichent.

### 3.9. Tenue du score (`scoreHolding`)
Lue sur le déroulé, point après point, sur les seuls combats dont tous les points (des deux camps) portent un rang unique (`counted`, affiché).
* « Mener » compare les points cumulés : un Ippon l'emporte sur les Waza-ari, un Waza-ari sur les Yuko.
* `scoredFirst` : combats où le premier point est au judoka ; `wonAfterScoringFirst` : victoires parmi eux.
* `lostAfterLeading` : défaites alors que le judoka a mené à un moment.
* `wonAfterTrailing` : victoires alors que le judoka a été mené à un moment.

### 3.10. Discipline (`discipline`)
* `shidosReceived / scoredCombats` : shidos reçus par combat, sur les combats dont le score officiel est renseigné (`scoredCombats`, affiché). Affichage : `0,5 shido par combat (6 combats)`.
* `hansokuMakeDefeats` : défaites dont la fin est `Hansoku-make`.
* Masquée si aucun combat n'a de score renseigné.

---

## 4. Fins de combat et techniques

### 4.1. Fin des combats gagnés (`victoriesByDecisionType`) et perdus (`defeatsByDecisionType`)
* Dénominateur : victoires (ou défaites) du périmètre.
* Seules les fins avec au moins un combat s'affichent, de la plus fréquente à la moins fréquente, puis une ligne « Non renseignée » (total moins la somme des lignes) : la somme des lignes égale le total.
* Affichage : `compte/total (taux %)`, pourcentage et barre à partir de 5.
* La même règle s'applique à la fiche saison du judoka (sans seuil).
* L'égalité (`Hiki wake`) n'entre dans aucune des deux sections.

### 4.2. Techniques qui gagnent (`topWinTechniques`)
Les 5 techniques les plus marquées par les judokas dans les combats gagnés (3 sur la fiche saison du judoka), ordre alphabétique à égalité. Barres relatives à la plus fréquente.

### 4.3. Techniques qui nous battent (`topDefeatTechniques`)
Les 5 techniques les plus marquées par les adversaires (`concededScores`) dans les **combats perdus** uniquement. Un point concédé dans un combat gagné n'est pas compté ; un point sans technique non plus.

---

## 5. Section "Saisies à compléter" (`dataQualityIssues`)

Affichée en dernier, si `totalCombats > 0`. Le service renvoie toujours les 6 critères ; seuls ceux avec `count > 0` s'affichent. Si aucun, le message « Toutes les saisies sont complètes. » s'affiche.

| Critère (`criterion`) | Unité | Libellé IHM | Condition de comptage |
| :-- | :-- | :-- | :-- |
| `judokaHandedness` | combat | Droitier/gaucher du judoka non renseigné | La garde du judoka suivi est absente. |
| `opponentStance` | combat | Droitier/gaucher de l'adversaire non renseigné | La garde de l'adversaire est absente. |
| `victoryType` | combat | Fin du combat non renseignée | `victoryType` est absent. |
| `scores` | combat | Points marqués non renseignés | Aucun point marqué détaillé. |
| `competitionLevel` | compétition | Niveau de compétition non renseigné | Compétitions du périmètre sans niveau, sur le nombre de compétitions du périmètre (une compétition club comptée une fois). |
| `inconsistentIppon` | combat | Ippon à vérifier | Victoire par `Ippon` sans aucun point `Ippon` détaillé. |

*Éléments concernés :* les critères par combat renvoient `combats` (50 premiers : `combatId`, `competitionId`, `competitionName`, `judokaId`, `opponent`) et l'écran propose « Voir les combats » ; le critère par compétition renvoie `competitions` (`competitionId`, `competitionName`) et propose « Voir les compétitions ».

*Note :* le genre du judoka n'est plus un critère de saisie du tableau de bord (STAT-13) ; la recherche MCP garde son filtre par genre.

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
