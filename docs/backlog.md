# Backlog ergonomie

Issu de la revue du 11/11/2026. L'application a été parcourue en local sur données fictives, en mobile (390 × 844) pour les profils judoka, parent et coach + admin, et en bureau (1280 × 860) pour le coach.

- Priorité : P1 (gêne le parcours principal), P2 (gêne récurrente), P3 (confort).
- Effort : S (≤ 1 jour), M (2-3 jours), L (≥ 1 semaine).
- Chaque story donne le constat observé, la règle visée et le critère d'acceptation.

## Vue d'ensemble

Le parcours principal est « ouvrir la compétition du jour → saisir un combat → saisir le classement ». Il fonctionne, mais il est alourdi par quatre défauts transverses :

1. **Trop de boutons pleine largeur.** Retour, Modifier et Supprimer occupent le haut de chaque fiche ; chaque carte de combat porte deux boutons.
2. **Saisie par menus déroulants.** Le formulaire de combat demande 4 à 6 listes déroulantes, au bord du tatami.
3. **Barre d'actions collante trop haute.** Deux boutons empilés masquent environ 130 px de contenu, dont des champs de formulaire.
4. **Accueils explicatifs.** Les cartes de l'accueil décrivent les fonctions au lieu de montrer l'état du jour ; la liste utile passe sous la ligne de flottaison.

## Avancement au 11/11/2026

Les 34 stories sont implémentées (tests : 279/279, parcours visuel judoka, parent et coach sans erreur). Écarts assumés par rapport au texte des stories :

| Story | Écart |
|---|---|
| NAV-2 | Onglets coach : « Accueil », « Compétitions », « Judokas », « Stats ». « Mon espace » rejoint le menu du compte avec « Ma famille » et « Gestion des accès », pour garder l'accès aux judokas en un geste. |
| NAV-3 | Squelette de l'accueil et affichage immédiat du cache. Le temps de réponse du serveur lui-même n'a pas été mesuré ni optimisé. |
| FICHE-2 | Les places proposées sont 1er, 2e, 3e, 5e, 7e et Non classé ; une valeur historique (4e, 6e, 8e) reste affichée. |
| STATS-1 | La tuile « Saisies à compléter » compte les combats du critère le plus fréquent (les critères se recoupent). |
| UI-5 | Le débordement n'a pas été reproduit ; `overflow-x: clip` sur la page l'empêche sans casser les barres collantes. |
| UI-7 | Le script de parcours reste hors dépôt (données fictives) ; les tests Playwright du dépôt couvrent la saisie de combat, le parcours parent et la finalisation hors ligne. |

Reste à faire hors backlog : vérifier sur un vrai téléphone la barre collante du formulaire de combat et le menu « ⋯ » (fermeture au toucher extérieur).

## Ordre de traitement proposé

| Lot | Objectif | Stories |
|---|---|---|
| 1 | Saisir un combat vite et sans erreur | COMBAT-1 à COMBAT-5, BARRE-1 |
| 2 | Alléger les fiches et la navigation | NAV-1 à NAV-4, FICHE-1 à FICHE-5 |
| 3 | Accueils orientés action | ACCUEIL-1 à ACCUEIL-4, LISTE-1, LISTE-2 |
| 4 | Coach et admin | CLUB-1 à CLUB-3, STATS-1, STATS-2, ADMIN-1, ADMIN-2 |
| 5 | Finitions | UI-1 à UI-7 |

## 1. Saisie d'un combat

### COMBAT-1 — Boutons au lieu des menus déroulants (P1, M)

- Constat : Étape, Résultat, « Comment le combat s'est terminé » et « Adversaire droitier ou gaucher » sont quatre listes déroulantes. Chaque choix coûte deux gestes.
- Règle : Résultat s'affiche en trois boutons (Victoire, Défaite, Égalité).
- Règle : la décision et la garde adverse s'affichent en boutons.
- Règle : l'étape s'affiche en pastilles défilantes (Poule, 1/16, 1/8, 1/4, 1/2, Repêchage, Place de 3, Finale).
- Acceptation : la partie « Saisie rapide » ne contient aucun menu déroulant.
- Acceptation : chaque bouton mesure au moins 44 px de haut.
- Fichiers : `assets/views/combat-form.html`, `assets/app-screen-combat-form.ts`.

### COMBAT-2 — Champs obligatoires et erreurs sur le champ (P1, S)

- Constat : rien n'indique que Résultat est obligatoire. Un formulaire vide part au serveur et l'erreur s'affiche en bandeau flottant, loin du champ.
- Règle : le formulaire vérifie Résultat avant l'envoi.
- Règle : le message d'erreur s'affiche sous le champ concerné, qui reçoit le focus.
- Règle : même traitement pour le nom de la compétition et pour le club, le nom et la catégorie d'une compétition club.
- Acceptation : enregistrer un formulaire vide n'appelle pas le serveur.
- Fichiers : `assets/app-screen-combat-form.ts`, `assets/app-screen-competition-form.ts`, `assets/app-screen-club-competition.ts`.

### COMBAT-3 — Enregistrer et saisir le suivant (P1, S)

- Constat : après un enregistrement, il faut revenir à la fiche puis rouvrir « Ajouter un combat ».
- Règle : un second bouton « Enregistrer et saisir le suivant » rouvre un formulaire vide.
- Règle : l'étape suivante est proposée (Poule reste Poule, 1/4 propose 1/2).
- Acceptation : trois combats se saisissent sans repasser par la fiche.

### COMBAT-4 — Carte de combat cliquable, sans boutons (P1, S)

- Constat : chaque carte porte « Modifier le combat » et « Supprimer le combat » en pleine largeur. Quatre combats font 2 900 px de haut sur mobile.
- Règle : toucher la carte ouvre la modification.
- Règle : la suppression se fait depuis le formulaire de modification.
- Règle : la ligne « Judoka » et la mention « Aucun déroulé renseigné » disparaissent de la carte.
- Acceptation : une carte de combat sans note tient en 120 px de haut au plus.
- Fichiers : `assets/views/competition.html`, `assets/views/combat-form.html`.

### COMBAT-5 — Alertes de saisie en langage courant (P2, S)

- Constat : les alertes affichent « MOYENNE Points marqués non renseignés ». Le niveau de priorité ne parle pas à un parent.
- Règle : l'alerte s'affiche « À compléter : points marqués ».
- Règle : toucher l'alerte ouvre le formulaire sur le champ concerné.
- Acceptation : aucun libellé « Haute » ou « Moyenne » n'est visible sur la fiche.

### BARRE-1 — Barre d'actions sur une seule ligne (P1, S)

- Constat : la barre collante empile deux boutons (Enregistrer et Annuler, ou Finaliser et Ajouter un combat). Elle masque le champ Niveau du formulaire compétition et la liste des participants du formulaire club.
- Règle : la barre collante porte une seule ligne : action principale large, action secondaire compacte.
- Règle : le contenu garde une marge basse égale à la hauteur de la barre.
- Acceptation : aucun champ n'est masqué par la barre en 390 × 844.
- Fichiers : `assets/app.css`, vues de formulaire.

## 2. Navigation et fiches

### NAV-1 — Retour en flèche, actions dans un menu (P1, M)

- Constat : Retour, Modifier et Supprimer sont trois boutons pleine largeur en haut de la fiche compétition. Ils occupent 170 px et exposent la suppression au premier plan.
- Règle : le retour devient une flèche à gauche du titre, sur tous les écrans.
- Règle : Modifier et Supprimer passent dans un menu « ⋯ » à droite du titre.
- Acceptation : le premier contenu de la fiche commence à moins de 160 px du haut en mobile.
- Fichiers : toutes les vues de `assets/views/`.

### NAV-2 — Onglets coach identiques partout (P1, S)

- Constat : l'accueil coach affiche « Accueil coach, Mon espace, Gestion des accès ». L'écran des statistiques affiche « Accueil coach, Mon espace, Statistiques ». Le troisième onglet est rogné à 390 px.
- Règle : les mêmes onglets s'affichent sur tous les écrans coach : Accueil, Compétitions, Statistiques, Mon espace.
- Règle : « Gestion des accès » passe dans le menu du compte.
- Acceptation : aucun onglet n'est rogné à 390 px.
- Fichiers : `assets/app-screen-home.ts`, `assets/views/home.html`, `assets/views/coach-dashboard.html`.

### NAV-3 — Chargement visible (P1, S)

- Constat : à l'ouverture sur l'environnement dev, la page reste vide environ cinq secondes, avec le seul en-tête.
- Règle : un squelette de l'accueil s'affiche pendant le chargement.
- Règle : les données en cache s'affichent tout de suite, puis se mettent à jour.
- Acceptation : aucun écran vide de plus de 300 ms.
- Fichiers : `assets/app-runtime.ts`.

### NAV-4 — En-tête compact (P2, S)

- Constat : le rôle « COACH · ADMIN · JUDOKA » s'affiche sur trois lignes et repousse le sous-titre. Le bouton de déconnexion est exposé, sans confirmation.
- Règle : l'en-tête affiche le nom et un seul rôle, sur une ligne.
- Règle : la déconnexion et « Gestion des accès » passent dans un menu ouvert par le nom.
- Acceptation : l'en-tête mesure 64 px de haut au plus en mobile.
- Fichiers : `assets/views/header.html`, `assets/app-runtime.ts`.

### FICHE-1 — Compétition à venir sans actions de résultat (P1, S)

- Constat : une compétition du 05/12 propose « Finaliser » et « Ajouter un combat », avec l'état vide « Aucun combat ».
- Règle : avant la date, la fiche affiche le délai (« dans 24 jours »), les informations et l'objectif du coach.
- Règle : les actions de combat et de classement apparaissent le jour J.
- Acceptation : aucune action de saisie de résultat sur une compétition future.
- Fichiers : `assets/views/competition.html`, `assets/app-screen-projections.ts`.

### FICHE-2 — Classement saisi sur la fiche (P1, S)

- Constat : « Finaliser » ouvre un écran à part qui ne contient qu'une liste déroulante. Le mot ne dit pas qu'il s'agit du classement.
- Règle : le bouton s'appelle « Saisir le classement ».
- Règle : le classement se choisit sur la fiche, en boutons (1er, 2e, 3e, 5e, 7e, Non classé).
- Acceptation : l'écran `competitionFinalizationView` est supprimé.
- Fichiers : `assets/views/competition.html`, `assets/views/competition-finalization.html`.

### FICHE-3 — Synthèse sans redondance (P2, S)

- Constat : la date figure dans le sous-titre et dans le bloc d'informations. Le bilan affiche « 3V · 1D · 0N ». La catégorie affiche « Cadet · -60kg ».
- Règle : le bloc d'informations tient en une ligne de pastilles (catégorie, poids, niveau, classement).
- Règle : les compteurs à zéro sont masqués (« 3V · 1D »).
- Règle : le poids s'écrit « -60 kg ».
- Acceptation : la synthèse d'une compétition terminée tient en 200 px de haut en mobile.

### FICHE-4 — Objectif et bilan du coach enregistrés automatiquement (P2, S)

- Constat : le coach a deux boutons, « Enregistrer l'objectif » et « Enregistrer le bilan », en plus de celui de la barre.
- Règle : chaque champ s'enregistre à la sortie du champ, avec la mention « Enregistré ».
- Acceptation : la section « Suivi coach » ne contient aucun bouton.

### FICHE-5 — Fiche de progression lisible (P2, M)

- Constat : la page dépasse la largeur de l'écran en mobile (439 px pour 390). Les répartitions s'affichent en tuiles « 4/6 (67 %) ». « Précédente » occupe une ligne entière. « Modifier le profil » est en bas de page.
- Règle : aucun défilement horizontal.
- Règle : les modes de victoire et de défaite s'affichent en barres horizontales.
- Règle : la saison se change par deux flèches autour de son libellé.
- Règle : « Modifier le profil » passe dans le menu « ⋯ » du titre.
- Acceptation : `document.documentElement.scrollWidth` égale la largeur de la fenêtre à 390 px.
- Fichiers : `assets/views/judoka.html`, `assets/app-screen-judoka.ts`, `assets/app.css`.

## 3. Accueils et listes

### ACCUEIL-1 — Accueil judoka : la liste d'abord (P1, S)

- Constat : deux cartes explicatives (« Ajouter une compétition », « Ma progression ») occupent le premier écran. La liste des compétitions commence à 550 px.
- Règle : l'accueil s'ouvre sur la compétition du jour ou la prochaine, puis la liste.
- Règle : « Nouvelle compétition » et « Ma fiche » deviennent deux boutons sur une ligne.
- Acceptation : la première compétition est visible sans défilement en 390 × 844.
- Fichiers : `assets/views/home.html`, `assets/app-screen-home.ts`.

### ACCUEIL-2 — Accueil parent : choisir l'enfant en un geste (P1, M)

- Constat : le parent passe par « Choisir un judoka », puis une liste déroulante. « Voir la fiche » est grisé tant qu'aucun enfant n'est choisi. Le choix est perdu au rechargement.
- Règle : l'accueil affiche une pastille par enfant ; toucher une pastille affiche ses compétitions.
- Règle : le dernier enfant choisi est mémorisé sur l'appareil.
- Règle : les onglets « Accueil parent » et « Compétitions » disparaissent.
- Acceptation : un parent de deux enfants ouvre la compétition du jour en deux gestes.
- Acceptation : aucun bouton grisé sur l'accueil.

### ACCUEIL-3 — Accueil coach : l'état du jour (P2, M)

- Constat : sous le bloc « Aujourd'hui », trois cartes décrivent les fonctions. Le filtre Club occupe une carte entière en haut de chaque écran.
- Règle : l'accueil liste ce qui attend le coach : compétition du jour, classements à saisir, bilans à écrire.
- Règle : le filtre Club devient une pastille dans la ligne d'onglets.
- Acceptation : chaque ligne de l'accueil ouvre l'écran où l'action se fait.

### ACCUEIL-4 — Un seul bouton d'ajout sur l'état vide (P3, S)

- Constat : « Mon espace » sans compétition affiche « Nouvelle compétition » et « Ajouter la première compétition ».
- Règle : l'état vide porte le seul bouton d'ajout.

### LISTE-1 — Cartes de compétition utiles (P2, S)

- Constat : chaque carte affiche une ligne « Date » et un lien « Ouvrir les combats → ». Une compétition passée n'affiche ni classement ni bilan. Une compétition passée sans classement n'affiche aucun rappel.
- Règle : la carte affiche le nom, la date en clair (« sam. 5 déc. »), le classement et le bilan (« 🥉 3e · 3V 1D »).
- Règle : une compétition passée sans classement affiche « Classement à saisir ».
- Règle : toute la carte est cliquable ; le lien texte disparaît.
- Acceptation : cinq compétitions tiennent sur un écran de 844 px.

### LISTE-2 — Sections « À venir » et « Passées » (P2, S)

- Constat : la liste mélange les compétitions à venir et passées ; l'ordre est expliqué par une phrase.
- Règle : deux intertitres, « À venir » et « Passées », remplacent la phrase.

## 4. Coach et admin

### CLUB-1 — Classements saisis depuis le suivi club (P1, M)

- Constat : pour classer dix judokas, le coach ouvre dix fiches.
- Règle : le suivi club propose le classement de chaque participant, en boutons sur sa ligne.
- Acceptation : le coach classe tous les participants sans quitter l'écran.
- Fichiers : `assets/views/club-competition-detail.html`, `assets/app-screen-club-competition.ts`.

### CLUB-2 — Formulaire de compétition club (P2, S)

- Constat : le club n'est pas présélectionné, même quand un club est filtré sur l'accueil. La liste des judokas est masquée par la barre d'actions. En modification, « Aucun résultat. » s'affiche avant toute recherche.
- Règle : le club filtré sur l'accueil est présélectionné.
- Règle : la liste des judokas s'affiche dès qu'une catégorie est choisie, au-dessus de la barre.
- Règle : le message d'absence de résultat n'apparaît qu'après une recherche.

### CLUB-3 — Compteurs de la liste club (P3, S)

- Constat : « 3 participant(s) · 3 classement(s) · 3 podium(s) ».
- Règle : les compteurs s'accordent (« 1 participant », « 3 participants »).
- Règle : la recherche devient un champ simple, sans carte.

### STATS-1 — Statistiques sans doublon (P2, M)

- Constat : la page fait 3 100 px en mobile et douze sections. « Compétitions analysées » et « Combats analysés » figurent deux fois ; le taux de victoire trois fois. « Nat. 1×🥈 » est illisible.
- Règle : chaque chiffre figure une seule fois.
- Règle : la synthèse garde quatre chiffres : combats, taux de victoire, podiums, saisies à compléter.
- Règle : les podiums s'affichent en toutes lettres (« National : 1 deuxième place »).
- Acceptation : la page fait moins de 2 000 px en mobile.
- Fichiers : `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`.

### STATS-2 — Répartitions en barres (P3, M)

- Constat : les modes de victoire, de défaite et les gardes s'affichent en tuiles de texte.
- Règle : chaque répartition s'affiche en barres horizontales avec le nombre et le pourcentage.

### ADMIN-1 — Gestion des accès en sections (P2, M)

- Constat : import, clubs, utilisateurs, invitations et admins se suivent sur une page de 4 500 px en mobile.
- Règle : la page s'organise en quatre onglets : Utilisateurs, Clubs, Invitations, Import.
- Règle : la suppression d'un utilisateur passe dans le menu « ⋯ » de sa ligne.
- Acceptation : chaque onglet tient en moins de deux écrans pour dix utilisateurs.
- Fichiers : `assets/views/admins.html`, `assets/app-screen-admins.ts`.

### ADMIN-2 — Import guidé (P3, S)

- Constat : cinq paragraphes de consignes précèdent le bouton d'import.
- Règle : les consignes se replient derrière « Format du fichier ».
- Règle : le fichier d'exemple est un bouton, à côté du choix du fichier.

## 5. Finitions

### UI-1 — Icônes d'aide « i » (P2, S)

- Constat : presque chaque titre et chaque tuile porte une icône « i » de 14 px, difficile à toucher.
- Règle : l'aide reste sur les indicateurs calculés ; elle disparaît des titres évidents.
- Règle : la zone tactile de l'icône mesure 44 px.

### UI-2 — Dates en clair (P3, S)

- Règle : les dates s'affichent « sam. 5 déc. 2026 » ; les compétitions proches ajoutent « dans 3 jours ».

### UI-3 — Casse des noms de personnes (P3, S)

- Constat : le même judoka s'affiche « Hugo DURAND » dans le titre et « Hugo Durand » dans la carte de combat.
- Règle : un seul format, « Hugo Durand », dans toute l'application.

### UI-4 — Libellés d'ajout cohérents (P3, S)

- Constat : la même action s'appelle « Ajouter une compétition », « Nouvelle compétition » et « Ajouter la première compétition ».
- Règle : « Nouvelle compétition » partout.

### UI-5 — Défilement horizontal des statistiques (P2, S)

- Constat : la capture de l'écran des statistiques mesure 456 px de large pour une fenêtre de 390 px.
- Règle : vérifier puis supprimer tout débordement horizontal.

### UI-6 — Réponse vide du serveur (P3, S)

- Constat : une réponse vide à un enregistrement affiche « Cannot read properties of null (reading 'message') ».
- Règle : le message devient « L'enregistrement a échoué. Réessayez. »

### UI-7 — Captures de référence (P3, S)

- Règle : le script de parcours (judoka, parent, coach, mobile et bureau) est ajouté à `tests/e2e/` et régénère les captures avant chaque lot.
