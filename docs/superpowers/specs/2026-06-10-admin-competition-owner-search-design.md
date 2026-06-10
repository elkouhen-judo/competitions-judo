# Recherche du judoka proprietaire par un admin

## Objectif

Permettre a un administrateur d'indiquer clairement l'identite du judoka proprietaire lors de la creation ou modification d'une competition.

## Comportement attendu

Le formulaire de competition affiche, pour les admins uniquement, une zone de recherche du judoka proprietaire.

L'admin saisit une partie du nom ou du prenom du judoka. La liste des judokas disponibles se filtre immediatement. L'admin selectionne ensuite une identite dans la liste.

La sauvegarde envoie uniquement l'`id_judoka` selectionne au backend. Le backend conserve la validation existante : une competition creee ou modifiee par un admin sans `id_judoka` est refusee.

Pour un utilisateur non-admin, le champ reste masque et le proprietaire reste automatiquement le judoka connecte.

## Interface

Le champ de recherche est un champ texte tactile, place au-dessus de la liste de selection. La liste reste un `select` natif pour conserver une interaction simple sur mobile.

Lorsqu'une competition existante est editee, la recherche affiche le nom du proprietaire actuel et la liste selectionne son `id_judoka`.

La liste des judokas est affichee dans un menu deroulant simple.

## Tests

Les tests statiques verifient que le formulaire contient le champ de recherche, que la saisie appelle le filtrage, que la selection reste portee par `competition_id_judoka`, et que le pre-remplissage admin renseigne la recherche avec l'identite courante.
