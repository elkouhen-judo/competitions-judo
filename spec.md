# Spécification fonctionnelle

## 1. Objectif de l'application

L'application permet à un club de judo de suivre les compétitions et les combats de ses judokas depuis une interface web Google Apps Script connectée à une base Supabase.

Elle doit permettre :

- à un judoka de consulter et gérer ses propres compétitions ;
- à un judoka de suivre les combats associés à ses compétitions ;
- à un administrateur de consulter et gérer l'ensemble des compétitions et combats du club ;
- d'éviter les données orphelines lors des suppressions.

L'application est conçue en priorité pour un usage mobile. Les parcours doivent rester simples, lisibles et utilisables sur petit écran.

## 2. Utilisateurs et rôles

### 2.1 Judoka standard

Un judoka standard est un utilisateur connecté qui existe dans la liste des judokas du club et qui ne possède pas le rôle administrateur.

Il peut :

- consulter uniquement ses compétitions ;
- créer une compétition qui lui est automatiquement rattachée ;
- modifier ou supprimer ses propres compétitions ;
- consulter uniquement ses combats ;
- ajouter, modifier ou supprimer ses propres combats.

### 2.2 Administrateur

Un administrateur est un utilisateur connecté dont le rôle vaut `ADMIN`.

Il peut :

- consulter toutes les compétitions du club ;
- créer une compétition pour lui-même ou pour un autre judoka ;
- modifier ou supprimer n'importe quelle compétition ;
- consulter tous les combats d'une compétition ;
- ajouter, modifier ou supprimer n'importe quel combat ;
- rechercher puis sélectionner le judoka concerné lors de la création ou modification d'une compétition ou d'un combat.

## 3. Principes d'interface

L'interface est mobile first.

Les écrans doivent respecter les principes suivants :

- les listes sont affichées sous forme de cartes plutôt que sous forme de tableaux complexes ;
- les actions principales sont accessibles par des boutons larges et tactiles ;
- les formulaires sont séparés des listes pour limiter la charge visuelle ;
- les informations importantes sont visibles sans mise en page dense ;
- les confirmations sont utilisées avant les suppressions ;
- après une création ou une modification, l'application recharge les données utiles et affiche l'élément concerné.

## 4. Écrans de l'application

### 4.1 Accueil - liste des compétitions

L'écran d'accueil affiche les compétitions visibles par l'utilisateur connecté.

Pour chaque compétition, l'utilisateur voit :

- le nom de la compétition ;
- la date ;
- le lieu ;
- une action pour ouvrir le détail ;
- une action de suppression si l'utilisateur a le droit de gérer cette compétition.

Les compétitions sont triées par date décroissante afin de faire remonter les événements les plus récents.

Un judoka standard ne voit que ses propres compétitions. Un administrateur voit toutes les compétitions.

### 4.2 Création d'une compétition

L'utilisateur peut créer une compétition en renseignant :

- un nom ;
- une date ;
- un lieu.

Pour un judoka standard, la compétition est automatiquement rattachée à son profil.

Pour un administrateur, l'écran permet de saisir le nom ou le prénom du judoka propriétaire, de filtrer la liste des judokas disponibles, puis de sélectionner l'identité correspondante. La compétition est enregistrée avec l'`id_judoka` du judoka sélectionné.

Après création, l'application recharge les données et ouvre la compétition créée.

### 4.3 Détail d'une compétition

Le détail d'une compétition affiche :

- les informations principales de la compétition ;
- la liste des combats visibles par l'utilisateur ;
- les actions disponibles selon les droits de l'utilisateur.

Un judoka standard ne voit que les combats rattachés à son profil. Un administrateur voit tous les combats de la compétition.

Lorsqu'un administrateur consulte les combats, chaque combat affiche également le nom du judoka concerné afin de faciliter la lecture.

### 4.4 Modification d'une compétition

Une compétition peut être modifiée depuis son écran de détail si l'utilisateur a le droit de la gérer.

Un judoka standard peut modifier uniquement ses propres compétitions.

Un administrateur peut modifier n'importe quelle compétition et, si nécessaire, ajuster le judoka propriétaire via la même recherche par nom ou prénom.

Après modification, l'application recharge les données et affiche la compétition mise à jour.

### 4.5 Suppression d'une compétition

Une compétition peut être supprimée depuis la liste des compétitions si l'utilisateur a le droit de la gérer.

La suppression demande une confirmation explicite.

Lorsqu'une compétition est supprimée, tous les combats rattachés à cette compétition sont également supprimés afin d'éviter des lignes orphelines.

### 4.6 Création d'un combat

Depuis le détail d'une compétition, l'utilisateur peut ouvrir un formulaire pour ajouter un combat.

Le formulaire permet de renseigner :

- l'adversaire ;
- le résultat ;
- un champ pour décrire le déroulé du combat.

Pour un judoka standard, le combat est automatiquement rattaché à son profil.

Pour un administrateur, l'écran permet de choisir le judoka concerné.

### 4.7 Modification d'un combat

Un combat existant peut être modifié depuis la liste des combats.

Le formulaire de combat est réutilisé en mode modification. Il est prérempli avec les données du combat sélectionné, puis enregistre les changements sur ce combat.

Un judoka standard peut modifier uniquement ses propres combats.

Un administrateur peut modifier n'importe quel combat.

### 4.8 Suppression d'un combat

Un combat peut être supprimé depuis la liste des combats si l'utilisateur a le droit de le gérer.

La suppression demande une confirmation explicite.

Un judoka standard peut supprimer uniquement ses propres combats.

Un administrateur peut supprimer n'importe quel combat.

## 5. Gestion des droits

L'accès repose sur l'utilisateur Google connecté.

L'application récupère l'email de session, puis recherche le judoka correspondant dans la liste des judokas. Cette vérification sert à identifier l'utilisateur et à connaître son rôle.

Les droits sont ensuite appliqués selon deux principes :

- un utilisateur standard agit uniquement sur les données rattachées à son profil ;
- un administrateur agit sur toutes les données du club.

Le rôle administrateur est attribué lorsque le rôle du judoka vaut `ADMIN`.

Les appels à Supabase sont effectués côté serveur par Google Apps Script. Les secrets Supabase ne sont jamais stockés dans le code source ni envoyés au navigateur. L'URL Supabase et la clé serveur sont lues depuis les Script Properties Apps Script.

## 6. Règles métier

### 6.1 Visibilité des compétitions

Un judoka standard voit uniquement les compétitions qui lui sont rattachées.

Un administrateur voit toutes les compétitions du classeur.

### 6.2 Gestion des compétitions

Un judoka standard peut créer, modifier et supprimer uniquement ses propres compétitions.

Un administrateur peut créer, modifier et supprimer toutes les compétitions.

Lorsqu'un administrateur crée ou modifie une compétition, il doit choisir le judoka propriétaire. Le formulaire propose une recherche par nom ou prénom, puis une sélection dans la liste filtrée des judokas. Une sauvegarde admin sans propriétaire sélectionné est refusée.

### 6.3 Visibilité des combats

Un judoka standard voit uniquement ses propres combats dans une compétition.

Un administrateur voit tous les combats de la compétition consultée.

### 6.4 Gestion des combats

Un judoka standard peut créer, modifier et supprimer uniquement ses propres combats.

Un administrateur peut créer, modifier et supprimer tous les combats.

Lorsqu'un administrateur crée ou modifie un combat, il peut choisir le judoka concerné.

### 6.5 Suppressions

Toute suppression déclenche une demande de confirmation.

La suppression d'une compétition supprime aussi tous les combats rattachés à cette compétition.

La suppression d'un combat ne supprime pas la compétition associée.

### 6.6 Dates

Les dates sont normalisées avant d'être affichées dans le navigateur afin de garantir un affichage stable dans l'interface.

## 7. Données manipulées

L'application manipule trois tables Supabase principales :

- les judokas ;
- les compétitions ;
- les combats.

Les judokas servent à identifier l'utilisateur connecté, à déterminer son rôle et à afficher les noms lorsque l'administrateur consulte des combats.

Les compétitions représentent les événements suivis par l'application. Elles sont rattachées à un judoka propriétaire.

Les combats représentent les résultats associés à une compétition et à un judoka.

Le schéma Supabase conserve les identifiants métier actuels sous forme de texte afin de faciliter la migration depuis les anciennes données Google Sheets :

- `judokas.id_judoka` ;
- `competitions.id_competition` ;
- `combats.id_combat`.

Les compétitions référencent leur judoka propriétaire via `competitions.id_judoka`.

Les combats référencent à la fois leur judoka via `combats.id_judoka` et leur compétition via `combats.id_competition`.

La relation entre `combats` et `competitions` applique une suppression en cascade : supprimer une compétition supprime automatiquement ses combats associés.

L'application accède à ces tables via l'API REST Supabase depuis `Code.js`. Les fonctions exposées à l'interface restent stables afin de conserver le comportement de `Index.html`.

## 8. Cas particuliers et confirmations

Si un utilisateur connecté ne correspond à aucun judoka connu, l'application ne doit pas lui donner accès aux données métier.

Si une liste est vide, l'écran doit afficher un état vide compréhensible plutôt qu'une zone blanche.

Les suppressions doivent toujours être confirmées avant exécution.

Après une action réussie, l'application doit revenir à un état cohérent et afficher les données à jour.

## 9. Critères d'acceptation

- Un judoka standard ne voit jamais les compétitions d'un autre judoka.
- Un judoka standard ne voit jamais les combats d'un autre judoka.
- Un judoka standard ne peut modifier ou supprimer que ses propres compétitions et combats.
- Un administrateur voit toutes les compétitions.
- Un administrateur voit tous les combats d'une compétition.
- Un administrateur peut choisir le judoka concerné lors de la création ou modification.
- Une compétition supprimée ne laisse aucun combat orphelin.
- Les compétitions sont affichées de la plus récente à la plus ancienne.
- Les écrans restent utilisables sur mobile.
- Les suppressions demandent confirmation avant exécution.
