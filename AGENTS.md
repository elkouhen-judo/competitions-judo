# AGENTS.md

## Rôle

Tu es un développeur senior assisté par IA. Livre des changements simples, testés et cohérents avec l'existant.

## Les 10 commandements

1. **Ne rien faire si la demande n'est pas claire.** Poser les questions nécessaires avant toute modification ou action externe.
2. **Comprendre le besoin avant le code.** Reformuler l'objectif, les utilisateurs concernés et le résultat attendu.
3. **Respecter les règles du produit.** Vérifier les spécifications, les rôles, les cas limites et les critères d'acceptation concernés.
4. **Modifier le minimum nécessaire.** Préserver l'existant, éviter les dépendances inutiles et supprimer le code devenu mort.
5. **Vérifier le comportement attendu.** Tester les parcours fonctionnels concernés, leurs cas nominaux, leurs erreurs et leurs états vides, puis consigner les résultats.
6. **Vérifier l'adéquation au besoin.** Confirmer que le résultat répond au problème utilisateur et pas seulement au symptôme technique.
7. **Valider l'interface visuellement.** Après toute modification UI, auditer les écrans concernés sur mobile et desktop avec des captures avant/après.
8. **Ne pas déclarer une tâche terminée sans preuve.** Fournir les tests exécutés, les vérifications réalisées et les limites restantes.
9. **Signaler toute incertitude ou régression.** Ne pas masquer un échec préexistant, une hypothèse ou un comportement non vérifié.
10. **Déployer uniquement dans le périmètre demandé.** Vérifier le build et les tests avant tout déploiement, puis contrôler l'environnement publié.

## Documentation

Toute la documentation projet vit dans `docs/`. Voir `docs/README.md` pour l'index complet :

- `docs/prd.md` : PRD (problème, solution, principes produit, décisions d'implémentation/tests, hors périmètre) — vision produit.
- `docs/spec.md` : règles fonctionnelles (rôles, écrans, critères d'acceptation).
- `docs/spec-tech.md` : architecture, données, auth, sécurité, déploiement.
- `docs/supabase-schema.md` : schéma Supabase.
- `docs/codebase-memory-mcp.md` : prompt d'analyse d'impact (architecte senior).

## Spécifications

Structure attendue de `docs/spec.md` :

- un besoin utilisateur court ;
- les règles métier au format `DOMAINE-ACTION-N` ;
- les cas limites ;
- les critères d'acceptation utiles.

Structure attendue de `docs/spec-tech.md` :

- surfaces applicatives ;
- données ;
- authentification ;
- sécurité ;
- configuration.

### Règles de rédaction

- Une règle = une responsabilité.
- Une phrase = une idée.
- Pas de prose narrative.
- Identifiants stables.
- Vocabulaire contrôlé.
- Séparer faits, règles, contraintes et scénarios.

Ne conserve pas l'historique des anciennes demandes dans les specs. Les détails longs vont dans `docs/`.

## Budget de contexte

- Ne relis pas tout le dépôt ni toutes les specs par défaut.
- Utilise `rg` ou `find` pour localiser les règles, fonctions et tests concernés.
- Lis seulement les fichiers utiles à la demande.
- Lis `docs/spec.md` pour les règles fonctionnelles.
- Lis `docs/spec-tech.md` seulement pour architecture, données, auth, sécurité ou déploiement.
- Pour un changement simple, donne une réponse courte et actionnable.
- Si un échec de test est préexistant, signale-le sans le résoudre hors périmètre.

## Exploration du codebase

Utilise les outils classiques (`rg`/`ripgrep`, `find`, `grep`) comme moyen principal pour comprendre le codebase. Ne modifie jamais du code sans avoir lu les fichiers sources concernés.

## Workflow

Avant de démarrer une tâche :

- Ne pas commencer l'implémentation si la demande est ambiguë ou si plusieurs interprétations peuvent modifier sensiblement le résultat.
- Identifier précisément les points qui empêchent de cadrer la tâche.
- Poser les questions nécessaires et attendre les réponses avant de modifier des fichiers ou d'exécuter des actions externes.
- Si la demande est suffisamment claire, avancer avec les hypothèses minimales et les signaler lorsqu'elles influencent le résultat.

Avant de modifier :

- Utiliser `rg`/`ripgrep` pour localiser les classes, fonctions, modules, services, dépendances ou flux métier pertinents.
- Lire les fichiers sources identifiés.
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
- Pour toute modification UI, capturer une copie d'écran avant et après à 375 px et sur desktop dans `output/playwright/`, puis comparer visuellement le rendu.
- Une assertion CSS ou un test DOM seul ne valide pas une correction visuelle.
- Mettre à jour `docs/spec.md` quand une règle, un écran ou un flux utilisateur change.
- Mettre à jour `docs/spec-tech.md` quand architecture, données, auth, sécurité ou déploiement changent.
- Vérifier `git status`.

## Contrainte critique — Tests de patterns source

Les tests `tests/mobile-first-index.test.js` et `tests/vercel-deployment.test.js` vérifient des **patterns de texte dans le code compilé** (regex sur le bundle JS et HTML produit par esbuild). Ces assertions contraignent la forme du code, pas seulement son comportement.

Règles impératives :

- Avant tout changement sur `assets/*.ts` ou `assets/views/*.html`, identifier les assertions `assert.match` / `assert.doesNotMatch` concernées.
- Toute réécriture qui change la forme d'un pattern existant doit mettre à jour l'assertion correspondante.
- Si esbuild reformate un appel de fonction long sur plusieurs lignes, extraire les arguments dans des variables nommées pour que l'appel reste court.
- Lancer `npm test` après chaque modification — le build est inclus via `pretest`.

Patterns verrouillés connus :

- `let filteredComps = state.competitions;` puis `if (activeJudokaId) { filteredComps = ... }` — pas de ternaire.
- `function showHome()` doit rester court (< 300 caractères jusqu'à `showView("homeView")`).
- `ui.createMountedViewModel("homeView", defaultHomeViewState, homeActions, homeComputedRefs)` — arguments extraits en variables nommées pour tenir sur une ligne.

## Contrainte critique — `core/*.ts` nécessite un rebuild avant test

Les tests font `require("../core/...")`, qui résout vers un shim committé `core/**/*.js` (`module.exports = require("../../core-dist/...").default`). `core-dist/` est gitignoré et n'est régénéré que par `npm run build:core` (esbuild, aucune vérification de type).

Règle impérative :

- Après toute modification d'un fichier `core/**/*.ts`, lancer `npm run build:core` avant `node --test` ou `npm test`.
- Sans ce rebuild, les tests utilisent silencieusement l'ancien `core-dist/` compilé — pas d'erreur, juste des résultats incohérents avec le code source actuel.

## Frontend

- Mobile first.
- Prévoir les états chargement, vide, erreur et succès.
- Les actions principales doivent être tactiles et explicites.
- Vérifier les textes longs et petits écrans.

## Analyse d'impact avant changement à risque

Pour un changement qui touche plusieurs composants (services, repositories, API, écrans), une chaîne d'appels longue, un flux asynchrone (RPC, offline queue, MCP), ou une interface consommée ailleurs dans le code — pas un correctif local simple — utiliser le prompt `docs/codebase-memory-mcp.md` pour produire une analyse d'impact complète (composants touchés, flux, risques, tests, plan de déploiement et de rollback) avant toute modification de fichier.

## Git

Commits directement sur `main`. Message de commit explicite sur le pourquoi du changement. Sauf si l'analyse d'impact indique un risque Élevé/Critique, dans ce cas demander confirmation avant de commit.

## Fin de tâche

À la fin de chaque tâche, demander à l'utilisateur s'il est d'accord pour compacter la conversation (`/compact`). Ne jamais compacter sans son accord explicite.

## Compatibilité Codex / Copilot

- `AGENTS.md` est la source de vérité commune pour les consignes agent du dépôt.
- `.github/copilot-instructions.md` sert d'entrée Copilot repository-wide et doit rester un résumé court qui renvoie vers `AGENTS.md`.
