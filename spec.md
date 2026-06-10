# Spécification fonctionnelle

L'application permet de suivre les compétitions de judo d'un club depuis une interface web Google Apps Script connectée à un classeur Google Sheets. Elle est conçue en priorité pour un usage mobile : les écrans sont organisés en cartes tactiles, les boutons sont larges, les formulaires sont séparés des listes, et le parcours évite les tableaux complexes sur petit écran.

L'accès repose sur l'utilisateur Google connecté. L'application récupère son email de session puis recherche le judoka correspondant dans l'onglet `Judokas`. Cette vérification sert uniquement à identifier l'utilisateur. Les opérations métier utilisent ensuite `id_judoka`, notamment pour rattacher, filtrer, modifier ou supprimer des combats. Le rôle administrateur est déterminé par la colonne `role` de l'onglet `Judokas` : un utilisateur est admin si cette valeur vaut `ADMIN`.

L'écran d'accueil liste les compétitions visibles par l'utilisateur. Un judoka standard ne voit que les compétitions dont la colonne `id_judoka` de l'onglet `Competitions` correspond à son `id_judoka`. Un admin voit toutes les compétitions du classeur. Chaque compétition est affichée sous forme de carte avec son nom, sa date et son lieu. Une action dédiée ouvre le détail de la compétition. Les compétitions sont triées par date décroissante afin de faire remonter les événements les plus récents.

Un utilisateur peut créer une compétition en renseignant un nom, une date et un lieu. Une compétition créée par un judoka standard est automatiquement rattachée à son `id_judoka`. Un admin peut choisir le judoka propriétaire de la compétition. Une compétition existante peut également être modifiée depuis son écran de détail si l'utilisateur peut la gérer : un judoka standard peut gérer ses propres compétitions, tandis qu'un admin peut toutes les gérer. Après création ou modification, l'application recharge les données et ouvre la compétition concernée.

Dans la vue liste des compétitions, chaque carte de compétition affiche une action de suppression directe si l'utilisateur peut gérer cette compétition. La suppression demande confirmation, puis supprime la compétition et tous les combats rattachés afin d'éviter des lignes orphelines dans l'onglet `Combats`. Un judoka standard ne peut supprimer que ses propres compétitions ; un admin peut supprimer n'importe quelle compétition.

Le détail d'une compétition affiche un résumé de ses informations principales, puis la liste de ses combats. Pour un admin, tous les combats de la compétition sont visibles. Pour un judoka non-admin, seuls les combats associés à son `id_judoka` sont affichés. Lorsqu'un admin consulte les combats, l'application enrichit chaque ligne avec le nom du judoka en utilisant l'onglet `Judokas`.

Une compétition peut contenir plusieurs combats. Depuis l'écran de détail, l'utilisateur peut ouvrir un formulaire dédié pour ajouter un combat. Le formulaire permet de renseigner l'adversaire, le résultat et un commentaire. Si l'utilisateur est admin, il peut sélectionner le judoka concerné dans une liste. Sinon, le combat est automatiquement rattaché au judoka connecté.

Les combats existants peuvent être édités. Le formulaire de combat est réutilisé en mode modification : il se préremplit avec les données du combat sélectionné, puis enregistre les changements dans la ligne correspondante de l'onglet `Combats`. Un admin peut modifier n'importe quel combat. Un judoka standard ne peut modifier que ses propres combats.

Les combats peuvent aussi être supprimés après confirmation. Là encore, l'admin peut supprimer n'importe quel combat, tandis qu'un judoka ne peut supprimer que les combats rattachés à son `id_judoka`.

Les données sont stockées dans trois onglets principaux : `Judokas`, `Competitions` et `Combats`. Les dates sont normalisées avant d'être renvoyées au navigateur afin de garantir un affichage stable dans l'interface.
