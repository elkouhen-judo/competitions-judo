# Produit - Kiroku

## Vision

Kiroku est le carnet de suivi sportif mobile-first d'un club de judo.

Le produit aide un coach à comprendre rapidement le parcours en compétition d'un judoka, à partir de faits simples: compétitions disputées, combats enregistrés, résultats, rythme de progression et profil de combat.

## Problème

Dans un club, les résultats de compétition sont souvent dispersés: messages, souvenirs du coach, feuilles papier, discussions avec les parents, notes personnelles.

Cette dispersion rend difficile de répondre à des questions simples:

- Combien de compétitions ce judoka a-t-il faites cette saison ?
- Gagne-t-il plutôt par ippon ou par décision ?
- Ses défaites sont-elles nettes, serrées ou liées à des pénalités ?
- Progresse-t-il d'une compétition à l'autre ?
- Quel bilan partager avec le judoka ou ses parents ?

## Cible prioritaire

L'utilisateur principal est le coach de club.

Il utilise Kiroku pour préparer, suivre et relire la progression sportive des judokas. Il a besoin d'un outil rapide, fiable, consultable sur téléphone, sans charge administrative excessive.

## Utilisateurs secondaires

| Utilisateur | Besoin principal |
|---|---|
| Judoka | Voir son parcours, ses compétitions et son bilan. |
| Parent | Suivre les compétitions de son enfant et tenir les informations à jour. |
| Admin club | Donner les accès, corriger les données et garder une vue globale. |

## Promesse produit

Donner au coach une vision claire, actionnable et à jour du parcours compétitif d'un judoka.

Kiroku ne cherche pas à tout mesurer. Il cherche à rendre les informations sportives essentielles faciles à saisir, faciles à retrouver et faciles à interpréter.

## Positionnement

Kiroku est:

- un carnet de suivi sportif pour le judo;
- un outil centré sur le judoka;
- un support d'analyse pour le coach;
- une application mobile-first pensée pour être utilisée entre deux combats, au dojo ou en déplacement.

Kiroku n'est pas:

- un logiciel complet de gestion de club;
- un outil de comptabilité, licence, cotisation ou planning;
- un réseau social;
- un outil d'analyse vidéo;
- un tableau de bord statistique complexe.

## Coeur Du Produit

Le coeur du produit est la fiche judoka.

Depuis cette fiche, le coach doit comprendre:

- qui est le judoka;
- sur quelle saison on regarde ses résultats;
- combien de compétitions et de combats composent son bilan;
- comment il gagne et comment il perd;
- quels résultats il a obtenus compétition par compétition.

La compétition est l'unité de suivi. Le combat est l'unité d'analyse sportive.

## Boucle D'Usage Principale

1. Choisir un judoka.
2. Consulter sa fiche et ses compétitions.
3. Ajouter une compétition.
4. Enregistrer les combats.
5. Finaliser le classement.
6. Relire le bilan de saison et le profil de combat.

Cette boucle doit rester courte. Si l'utilisateur doit réfléchir à la structure de l'outil, le produit est trop compliqué.

## Principes Produit

- Mobile d'abord: les écrans doivent fonctionner confortablement sur téléphone.
- Saisie minimale: demander seulement ce qui sert le suivi sportif.
- Lecture coach: les données doivent produire une lecture utile, pas seulement une archive.
- Judoka au centre: les actions principales partent du judoka actif.
- Progression visible: chaque saison doit raconter un parcours.
- Permissions simples: chacun voit et modifie uniquement ce qui correspond à son rôle.
- Pas de surcharge: une fonctionnalité non sportive doit justifier fortement sa place.

## Fonctionnalités MVP

- Connexion Google contrôlée par invitation.
- Gestion des judokas accessibles selon le rôle.
- Création et modification de compétitions.
- Ajout, modification et suppression de combats.
- Finalisation du classement d'une compétition.
- Fiche performance par judoka et par saison.
- Gestion des enfants par les parents.
- Gestion des accès administrateur.

## Critères De Succès Produit

Le produit est réussi si:

- un coach peut retrouver le bilan d'un judoka en moins d'une minute;
- l'ajout d'une compétition et de ses combats reste faisable sur téléphone;
- la fiche judoka permet d'identifier rapidement les tendances de victoire et de défaite;
- les parents et judokas comprennent ce qu'ils peuvent voir ou modifier;
- l'application reste focalisée sur le suivi sportif, même quand de nouveaux besoins apparaissent.

## Décisions Produit À Garder En Tête

- La fiche judoka est l'écran de référence pour la valeur produit.
- La liste des compétitions doit rester courte, lisible et exploitable.
- Les statistiques doivent aider une discussion coach-judoka, pas produire une illusion de précision.
- Les champs de saisie doivent être ajoutés seulement s'ils améliorent la lecture sportive.
- Les futures fonctionnalités doivent renforcer la boucle judoka -> compétition -> combat -> bilan.
