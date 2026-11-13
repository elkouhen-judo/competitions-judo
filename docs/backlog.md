# Backlog coach : création d'une compétition et statistiques

Issu de deux revues du 13/11/2026, faites par lecture du code : l'écran « Nouvelle compétition » du coach et l'onglet « Stats ». Les écrans n'ont pas été rejoués.

- Priorité : P1 (bloque ou trompe le coach), P2 (gêne récurrente), P3 (confort ou cohérence).
- Effort : S (≤ 1 jour), M (2-3 jours), L (≥ 1 semaine).
- Chaque story donne le constat, la règle visée et le critère d'acceptation.

## Vue d'ensemble

**Création d'une compétition.** Le serveur exige le niveau, la date et au moins un judoka. Le formulaire ne vérifie que le club, le nom et la catégorie d'âge. Les trois autres refus arrivent en bandeau après l'envoi. L'inscription d'un groupe se fait case par case, 10 judokas par page, sans vue de la sélection.

**Statistiques.** Les statistiques ne sont accessibles que par l'onglet « Stats », sur tous les combats de tous les clubs. Pour voir celles d'une compétition, le coach doit ouvrir les filtres, taper le nom de la compétition et la choisir. La fiche d'une compétition n'a aucun accès aux statistiques. Une erreur de chargement s'affiche comme « Aucun combat trouvé ».

## Avancement au 13/11/2026

Les 19 stories sont implémentées dans l'arbre de travail (tests : 356/356). Rien n'est commité ni déployé.

Écarts assumés par rapport au texte des stories :

| Story | Écart |
|---|---|
| CREA-9 | La catégorie d'âge (8 choix) reste une liste déroulante ; seul le niveau passe en boutons. |
| TDB-1 | L'action est un bouton « Statistiques de la compétition » en haut de la fiche. Les statistiques couvrent la saison de la compétition : retirer la pastille montre cette saison, tous judokas. |
| TDB-3 | Les 10 premiers judokas s'affichent, puis tous sur demande. |
| TDB-4 | Les 50 premiers combats de chaque critère sont renvoyés ; au-delà, l'écran l'indique. |
| TDB-5 | Les 3 techniques les plus subies, comme pour les techniques qui gagnent. |
| TDB-9 | Le débordement d'une bulle cachée n'est pas visible (la page rogne déjà en largeur) ; une capture pleine page peut l'élargir. |

## Ordre de traitement proposé

| Lot | Objectif | Stories |
|---|---|---|
| 1 | Créer une compétition sans refus du serveur | CREA-1, CREA-2 |
| 2 | Statistiques d'une compétition en un geste | TDB-1, TDB-2 |
| 3 | Inscrire un groupe sans erreur | CREA-3, CREA-4, CREA-5, CREA-6, CREA-7 |
| 4 | Statistiques utiles au travail du coach | TDB-3, TDB-4, TDB-5, TDB-6 |
| 5 | Finitions | CREA-8, CREA-9, CREA-10, TDB-7, TDB-8, TDB-9 |

## 1. Création d'une compétition

### CREA-1 — Niveau, date et judokas vérifiés avant l'envoi (P1, S)

- Constat : « Niveau » s'affiche sans astérisque. Le serveur répond « Niveau de compétition obligatoire. »
- Constat : rien n'indique qu'il faut au moins un judoka. Le serveur répond « Au moins un judoka doit être sélectionné. »
- Constat : une date vidée part au serveur, qui répond « Nom et date obligatoires. »
- Règle : niveau, date et judokas inscrits portent la marque des champs obligatoires.
- Règle : le formulaire vérifie ces trois champs avant l'envoi, comme le club, le nom et la catégorie.
- Règle : le message s'affiche sous le champ concerné, qui reçoit le focus.
- Acceptation : enregistrer sans niveau, sans date ou sans judoka n'appelle pas le serveur.
- Acceptation : chaque cas affiche son message sous le champ : « Choisissez le niveau. », « Indiquez la date. », « Cochez au moins un judoka. »
- Fichiers : `assets/views/club-competition-form.html`, `assets/app-screen-club-competition.ts`, `tests/mobile-first-index.test.js`.

### CREA-2 — Formulaire bloqué pour un coach sans club (P1, S)

- Constat : le bandeau « Vous n'êtes rattaché à aucun club » s'affiche, mais le formulaire reste remplissable. L'enregistrement échoue côté serveur.
- Règle : sans club, les champs et « Enregistrer » ne sont pas proposés. Seul le bandeau et le retour restent.
- Acceptation : un coach sans club ne peut déclencher aucun appel `saveClubCompetition`.
- Fichiers : `assets/views/club-competition-form.html`, `assets/app-screen-club-competition.ts`.

### CREA-3 — Confirmation avant de quitter un formulaire modifié (P2, S)

- Constat : la flèche retour et « Annuler » ferment le formulaire sans question, même avec des judokas cochés. Le formulaire de combat demande confirmation (CBT-013).
- Règle : quitter un formulaire modifié demande confirmation.
- Règle : un formulaire non modifié se ferme sans question.
- Acceptation : cocher un judoka puis toucher la flèche retour affiche « Quitter sans enregistrer ? ».
- Fichiers : `assets/app-screen-club-competition.ts`.

### CREA-4 — Tout sélectionner (P2, S)

- Constat : inscrire toute une catégorie demande de cocher chaque judoka, page par page.
- Règle : une action « Tout sélectionner » coche tous les judokas de la liste filtrée (club, catégorie, recherche), toutes pages confondues.
- Règle : quand tous sont cochés, l'action devient « Tout désélectionner ».
- Acceptation : avec 23 judokas dans la catégorie, un toucher en inscrit 23.
- Acceptation : avec une recherche active, seuls les judokas trouvés sont cochés.
- Fichiers : `assets/views/club-competition-form.html`, `assets/app-screen-club-competition.ts`.

### CREA-5 — Sélection visible avant l'enregistrement (P2, S)

- Constat : les judokas cochés sur une autre page sont invisibles. Seul leur nombre s'affiche.
- Règle : les judokas inscrits s'affichent en pastilles au-dessus de la liste, chacune avec une action « Retirer ».
- Acceptation : un judoka coché en page 2 reste visible en page 1, dans les pastilles.
- Acceptation : retirer une pastille décoche la case correspondante.
- Fichiers : `assets/views/club-competition-form.html`, `assets/app-screen-club-competition.ts`, `assets/app.tailwind.css`.

### CREA-6 — Recherche limitée aux correspondances (P3, S)

- Constat : les judokas déjà cochés restent dans les résultats de recherche, même s'ils ne correspondent pas au texte tapé.
- Règle : la recherche ne liste que les judokas dont le nom correspond. La sélection reste visible dans les pastilles de CREA-5.
- Acceptation : chercher « du » ne liste aucun judoka coché dont le nom ne contient pas « du ».
- Dépend de : CREA-5.
- Fichiers : `assets/app-screen-club-competition.ts`.

### CREA-7 — Avertir quand un changement retire des judokas (P2, S)

- Constat : changer de catégorie d'âge ou de club décoche des judokas sans message. Seul le compteur change.
- Règle : un message indique combien de judokas ont été retirés et pourquoi.
- Acceptation : passer de « Minime » à « Cadet » avec 4 judokas cochés affiche « 4 judokas retirés : ils ne sont pas dans cette catégorie. »
- Fichiers : `assets/app-screen-club-competition.ts`, `assets/views/club-competition-form.html`.

### CREA-8 — Judokas sans catégorie d'âge signalés (P3, S)

- Constat : un judoka sans catégorie d'âge n'apparaît dans aucune catégorie. Le message dit seulement « Aucun judoka de ce club dans cette catégorie. »
- Règle : sous la liste, une ligne indique le nombre de judokas du club sans catégorie d'âge.
- Acceptation : avec 2 judokas sans catégorie, la ligne « 2 judokas du club n'ont pas de catégorie d'âge » s'affiche.
- Fichiers : `assets/views/club-competition-form.html`, `assets/app-screen-club-competition.ts`.

### CREA-9 — Boutons pour le niveau, une seule façon d'annuler (P3, S)

- Constat : le niveau (4 choix) est une liste déroulante. Le formulaire de combat utilise des boutons.
- Constat : la flèche retour et « Annuler » font la même chose. Le formulaire de combat n'affiche pas « Annuler » en création.
- Règle : le niveau s'affiche en 4 boutons, parcourables au clavier.
- Règle : la barre d'actions ne contient que « Enregistrer ».
- Acceptation : le formulaire ne contient plus de liste déroulante pour le niveau.
- Fichiers : `assets/views/club-competition-form.html`, `assets/app-screen-club-competition.ts`, `tests/mobile-first-index.test.js`.

### CREA-10 — Ouvrir la compétition créée (P3, S)

- Constat : après l'enregistrement, le coach revient à l'accueil. Il doit retrouver la compétition pour y saisir les combats.
- Règle : après une création, la fiche de la compétition créée s'ouvre.
- Acceptation : « Enregistrer » affiche la fiche avec ses participants, sans appel RPC de plus que l'enregistrement et l'ouverture.
- Fichiers : `assets/app-screen-club-competition.ts`.

## 2. Statistiques du coach

### TDB-1 — Statistiques accessibles depuis la compétition (P1, M)

- Constat : la fiche d'une compétition club n'a aucun accès aux statistiques. Le coach doit passer par l'onglet « Stats », ouvrir les filtres, taper le nom et choisir la compétition.
- Constat : la règle COMP-015 prévoit une vue agrégeant tous les judokas d'une même compétition.
- Règle : la fiche d'une compétition club propose une action « Statistiques ».
- Règle : l'action ouvre l'onglet « Stats » filtré sur cette seule compétition, affichée en pastille.
- Règle : le retour depuis ces statistiques revient à la fiche de la compétition.
- Règle : l'action n'est pas proposée tant qu'aucun combat n'est saisi.
- Acceptation : depuis la fiche, un toucher affiche les statistiques de la compétition, en un seul appel `getCoachDashboard`.
- Acceptation : retirer la pastille revient aux statistiques de tous les clubs.
- Fichiers : `assets/views/club-competition-detail.html`, `assets/app-screen-club-competition.ts`, `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`, `assets/types.ts`, `docs/spec.md`.

### TDB-2 — Erreur de chargement distincte de « aucun combat » (P1, S)

- Constat : si l'appel échoue (hors connexion, erreur serveur), l'écran affiche « Aucun combat trouvé pour ces filtres. » Les statistiques ne sont pas lisibles hors connexion.
- Règle : un échec affiche « Statistiques indisponibles » et une action « Réessayer ».
- Règle : hors connexion, le message précise que les statistiques demandent une connexion.
- Règle : les dernières statistiques affichées restent visibles tant qu'un nouveau chargement n'a pas réussi.
- Acceptation : hors connexion, l'écran n'affiche jamais « Aucun combat trouvé ».
- Fichiers : `assets/app-screen-coach-dashboard.ts`, `assets/views/coach-dashboard.html`.

### TDB-3 — Résultats par judoka (P2, M)

- Constat : toutes les statistiques sont agrégées. Le coach ne voit pas quel judoka porte les victoires ou les défaites.
- Règle : une section « Par judoka » liste chaque judoka du périmètre : combats, victoires, défaites, podiums.
- Règle : la liste est triée par nombre de combats décroissant.
- Règle : toucher un judoka ouvre sa fiche.
- Acceptation : sur une compétition de 6 judokas, la section liste 6 lignes dont la somme des combats égale « Combats ».
- Acceptation : le calcul n'ajoute aucune requête Supabase.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/services/coach-dashboard.service.ts`, `core/types.ts`, `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`, `docs/metrics.md`, `tests/application-services.test.js`.

### TDB-4 — Saisies à compléter : accès aux combats concernés (P2, M)

- Constat : « Saisies à compléter » donne un décompte par critère. Le coach ne peut pas atteindre les combats concernés.
- Règle : chaque critère ouvre la liste des combats concernés (judoka, compétition, adversaire).
- Règle : toucher un combat ouvre sa compétition.
- Acceptation : « Garde de l'adversaire · 5/40 » ouvre une liste de 5 combats.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/services/coach-dashboard.service.ts`, `core/types.ts`, `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`, `tests/application-services.test.js`.

### TDB-5 — Techniques subies (P2, M)

- Constat : « Techniques qui gagnent » liste les techniques marquées. Les techniques subies sont saisies (points de l'adversaire) mais ne sont pas exploitées.
- Règle : une section « Techniques subies » liste les techniques des points de l'adversaire, de la plus fréquente à la moins fréquente.
- Acceptation : un point adverse saisi « Uchi-mata » apparaît dans la section.
- Acceptation : la section n'apparaît pas sans point adverse avec technique.
- Fichiers : `core/domain/coach-dashboard-statistics.ts`, `core/types.ts`, `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`, `docs/metrics.md`, `tests/application-services.test.js`.

### TDB-6 — Saison en cours par défaut, filtres conservés (P2, S)

- Constat : l'onglet s'ouvre sur tous les combats de toutes les saisons. Chaque ouverture remet les filtres à zéro.
- Règle : à la première ouverture, la période est la saison en cours (du 1er septembre au 31 août).
- Règle : les filtres choisis sont conservés tant que l'application reste ouverte.
- Règle : « Réinitialiser » revient à la saison en cours.
- Acceptation : quitter l'onglet puis y revenir garde la catégorie d'âge choisie.
- Validé le 13/11/2026 : la période par défaut est la saison en cours.
- Acceptation : à la première ouverture, le résumé des filtres affiche la saison en cours et les statistiques ne comptent que ses combats.
- Fichiers : `assets/app-screen-coach-dashboard.ts`, `docs/spec.md`.

### TDB-7 — Libellés exacts (P3, S)

- Constat : la section « Ippon » dit « Part des combats gagnés ». Le pourcentage est calculé sur tous les combats.
- Constat : le résumé des filtres affiche les dates au format `2026-09-01`.
- Constat : la ligne « Effectif » est placée sous « Selon la garde de l'adversaire », sans rapport avec ce titre.
- Constat : dès qu'une saisie est incomplète, la phrase de synthèse ne parle que de saisie, jamais de performance.
- Règle : la légende de « Ippon » dit « Part de tous les combats ».
- Règle : les dates du résumé sont au format de l'application (`1 sept. 2026`).
- Règle : l'effectif s'affiche dans le bloc de synthèse.
- Règle : la phrase de synthèse parle de performance. Les saisies à compléter restent dans leur tuile.
- Acceptation : aucun libellé ne contredit `docs/metrics.md`.
- Fichiers : `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`.

### TDB-8 — Erreur de dates sous le champ (P3, S)

- Constat : une date de début postérieure à la date de fin affiche un bandeau. Les anciennes statistiques restent affichées sans indication.
- Règle : le message s'affiche sous les dates.
- Acceptation : corriger la date fait disparaître le message et relance le calcul.
- Fichiers : `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`.

### TDB-9 — Info-bulle sur chaque métrique, spécification alignée (P3, M)

- Constat : DASH-008 exige une info-bulle sur chaque métrique. Seules les saisies à compléter en ont une.
- Constat : DASH-002 annonce la catégorie « Minime » par défaut. L'écran n'applique aucun filtre.
- Constat : DASH-006 et DASH-007 décrivent un ordre et des titres de sections qui ne sont plus ceux de l'écran.
- Validé le 13/11/2026 : l'exigence d'une info-bulle sur chaque métrique est conservée.
- Règle : chaque tuile de synthèse et chaque section de statistiques porte une info-bulle, accessible au survol, au focus et au toucher.
- Règle : l'info-bulle dit en une phrase ce que la métrique mesure et sur quels combats elle est calculée, selon `docs/metrics.md`.
- Règle : `docs/spec.md` décrit l'écran tel qu'il est après ce backlog (filtres par défaut de TDB-6, ordre et titres des sections).
- Acceptation : aucune métrique de l'onglet « Stats » n'est sans info-bulle, sections de TDB-3 et TDB-5 comprises.
- Acceptation : sur mobile, une info-bulle ne déborde pas de l'écran.
- Fichiers : `assets/views/coach-dashboard.html`, `assets/app-screen-coach-dashboard.ts`, `assets/app.tailwind.css`, `docs/spec.md`, `docs/metrics.md`.
