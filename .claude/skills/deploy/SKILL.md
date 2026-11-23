---
name: deploy
description: Déploie Ayumi en dev et/ou en prod (migration Supabase comprise), puis vérifie l'environnement publié. À lancer uniquement sur demande explicite de l'utilisateur.
disable-model-invocation: true
argument-hint: "[dev|prod|dev+prod]"
---

# Déployer Ayumi

Cible demandée : `$ARGUMENTS` (par défaut `dev`). Ne jamais déployer la prod sans qu'elle soit nommée dans la demande (AGENTS.md, commandement 10).

## 1. Avant

1. `git status -sb` : l'arbre doit être propre et `main` à jour avec `origin/main`. Sinon, s'arrêter et demander s'il faut commiter et pousser (description technique validée au préalable, AGENTS.md).
2. Repérer une migration à appliquer : `git diff --name-only <dernier déploiement>..HEAD -- supabase/migrations/`. Le schéma tient dans un seul fichier idempotent, `supabase/migrations/20260612000000_initial_schema.sql`.

## 2. Base de données (seulement si le schéma a changé)

`npm run db:deploy` demande `SUPABASE_ACCESS_TOKEN` ; s'il manque, passer par la CLI Supabase déjà authentifiée.

1. Prod concernée : sauvegarde d'abord, `npm run db:backup:prod` (dossier `backups/supabase/prod/<horodatage>`). `npm run db:deploy` la fait seul (GAT-008).
2. Dev (`ogjrxvoqrjstlarwennh`) : `supabase db query --remote=ogjrxvoqrjstlarwennh --yes -f supabase/migrations/20260612000000_initial_schema.sql`, puis vérifier la fonction ou la colonne modifiée par une requête de lecture.
3. Prod (`dqtdbfmehwdexikkblwg`), seulement si demandée et si le dev est vérifié : même commande avec `--remote=dqtdbfmehwdexikkblwg`, même vérification.

## 3. Application

Les scripts passent par `scripts/predeploy.js` (fichiers suivis tous commités, prod depuis `main` poussé, `npm run check`, `npm test`), puis `scripts/smoke-check.js` contrôle le `200` après publication (GAT-005 à 007). Une gate en échec arrête le déploiement : ne pas contourner.

- Dev : `npm run app:deploy:dev`
- Prod : `npm run app:deploy:prod`

Si Vercel répond que le jeton est invalide, demander à l'utilisateur de lancer `! vercel login`.

## 4. Vérifier l'environnement publié

Pour chaque cible déployée :

1. `curl -s -o /dev/null -w "%{http_code}" <url>/` doit répondre `200` (dev : https://competitions-judo-dev.vercel.app, prod : https://competitions-judo.vercel.app).
2. `curl -s "<url>/api/client?v=$RANDOM" | grep -c "<identifiant propre au changement>"` doit trouver le nouveau code (le cache peut servir l'ancien quelques secondes : réessayer une fois).
3. Si le schéma a changé, relire une donnée de l'environnement avec la CLI Supabase.

## 5. Compte rendu

Commit déployé, URLs, tests passés, migration appliquée ou non (et sauvegarde prod), vérifications faites et ce qui n'a pas été vérifié (par exemple : pas d'essai avec un vrai compte).
