# Design mobile-first terrain

## Objectif

Ameliorer l'ergonomie mobile de l'application de suivi des competitions de judo pour un usage rapide pendant une competition. Le parcours prioritaire est : ouvrir une competition, consulter les combats, ajouter ou modifier un combat avec le moins de friction possible.

## Approche retenue

L'interface reste une application Google Apps Script monofichier cote client, sans nouveau framework ni dependance. Les changements se concentrent dans `Index.html` : structure HTML legere si necessaire, CSS mobile-first, et petites adaptations de rendu JavaScript pour rendre les cartes plus scannables.

La base mobile devient la reference. Les ecrans larges reçoivent ensuite une amelioration progressive via media queries, sans que le desktop dicte la mise en page.

## Ergonomie mobile

L'en-tete doit occuper moins d'espace vertical. Les informations utilisateur restent visibles mais ne doivent pas concurrencer les actions principales.

La liste des competitions doit afficher uniquement les informations utiles : nom, date et lieu. La ligne "Action / Ouvrir" est supprimee car toute la carte est deja tactile.

Le detail d'une competition doit mettre les combats au premier plan. Le bouton "Ajouter un combat" reste facilement accessible en bas de l'ecran sur mobile. Les zones de suppression restent visibles mais secondaires.

Les cartes de combat doivent permettre de lire vite l'adversaire et le resultat. Le commentaire est affiche avec moins de poids visuel. Les actions "Editer" et "Supprimer" conservent des cibles tactiles confortables.

Les formulaires doivent privilegier la saisie rapide : champs pleine largeur, hauteur tactile, libelles clairs, actions collees en bas sur mobile. L'action principale est affichee en dernier visuellement et doit rester la plus evidente.

## Desktop et tablette

A partir des largeurs tablette/desktop, les listes peuvent repasser en grille, les boutons peuvent reprendre une largeur automatique, et les panneaux peuvent retrouver un encadrement leger. Ces ajustements ne doivent pas ajouter de comportement different entre mobile et desktop.

## Tests et verification

La verification portera sur le rendu statique de `Index.html` et sur les comportements existants : changement de vue, rendu des competitions, rendu des combats, affichage des formulaires et preservation des appels Apps Script. Comme le projet n'a pas de runner frontend, une verification locale par inspection HTML/CSS et, si possible, un rendu navigateur simple sera utilise.
