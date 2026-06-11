# Spécification fonctionnelle

## 1. Contexte

Kiroku est une application mobile first de suivi des compétitions et combats d'un club de judo.

Objectifs :

- suivre les compétitions et combats des judokas ;
- appliquer des droits par rôle ;
- éviter les données orphelines ;
- garder une interface lisible sur mobile.

## 2. Rôles

- `JUDOKA` : accède uniquement à ses propres compétitions et combats.
- `PARENT` : accède à ses données et aux judokas liés dans `parent_judokas`.
- `ADMIN` : accède à toutes les données du club.

Un judoka devient `PARENT` dès qu'il ajoute un enfant. Il redevient `JUDOKA` quand son dernier enfant est retiré.

## 3. Écrans

- **Accueil** : liste compacte des compétitions visibles, triées par date décroissante.
- **Compétition** : détail d'une compétition, liste des combats, actions autorisées.
- **Formulaire compétition** : création ou modification d'une compétition.
- **Formulaire combat** : création ou modification d'un combat.
- **Gestion des enfants** : ajout, modification et suppression des enfants pour les non-admins.
- **Connexion Vercel** : connexion Google via Supabase Auth uniquement.

## 4. Règles métier

### Compétitions

- **COMP-VIS-1** - Un `JUDOKA` voit uniquement ses compétitions.
- **COMP-VIS-2** - Un `PARENT` voit ses compétitions et celles des judokas qu'il gère.
- **COMP-VIS-3** - Un `ADMIN` voit toutes les compétitions.
- **COMP-GEST-1** - Un `JUDOKA` crée, modifie et supprime uniquement ses compétitions.
- **COMP-GEST-2** - Un `PARENT` crée, modifie et supprime uniquement ses compétitions et celles des judokas qu'il gère.
- **COMP-GEST-3** - Une sauvegarde parent pour un judoka hors périmètre est refusée.
- **COMP-GEST-4** - Un `ADMIN` crée, modifie et supprime toutes les compétitions.
- **COMP-GEST-5** - Un `ADMIN` choisit le judoka propriétaire par recherche nom/prénom avant sauvegarde.
- **COMP-GEST-6** - Une sauvegarde admin sans propriétaire sélectionné est refusée.
- **COMP-UI-1** - Les compétitions sont affichées de la plus récente à la plus ancienne.
- **COMP-UI-2** - La liste reste compacte et utilisable sur mobile.

### Combats

- **COMBAT-VIS-1** - Un `JUDOKA` voit uniquement ses combats dans une compétition.
- **COMBAT-VIS-2** - Un `PARENT` voit ses combats et ceux des judokas qu'il gère dans une compétition accessible.
- **COMBAT-VIS-3** - Un `ADMIN` voit tous les combats de la compétition.
- **COMBAT-GEST-1** - Un `JUDOKA` crée, modifie et supprime uniquement ses combats.
- **COMBAT-GEST-2** - Un `PARENT` crée, modifie et supprime uniquement ses combats et ceux des judokas qu'il gère.
- **COMBAT-GEST-3** - Un `ADMIN` crée, modifie et supprime tous les combats.
- **COMBAT-GEST-4** - Un `ADMIN` peut choisir le judoka concerné.

### Enfants

- **ENFANT-GEST-1** - Un utilisateur non-admin peut gérer ses enfants.
- **ENFANT-GEST-2** - Ajouter un premier enfant promeut le compte en `PARENT`.
- **ENFANT-GEST-3** - Retirer le dernier enfant repasse le compte en `JUDOKA`.
- **ENFANT-SUPPR-1** - Un enfant avec compétition ou combat ne peut pas être supprimé.
- **ENFANT-SUPPR-2** - Si l'enfant n'a pas d'email, aucun autre parent et aucune donnée sportive, sa fiche `judokas` est supprimée ; sinon seul le lien parent-enfant est retiré.

### Suppressions et dates

- **SUPPR-1** - Toute suppression demande confirmation.
- **SUPPR-2** - Supprimer une compétition supprime ses combats.
- **SUPPR-3** - Supprimer un combat ne supprime pas sa compétition.
- **DATE-1** - Les dates sont normalisées avant affichage navigateur.

### Authentification

- **AUTH-1** - L'utilisateur se connecte avec Google via Supabase Auth.
- **AUTH-2** - L'application conserve la session Supabase retournée par le callback OAuth.
- **AUTH-3** - L'API vérifie la session Supabase et récupère l'email vérifié.
- **AUTH-4** - Les droits applicatifs viennent du rôle stocké dans `judokas`, pas du compte Google.
- **AUTH-5** - L'écran de connexion ne propose ni mot de passe, ni magic link.
- **AUTH-6** - L'en-tête affiche l'identité connectée sans bouton de déconnexion.
- **AUTH-7** - Le secret OAuth Google reste dans Supabase et n'est jamais envoyé au navigateur.

## 5. Interface

- Mobile first.
- Formulaires séparés des listes.
- Actions principales visibles, tactiles et explicites.
- États vide, erreur, chargement et succès compréhensibles.
- Confirmation obligatoire avant suppression.
- Après création ou modification, recharger les données utiles et afficher l'élément concerné.

## 6. Critères d'acceptation

- Un utilisateur ne voit jamais de données hors de son rôle.
- Un parent ne peut jamais gérer un judoka hors de `parent_judokas`.
- Un admin peut gérer toutes les compétitions et tous les combats.
- Une compétition supprimée ne laisse aucun combat orphelin.
- Les suppressions demandent confirmation.
- L'application reste utilisable sur mobile.
- La version Vercel connecte uniquement avec Google.
