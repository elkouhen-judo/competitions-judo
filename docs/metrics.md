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

*Note :* les filtres par genre (`gender`) et par garde (`handedness`) ont été retirés du tableau de bord ; `gender` ne subsiste que pour le chat coach (`CoachChatFilters`, périmètre distinct). Les statistiques "Judokas par genre"/"Judokas par garde" (section 3.2) restent inchangées — ce ne sont que les filtres qui ont été supprimés.

### Logique d'exclusion et cas limites :
1. **Étape 1 :** Les filtres `ageCategory`, `dateFrom`/`dateTo` et `competitionIds` restreignent d'abord la liste des **compétitions** éligibles, puis l'ensemble des combats correspondants est extrait sans filtre supplémentaire au niveau combat.
2. **Filtres vides ou non sélectionnés :** Si un filtre n'est pas renseigné dans l'IHM, il est ignoré (aucune restriction n'est appliquée sur ce critère).
3. **Métadonnées manquantes :** Un combat dont les métadonnées judoka sont absentes peut rester dans le périmètre global, mais il est exclu des sous-décomptes qui exigent une valeur reconnue (`Homme`/`Femme`, `Droitier`/`Gaucher`).
4. **Rafraîchissement :** Toute modification d'un filtre déclenche un nouveau calcul automatique côté serveur après un délai d'inactivité de 300 ms (anti-rebond), sans bouton "Actualiser".
5. **Liste des compétitions sélectionnables :** Les options proposées par le sélecteur de compétitions sont elles-mêmes restreintes par `ageCategory` et `dateFrom`/`dateTo` (mêmes règles qu'à l'Étape 1, sans tenir compte de `competitionIds`). Modifier la catégorie d'âge ou les dates met donc à jour la liste des compétitions proposées ; toute compétition déjà sélectionnée qui sort de ce nouveau périmètre est automatiquement retirée de la sélection.

---

## 2. Règles générales de calcul des taux
Sauf mention contraire explicite dans les tableaux ci-dessous, tous les taux et pourcentages respectent les règles mathématiques strictes suivantes :
* **Formule de base :** `taux = round((numérateur / dénominateur) * 100)`.
* **Arrondi :** Arrondi à l'entier le plus proche (`round()`).
* **Division par zéro :** Si le dénominateur est `0`, le taux vaut `0`.

---

## 3. Spécifications détaillées par section

L'ordre des sous-sections ci-dessous suit l'ordre d'affichage pédagogique du tableau de bord : périmètre (combien de combats, qui sont les judokas), puis résultats globaux (performance, podiums), puis analyses détaillées (par garde, par décision).

### 3.1. Section "Volumes"
Cette section comptabilise la volumétrie globale de l'activité sur le périmètre totalement filtré.

| Métrique technique    | Libellé IHM                    | Type de décompte      | Règle de calcul et unicité                                                                                                          |
| :-------------------- | :----------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `totalCombats`        | **Combats analysés**           | Compte de lignes      | Nombre total de combats restants après application de l'ensemble des filtres (Étape 1 + Étape 2).                                   |

### 3.2. Section "Répartition des judokas"
Cette section dénombre les judokas distincts du périmètre filtré, indépendamment du volume de combats.

| Métrique technique    | Libellé IHM                    | Type de décompte      | Règle de calcul et unicité                                                                                                          |
| :-------------------- | :----------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `judokasByGender`     | **Judokas par genre — Homme / Femme** | Dénombrement distinct | Nombre de judokas **uniques/distincts** ayant réalisé au moins un combat dans le périmètre filtré, ventilé par genre.       |
| `judokasByHandedness` | **Judokas par garde — Droitier / Gaucher** | Dénombrement distinct | Nombre de judokas **uniques/distincts** ayant réalisé au moins un combat dans le périmètre filtré, ventilé par garde.      |

*Note d'ambiguïté résolue :* Si un même judoka effectue 5 combats dans le périmètre filtré, il compte pour `5` dans `totalCombats` (section "Volumes"), mais pour `1` dans la ventilation de `judokasByGender` et de `judokasByHandedness` (section "Répartition des judokas").

### 3.3. Section "Performance globale"
Pour cette section, le dénominateur commun et systématique est le nombre total de combats filtrés (`totalCombats`).

| Métrique technique     | Libellé IHM               | Dénominateur   | Numérateur (Critères d'inclusion)                                                                                                                      |
| :--------------------- | :------------------------ | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `victoryRate`               | **Victoires totales**           | `totalCombats` | Nombre de combats où le résultat pour le judoka suivi est strictement égal à `"Victoire"`.                                                             |
| `tachiWazaIpponVictoryRate` | **Victoires Ippon debout**      | `totalCombats` | Nombre de combats qui cumulent **à la fois** :<br>1. Résultat = `"Victoire"`<br>2. Au moins un score marqué avec `category = "Tachi-waza"` **et** `value = "Ippon"`. |
| `neWazaIpponVictoryRate`    | **Victoires Ippon au sol**      | `totalCombats` | Nombre de combats qui cumulent **à la fois** :<br>1. Résultat = `"Victoire"`<br>2. Au moins un score marqué avec `category = "Ne-waza"` **et** `value = "Ippon"`.    |

*Note de discriminant :* Le score (`CombatScore.value`) est l'unique critère retenu pour ces deux métriques — le type de décision finale du combat (`victoryType`, ex. nom de la prise) n'intervient pas dans ce calcul. Ces deux métriques ne sont donc pas mutuellement exclusives ni exhaustives par rapport à la ligne `Ippon` de la section 4.1 : un écart entre les deux est un signal de qualité de saisie, voir section 5.

### 3.4. Section "Podiums" (`podiumsByLevel`)
Cette section dénombre les compétitions du périmètre filtré (Étape 1, indépendamment des combats) terminées sur le podium, puis les regroupe par niveau de compétition.

| Métrique technique | Libellé IHM   | Type de décompte | Règle de calcul                                                                                          |
| :------------------ | :------------ | :---------------- | :--------------------------------------------------------------------------------------------------------- |
| `podiumsByLevel[niveau].podiums` (`1er`) | **1ère place** | Compte de lignes  | Nombre de compétitions du périmètre filtré, au niveau concerné, dont le classement final est exactement `"1er"`. |
| `podiumsByLevel[niveau].podiums` (`2e`)  | **2ème place** | Compte de lignes  | Nombre de compétitions du périmètre filtré, au niveau concerné, dont le classement final est exactement `"2e"`.  |
| `podiumsByLevel[niveau].podiums` (`3e`)  | **3ème place** | Compte de lignes  | Nombre de compétitions du périmètre filtré, au niveau concerné, dont le classement final est exactement `"3e"`.  |

*Particularités :*
- **Compteurs bruts uniquement :** contrairement aux autres sections, aucun pourcentage n'est affiché (pas de dénominateur pertinent à exposer).
- **Compétitions finalisées uniquement :** une compétition dont le classement (`Competition.result`) est vide (non finalisée) est exclue du calcul, y compris pour les places autres que 1/2/3 (`"4e"`…`"8e"`, `"Non classé"` ne comptent pas non plus, seules les valeurs exactes `"1er"`/`"2e"`/`"3e"` sont retenues).
- **Niveau de calcul :** par compétition, pas par combat — une compétition sans combat enregistré mais déjà classée compte normalement.
- **Niveaux gérés :** `Départemental`, `Régional`, `National`, `International`. Une compétition sans niveau reconnu n'est comptée dans aucun niveau.

### 3.5. Section "Rapport de garde" (`byLateralMatchup`)
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

## 5. Section "Qualité de la saisie" (`dataQualityIssues`)

Cette section est affichée en dernier sur le tableau de bord : c'est une information de diagnostic sur la fiabilité des données, à consulter après avoir pris connaissance des résultats eux-mêmes (sections 3 et 4).

Cette section recense, sur le périmètre filtré, les combats dont la saisie est incomplète ou incohérente. Elle n'est affichée que si `totalCombats > 0`. Le dénominateur de chaque critère est `totalCombats` ; l'affichage IHM utilise le format `compte/total (taux%)`.

*Affichage IHM :* le service renvoie toujours les 7 critères (même à `count = 0`) ; seuls les critères avec `count > 0` (au moins un combat concerné) sont affichés à l'écran. Si tous les critères sont à `0`, un message "Aucun problème de saisie détecté sur ce périmètre." remplace la grille.

| Critère (`criterion`) | Libellé IHM                          | Condition de comptage (le combat est compté si...)                                                                  |
| :--------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| `judokaHandedness`     | Garde judoka non renseignée           | La garde du judoka suivi est absente.                                                                                 |
| `opponentStance`       | Garde adversaire non renseignée       | La garde de l'adversaire est absente.                                                                                 |
| `victoryType`          | Type de décision non renseigné        | Le type de décision finale (`victoryType`) est absent.                                                               |
| `scores`               | Prises marquées non renseignées       | Le combat n'a aucune prise marquée (tableau `scores` vide).                                                          |
| `competitionLevel`     | Niveau de compétition non renseigné   | Le niveau de la compétition associée est absent.                                                                     |
| `judokaGender`         | Genre judoka non renseigné            | Le genre du judoka suivi est absent.                                                                                 |
| `inconsistentIppon`    | Ippon incohérent                      | Résultat = `"Victoire"` **et** `victoryType = "Ippon"` **et** aucun score marqué n'a `value = "Ippon"` (ni Tachi-waza ni Ne-waza). |

*Note :* ce dernier critère détecte la divergence possible entre la ligne `Ippon` de la section 4.1 (basée sur `victoryType`) et les métriques `tachiWazaIpponVictoryRate`/`neWazaIpponVictoryRate` de la section 3.3 (basées sur `scores`) — il signale les combats à compléter plutôt que de forcer une règle de cohérence stricte entre les deux métriques.

---
