---
title: Coach Dashboard Metrics
version: 1.2
date_updated: 2026-06-19
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
| Filtre UI              | Champ technique       | Niveau d'application       | Description / correspondance en base                                      |
| :--------------------- | :-------------------- | :------------------------- | :------------------------------------------------------------------------ |
| **Compétitions**       | `competitionIds`      | **Étape 1 : Compétitions** | Filtre la table Compétitions sur les identifiants demandés. Disponible côté service/API, non exposé dans l'UI actuelle. |
| **Catégorie d'âge**    | `ageCategory`         | **Étape 1 : Compétitions** | Filtre la table Compétitions sur le champ `categorie_age`.                |
| **Date début / fin**   | `dateFrom` / `dateTo` | **Étape 1 : Compétitions** | Filtre la table Compétitions sur le champ `date`. Si les deux dates sont renseignées, `dateFrom <= dateTo` est obligatoire. |
| **Année dans la cat.** | `categoryYear`        | **Étape 2 : Combats**      | Filtre les combats via l'attribut du Judoka principal (`yearInCategory`). |
| **Genre**              | `gender`              | **Étape 2 : Combats**      | Filtre les combats via l'attribut du Judoka principal (`gender`).         |
| **Garde**              | `handedness`          | **Étape 2 : Combats**      | Filtre les combats via l'attribut du Judoka principal (`handedness`).     |

### Logique d'exclusion et cas limites :
1. **Étape 1 :** Les filtres `competitionIds`, `ageCategory` et `dateFrom`/`dateTo` restreignent d'abord la liste des **compétitions** éligibles.
2. **Étape 2 :** Pour les compétitions retenues, le système extrait l'ensemble des combats correspondants, puis applique les filtres `categoryYear`, `gender` et `handedness` en se basant exclusivement sur les métadonnées du **judoka suivi** (et non de son adversaire).
3. **Filtres vides ou non sélectionnés :** Si un filtre n'est pas renseigné dans l'IHM, il est ignoré (aucune restriction n'est appliquée sur ce critère).
4. **Métadonnées manquantes :** Un combat dont les métadonnées judoka sont absentes peut rester dans le périmètre global, mais il est exclu des sous-décomptes qui exigent une valeur reconnue (`Homme`/`Femme`, `Droitier`/`Gaucher`).

---

## 2. Règles générales de calcul des taux
Sauf mention contraire explicite dans les tableaux ci-dessous, tous les taux et pourcentages respectent les règles mathématiques strictes suivantes :
* **Formule de base :** `taux = round((numérateur / dénominateur) * 100)`.
* **Arrondi :** Arrondi à l'entier le plus proche (`round()`).
* **Division par zéro :** Si le dénominateur est `0`, le taux vaut `0`.

---

## 3. Spécifications détaillées par section

### 3.1. Section "Volumes"
Cette section comptabilise la volumétrie globale de l'activité sur le périmètre totalement filtré.

| Métrique technique    | Libellé IHM                    | Type de décompte      | Règle de calcul et unicité                                                                                                          |
| :-------------------- | :----------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `totalCombats`        | **Combats analysés**           | Compte de lignes      | Nombre total de combats restants après application de l'ensemble des filtres (Étape 1 + Étape 2).                                   |
| `judokasByGender`     | **Judokas par genre — Homme / Femme** | Dénombrement distinct | Nombre de judokas **uniques/distincts** ayant réalisé au moins un combat dans le périmètre filtré, ventilé par genre.       |
| `judokasByHandedness` | **Judokas par garde — Droitier / Gaucher** | Dénombrement distinct | Nombre de judokas **uniques/distincts** ayant réalisé au moins un combat dans le périmètre filtré, ventilé par garde.      |

*Note d'ambiguïté résolue :* Si un même judoka effectue 5 combats dans le périmètre filtré, il compte pour `5` dans `totalCombats`, mais pour `1` dans la ventilation de `judokasByGender` et de `judokasByHandedness`.

### 3.2. Section "Performance globale"
Pour cette section, le dénominateur commun et systématique est le nombre total de combats filtrés (`totalCombats`).

| Métrique technique     | Libellé IHM               | Dénominateur   | Numérateur (Critères d'inclusion)                                                                                                                      |
| :--------------------- | :------------------------ | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `victoryRate`          | **Victoires totales**              | `totalCombats` | Nombre de combats où le résultat pour le judoka suivi est strictement égal à `"Victoire"`.                                                             |
| `tachiWazaVictoryRate` | **Victoires debout**               | `totalCombats` | Nombre de combats qui cumulent **à la fois** :<br>1. Résultat = `"Victoire"`<br>2. Au moins un score marqué appartenant à la catégorie `"Tachi-waza"`. |
| `neWazaVictoryRate`    | **Victoires au sol**               | `totalCombats` | Nombre de combats qui cumulent **à la fois** :<br>1. Résultat = `"Victoire"`<br>2. Au moins un score marqué appartenant à la catégorie `"Ne-waza"`.    |
| `hansokuMakeLossRate`  | **Défaites par hansoku-make**      | `totalCombats` | Nombre de combats qui cumulent **à la fois** :<br>1. Résultat = `"Défaite"`<br>2. Type de décision finale = `"Hansoku-make"` (disqualification).       |

### 3.3. Section "Par niveau" (`byCompetitionLevel`)
Cette section ventile les performances selon le niveau hiérarchique de la compétition (`byCompetitionLevel`).
* **Niveaux gérés :** `Départemental`, `Régional`, `National`, `International`.

Chaque niveau dispose de ses propres compteurs indépendants :
* **Volume du niveau :** Nombre total de combats disputés dans une compétition de ce niveau spécifique.
* **Victoires du niveau :** Nombre de combats du niveau dont le résultat est `"Victoire"`.
* **Taux de victoire du niveau :** `round((victories / combats) * 100)`.

### 3.4. Section "Rapport de garde" (`byLateralMatchup`)
Libellé IHM de la carte : **Face à la garde adverse**.
Cet indicateur évalue l'impact de la symétrie des gardes sur le taux de réussite du judoka.

#### Critères d'exclusion stricts :
Un combat est **totalement exclu** de cette section si l'une des conditions suivantes est vraie :
1. Le résultat du combat n'est ni `"Victoire"` ni `"Défaite"` (par exemple une égalité `Hiki wake`).
2. La garde du judoka suivi n'est pas une valeur reconnue (`"Droitier"` ou `"Gaucher"`).
3. La garde de l'adversaire n'est pas une valeur reconnue (`"Droitier"` ou `"Gaucher"`).

#### Catégories de confrontation :
* **Garde opposée (`opposite`) :** La garde du judoka est différente de celle de l'adversaire (Droitier vs Gaucher, ou Gaucher vs Droitier).
* **Même garde (`same`) :** La garde du judoka est égale à celle de l'adversaire (Droitier vs Droitier, ou Gaucher vs Gaucher).

#### Formules de calcul :
* **Taux de victoire garde opposée :** `round((victories opposite / combats opposite) * 100)`.
* **Taux de victoire même garde :** `round((victories same / combats same) * 100)`.

---

## 4. Sections "Répartition par décision"

Ces deux sections analysent la distribution des types de décisions. Elles affichent le format textuel suivant à l'écran : `compte / total (taux%)`.

### 4.1. Victoires par décision (`victoriesByDecisionType`)
* **Dénominateur spécifique :** Nombre total de combats se soldant par une **Victoire** du judoka dans le périmètre filtré.
* **Types de décisions cartographiés :** `Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hansoku-make`, `Forfait`.
* **Formule du taux :** `round( (Victoires par [Type de décision] / Nombre total de Victoires) * 100 )`

### 4.2. Défaites par décision (`defeatsByDecisionType`)
* **Dénominateur spécifique :** Nombre total de combats se soldant par une **Défaite** du judoka dans le périmètre filtré.
* **Types de décisions cartographiés :** `Ippon`, `Waza-ari`, `Yuko`, `Décision`, `Hansoku-make`, `Forfait`.
* **Formule du taux :** `round( (Défaites par [Type de décision] / Nombre total de Défaites) * 100 )`

*Note de cohérence :* L'égalité (`Hiki wake`) possédant son propre type de décision isolé, elle n'intervient jamais dans ces deux sections car le statut du combat n'est ni une Victoire ni une Défaite.

---
