---
title: Kiroku Refactoring Backlog
date_created: 2026-06-12
last_updated: 2026-06-15
owner: competitions-judo
tags:
  - refactoring
  - backlog
---

# TODO - Axes de simplification

Audit realise le 2026-06-12.

Objectif : reduire le couplage entre UI, RPC, services et tests pour rendre les prochains changements plus locaux, plus rapides a verifier et moins fragiles pour un LLM.

## P0 - Simplifications prioritaires

1. Extraire un client RPC frontend
   - Constat : `assets/app.js` garde `runServer(method, args, success, failure)`, la session, le `fetch`, le routage d'erreurs et certaines transitions login.
   - Simplification : creer `assets/app-api.js` avec des fonctions nommees (`getInitialData`, `saveCompetition`, `deleteCombat`, etc.) qui retournent des promesses et normalisent les erreurs.
   - Critere de fin : les ecrans n'appellent plus `app.runServer("nomMethode", args)` directement.

2. Remplacer les decisions frontend basees sur le texte des erreurs
   - Constat : la navigation login/invitation/session depend de `message.includes(...)` dans `assets/app.js` et `assets/app-auth.js`.
   - Simplification : faire retourner `/api/rpc` des erreurs structurees compatibles (`{ code, message }`) pour les cas `SESSION_INVALID`, `INVITATION_FOUND`, `INVITATION_REQUIRED`.
   - Critere de fin : les transitions UI critiques ne dependent plus de fragments de messages serveur.

3. Supprimer les handlers globaux et les `onclick` inline
   - Constat : `assets/app.js` expose de nombreuses fonctions via `Object.assign(window, ...)` et les templates HTML utilisent encore `onclick`.
   - Simplification : utiliser `data-action` / `data-id` avec delegation d'evenements par ecran.
   - Critere de fin : `Object.assign(window, ...)` disparait ou se limite a un cas documente, et les tests ne recherchent plus de `onclick`.

4. Isoler l'autocomplete judoka
   - Constat : `bindAutocomplete` est generique mais vit dans `assets/app-screen-competition.js`; l'accueil l'utilise via `screens.competition.bindAutocomplete`.
   - Simplification : creer `assets/app-autocomplete.js` avec une API explicite et sans dependance a l'ecran competition.
   - Critere de fin : l'ecran home ne depend plus de l'ecran competition pour choisir un judoka.

5. [PARTIEL] Rendre explicite le registre RPC backend
   - Constat : `core/index.js` compose la surface publique par spreads de services, ce qui masque la liste exacte des methodes exposees.
   - Fait : `core/types.js` declare un typedef `RpcMethods` listant les 23 methodes (`getInitialData`, `saveCompetition`, `ajouterCombat`, etc.) avec leur signature ; `core/index.js` type `methods` avec `@type {import("./types").RpcMethods}` (verifie par `npm run typecheck`) ; `api/rpc.js` rejette les noms de methode qui ne sont pas une propriete propre de `methods` (`Object.hasOwn`).
   - Reste ouvert : declarer une courte intention/documentation par methode, et une eventuelle validation runtime des arguments.
   - Critere de fin : renommer ou supprimer une methode publique impose une modification visible dans un seul registre.

## P1 - Simplifications importantes

6. [FAIT] Factoriser le chargement du contexte utilisateur dans les services
   - Constat : `competitions.service.js`, `combats.service.js` et `children.service.js` repetent la sequence `getCurrentUserContext` ou `getCurrentUser`, conversion canonique, scope et verification.
   - Simplification : `getDomainUserContext(email)` ajoute dans `user-context.service.js`, utilise par `competitions.service.js`, `combats.service.js`, `club-competitions.service.js` et `core/index.js`.
   - Reste ouvert : `getRequiredCurrentUser(email)` pour factoriser le pattern `if (!user) throw new Error("Acces refuse pour : ...")` repete dans `children.service.js` et `admin.service.js`.

7. [PARTIEL] Clarifier les DTO par cas d'usage
   - Constat : `domain-adapters.js` convertit entre formats Supabase, domaine et UI, mais les noms restent generiques (`toCompetitionReadModel`, `toJudokaReadModel`).
   - Fait : alias morts (`toDomainCombat`, `toDomainCompetition`, `toDomainJudoka`, `toDomainManagedChild`) et doublons (`toJudokaReadModel`/`toCanonicalJudoka`, `toCompetitionReadModel`/`toCanonicalCompetition`) supprimes ; conversions factorisees via un helper `pick`. `core/types.js` documente desormais les formes canoniques (`Judoka`, `Competition`, `Combat`, `ManagedChild`, `AccessInvitation`) et les DTO composites par methode RPC (`InitialData`, `CompetitionDetail`, `ClubCompetitionDetail`, `ChildrenManagement`, `AdminsManagement`, `JudokaProfile`).
   - Reste ouvert : nommer les sorties selon leur usage (`CompetitionListItemDto`, `CompetitionDetailDto`, `JudokaProfileDto`) si les noms generiques actuels deviennent ambigus ; detailler `JudokaProfile` (actuellement `[key: string]: any`).
   - Critere de fin : chaque reponse RPC complexe a un DTO explicite ou une entree de contrat.

8. Extraire les templates HTML frontend en fonctions pures
   - Constat : les ecrans construisent encore de longs fragments HTML avec `innerHTML`, rendu, echappement et actions melanges.
   - Simplification : creer des fonctions pures par carte ou bloc (`competitionCardHtml`, `combatCardHtml`, `invitationRowHtml`, `childCardHtml`).
   - Critere de fin : les fonctions de rendu orchestrent les listes; les templates ne font que transformer des donnees en HTML.

9. Rendre les tests frontend moins couples aux chaines HTML
   - Constat : plusieurs tests valident des regex longues sur le bundle complet et figent des details d'implementation (`onclick`, classes, ordre HTML).
   - Simplification : tester des invariants plus stables via helpers purs, conventions de DOM minimales et tests structurels courts.
   - Critere de fin : un refacto de template sans changement fonctionnel ne casse pas une grande partie de `tests/mobile-first-index.test.js` ou `tests/vercel-deployment.test.js`.

10. Ajouter des scripts de test par zone
    - Constat : `package.json` expose seulement `npm test`, alors que les changements schema, backend et structure frontend n'ont pas le meme perimetre.
    - Simplification : ajouter `test:backend`, `test:frontend-structure`, `test:schema` en reutilisant les fichiers de test existants.
    - Critere de fin : un changement local peut lancer une verification ciblee avant la suite complete.

## P2 - Nettoyage utile

11. Reduire les gros modules frontend restants
    - Constat : `assets/app-screen-competition.js` reste le plus charge (detail competition, formulaire competition, formulaire combat, autocomplete, decisions de combat).
    - Simplification : separer `competition-detail`, `competition-form`, `combat-form` et `judoka-autocomplete`.
    - Critere de fin : chaque module frontend reste proche d'un seul flux utilisateur.

12. Centraliser les options metier partagees
    - Constat : les categories, classements, resultats et types de decision existent cote domaine, mais certaines listes ou regles sont aussi reproduites cote UI.
    - Simplification : exposer un petit contrat public statique ou dupliquer volontairement dans un fichier frontend unique documente.
    - Critere de fin : modifier une option metier ne demande pas de chercher dans plusieurs ecrans.

13. Encadrer l'usage de `innerHTML`
    - Constat : l'echappement est present, mais chaque nouveau fragment HTML doit penser a `escapeHtml` / `escapeAttribute`.
    - Simplification : limiter `innerHTML` aux templates purs ou introduire de petits builders DOM pour les zones interactives.
    - Critere de fin : les donnees utilisateur ne sont jamais inserees sans helper d'echappement identifiable.

14. Documenter une carte courte de modification
    - Constat : `spec-tech.md` decrit l'architecture, mais pas le chemin pratique pour modifier un flux.
    - Simplification : creer `docs/code-map.md` avec "pour modifier competition/combat/enfant/admin/auth, regarder ces fichiers et lancer ces tests".
    - Critere de fin : une demande fonctionnelle peut etre reliee rapidement aux fichiers et tests utiles.

15. Ajouter les IDs de regles dans les tests critiques
    - Constat : les specs utilisent `COMP-*`, `CBT-*`, `AUTH-*`, `CHD-*`, mais les tests ne les mentionnent pas systematiquement.
    - Simplification : inclure l'ID de regle dans le nom des tests quand le lien est direct.
    - Critere de fin : `rg "COMP-015"` ou `rg "AUTH-009a"` retrouve spec et tests associes.

## Roadmap TypeScript / decoupage frontend (non demarre)

16. Decouper `Index.html` en partials assembles par `api/app.js`
    - Constat : `Index.html` contient les ~11 vues Vue inline (~1000+ lignes) dans un seul fichier,
      ce qui rend les diffs larges et le fichier difficile a naviguer.
    - Simplification : extraire chaque vue/template en fichier partiel sous `assets/views/`
      (ou equivalent), assembles a la construction de la reponse par `api/app.js` (toujours
      sans bundler/etape de build).
    - Critere de fin : `Index.html` ne contient plus que la structure globale et les points
      d'assemblage ; chaque vue est editable independamment.
    - A planifier separement (chantier dedie, hors perimetre de l'introduction des types
      JSDoc/`jsconfig` realisee en parallele).

17. Etendre les types JSDoc / `jsconfig` a `assets/**`
    - Constat : `jsconfig.json` couvre actuellement `core/**` et `api/**` ; le frontend
      (`assets/`) n'est pas type-checke.
    - Simplification : une fois le pattern valide cote `core/` (cf. `core/types.js`,
      item 5 et 7), etendre `include` a `assets/**/*.js` et annoter progressivement
      `assets/app-api.js` (futur client RPC, item 1) avec les types de `core/types.js`
      (notamment `RpcMethods`, `Judoka`, `Competition`, `Combat`).
    - Critere de fin : `npm run typecheck` couvre aussi `assets/`.

18. Migration vers de vrais fichiers `.ts`
    - Constat : l'app n'a pas d'etape de build (Vue 3 global build servi directement,
      deploiement Vercel sans bundler) ; une migration `.ts` reelle impose d'en introduire une.
    - Simplification : a reconsiderer apres le decoupage d'`Index.html` (item 16) et
      l'extension des types a `assets/` (item 17), en evaluant l'impact d'un build step
      sur le deploiement Vercel actuel.
    - Critere de fin : decision documentee (go/no-go build step) avant toute conversion
      `.js` -> `.ts`.

## Discipline de refacto

- Faire un axe a la fois, avec test cible avant la suite complete.
- Eviter de modifier simultanement comportement metier et structure.
- Mettre a jour `spec.md` seulement si une regle ou un flux change.
- Mettre a jour `spec-tech.md` seulement si contrat, architecture, securite, donnees ou deploiement changent.
