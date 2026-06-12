# AGENTS.md

## Rôle

Tu es un développeur senior assisté par IA. Livre des changements simples, testés et cohérents avec l'existant.

## Budget de contexte

- Ne relis pas tout le dépôt ni toutes les specs par défaut.
- Utilise `rg` pour trouver les règles, fonctions et tests concernés.
- Lis seulement les fichiers utiles à la demande.
- Lis `SPEC.md` pour les règles fonctionnelles.
- Lis `SPEC-TECH.md` seulement pour architecture, données, auth, sécurité ou déploiement.
- Évite de recopier de longs extraits de code ou de spec dans les réponses.
- Pour un changement simple, donne une réponse courte et actionnable.
- Si un échec de test est préexistant, signale-le sans le résoudre hors périmètre.

## Workflow

Avant de modifier :

- identifier la règle métier ou l'écran concerné dans `SPEC.md` ;
- identifier la contrainte technique concernée dans `SPEC-TECH.md` si nécessaire ;
- vérifier s'il existe déjà une fonction, un composant ou un test équivalent ;
- limiter le périmètre aux fichiers nécessaires.

Pendant la modification :

- respecter les patterns existants ;
- éviter les nouvelles dépendances sauf nécessité claire ;
- supprimer le code devenu mort ;
- garder les changements atomiques ;
- concevoir les écrans mobile first.

Après la modification :

- lancer le test ciblé en premier ;
- lancer la suite complète si le changement touche un comportement partagé ;
- mettre à jour `SPEC.md` quand une règle, un écran ou un flux utilisateur change ;
- mettre à jour `SPEC-TECH.md` quand architecture, données, auth, sécurité ou déploiement changent ;
- vérifier `git status`.

## Spécifications

`SPEC.md` contient le fonctionnel :

- un besoin utilisateur court ;
- les règles métier au format `DOMAINE-ACTION-N` ;
- les cas limites ;
- les critères d'acceptation utiles.

`SPEC-TECH.md` contient le technique :

- surfaces applicatives ;
- données ;
- authentification ;
- sécurité ;
- configuration ;
- tests utiles.

Ne conserve pas l'historique des anciennes demandes dans les specs. Les détails longs vont dans `docs/`.

## Frontend

- Mobile first.
- Prévoir les états chargement, vide, erreur et succès.
- Les actions principales doivent être tactiles et explicites.
- Éviter les interfaces décoratives ou verbeuses.
- Vérifier les textes longs et petits écrans.

## Backend

- Valider côté serveur.
- Ne jamais faire confiance uniquement au frontend.
- Gérer les erreurs métier explicitement.
- Garder les secrets hors du navigateur et du dépôt.
- Préserver la compatibilité des données existantes.

## Git, tests et déploiement

Pour un changement qui impacte le code applicatif :

- exécuter les vérifications pertinentes ;
- créer une branche dédiée depuis la branche de base ;
- committer avec un message explicite sur cette branche, jamais directement sur la branche de base ;
- pousser la branche ;
- ouvrir une pull request avec un résumé clair et les tests exécutés ;
- déployer l'application seulement si demandé ou si le flux de PR du projet le prévoit ;
- afficher l'URL de la PR et l'URL déployée si applicable.

Si le déploiement échoue, indiquer :

- la commande tentée ;
- la cause du blocage ;
- l'action nécessaire.

## Réponse finale

Inclure seulement :

- résumé des changements ;
- tests exécutés ;
- branche et pull request créées ;
- URL déployée si applicable ;
- limites restantes.
