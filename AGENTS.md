# AGENTS.md

## Rôle

Tu es un développeur senior assisté par IA. Livre des changements simples, testés et cohérents avec l'existant.

## Documentation

Toute la documentation projet vit dans `docs/`. Voir `docs/README.md` pour l'index complet :

- `docs/prd.md` : PRD (problème, solution, user stories, décisions d'implémentation/tests, hors périmètre) — vision produit.
- `docs/spec.md` : règles fonctionnelles (rôles, écrans, critères d'acceptation).
- `docs/spec-tech.md` : architecture, données, auth, sécurité, déploiement.
- `docs/supabase-schema.md` : schéma Supabase.

## Budget de contexte

- Ne relis pas tout le dépôt ni toutes les specs par défaut.
- Utilise `grep` ou `find` pour localiser les règles, fonctions et tests concernés.
- Lis seulement les fichiers utiles à la demande.
- Lis `docs/spec.md` pour les règles fonctionnelles.
- Lis `docs/spec-tech.md` seulement pour architecture, données, auth, sécurité ou déploiement.
- Pour un changement simple, donne une réponse courte et actionnable.
- Si un échec de test est préexistant, signale-le sans le résoudre hors périmètre.

## Contrainte critique — Tests de patterns source

Les tests `tests/mobile-first-index.test.js` et `tests/vercel-deployment.test.js` vérifient des **patterns de texte dans le code compilé** (regex sur le bundle JS et HTML produit par esbuild). Ces assertions contraignent la forme du code, pas seulement son comportement.

Règles impératives :

- Avant tout changement sur `assets/*.ts` ou `assets/views/*.html`, identifier les assertions `assert.match` / `assert.doesNotMatch` concernées.
- Toute réécriture qui change la forme d'un pattern existant doit mettre à jour l'assertion correspondante.
- Si esbuild reformate un appel de fonction long sur plusieurs lignes, extraire les arguments dans des variables nommées pour que l'appel reste court.
- Lancer `npm test` après chaque modification — le build est inclus via `pretest`.

Patterns verrouillés connus :

- `let filteredComps = state.competitions;` puis `if (activeJudokaId) { filteredComps = ... }` — pas de ternaire.
- `canDelete: (state.isAdmin || state.isParent) && !state.isCoach` — inline dans l'objet, pas extrait en variable.
- `function showHome()` doit rester court (< 300 caractères jusqu'à `showView("homeView")`).
- `ui.createMountedViewModel("homeView", defaultHomeViewState, homeActions, homeComputedRefs)` — arguments extraits en variables nommées pour tenir sur une ligne.

## Contrainte critique — `core/*.ts` nécessite un rebuild avant test

Les tests font `require("../core/...")`, qui résout vers un shim committé `core/**/*.js` (`module.exports = require("../../core-dist/...").default`). `core-dist/` est gitignoré et n'est régénéré que par `npm run build:core` (esbuild, aucune vérification de type).

Règle impérative :

- Après toute modification d'un fichier `core/**/*.ts`, lancer `npm run build:core` avant `node --test` ou `npm test`.
- Sans ce rebuild, les tests utilisent silencieusement l'ancien `core-dist/` compilé — pas d'erreur, juste des résultats incohérents avec le code source actuel.

## Workflow

Avant de modifier :

- Identifier la règle métier dans `docs/spec.md`.
- Identifier la contrainte technique dans `docs/spec-tech.md` si nécessaire.
- Vérifier s'il existe déjà une fonction ou un test équivalent.
- Limiter le périmètre aux fichiers nécessaires.

Pendant la modification :

- Respecter les patterns existants.
- Éviter les nouvelles dépendances sauf nécessité claire.
- Supprimer le code devenu mort.
- Concevoir les écrans mobile first.

Après la modification :

- Lancer `npm test` (build + tests inclus via `pretest`).
- Mettre à jour `docs/spec.md` quand une règle, un écran ou un flux utilisateur change.
- Mettre à jour `docs/spec-tech.md` quand architecture, données, auth, sécurité ou déploiement changent.
- Vérifier `git status`.

## Git

Commits directement sur `main`. Message de commit explicite sur le pourquoi du changement.

## Compatibilité Codex / Copilot

- `AGENTS.md` est la source de vérité commune pour les consignes agent du dépôt.
- `.github/copilot-instructions.md` sert d'entrée Copilot repository-wide et doit rester un résumé court qui renvoie vers `AGENTS.md`.

## Spécifications

`docs/spec.md` contient le fonctionnel :

- un besoin utilisateur court ;
- les règles métier au format `DOMAINE-ACTION-N` ;
- les cas limites ;
- les critères d'acceptation utiles.

`docs/spec-tech.md` contient le technique :

- surfaces applicatives ;
- données ;
- authentification ;
- sécurité ;
- configuration.

Ne conserve pas l'historique des anciennes demandes dans les specs. Les détails longs vont dans `docs/`.

## Frontend

- Mobile first.
- Prévoir les états chargement, vide, erreur et succès.
- Les actions principales doivent être tactiles et explicites.
- Vérifier les textes longs et petits écrans.
