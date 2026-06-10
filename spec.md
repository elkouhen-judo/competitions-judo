# Spécification fonctionnelle

## 1. Objectif de l'application

L'application permet à un club de judo de suivre les compétitions et les combats de ses judokas depuis une interface web Google Apps Script connectée à une base Supabase.

Elle doit permettre :

- à un judoka de consulter et gérer ses propres compétitions ;
- à un judoka de suivre les combats associés à ses compétitions ;
- à un parent de consulter et gérer les compétitions et combats des judokas dont il a la charge ;
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
- ajouter, modifier ou supprimer ses propres combats ;
- ouvrir un écran de gestion des enfants pour ajouter, modifier ou supprimer les judokas mineurs dont il a la charge ;
- devenir parent à partir de cet écran tout en conservant ses droits de judoka sur ses propres données.

### 2.2 Parent

Un parent est un utilisateur connecté dont le rôle vaut `PARENT`.

Il peut :

- consulter les compétitions rattachées à son propre profil et aux judokas dont il a la charge ;
- créer une compétition pour lui-même ou pour un judoka dont il a la charge ;
- modifier ou supprimer les compétitions rattachées à lui-même ou aux judokas dont il a la charge ;
- consulter les combats rattachés à lui-même ou aux judokas dont il a la charge ;
- ajouter, modifier ou supprimer les combats rattachés à lui-même ou aux judokas dont il a la charge ;
- sélectionner le judoka concerné parmi la liste restreinte des judokas qu'il peut gérer.

La liste des judokas gérés par un parent est définie par la table de liaison `parent_judokas`. Le parent est également inclus dans sa propre liste de gestion afin de conserver ses droits de judoka.
Un judoka qui ajoute au moins un enfant via l'écran dédié passe au rôle `PARENT`. Si tous ses enfants sont retirés, il redevient `JUDOKA`.

### 2.3 Administrateur

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

- la liste des compétitions est affichée de manière compacte, proche d'un tableau, pour permettre une lecture rapide ;
- sur mobile, l'affichage compact doit rester lisible et utilisable sans imposer un tableau large difficile à parcourir ;
- sur mobile, la liste compacte doit éviter le scroll horizontal lorsque c'est possible en regroupant ou simplifiant les informations secondaires ;
- les actions principales sont accessibles par des boutons larges et tactiles ;
- les formulaires sont séparés des listes pour limiter la charge visuelle ;
- les informations importantes sont visibles sans mise en page dense ;
- les confirmations sont utilisées avant les suppressions ;
- après une création ou une modification, l'application recharge les données utiles et affiche l'élément concerné.

## 4. Écrans de l'application

### 4.1 Accueil - liste des compétitions

L'écran d'accueil affiche les compétitions visibles par l'utilisateur connecté.

La liste est présentée sous une forme compacte similaire à un tableau. Chaque ligne correspond à une compétition et regroupe les informations essentielles avec les actions associées.

Sur mobile, les informations secondaires peuvent être regroupées dans une cellule principale ou affichées sur une ligne de détail compacte afin d'éviter un tableau horizontal trop large. Les actions d'ouverture et de suppression doivent rester accessibles via des éléments interactifs explicites et tactiles.

Pour chaque compétition, l'utilisateur voit :

- le nom de la compétition ;
- la date ;
- le lieu ;
- une action pour ouvrir le détail ;
- une action de suppression si l'utilisateur a le droit de gérer cette compétition.

Les compétitions sont triées par date décroissante afin de faire remonter les événements les plus récents.

Un judoka standard ne voit que ses propres compétitions. Un parent voit ses propres compétitions et celles des judokas dont il a la charge. Un administrateur voit toutes les compétitions.

### 4.2 Création d'une compétition

L'utilisateur peut créer une compétition en renseignant :

- un nom ;
- une date ;
- un lieu.

Pour un judoka standard, la compétition est automatiquement rattachée à son profil.

Pour un parent, l'écran permet de choisir le judoka propriétaire parmi lui-même et les judokas dont il a la charge.

Pour un administrateur, l'écran permet de saisir le nom ou le prénom du judoka propriétaire, de filtrer la liste des judokas disponibles, puis de sélectionner l'identité correspondante. La compétition est enregistrée avec l'`id_judoka` du judoka sélectionné.

Après création, l'application recharge les données et ouvre la compétition créée.

### 4.3 Détail d'une compétition

Le détail d'une compétition affiche :

- les informations principales de la compétition ;
- la liste des combats visibles par l'utilisateur ;
- les actions disponibles selon les droits de l'utilisateur.

Un judoka standard ne voit que les combats rattachés à son profil. Un parent voit les combats rattachés à lui-même et aux judokas dont il a la charge. Un administrateur voit tous les combats de la compétition.

Lorsqu'un parent ou un administrateur consulte les combats, chaque combat affiche également le nom du judoka concerné afin de faciliter la lecture.

### 4.4 Modification d'une compétition

Une compétition peut être modifiée depuis son écran de détail si l'utilisateur a le droit de la gérer.

Un judoka standard peut modifier uniquement ses propres compétitions.

Un parent peut modifier les compétitions rattachées à lui-même ou aux judokas dont il a la charge, et ajuster le judoka propriétaire uniquement dans cette liste restreinte.

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

Pour un parent, l'écran permet de choisir le judoka concerné parmi lui-même et les judokas dont il a la charge.

Pour un administrateur, l'écran permet de choisir le judoka concerné.

### 4.7 Modification d'un combat

Un combat existant peut être modifié depuis la liste des combats.

Le formulaire de combat est réutilisé en mode modification. Il est prérempli avec les données du combat sélectionné, puis enregistre les changements sur ce combat.

Un judoka standard peut modifier uniquement ses propres combats.

Un parent peut modifier uniquement les combats rattachés à lui-même ou aux judokas dont il a la charge.

Un administrateur peut modifier n'importe quel combat.

### 4.8 Suppression d'un combat

Un combat peut être supprimé depuis la liste des combats si l'utilisateur a le droit de le gérer.

La suppression demande une confirmation explicite.

Un judoka standard peut supprimer uniquement ses propres combats.

Un parent peut supprimer uniquement les combats rattachés à lui-même ou aux judokas dont il a la charge.

Un administrateur peut supprimer n'importe quel combat.

### 4.9 Gestion des enfants

Un utilisateur connecté non administrateur dispose d'un écran dédié pour gérer les enfants dont il a la charge.

Cet écran permet :

- d'afficher la liste actuelle des enfants liés au compte connecté ;
- d'ajouter un enfant en saisissant son prénom et son nom ;
- de modifier le prénom ou le nom d'un enfant existant ;
- de supprimer un enfant si cet enfant ne possède ni compétition ni combat.

Lors de l'ajout du premier enfant, le compte connecté devient parent et récupère les droits associés. Lorsque le dernier enfant est retiré, le compte redevient judoka standard.

Si un enfant supprimé n'a pas d'email, n'est rattaché à aucun autre parent et ne porte aucune donnée sportive, sa fiche judoka est supprimée. Sinon, seul le lien parent-enfant est retiré.

## 5. Gestion des droits

L'accès repose sur l'utilisateur Google connecté.

L'application récupère l'email de session, puis recherche le judoka correspondant dans la liste des judokas. Cette vérification sert à identifier l'utilisateur et à connaître son rôle.

Les droits sont ensuite appliqués selon trois principes :

- un utilisateur standard agit uniquement sur les données rattachées à son profil ;
- un parent agit uniquement sur les données rattachées à son profil et aux judokas dont il a la charge ;
- un administrateur agit sur toutes les données du club.

Le rôle administrateur est attribué lorsque le rôle du judoka vaut `ADMIN`.

Le rôle parent est attribué lorsque le rôle du judoka vaut `PARENT`. Les judokas qu'il peut gérer sont ceux liés à son `id_judoka` dans `parent_judokas`.
L'écran de gestion des enfants n'est pas disponible pour les administrateurs.

Les appels à Supabase sont effectués côté serveur par Google Apps Script. Les secrets Supabase ne sont jamais stockés dans le code source ni envoyés au navigateur. L'URL Supabase et la clé serveur sont lues depuis les Script Properties Apps Script.

## 6. Règles métier

### 6.1 Visibilité des compétitions

Un judoka standard voit uniquement les compétitions qui lui sont rattachées.

Un parent voit uniquement les compétitions qui lui sont rattachées ou qui sont rattachées aux judokas dont il a la charge.

Un administrateur voit toutes les compétitions du classeur.

### 6.2 Gestion des compétitions

Un judoka standard peut créer, modifier et supprimer uniquement ses propres compétitions.

Un parent peut créer, modifier et supprimer les compétitions rattachées à lui-même ou aux judokas dont il a la charge. Une sauvegarde parent pour un judoka hors de cette liste est refusée.

Un administrateur peut créer, modifier et supprimer toutes les compétitions.

Lorsqu'un administrateur crée ou modifie une compétition, il doit choisir le judoka propriétaire. Le formulaire propose une recherche par nom ou prénom, puis une sélection dans la liste filtrée des judokas. Une sauvegarde admin sans propriétaire sélectionné est refusée.

### 6.3 Visibilité des combats

Un judoka standard voit uniquement ses propres combats dans une compétition.

Un parent voit uniquement ses propres combats et ceux des judokas dont il a la charge dans une compétition accessible.

Un administrateur voit tous les combats de la compétition consultée.

### 6.4 Gestion des combats

Un judoka standard peut créer, modifier et supprimer uniquement ses propres combats.

Un parent peut créer, modifier et supprimer uniquement les combats rattachés à lui-même ou aux judokas dont il a la charge.

Un administrateur peut créer, modifier et supprimer tous les combats.

Lorsqu'un administrateur crée ou modifie un combat, il peut choisir le judoka concerné.

### 6.5 Suppressions

Toute suppression déclenche une demande de confirmation.

La suppression d'une compétition supprime aussi tous les combats rattachés à cette compétition.

La suppression d'un combat ne supprime pas la compétition associée.

La suppression d'un enfant est refusée tant que cet enfant possède des compétitions ou des combats.

### 6.6 Dates

Les dates sont normalisées avant d'être affichées dans le navigateur afin de garantir un affichage stable dans l'interface.

## 7. Données manipulées

L'application manipule quatre tables Supabase principales :

- les judokas ;
- les liens entre parents et judokas ;
- les compétitions ;
- les combats.

Les judokas servent à identifier l'utilisateur connecté, à déterminer son rôle et à afficher les noms lorsque le parent ou l'administrateur consulte des combats.

Les liens entre parents et judokas sont stockés dans `parent_judokas`. Chaque ligne associe un `id_parent` à un `id_judoka` que ce parent peut gérer.

Les compétitions représentent les événements suivis par l'application. Elles sont rattachées à un judoka propriétaire.

Les combats représentent les résultats associés à une compétition et à un judoka.

Le schéma Supabase conserve les identifiants métier actuels sous forme de texte afin de faciliter la migration depuis les anciennes données Google Sheets :

- `judokas.id_judoka` ;
- `parent_judokas.id_parent` ;
- `parent_judokas.id_judoka` ;
- `competitions.id_competition` ;
- `combats.id_combat`.

Les compétitions référencent leur judoka propriétaire via `competitions.id_judoka`.

Les combats référencent à la fois leur judoka via `combats.id_judoka` et leur compétition via `combats.id_competition`.

La table `parent_judokas` référence deux lignes de `judokas` : le parent via `id_parent` et le judoka géré via `id_judoka`.

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
- Un parent voit les compétitions et combats de son propre profil et des judokas dont il a la charge.
- Un parent ne voit jamais les compétitions et combats d'un judoka hors de sa liste de gestion.
- Un parent ne peut créer, modifier ou supprimer une compétition ou un combat que pour lui-même ou pour un judoka dont il a la charge.
- Un administrateur voit toutes les compétitions.
- Un administrateur voit tous les combats d'une compétition.
- Un administrateur peut choisir le judoka concerné lors de la création ou modification.
- Une compétition supprimée ne laisse aucun combat orphelin.
- Les compétitions sont affichées de la plus récente à la plus ancienne.
- La liste des compétitions est affichée de manière compacte, proche d'un tableau, sans imposer de scroll horizontal difficile à utiliser sur mobile.
- Les écrans restent utilisables sur mobile.
- Les suppressions demandent confirmation avant exécution.

## 10. Déploiement Vercel

L'application doit pouvoir être déployée sur Vercel en plus du déploiement Google Apps Script historique.

Sur Vercel :

- `Index.html` reste l'interface principale ;
- les appels `google.script.run` sont remplacés dans le navigateur par un adaptateur HTTP compatible ;
- les fonctions métier sont exposées via une API serverless Vercel ;
- l'utilisateur se connecte avec l'authentification Supabase email/mot de passe ;
- les appels navigateur vers Supabase Auth qui utilisent la clé anonyme doivent envoyer `apikey` et `Authorization: Bearer <SUPABASE_ANON_KEY>` ;
- la connexion standard ne doit pas envoyer d'email ;
- si aucun compte Supabase Auth n'existe pour cet email, l'application tente une inscription automatique côté serveur ;
- si l'environnement expose `SUPABASE_AUTH_ADMIN_JWT` ou si `SUPABASE_SERVICE_ROLE_KEY` contient encore une ancienne clé JWT `service_role`, le compte Supabase Auth créé automatiquement est marqué comme confirmé afin d'éviter l'envoi d'un email de validation ;
- si seul un `sb_secret_...` moderne est disponible côté serveur, l'application bascule sur `auth/v1/signup`, crée le compte puis indique clairement à l'utilisateur qu'une confirmation email est requise avant la première connexion ;
- le compte Supabase Auth créé automatiquement est marqué comme confirmé afin d'éviter l'envoi d'un email de validation ;
- si Supabase Auth répond `invalid_credentials` au premier essai, l'application retente l'inscription automatique avant de renvoyer une erreur ;
- l'écran de connexion explique clairement que le même formulaire permet soit de se connecter, soit de créer automatiquement son compte lors de la première utilisation ;
- si l'email authentifié n'existe pas encore dans la table `judokas`, l'utilisateur doit compléter un formulaire de création de profil applicatif ;
- pour un profil judoka, le formulaire crée une ligne dans `judokas` avec le rôle `JUDOKA` ;
- le formulaire initial de création de profil ne gère plus les enfants et crée toujours un profil `JUDOKA` ;
- la gestion des enfants et le passage au rôle `PARENT` se font uniquement après connexion depuis l'écran dédié de gestion des enfants ;
- le lien de confirmation Supabase doit rediriger vers l'URL publique de l'application Vercel, et jamais vers localhost ;
- l'écran de connexion propose une action "mot de passe oublié" qui envoie un email de réinitialisation Supabase ;
- le lien de réinitialisation du mot de passe doit rediriger vers l'URL publique de l'application Vercel, et jamais vers localhost ;
- les emails d'authentification doivent être réservés aux actions explicitement nécessaires, comme la réinitialisation du mot de passe ;
- les magic links ne sont pas utilisés pour l'authentification standard ;
- l'API serverless vérifie la session Supabase Auth et récupère l'email vérifié ;
- l'API rapproche cet email de la table `judokas` pour appliquer les droits métier ;
- après une connexion réussie, l'écran de connexion doit disparaître et l'utilisateur doit arriver sur la liste des compétitions ;
- un utilisateur connecté peut se déconnecter depuis l'en-tête de l'application ;
- le bouton de déconnexion est affiché sur la même ligne que l'identité de l'utilisateur et utilise une icône explicite ;
- sur Vercel, la déconnexion appelle Supabase Auth, supprime la session locale et revient à l'écran de connexion ;
- les requêtes métier vers Supabase restent effectuées côté serveur avec la clé API stockée dans les variables d'environnement Vercel ;
- si `SUPABASE_SERVICE_ROLE_KEY` contient une clé secrète moderne `sb_secret_...`, elle doit être envoyée uniquement dans l'en-tête `apikey` et jamais dans `Authorization: Bearer ...` ;
- la clé `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais être envoyée au navigateur.

Variables d'environnement obligatoires :

- `SUPABASE_URL` ;
- `SUPABASE_ANON_KEY` ;
- `SUPABASE_SERVICE_ROLE_KEY`.

Variable d'environnement optionnelle :

- `SUPABASE_AUTH_ADMIN_JWT` pour conserver une création de compte auto-confirmée sans email lorsque `SUPABASE_SERVICE_ROLE_KEY` contient une clé `sb_secret_...`.

La demande fonctionnelle peut être formulée ainsi : "Rendre l'application déployable sur Vercel tout en conservant le fonctionnement Apps Script existant. Sur Vercel, connecter l'utilisateur avec Supabase Auth email/mot de passe, créer automatiquement et côté serveur le compte Auth si nécessaire, privilégier une création auto-confirmée sans email quand un JWT admin legacy est disponible, sinon basculer proprement sur une confirmation email explicite, puis appliquer les droits métier en recherchant l'email dans la table `judokas`."

La demande fonctionnelle peut être formulée ainsi : "Permettre à un judoka connecté de devenir aussi parent depuis l'application grâce à un écran mobile first de gestion des enfants. Depuis cet écran, il doit pouvoir ajouter, modifier et supprimer ses enfants, être promu au rôle `PARENT` dès le premier enfant, puis retrouver le rôle `JUDOKA` si tous les enfants sont retirés, tout en conservant ses propres droits de judoka."
