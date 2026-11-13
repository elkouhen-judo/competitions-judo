# Backlog saisie d'un combat sans redondance

Issu de la revue du 13/11/2026 de l'écran « Ajouter / Modifier un combat », faite par lecture du code et des captures existantes. L'écran n'a pas été rejoué.

- Priorité : P1 (touche en trop à chaque combat), P2 (ressaisie fréquente), P3 (confort d'affichage).
- Effort : S (≤ 1 jour), M (2-3 jours), L (≥ 1 semaine).
- Chaque story donne le constat, la règle visée et le critère d'acceptation.

## Vue d'ensemble

L'écran suit le combat : avant, pendant, fin. Le score et le déroulé partagent déjà une seule source de données. Trois informations restent saisies alors qu'elles sont connues :

| Information | Déjà connue par | Touches en trop |
|---|---|---|
| Résultat et fin du combat | Le score (Ippon, 3 shidos, score supérieur) | 2 par combat |
| Garde de l'adversaire | Un combat précédent contre le même adversaire | 1 par adversaire déjà rencontré |
| Étape | Le dernier combat de la compétition | 1 par combat après « Enregistrer » |

Ce qui est déjà sans doublon et ne doit pas régresser :

- Le tableau de marque est le décompte du déroulé.
- La catégorie (debout, au sol) se déduit de la technique.
- « Égalité » remplit « Hiki wake ».
- « Victoire par Ippon » choisi en premier ajoute le point au déroulé, une seule fois.
- « Enregistrer + suivant » propose l'étape suivante.

## Avancement au 13/11/2026

Les 7 stories sont implémentées dans l'arbre de travail (tests : 352/352). Rien n'est commité ni déployé.

Écarts assumés par rapport au texte des stories :

| Story | Écart |
|---|---|
| SAISIE-1 | Remplacer à la main un résultat déduit efface aussi la fin du combat déduite. Sans cela, « Défaite » gardait « Ippon » et CBT-007f ajoutait un Ippon adverse, ce qui masquait la contradiction. |
| SAISIE-3 | Le nom de l'adversaire est comparé sans tenir compte des majuscules. Un ancien cache de suggestions hors connexion, sans garde, ne préremplit rien. |
| SAISIE-5 | Le résumé disparaît dès que le score est renseigné ; le tableau est toujours visible. |

## Ordre de traitement proposé

| Lot | Objectif | Stories |
|---|---|---|
| 1 | Ne plus saisir deux fois l'issue du combat | SAISIE-1, SAISIE-2 |
| 2 | Ne plus ressaisir ce que l'appli connaît | SAISIE-3, SAISIE-4 |
| 3 | Alléger l'affichage | SAISIE-5, SAISIE-6, SAISIE-7 |

## 1. Issue du combat

### SAISIE-1 — Résultat et fin du combat déduits du score (P1, M)

- Constat : l'écran demande le score, puis le résultat, puis la fin du combat. Un Ippon du judoka au score oblige encore à toucher « Victoire » puis « Ippon ».
- Constat : la déduction existe dans un seul sens. « Victoire par Ippon » ajoute le point au déroulé ; le point au déroulé ne remplit pas « Victoire par Ippon ».
- Règle : un Ippon d'un camp remplit le résultat (Victoire ou Défaite) et la fin du combat « Ippon ».
- Règle : 3 shidos d'un camp remplissent le résultat et la fin du combat « Hansoku-make ».
- Règle : sans Ippon ni 3 shidos, un score supérieur propose le résultat et la fin du combat (« Waza-ari » ou « Yuko », selon la plus haute valeur qui départage). La proposition n'est pas sélectionnée d'office.
- Règle : une valeur déduite reste modifiable.
- Règle : un résultat ou une fin de combat choisis à la main ne sont jamais écrasés par une déduction.
- Règle : retirer le point qui a servi à la déduction retire la valeur déduite, si elle n'a pas été modifiée à la main.
- Acceptation : « + » sur l'Ippon du judoka, puis « Enregistrer » : le combat est enregistré en « Victoire par Ippon » sans autre touche.
- Acceptation : 3 « + » sur les shidos de l'adversaire : « Victoire » et « Hansoku-make » sont sélectionnés.
- Acceptation : après un choix manuel de « Défaite », un « + » sur l'Ippon du judoka ne change pas le résultat.
- Acceptation : à l'ouverture d'un combat existant, aucune valeur enregistrée n'est modifiée par la déduction.
- Fichiers : `assets/app-screen-combat-form.ts`, `assets/views/combat-form.html`, `tests/combat-creation-visual.test.js`, `docs/spec.md`.

### SAISIE-2 — Avertissement si le score contredit le résultat (P1, S)

- Constat : un Ippon pour le judoka avec « Défaite » s'enregistre sans message. Le seul contrôle porte sur « Victoire par Ippon » sans point Ippon.
- Règle : un avertissement s'affiche sous le résultat quand le score et le résultat se contredisent.
- Règle : les contradictions détectées sont : Ippon d'un camp et résultat inverse ; 3 shidos d'un camp et résultat inverse ; « Égalité » avec un Ippon.
- Règle : l'avertissement n'empêche pas l'enregistrement. L'arbitre peut décider autrement que le score saisi.
- Acceptation : Ippon du judoka et « Défaite » affichent « Le score indique une victoire. Vérifiez le résultat. »
- Acceptation : le combat s'enregistre malgré l'avertissement.
- Acceptation : corriger le score ou le résultat fait disparaître l'avertissement.
- Fichiers : `assets/app-screen-combat-form.ts`, `assets/views/combat-form.html`, `tests/combat-creation-visual.test.js`.

## 2. Informations déjà connues

### SAISIE-3 — Garde préremplie pour un adversaire déjà rencontré (P2, M)

- Constat : les suggestions d'adversaires ne renvoient que des noms. Choisir un adversaire connu oblige à ressaisir sa garde.
- Règle : `getCombatSuggestions` renvoie, pour chaque adversaire, la garde du combat le plus récent où elle est renseignée.
- Règle : choisir ou saisir un adversaire connu remplit la garde, si elle est vide.
- Règle : une garde déjà choisie n'est jamais écrasée.
- Règle : la garde préremplie reste modifiable.
- Acceptation : saisir le nom d'un adversaire déjà rencontré comme « Gaucher » sélectionne « Gaucher ».
- Acceptation : un adversaire inconnu laisse la garde vide.
- Acceptation : hors connexion, le préremplissage fonctionne avec les suggestions du cache local.
- Acceptation : `getCombatSuggestions` garde une seule lecture Supabase.
- Fichiers : `core/services/competitions.service.ts`, `core/repositories/combats.repository.ts`, `core/types.ts`, `assets/types.ts`, `assets/app-screen-combat-form.ts`, `tests/application-services.test.js`, `tests/combat-creation-visual.test.js`.

### SAISIE-4 — Étape proposée à chaque ajout de combat (P2, S)

- Constat : seul « Enregistrer + suivant » propose l'étape. Après « Enregistrer », « Ajouter un combat » ouvre un formulaire sans étape. En poule, « Poule » est à retoucher à chaque combat.
- Règle : à l'ouverture d'un nouveau combat, l'étape proposée se calcule à partir du dernier combat de la compétition, avec la règle existante `getNextCombatStage`.
- Règle : sans combat précédent, ou si la règle ne donne rien (après une finale, après une défaite hors tableau de repêchage), l'étape reste vide.
- Règle : l'étape proposée reste modifiable.
- Acceptation : après un combat de poule, « Ajouter un combat » ouvre le formulaire avec « Poule » sélectionné.
- Acceptation : après une victoire en 1/4, le formulaire propose « 1/2 ».
- Acceptation : « Enregistrer + suivant » garde son comportement actuel.
- Acceptation : la modification d'un combat existant garde son étape enregistrée.
- Fichiers : `assets/app-screen-combat-form.ts`, `tests/combat-creation-visual.test.js`.

## 3. Affichage

### SAISIE-5 — Un seul affichage du score (P3, S)

- Constat : la ligne « 1 0 2 - 0 1 0 · Shidos 0 - 1 » répète le tableau placé juste dessous.
- Règle : la ligne de résumé ne s'affiche plus quand le tableau est visible.
- Règle : l'état « Non renseigné » et le bouton « Effacer » restent disponibles.
- Acceptation : un score saisi n'apparaît qu'une fois dans la section « Le combat ».
- Fichiers : `assets/views/combat-form.html`, `assets/app-screen-combat-form.ts`, `assets/app.tailwind.css`.

### SAISIE-6 — Un seul message pour une technique manquante (P3, S)

- Constat : un point ajouté par « Victoire par Ippon » affiche « Ippon ajouté au déroulé : précisez la technique » et « À compléter : technique d'un point ».
- Règle : une technique manquante ne produit qu'un message, placé sous le déroulé.
- Acceptation : choisir « Victoire par Ippon » sur un formulaire vide affiche un seul message sur la technique.
- Fichiers : `assets/views/combat-form.html`, `assets/app-screen-combat-form.ts`.

### SAISIE-7 — Exemple du champ Notes sans information déjà saisie (P3, S)

- Constat : l'exemple « bon départ, difficulté contre un gaucher, projection tentée... » invite à réécrire la garde et la technique.
- Règle : l'exemple ne cite que ce que le formulaire ne capte pas (ressenti, tactique, consigne du coach).
- Acceptation : l'exemple ne mentionne ni la garde, ni une technique, ni le score.
- Fichiers : `assets/views/combat-form.html`.
