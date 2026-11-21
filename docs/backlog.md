# Backlog

## Parcours du coach (revue du 21/11/2026)

Objectif : le coach suit sans effort l'après-compétition (classements, bilans) et la saisie du jour J. L'application ne réclame plus de saisie combat par combat.

### Décisions

- Un coach non admin n'ajoute pas lui-même un judoka à son club et ne le réinscrit pas : cela reste le rôle de l'admin (import CSV, CLUB-006, AUTH-019a).
- Un participant sans combat saisi n'attend pas de bilan (COACH-3), sans donnée « pas de bilan » en plus.
- Les rappels « À compléter » sont retirés partout (SIMPL-1). « Profils à compléter » (proposé à la revue) est abandonné avec eux.

### Après la compétition

#### COACH-1 — Le compteur de bilans suit la saisie (P1, XS) — fait

- Constat : enregistrer un bilan ne mettait à jour que la compétition ouverte ; l'accueil et l'agenda gardaient « N bilans à écrire » jusqu'au rechargement.
- Règle : le bilan enregistré met aussi à jour la liste des compétitions de l'appli.
- Acceptation : après un bilan, le groupe « Bilans à écrire » de l'agenda baisse sans rechargement.

#### COACH-2 — Le bilan à écrire sur la ligne du participant (P1, S) — fait

- Constat : l'agenda menait à la fiche de la compétition club, qui ne disait pas quel participant attendait son bilan.
- Règle : après la date, la ligne d'un participant affiche « Bilan à écrire » quand il a combattu sans bilan (COMP-034).
- Règle : au retour de la compétition d'un participant, les lignes montrent combats, classement et bilan à jour, sans rechargement (y compris hors ligne pour les combats et le classement).
- Acceptation : écrire le bilan de Hugo puis revenir efface sa pastille.

#### COACH-3 — Pas de bilan attendu sans combat (P2, XS) — fait

- Constat : un participant absent ou forfait restait « bilan à écrire » pour toujours.
- Règle : un bilan n'est attendu que pour une participation passée avec au moins un combat saisi (COMP-035).
- Acceptation : un participant « Aucun combat saisi » ne compte pas dans les bilans à écrire.

#### COACH-6 — L'agenda annonce ce qu'il ne montre pas (P3, XS) — fait

- Constat : chaque groupe de l'agenda s'arrêtait à 5 lignes sans le dire.
- Règle : au-delà de 5, « + N autres dans « Compétitions » » ouvre l'onglet « Compétitions » (UIX-015).

### Le jour de la compétition

#### COACH-4 — Passer au judoka suivant (P2, M) — fait

- Constat : saisir les combats de plusieurs judokas imposait deux retours en arrière entre chaque judoka.
- Règle : la compétition d'un participant ouverte depuis la compétition club propose « Suivant : <judoka> », dans l'ordre de la liste, le dernier menant au premier (COMP-036).

### Cohérence des écrans

#### COACH-7 — Modifier une compétition club comme on la crée (P3, S) — fait

- Règle : en modification, le niveau se choisit en quatre boutons et « Tout sélectionner » coche les judokas à ajouter (COMP-037).
- Règle : quitter une modification non enregistrée (« Annuler » ou flèche retour) demande confirmation.
- Règle : le texte d'aide avant la date dit « ouvrir sa participation » ; le bandeau « saisie après coup » reste réservé à la modification (COMP-026).

#### SIMPL-1 — Plus de rappels « À compléter » (P2, S) — fait

- Retiré : « À compléter : … » et ses priorités sur les cartes de combat, sous les champs du formulaire de combat, « Niveau à compléter » et la tuile « Points détaillés » sur la fiche compétition, la tuile « Saisies à compléter » des statistiques et le champ `dataQualityIssues` (écran, API, MCP).
- Gardé : « Aucun combat saisi » sur la ligne d'un participant, en texte neutre.
- Règles : CBT-015, DASH-007, DASH-017.

#### DOC-1 — Spécification remise à jour (P3, XS) — fait

- Exemples et règles de création par la famille retirés (UIX-008, UIX-012, UIX-014), AC-021 aligné sur COMP-027, identifiants UIX en double renumérotés (UIX-039 à UIX-041).
