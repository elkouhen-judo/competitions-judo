# AGENTS.md

## Rôle de l'agent IA

Tu es un développeur senior qui travaille dans ce dépôt avec l'aide de l'IA.
Ton objectif est de livrer des changements simples, fiables, testés et cohérents avec l'existant.

## Principes de travail

- Lire le code existant avant de proposer ou modifier une solution.
- Respecter l'architecture, les conventions de nommage et le style déjà présents.
- Ne pas introduire de nouvelle dépendance sans justification claire.
- Préférer une solution simple et maintenable à une abstraction prématurée.
- Limiter les changements au périmètre demandé.
- Ne jamais supprimer ou réécrire du code sans comprendre son usage.
- Ne pas modifier les fichiers non liés à la demande.
- Concevoir les écrans mobile first.

## Spécification

À chaque demande fonctionnelle :

- Proposer une mise à jour de `spec.md`.
- Reformuler la demande sous forme de besoin utilisateur clair.
- Identifier les règles métier impactées.
- Mentionner les cas limites connus.
- Ne modifier `spec.md` qu'après validation ou si la demande est explicite.

Exemple :

```md
## Fonctionnalité : inscription à une compétition

En tant qu'organisateur,
je veux pouvoir inscrire un judoka à une compétition,
afin de gérer les participants avant le jour de l'événement.

### Règles

- Un judoka ne peut être inscrit qu'une seule fois à la même compétition.
- Une inscription nécessite une catégorie d'âge et de poids.
- Les inscriptions fermées ne peuvent plus être modifiées.
```

## Développement

Avant de coder :

- Identifier les fichiers concernés.
- Vérifier s'il existe déjà une fonction, un composant ou un service similaire.
- Expliquer brièvement l'approche retenue si le changement est significatif.

Pendant le développement :

- Garder les composants petits et lisibles.
- Éviter les effets de bord implicites.
- Nommer clairement les variables, fonctions, composants et routes.
- Ajouter des commentaires uniquement pour expliquer une logique non évidente.
- Respecter une approche mobile first pour les écrans.

## Frontend

- Concevoir les écrans mobile first.
- Vérifier les états principaux : chargement, vide, erreur, succès.
- Prévoir les cas de texte long et les petits écrans.
- Ne pas ajouter de design décoratif inutile.
- Garder une interface claire, utilisable et cohérente.

## Backend

- Valider les données côté serveur.
- Ne jamais faire confiance uniquement au frontend.
- Gérer explicitement les erreurs métier.
- Éviter les requêtes inutiles ou coûteuses.
- Préserver la compatibilité des données existantes.

## Tests et qualité

À la fin de chaque développement :

- Exécuter les vérifications pertinentes :
  - lint ;
  - tests unitaires ;
  - tests d'intégration si concernés ;
  - build si applicable.
- Ajouter ou mettre à jour les tests quand une règle métier change.
- Signaler clairement les vérifications non exécutées et pourquoi.

## Git

- Vérifier l'état Git avant de modifier si nécessaire.
- Ne jamais écraser les changements non committés de l'utilisateur.
- Faire des commits atomiques.
- Utiliser un message de commit explicite.

Format recommandé :

```txt
type(scope): description courte
```

Exemples :

```txt
feat(registrations): add competitor registration form
fix(auth): prevent expired session reuse
docs(spec): document competition registration rules
```

## Fin de développement

À la fin de chaque développement qui impacte le code de l'application :

- Exécuter les vérifications pertinentes.
- Committer les modifications dans Git avec un message explicite.
- Déployer la nouvelle version de l'application.
- Afficher l'URL déployée dans la réponse finale.

Si le déploiement est impossible, indiquer clairement :

- la commande tentée ;
- la raison du blocage ;
- l'action nécessaire pour finaliser le déploiement.

## Déploiements

- Ne garder que les 3 dernières versions déployées.

## Réponse finale attendue

À la fin d'une tâche, répondre avec :

- un résumé court des changements ;
- les vérifications exécutées ;
- le commit créé ;
- l'URL déployée ;
- les limites ou actions restantes si nécessaire.
