# AGENTS.md

## Rôle

Tu es un développeur senior assisté par IA. Livre des changements simples, testés et cohérents avec l'existant.

## Budget de contexte

- Ne relis pas tout le dépôt ni toutes les specs par défaut.
- Utilise `rg` pour trouver les règles, fonctions et tests concernés.
- Lis seulement les fichiers utiles à la demande.
- Lis `spec.md` pour les règles fonctionnelles.
- Lis `spec-tech.md` seulement pour architecture, données, auth, sécurité ou déploiement.
- Évite de recopier de longs extraits de code ou de spec dans les réponses.
- Pour un changement simple, donne une réponse courte et actionnable.
- Si un échec de test est préexistant, signale-le sans le résoudre hors périmètre.

## Workflow

Avant de modifier :

- identifier la règle métier ou l'écran concerné dans `spec.md` ;
- identifier la contrainte technique concernée dans `spec-tech.md` si nécessaire ;
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
- mettre à jour `spec.md` quand une règle, un écran ou un flux utilisateur change ;
- mettre à jour `spec-tech.md` quand architecture, données, auth, sécurité ou déploiement changent ;
- vérifier `git status`.

## Cadrage Avec LLM

Avant de lancer un changement avec assistance LLM, cadrer explicitement:

- l'objectif attendu en une phrase ;
- le périmètre exact, y compris ce qui est hors scope ;
- les références fonctionnelles et techniques à respecter ;
- les contraintes de style, de structure ou de comportement ;
- la méthode de travail attendue, de préférence par petites étapes ;
- les critères de fin et de validation ;
- la cadence de commit si le changement doit rester récupérable.

Template simple à réutiliser:

```text
Objectif:
- [résultat attendu en une phrase]

Périmètre:
- Modifier uniquement [fichiers / écrans / flux].
- Ne pas toucher à [ce qui est hors scope].

Références:
- Fonctionnel: `spec.md`
- Technique: `spec-tech.md` si nécessaire
- Comportement existant à préserver: [points clés]

Contraintes:
- Respecter les patterns du dépôt.
- Mobile first.
- Garder les changements petits et atomiques.
- Ne pas introduire de nouvelle dépendance sans raison forte.

Méthode:
- Avancer écran par écran ou étape par étape.
- Vérifier chaque étape avant de continuer.
- Corriger seulement ce qui est nécessaire pour atteindre l'objectif.

Validation:
- Lancer les tests ciblés.
- Puis la suite pertinente si le comportement est partagé.
- Vérifier `git status` après chaque étape.

Livraison:
- Faire un commit par étape terminée.
- Pousser après chaque commit si le flux projet l'exige.
- S'arrêter si un point métier ou technique manque de clarté.
```

## Skills Recommandés

Pour ce dépôt, privilégier en priorité:

- `vue` pour les écrans et composants Vue 3 ;
- `frontend-design` pour les refontes visuelles et les arbitrages d'interface ;
- `domain-driven-design` pour structurer les règles métier et le vocabulaire ;
- `update-specification` quand un flux ou une règle fonctionnelle change ;
- `vercel:verification` pour valider un flux de bout en bout sur l'application lancée ;
- `vercel:auth` quand le travail touche au login, aux invitations ou aux permissions ;
- `vercel:deployments-cicd` quand le sujet porte sur la livraison ou le déploiement.
- `superpowers` quand le travail doit être exécuté de façon plus outillée, avec plans, sous-agents ou revue en plusieurs passes.

Le noyau recommandé pour ce projet est `vue`, `frontend-design`, `domain-driven-design` et `vercel:verification`.

## Compatibilité Codex / Copilot

- `AGENTS.md` est la source de vérité commune pour les consignes agent du dépôt.
- `.github/copilot-instructions.md` sert d'entrée Copilot repository-wide et doit rester un résumé court qui renvoie vers `AGENTS.md`.
- Les skills repo sont dans `.agents/skills/*/SKILL.md`; ne pas dupliquer leur contenu complet dans les instructions globales.
- Quand un outil ne sait pas activer un skill automatiquement, appliquer le résumé de `AGENTS.md` et lire le `SKILL.md` concerné seulement si la tâche le justifie.
- Garder les noms de fichiers réels en minuscules: `spec.md` et `spec-tech.md`.

## Spécifications

`spec.md` contient le fonctionnel :

- un besoin utilisateur court ;
- les règles métier au format `DOMAINE-ACTION-N` ;
- les cas limites ;
- les critères d'acceptation utiles.

`spec-tech.md` contient le technique :

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
