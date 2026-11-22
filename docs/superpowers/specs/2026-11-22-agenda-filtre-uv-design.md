# Agenda FFJDA — filtre par UV (conception courte)

Date : 2026-11-22 · Statut : validé en conversation.

## Intention

L'objectif principal de l'agenda est de repérer les séances de passage d'UV. Le coach veut filtrer par UV et, idéalement, trouver les séances où l'on peut passer plusieurs UV à la fois (UV1 et UV2).

## Objectifs / non-objectifs

- Filtre UV1, UV2, UV3, UV4, cumulatif : cocher plusieurs UV garde les séances qui les proposent **toutes**.
- Étiquettes d'UV sur les cartes d'examen.
- Hors périmètre : dan visé, judo / jujitsu, volets a/b de l'UV3.

## Approches

1. **Détection à la lecture, côté serveur** (retenue) : fonction de domaine pure appliquée par `getFfjudoEvents`, champ `uvs` renvoyé. Pas de migration, pas de resynchro, règle testable et améliorable.
2. Détection à la synchro, colonne en base : migration prod et resynchro à chaque évolution de la règle.
3. Détection dans le navigateur : logique cachée dans l'écran, moins testable.

## Règle de détection (sur le titre)

- Candidats : type `PASSAGE DE GRADE`, ou titre mentionnant « UV ».
- Exclus : titre contenant « stage » (séance de préparation).
- UV1, UV2, UV4 : `UV` suivi du numéro, y compris listes (« UV1/2/3b », « UV1-UV2 », « UV 1 », « UV1 UV2 UV3-B »).
- UV3 : `UV3`, volets (« 3b », « volet b UV3 »), « TEC » (mot entier), « test efficacité combat », « shiai ».
- Aucune UV reconnue → `uvs` vide : visible via le filtre Type, pas via le filtre UV.

## Écran

Rangée de 4 boutons à bascule « UV1 »…« UV4 » (`aria-pressed`) au-dessus des filtres ; combinable avec Ligue, Type et Mois ; « Effacer les filtres » les décoche ; étiquettes « UV1 · UV2 » sur les cartes.

## Règles à ajouter

`AGD-012` (détection), `AGD-013` (filtre cumulatif et étiquettes) dans `docs/spec.md`.
