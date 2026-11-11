# Backlog UX

Issu de la revue ergonomique du 11/11/2026 (gabarits `assets/views/*.html` et captures `screenshots/`).

- Priorité : P1 (bloque le parcours principal), P2 (gêne récurrente), P3 (confort).
- Effort : S (≤ 1 jour), M (2-3 jours), L (≥ 1 semaine, touche le schéma).
- Les identifiants suivent la convention `DOMAINE-ACTION-N`.

## Ordre de traitement proposé

| Lot | Contenu | Stories |
|---|---|---|
| 1 | Saisie rapide et finitions | COMBAT-SAISIE-1 à 3, COMBAT-ALERTE-1, NAV-ACTIONS-1, COMBAT-CARTE-1, UI-FINITION-1 à 5 |
| 2 | Navigation et fiche compétition | NAV-BARRE-1, NAV-ACCUEIL-1 et 2, NAV-SUPPRESSION-1, COMPETITION-FICHE-1 et 2, COMPETITION-COACH-1, COMPETITION-CLASSEMENT-1 et 2 |
| 3 | Modèle judo | COMBAT-CONCEDE-1, COMBAT-SHIDO-1, COMBAT-TOUR-1, CLUB-CATEGORIE-1 |
| 4 | Coach et admin | DASHBOARD-SYNTHESE-1, DASHBOARD-GRAPHIQUE-1, DASHBOARD-DETAIL-1, CLUB-DETAIL-1, ADMIN-PAGE-1, ADMIN-IMPORT-1 |
| Transverse | Refactoring du thème A « Blanc & Bleu » | THEME-TOKENS-1, THEME-SURCOUCHE-1, THEME-COULEURS-1, THEME-TYPO-1, THEME-FORMES-1, THEME-COMPOSANTS-1, THEME-PWA-1, THEME-VALIDATION-1, DOC-CAPTURES-1 |

## 1. Saisie d'un combat

### COMBAT-SAISIE-1 — Boutons segmentés pour le résultat et la décision (P1, S)

- Besoin : le parent ou le coach saisit un combat d'une main, au bord du tatami.
- Règle : Résultat s'affiche en trois boutons (Victoire, Défaite, Égalité).
- Règle : la décision s'affiche en boutons dès qu'un résultat est choisi.
- Acceptation : aucun menu déroulant dans la section « Saisie rapide ».
- Acceptation : chaque bouton mesure au moins 44 px de haut.
- Fichiers : `assets/views/combat-form.html`, `assets/app-screen-combat-form.ts`.

### COMBAT-SAISIE-2 — Ligne de score pré-créée depuis la décision (P1, S)

- Besoin : ne pas saisir deux fois la même information.
- Règle : choisir Ippon, Waza-ari ou Yuko crée une ligne de score avec cette valeur.
- Règle : seule la technique reste à renseigner.
- Acceptation : l'alerte « Ippon indiqué, mais aucun point Ippon détaillé » n'apparaît plus après une saisie nominale.
- Cas limite : une ligne de score déjà saisie n'est pas écrasée.

### COMBAT-SAISIE-3 — Enregistrer et saisir le suivant (P1, S)

- Besoin : enchaîner les combats d'une poule.
- Règle : un second bouton enregistre puis rouvre un formulaire vide sur la même compétition.
- Acceptation : un toast confirme l'enregistrement du combat précédent.

### COMBAT-ALERTE-1 — Alertes de qualité cliquables (P2, M)

- Besoin : corriger une saisie incomplète sans chercher le champ.
- Règle : toucher une alerte ouvre le formulaire du combat sur le champ concerné.
- Acceptation : le champ ciblé reçoit le focus.
- Dépendance : COMBAT-CARTE-1.

### COMBAT-CARTE-1 — Carte combat cliquable (P2, S)

- Règle : toucher la carte ouvre l'édition du combat.
- Règle : « Supprimer le combat » se trouve dans l'écran d'édition.
- Acceptation : la carte ne contient plus de bouton pleine largeur.

## 2. Modèle judo

### COMBAT-CONCEDE-1 — Points concédés (P1, L)

- Besoin : savoir sur quelle technique le judoka perd.
- Règle : chaque ligne de score porte un côté (marqué ou concédé).
- Règle : la fiche judoka et le tableau de bord affichent les techniques concédées les plus fréquentes.
- Acceptation : les combats existants restent lisibles, avec leurs scores côté « marqué ».
- Impact : schéma Supabase, `combat-score`, statistiques et outils MCP.

### COMBAT-SHIDO-1 — Shidos des deux combattants (P2, M)

- Règle : le formulaire propose 0 à 3 shidos pour le judoka et pour l'adversaire.
- Règle : un hansoku-make distingue le cumul de shidos de la faute directe.
- Acceptation : le tableau de bord affiche le nombre moyen de shidos par combat.

### COMBAT-TOUR-1 — Tour et golden score (P2, M)

- Règle : un combat porte un tour facultatif (Poule, Tableau, Repêchage, Place de 3e, Finale).
- Règle : un combat porte un indicateur golden score.
- Acceptation : la liste des combats suit l'ordre de saisie et affiche le tour.

### CLUB-CATEGORIE-1 — Plusieurs catégories d'âge par compétition club (P2, L)

- Besoin : un tournoi réunit souvent plusieurs catégories le même jour.
- Règle : une compétition club accepte une ou plusieurs catégories d'âge.
- Règle : la liste des judokas proposés couvre toutes les catégories choisies.
- Acceptation : le coach crée un seul événement pour Benjamins et Minimes.
- Impact : schéma, héritage des champs vers les compétitions individuelles.

### COMPETITION-CLASSEMENT-1 — Libellés du classement (P3, S)

- Règle : les options affichent le rang en toutes lettres (« 1er », « 2e », « 3e »).
- Acceptation : aucune option ne repose sur un emoji seul.

## 3. Navigation

### NAV-BARRE-1 — Barre de navigation basse fixe (P1, M)

- Besoin : savoir où l'on est et changer de section en un geste.
- Règle : la barre affiche Accueil, Compétitions, Judokas et Stats selon le rôle.
- Règle : l'entrée active est marquée sur tous les écrans.
- Acceptation : les onglets de mode ne changent plus de libellés d'un écran à l'autre.
- Cas limite : un utilisateur multi-rôle change de rôle depuis l'Accueil.

### NAV-ACCUEIL-1 — Accueil coach orienté état du jour (P2, M)

- Règle : l'accueil affiche la prochaine compétition, les bilans à rédiger et les combats à compléter.
- Règle : chaque compteur ouvre la liste correspondante.
- Acceptation : l'accueil ne contient plus de carte purement descriptive.
- Dépendance : NAV-BARRE-1.

### NAV-ACCUEIL-2 — Accueil parent et judoka (P2, M)

- Règle : l'accueil affiche le judoka actif, sa prochaine compétition et son dernier résultat.
- Règle : le changement de judoka se fait depuis l'en-tête.
- Acceptation : la carte « Judoka actif » disparaît.

### NAV-ACTIONS-1 — Retour en flèche et menu d'actions (P2, S)

- Règle : le retour est une flèche dans la barre haute.
- Règle : Modifier et Supprimer se trouvent dans un menu « ⋯ ».
- Acceptation : aucun bouton pleine largeur ne précède le contenu de la fiche compétition.

### NAV-SUPPRESSION-1 — Confirmation de suppression intégrée (P2, S)

- Règle : la confirmation s'affiche dans l'application, sans `window.confirm`.
- Règle : le message nomme la conséquence (nombre de combats supprimés).
- Fichier : `assets/app-runtime.ts:1216`.

## 4. Fiche compétition

### COMPETITION-FICHE-1 — Ordre des sections selon l'état (P1, M)

- Règle : compétition à venir : objectif en tête.
- Règle : compétition en cours : combats et ajout en tête.
- Règle : compétition terminée : classement et bilan en tête.
- Acceptation : « Ajouter un combat » est visible sans défilement le jour J.

### COMPETITION-FICHE-2 — Synthèse sans redondance (P3, S)

- Règle : la tuile « Statut » disparaît quand le classement figure déjà dans l'en-tête.
- Règle : « Combats avec points » devient « Combats détaillés ».

### COMPETITION-COACH-1 — Enregistrement automatique de l'objectif et du bilan (P3, S)

- Règle : le texte s'enregistre à la sortie du champ.
- Acceptation : un indicateur « Enregistré » remplace les deux boutons.
- Cas limite : hors ligne, le texte reste dans le champ et l'échec est signalé.

### COMPETITION-CLASSEMENT-2 — Classement saisi sur la fiche (P2, S)

- Règle : le classement se choisit sur la fiche, sans écran dédié.
- Règle : un classement déjà saisi reste modifiable au même endroit.
- À vérifier : `canFinalizeCompetition` passe à faux dès qu'un résultat existe (`assets/app-screen-projections.ts:234`).

## 5. Coach et admin

### DASHBOARD-SYNTHESE-1 — Tableau de bord sans doublon (P2, S)

- Règle : chaque indicateur n'apparaît qu'une fois.
- Règle : la phrase de synthèse ouvre l'écran.
- Constat : « Compétitions analysées », « Combats analysés » et le taux de victoire sont affichés deux fois.

### DASHBOARD-GRAPHIQUE-1 — Répartitions en barres (P3, M)

- Règle : modes de victoire, modes de défaite et gardes s'affichent en barres horizontales.
- Acceptation : chaque barre conserve son libellé et sa valeur chiffrée.

### DASHBOARD-DETAIL-1 — Chiffres cliquables (P2, M)

- Règle : toucher un indicateur ouvre la liste des combats concernés.
- Règle : « Fiabilité des données » ouvre la liste des combats à compléter.

### CLUB-DETAIL-1 — Participants d'abord (P2, M)

- Règle : le détail d'une compétition club s'ouvre sur les participants et leur avancement.
- Règle : l'édition des informations se trouve derrière « Modifier ».
- Acceptation : un participant affiche son nombre de combats saisis et son classement.

### ADMIN-PAGE-1 — Gestion des accès en onglets (P3, M)

- Règle : Utilisateurs, Invitations, Admins et Import sont quatre onglets.
- Acceptation : « Ajouter un admin » est accessible sans défilement dans son onglet.

### ADMIN-IMPORT-1 — Colonnes d'import lisibles (P3, S)

- Règle : l'aide décrit chaque colonne en français courant.
- Règle : le nom technique figure seulement dans le fichier d'exemple.

## 6. Finitions

### UI-FINITION-1 — Espace dans la pastille utilisateur (P3, S)

- Constat : « Alex MARTIN- ADMIN · PARENT ».

### UI-FINITION-2 — Typographie des dates (P3, S)

- Règle : les dates utilisent la police du texte courant.

### UI-FINITION-3 — Marges des listes (P3, S)

- Règle : le contenu des listes respecte la marge intérieure du panneau.

### UI-FINITION-4 — Accords au pluriel (P3, S)

- Règle : les libellés s'accordent selon le nombre (« 1 participant », « 2 participants »).

### UI-FINITION-5 — Largeur des badges (P3, S)

- Règle : un badge prend la largeur de son texte.

## Transverse — Refactoring du thème A « Blanc & Bleu »

Décision : la piste A est retenue. Maquette de référence : https://claude.ai/artifact/2qcgEaWewv5w1mdMVD2dDo (artboard « A · Blanc & Bleu »).

Principe : le refactoring change l'apparence, pas le comportement. Aucun gabarit `assets/views/*.html` ne change de structure dans ce volet. Les nouveaux composants (barre basse, boutons segmentés) sont livrés par leurs stories fonctionnelles et stylés ici.

Ordre : THEME-TOKENS-1, THEME-SURCOUCHE-1, THEME-COULEURS-1, THEME-TYPO-1, THEME-FORMES-1, THEME-COMPOSANTS-1, THEME-PWA-1, THEME-VALIDATION-1.

### Avancement au 11/11/2026

| Story | Statut | Écart ou reste à faire |
|---|---|---|
| THEME-TOKENS-1 | Fait | — |
| THEME-SURCOUCHE-1 | Fait | Les trois surcouches sont remplacées par une seule couche « Thème A » en fin de fichier. Les règles historiques de la couche `components` restent en place (structure). L'étape « rendu identique avant palette » a été sautée. |
| THEME-COULEURS-1 | Fait | 11 `rgba()` restent pour des voiles et ombres translucides. |
| THEME-TYPO-1 | Fait, avec écart | Police chargée par Google Fonts comme l'était Atkinson, pas auto-hébergée. Hors ligne sans cache, repli sur la police système. |
| THEME-FORMES-1 | Fait | — |
| THEME-COMPOSANTS-1 | Fait pour l'existant | Barre basse et boutons segmentés attendent NAV-BARRE-1 et COMBAT-SAISIE-1. |
| THEME-PWA-1 | Fait | Logo vérifié sur captures mobile et desktop. |
| THEME-VALIDATION-1 | Voir compte rendu | Écrans non capturés : admin, tableau de bord coach, fiche judoka, compétition club. |

Corrections faites en chemin :

- Les badges de résultat n'étaient jamais colorés : l'application génère `result-victoire`, `result-défaite`, `result-egalité`, la feuille ne stylait que `result-v/d/e`.
- La pastille utilisateur affichait « Alex MARTIN- ADMIN » : nom et rôle sont désormais deux éléments distincts (`assets/views/header.html`).
- Un cadre gris apparaissait autour de l'écran d'accueil : anneau de focus programmatique du panneau.
- Les tests `label-borders-playwright` et `combat-creation-visual` imposaient un filet gauche sur chaque libellé. Ils vérifient désormais son absence.

### Valeurs cibles

| Variable | Actuel (ligne 6) | Surcouche (ligne 3125) | Cible A |
|---|---|---|---|
| `--bg` | `#f7f6f3` | `#f3f5f7` | `#F3F5FA` |
| `--panel` | `#ffffff` | `#ffffff` | `#FFFFFF` |
| `--surface` | `#fbfbfa` | `#ffffff` | `#FFFFFF` |
| `--text` | `#242321` | `#18212b` | `#0E1A2B` |
| `--muted` | `#787774` | `#65717d` | `#4E5A6C` |
| `--line` | `#eae9e5` | `#e1e6eb` | `#E3E8F0` |
| `--primary` | `#242321` | `#18212b` | `#0E1A2B` |
| `--primary-hover` | `#403e3a` | `#2a3744` | `#1B2A40` |
| `--accent` | `#346538` | `#c62828` | `#1F4FD8` |
| `--accent-soft` | `#edf3ec` | `#fff0f0` | `#E8EEFC` |
| `--tatami` | `#f1f1ed` | `#f4f6f8` | `#F3F5FA` |
| `--tatami-line` | `#deddd8` | `#d7dde3` | `#E3E8F0` |
| `--radius` | `6px` | `10px` | `12px` |
| `--radius-card` | `8px` | `14px` | `16px` |
| `--button-focus-ring` | vert 22 % | rouge 20 % | `rgba(31, 79, 216, 0.25)` |

- Les variables `--danger*`, `--warning*`, `--gold*`, `--silver*` et `--bronze*` gardent leur valeur.
- `--success` et `--success-soft` restent verts pour les messages de confirmation.
- Le badge « Victoire » utilise `--accent`, pas `--success`.
- Hypothèse : les valeurs `--primary-hover` et `--accent-soft` ne figurent pas sur la maquette, elles sont dérivées.

### THEME-TOKENS-1 — Un seul bloc de variables (P2, S)

- Constat : `assets/app.tailwind.css` définit `:root` deux fois (lignes 6 et 3125).
- Constat : le second bloc écrase 15 variables du premier.
- Règle : un seul bloc `:root` porte les valeurs cibles A.
- Règle : trois variables s'ajoutent : `--radius-pill: 999px`, `--font-body`, `--font-heading`.
- Acceptation : `grep -c ":root" assets/app.tailwind.css` renvoie 1.
- Acceptation : `tailwind.config.js` continue de pointer sur les variables, sans valeur en dur.

### THEME-SURCOUCHE-1 — Fusionner la surcouche « Direction moderne » (P2, M)

- Constat : les lignes 3125 à 3428 redéfinissent `body`, `.app-shell`, `.topbar` et d'autres règles déjà écrites plus haut.
- Règle : chaque sélecteur n'est défini qu'à un endroit, hors variantes responsive.
- Règle : en cas de conflit, la valeur de la surcouche gagne, car c'est elle qui s'affiche aujourd'hui.
- Acceptation : le rendu avant et après fusion est identique sur les captures, avant application de la palette A.
- Risque : une règle de la surcouche dépend de l'ordre de déclaration. Vérifier écran par écran.

### THEME-COULEURS-1 — Supprimer les couleurs en dur (P2, M)

- Constat : 31 codes hexadécimaux et 19 `rgba()` figurent hors des blocs `:root`.
- Règle : toute couleur de composant passe par une variable.
- Règle : les ombres et voiles utilisent `color-mix()` ou une variable dédiée.
- Exception : le logo Google de l'écran de connexion garde ses couleurs de marque.
- Acceptation : aucun code hexadécimal hors `:root` dans `assets/app.tailwind.css`.

### THEME-TYPO-1 — Police Plus Jakarta Sans (P2, M)

- Constat : cinq piles de polices coexistent (Georgia ligne 418, Avenir Next lignes 1649, 1986, 2903 et 3144).
- Constat : `Index.html` charge Atkinson Hyperlegible, que `body` n'utilise plus.
- Règle : `--font-body` et `--font-heading` valent `'Plus Jakarta Sans', system-ui, sans-serif`.
- Règle : toutes les déclarations `font-family` utilisent ces deux variables.
- Règle : graisses utilisées : 500 (texte), 600 (libellés), 700 (boutons), 800 (titres).
- Règle : la police est servie par l'application, pas par Google Fonts, pour fonctionner hors ligne.
- Acceptation : hors ligne, les titres s'affichent en Plus Jakarta Sans après une première visite.
- Fichiers : `assets/app.tailwind.css`, `tailwind.config.js`, `Index.html`, `api/service-worker.js`.
- À arbitrer : Atkinson Hyperlegible avait été choisie pour sa lisibilité. Confirmer son abandon.

### THEME-FORMES-1 — Surfaces, rayons et ombres (P2, M)

- Règle : une carte est une surface blanche sans bordure, posée sur `--bg`.
- Règle : les cartes utilisent `--radius-card`, les champs et boutons `--radius`, les badges et puces `--radius-pill`.
- Règle : `--shadow` vaut `none`. Seule la barre d'action collante garde une séparation par `--line`.
- Règle : les lignes `.meta-row` ne portent plus de filet entre elles à l'intérieur d'une carte.
- Acceptation : aucune carte n'est imbriquée dans un panneau bordé (double cadre visible sur les captures actuelles).

### THEME-COMPOSANTS-1 — Composants aux couleurs A (P2, M)

- Bouton primaire : fond `--primary`, texte blanc, hauteur 52 px, graisse 700.
- Bouton secondaire : fond `--panel`, texte `--text`, sans bordure sur `--bg`.
- Bouton danger : texte `--danger` sur `--danger-soft`, jamais en pleine largeur à côté d'un bouton primaire.
- Badge résultat : « Victoire » plein `--accent` texte blanc, « Défaite » contour 1,5 px texte `--text`, « Égalité » fond `--accent-soft`.
- Puce méta (date, catégorie, poids, niveau) : fond `--panel`, `--radius-pill`, graisse 600.
- Tuile statistique : fond `--panel`. La tuile mise en avant (classement) prend le fond `--accent` et un texte blanc.
- Onglets et barre basse : entrée active en `--accent` graisse 800, entrées inactives en `--muted`.
- Boutons segmentés : rail `--bg`, segment actif `--accent` texte blanc.
- Alertes de qualité : inchangées (`--warning*`, `--danger*`).
- Dépendances : NAV-BARRE-1 (barre basse), COMBAT-SAISIE-1 (boutons segmentés).
- Acceptation : le résultat d'un combat se distingue sans la couleur (plein contre contour, plus le libellé).

### THEME-PWA-1 — Couleurs de l'application installée (P3, S)

- Règle : `theme-color` de `Index.html` passe de `#242321` à `#F3F5FA`.
- Règle : dans `api/manifest.js`, `theme_color` passe de `#111111` à `#F3F5FA` et `background_color` de `#fbfbfa` à `#F3F5FA`.
- Règle : `CACHE_NAME` de `api/service-worker.js` est incrémenté pour diffuser les nouveaux styles.
- À vérifier : l'icône de l'application et le logo `.brand-logo` restent lisibles sur le nouveau fond.

### THEME-VALIDATION-1 — Tests et captures (P2, M)

- Règle : `npm test` passe. Quatre tests lisent `assets/app.css` : `mobile-first-index`, `label-borders-playwright`, `combat-creation-visual`, `vercel-deployment`.
- Constat : `mobile-first-index.test.js:98` vérifie `--button-primary-bg: var(--primary)`. Cette ligne doit rester.
- Règle : chaque écran est capturé avant et après, en mobile (390 px) et en desktop.
- Règle : tout texte atteint un contraste de 4,5:1, y compris `--muted` sur `--bg`.
- Règle : les états focus, désactivé, erreur et chargement (squelettes) sont contrôlés sur chaque composant.
- Retour arrière : le refactoring est livré en un commit par story, réversible isolément.

### DOC-CAPTURES-1 — Régénérer les captures (P3, S)

- Constat : les captures 02, 03 et 04 sont identiques.
- Constat : la section « À venir » des captures n'existe plus dans `home.html`.
- Règle : les captures couvrent mobile et desktop pour chaque écran.

## Tour des parcours du 11/11/2026 — corrections livrées

Constats issus du tour coach (env dev réel), parent et judoka (banc local). Les douze axes ci-dessous sont implémentés.

| Story | Correction | Statut |
|---|---|---|
| NAV-ACCUEIL-1 (partiel) | Bloc « Jour J » en tête de l'accueil coach : compétitions club du jour et des 6 jours suivants, ouvertes en un geste | Fait |
| COMPETITION-FICHE-1 | Le jour J ou sans combat, la section Combats passe en premier ; un seul bouton d'ajout ; synthèse masquée sans combat ; tuile Statut masquée quand le classement est connu | Fait |
| COMPETITION-TITRE-1 | Sous-titre de la fiche : nom du judoka et date | Fait |
| NAV-SELECTEUR-1 | Sélecteur de judoka : lignes claires, catégorie au lieu de l'e-mail ou de l'ID, tri par catégorie puis nom, aucune présélection pour le coach, adresse mise à jour au choix | Fait |
| JUDOKA-CEINTURE-1 | Couleur de ceinture normalisée à la lecture, à l'import et à l'enregistrement (`core/domain/access/belt-color.ts`) | Fait ; les données existantes restent en minuscules en base tant qu'elles ne sont pas réenregistrées |
| COMBAT-CONCEDE-1 (étape 1) | Points affichés « Points marqués par le judoka » ; aide du formulaire précisant de ne pas saisir les points adverses | Fait ; le modèle des points concédés reste à faire |
| CLUB-LISTE-1 | Recherche par nom ou date ; aucun « bilan manquant » avant la date ; plus de défilement automatique à l'ouverture | Fait |
| CLUB-DETAIL-1 | Détail club en lecture : participants triés par classement avec bilan de combats ; édition, ajout, retrait et suppression derrière « Modifier » | Fait |
| COMPETITION-CLASSEMENT-1 | Médailles accompagnées du rang en texte (« 🥇 1er ») | Fait |
| COMPETITION-PREREMPLI-1 | Catégorie d'âge et poids préremplis depuis le profil du judoka | Fait |
| JUDOKA-FICHE-1 | Nom et saison affichés une seule fois ; modes à zéro masqués ; profil derrière « Modifier le profil » ; « 1re année » | Fait |
| DASHBOARD-SYNTHESE-1 (partiel) | Statistiques : aucun filtre appliqué d'office, filtres repliés avec résumé, onglet actif visible | Fait |
| NAV-ACCUEIL-2 (partiel) | Parent : pas d'onglet « Mon espace » pour un compte uniquement parent ; enfant présélectionné seulement s'il est seul | Fait |

