# Instructions Copilot pour Kiroku

Ces instructions complètent `AGENTS.md`, qui reste la source de vérité commune pour Codex, Copilot et les autres agents. En cas de conflit, suivre `AGENTS.md`, puis les specs concernées.

## Projet

Kiroku est une application mobile first de suivi de compétitions de judo pour un club. Elle gère les judokas, parents, compétitions, combats, invitations, rôles et statistiques de saison.

Le dépôt est une application JavaScript sans bundler:

- `Index.html`: shell frontend servi par l'application.
- `assets/**/*.js`: runtime navigateur, logique UI et Vue progressivement intégré.
- `api/*.js`: endpoints Vercel, dont `/api/app`, `/api/rpc`, `/api/client` et `/api/styles`.
- `core/domain/*`: règles métier, value objects et calculs.
- `core/services/*`: orchestration applicative.
- `core/repositories/*`: mapping persistance Supabase.
- `supabase/migrations/*`: schéma SQL canonique.
- `tests/*.test.js`: validations Node.js natives.

## Références à lire selon la tâche

- Fonctionnel: lire `docs/spec.md` pour les règles métier, écrans, flux et critères d'acceptation.
- Technique: lire `docs/spec-tech.md` seulement pour architecture, données, auth, sécurité, configuration ou déploiement.
- Agent workflow: lire `AGENTS.md` avant toute modification substantielle.
- Skills repo: `.agents/skills/vue/SKILL.md` existe pour les changements Vue 3. L'utiliser quand la tâche touche Vue, `<script setup>`, Composition API ou les composants Vue.

## Méthode attendue

- Chercher avec `rg` avant d'élargir la lecture du dépôt.
- Garder les changements petits, atomiques et cohérents avec les patterns existants.
- Ne pas ajouter de dépendance sans nécessité claire.
- Concevoir mobile first et prévoir chargement, vide, erreur et succès pour les écrans.
- Valider côté serveur les règles métier et permissions; ne jamais compter uniquement sur le frontend.
- Mettre à jour `docs/spec.md` si une règle, un écran ou un flux utilisateur change.
- Mettre à jour `docs/spec-tech.md` si architecture, données, auth, sécurité ou déploiement changent.

## Commandes utiles

- Tests complets: `npm test`
- Lint si nécessaire: `npx eslint .`
- Déploiement de production: `make deploy` lance `npm test`, puis `vercel --prod`.

Node.js doit rester en version `>=20` selon `package.json` et `docs/spec-tech.md`.

## Règles de livraison

Pour un changement applicatif, lancer les tests ciblés d'abord, puis `npm test` si le comportement est partagé. Vérifier `git status` avant de conclure. Si un échec est préexistant ou hors périmètre, le signaler sans le corriger.
