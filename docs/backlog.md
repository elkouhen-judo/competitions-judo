# Backlog

## Revue des parcours par profil (21/11/2026)

Méthode : relecture des écrans, des services et des règles (`docs/spec.md`), profil par profil. Le parcours coach a été revu et livré le même jour (COACH-1 à COACH-7, SIMPL-1, RETOUR-1) ; il ne reste qu'un point, partagé avec la famille (PART-1).

### Décisions prises pour cette revue

- Le coach non admin n'ajoute toujours pas de judoka à son club (rôle de l'admin).
- Les invitations individuelles restent faites par l'import CSV (CHD-001) ; pas de formulaire d'invitation.

---

## Admin

Faits vérifiés : l'admin gère utilisateurs, admins, clubs, coachs de chaque club, invitations et import CSV. Le rôle coach ne se donne et ne se retire que par l'import CSV (`role` = `COACH` ou `NORMAL`). Rien ne permet de trouver les judokas sans club (invisibles des coachs, CLUB-001) ni ceux non réinscrits (AUTH-019a), hors le résumé d'un import.

#### ADMIN-1 — Donner ou retirer le rôle coach depuis « Utilisateurs » (P1, M)

- Constat : nommer un nouveau coach ou retirer un coach parti impose de refaire un CSV.
- Règle : la carte d'un utilisateur `JUDOKA` avec e-mail propose « Nommer coach » ou « Retirer le rôle coach » dans son menu d'actions.
- Règle : un `PARENT` ne peut pas être coach (comme à l'import) ; un admin coach garde ses droits admin (ROL-004a).
- Règle : retirer le rôle coach retire aussi ses clubs coachés ; le judoka garde son propre club et ses données.
- Règle : le coach nommé apparaît dans « Clubs coachés » pour recevoir ses clubs.
- Règle : retirer le rôle demande confirmation (UIX-038) ; un admin ne retire pas son propre rôle coach.
- Acceptation : nommer coach un judoka, lui cocher un club ; le retirer, il n'apparaît plus dans « Clubs coachés ».

#### ADMIN-2 — Trouver les judokas sans club et les non réinscrits (P2, S)

- Constat : un judoka sans club n'est vu par aucun coach ; l'admin ne peut pas le retrouver autrement qu'en parcourant tous les comptes.
- Règle : « Utilisateurs » propose un filtre « Tous », « Sans club », « Non réinscrits » (saison en cours), appliqué par le serveur avec la recherche et la pagination (UIX-016c).
- Règle : ces deux filtres ne listent que des profils `JUDOKA`.
- Acceptation : « Sans club » liste un judoka sans club et pas un parent ; « Non réinscrits » liste un judoka inscrit pour une saison passée.

#### ADMIN-3 — Pas de bouton de modification de profil qui échoue (P3, XS)

- Constat : la fiche judoka affiche « Modifier le profil » à un admin, que le serveur refuse hors de son périmètre (ROL-004).
- Règle : l'action n'est proposée qu'au judoka lui-même, à son parent et à son coach.

---

## Coach

#### PART-1 — Une participation à une compétition club ne se supprime pas depuis sa fiche (P1, S)

- Constat : « Supprimer la compétition » sur la fiche d'une participation liée à une compétition club la supprime avec ses combats, pour le coach comme pour la famille. Cela contourne COMP-027 (une participation avec résultats ne se retire pas d'une compétition passée) et fait disparaître un participant de la compétition club sans que le coach le voie.
- Règle : une participation liée à une compétition club ne se supprime que par « Retirer » sur la compétition club (COMP-027) ; le serveur refuse sa suppression directe, pour tous les profils (écrans, API, MCP).
- Règle : la fiche de cette participation ne propose plus « Supprimer la compétition » ; une compétition détachée (COMP-018) reste supprimable.
- Acceptation : la suppression directe d'une participation liée est refusée avec « Retirez ce judoka depuis la compétition club. » ; une compétition détachée se supprime toujours.

---

## Parent

Faits vérifiés : la famille choisit l'enfant, lit ses compétitions, saisit combats et classement, lit le bilan du coach. Elle ne crée plus de compétition (COMP-006).

#### FAM-1 — Dire pourquoi un enfant n'a aucune compétition (P2, XS)

- Constat : pour un enfant sans club, le message « Les compétitions apparaissent ici quand le coach du club y inscrit le judoka » promet ce qui n'arrivera pas : aucun coach ne le voit (CLUB-001).
- Règle : sans club, le message devient « <Prénom> n'est rattaché à aucun club : aucun coach ne peut l'inscrire. Demandez au club de le rattacher. »
- Acceptation : un enfant sans club affiche ce message ; un enfant avec club garde le message actuel.

PART-1 s'applique aussi à la famille.

---

## Judoka

Faits vérifiés : le judoka lit ses compétitions, saisit ses combats et son classement, lit son bilan.

- FAM-1 s'applique à « Mon espace » (« Vous n'êtes rattaché à aucun club… »).
- PART-1 s'applique au judoka.

---

## Suite (21/11/2026)

#### SIMPL-2 — Plus de rappels « Bilan à écrire » (P2, XS) — fait

- Retiré : la pastille « Bilan à écrire » sur la ligne d'un participant, la pastille « N bilans à écrire » des cartes de compétition club et le groupe « Bilans à écrire » de l'agenda du coach.
- Le bilan reste écrit et lu sur la compétition du judoka (« Suivi coach »). Règles : COMP-034, UIX-015, UIX-026.

## Plan d'exécution

Ordre : PART-1, FAM-1, ADMIN-3, ADMIN-2, ADMIN-1. Chaque sujet : test qui échoue, code, test qui passe, `npm test`, spec mise à jour. Captures mobile et desktop pour chaque écran touché. Relecture indépendante de l'ensemble à la fin.
