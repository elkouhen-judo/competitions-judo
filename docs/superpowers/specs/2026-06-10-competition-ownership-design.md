# Gestion des competitions par proprietaire

## Objectif

Mettre l'application en conformite avec `spec.md` et la regle confirmee : chaque utilisateur peut gerer ses propres competitions, tandis que les administrateurs peuvent gerer toutes les competitions.

## Source de verite

L'onglet `Competitions` porte la propriete d'une competition via une colonne `id_judoka`.

Colonnes attendues :

- `id_competition`
- `id_judoka`
- `nom`
- `date`
- `lieu`

`id_judoka` identifie le judoka proprietaire de la competition. Cette colonne est obligatoire pour les competitions creees depuis l'application.

## Regles fonctionnelles

Un utilisateur standard voit les competitions dont `Competitions.id_judoka` correspond a son `id_judoka`.

Un administrateur voit toutes les competitions.

Un utilisateur standard peut creer une competition. Elle est automatiquement rattachee a son `id_judoka`.

Un administrateur peut creer une competition pour un judoka donne en choisissant ce judoka dans une liste. Si aucun judoka n'est choisi, la sauvegarde est refusee pour eviter une competition sans proprietaire.

Un utilisateur standard peut modifier ou supprimer uniquement ses propres competitions.

Un administrateur peut modifier ou supprimer n'importe quelle competition.

La suppression d'une competition supprime aussi tous les combats rattaches a son `id_competition`.

Les combats restent rattaches a leur propre `id_judoka`. La propriete de la competition ne remplace pas les controles existants sur les combats.

## Backend

`getCompetitionsForUser(user)` filtre les competitions par `id_judoka` pour les non-admins et renvoie toutes les competitions pour les admins.

`getCompetitionDetail(id_competition)` verifie l'acces a la competition avant de renvoyer ses informations. Un non-admin doit etre proprietaire de la competition. Les combats restent filtres par `id_judoka` pour les non-admins.

`saveCompetition(competition)` accepte les non-admins. En creation et modification, un non-admin force `id_judoka` a son propre identifiant. Un admin utilise l'identifiant fourni par le formulaire.

`deleteCompetition(id_competition)` autorise la suppression si l'utilisateur est admin ou proprietaire. La suppression en cascade des combats est conservee.

## Interface

Le bouton d'ajout de competition est visible pour tous les utilisateurs authentifies.

Dans le detail d'une competition, les actions modifier et supprimer sont visibles si l'utilisateur peut gerer cette competition : admin ou proprietaire.

Le formulaire de competition ajoute un champ de selection du judoka uniquement pour les admins. Pour les non-admins, la propriete est implicite et non modifiable.

Apres creation ou modification, l'application recharge les donnees et ouvre la competition concernee.

## Tests

Ajouter des tests locaux sur `Code.js` pour proteger les regles suivantes :

- `saveCompetition` ne bloque pas les non-admins et rattache la competition a leur `id_judoka`.
- `saveCompetition` permet a un admin de choisir le proprietaire.
- `getCompetitionsForUser` filtre les competitions par proprietaire pour les non-admins.
- `deleteCompetition` refuse un non-admin non proprietaire et accepte un proprietaire.

Conserver les tests existants sur l'interface mobile et la sortie Apps Script.
