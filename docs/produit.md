---
title: Kiroku Product Vision
date_created: 2026-06-13
last_updated: 2026-06-14
owner: competitions-judo
tags:
  - product
  - vision
---

# Produit - Kiroku

## Vision

Kiroku est le carnet de suivi compétitif mobile-first d'un club de judo, alimenté par les familles et exploité par le coach.

Le produit aide le coach à comprendre instantanément le parcours, le rythme de progression et le profil de combat d'un judoka, sans lui imposer la moindre charge administrative de saisie.

## Problème

Dans un club, les résultats de compétition sont souvent dispersés ou perdus (SMS, souvenirs flous, feuilles de poules égarées). Le coach manque de temps pour tout centraliser, ce qui l'empêche de répondre à des questions clés lors des entraînements :

- Combien de compétitions ce judoka a-t-il faites cette saison ?
- Quel est son ratio victoires/défaites sur ses derniers tournois ?
- Ses défaites sont-elles liées à des axes techniques précis ou des erreurs répétitives ?
- Quel bilan fait-on partager avec le judoka pour le faire progresser ?

## Cible Prioritaire & Utilisateurs

### 1. Le Coach (Consommateur principal)
Il n'écrit rien ou presque. Il consulte Kiroku sur son téléphone, au dojo ou sur la chaise de coaching, pour analyser le profil d'un élève, préparer un combat ou débriefer une compétition.

### 2. Le Parent / Le Judoka (Saisisseurs principaux)
Ils sont responsables de la mise à jour des données. Après ou pendant une compétition, ils saisissent les résultats et les combats directement depuis leur mobile.

## Promesse Produit

Donner au coach une vision claire, actionnable et centralisée du parcours compétitif de ses judokas, portée par un effort collaboratif des familles.

## Positionnement

Kiroku est :
- Un outil de centralisation et d'analyse des performances de judo.
- Une application mobile-first pensée pour une saisie rapide par les parents dans les tribunes et une lecture rapide par le coach sur le tapis.

Kiroku n'est pas :
- Un logiciel de gestion de club (licences, cotisations, présence).
- Un réseau social ou un outil d'analyse vidéo.
- Un système de messagerie.

## Coeur Du Produit

Le produit s'articule autour de deux vues majeures :

1. **La Fiche Judoka (Vue Coach/Famille) :** L'agrégateur de performance par saison (nombre de combats, ratio V/D, historique des compétitions).
2. **La Vue Compétition (Vue Coach) :** Un écran permettant au coach de voir, pour un événement donné (ex: *Interclubs de Nantes*), l'ensemble des résultats saisis par les parents du club pour cette compétition.

## Boucle D'Usage Principale

1. **Saisie :** Le parent crée une compétition et enregistre les combats de son enfant (fiche par fiche).
2. **Agrégation :** Le système met à jour automatiquement la Fiche du Judoka concerné et alimente la vue Compétition globale.
3. **Consultation :** Le coach ouvre Kiroku pour débriefer le weekend ou préparer son cours.
4. **Restitution :** Coach et judoka échangent sur le tapis autour de données concrètes.

## Principes Produit

- **Zéro saisie coach obligatoire :** Le produit doit pouvoir vivre même si le coach ne fait que lire.
- **Saisie asynchrone par Judoka :** Le parent crée la compétition et les combats depuis l'espace de son enfant.
- **Friction d'entrée minimale :** L'interface de saisie des combats doit être tellement simple qu'un parent non-judoka peut la remplir.
- **Online-first pour le MVP :** L'application nécessite une connexion réseau (la gestion du hors-ligne est exclue du MVP).

## Fonctionnalités MVP

### Gestion des Accès & Rôles
- **Espace Coach :** Accès en lecture seule à tous les judokas du club et à la vue d'ensemble des compétitions.
- **Espace Parent / Judoka :** Accès en lecture/écriture uniquement sur le profil du judoka (ou des enfants de la fratrie).

### Saisie Sportive (Périmètre Parent)
- Création d'une compétition (Nom, Date, Lieu, Catégorie d'âge/poids).
- Saisie des combats avec la granularité stricte suivante :
  - **Statut :** Victoire (V) / Défaite (D) / Égalité (E).
  - **Déroulé :** Zone de commentaire libre optionnelle (ex: *"Perdu par Ippon sur Uchi-Mata"*, *"Gagné aux pénalités au Golden Score"*).
- Renseignement du classement final de l'enfant (ex: *1er, 3ème, Non classé*).

### Consultation & Analyse (Périmètre Coach)
- **Dashboard Compétitions :** Liste des événements récents. En cliquant sur une compétition, le coach voit la liste des judokas du club qui y ont participé et leurs résultats associés.
- **Fiche Performance Judoka :** Historique complet des combats trié par saison, avec affichage du commentaire libre pour chaque combat pour comprendre le contexte.

## Critères De Succès Du MVP

- Un parent peut enregistrer une compétition et 3 combats en moins de 3 minutes depuis les tribunes.
- Le dimanche soir ou le lundi au dojo, le coach peut voir en 2 clics l'ensemble des résultats du club sur le tournoi du weekend.
- Le volume de combats saisis augmente chaque weekend sans que le coach ait à intervenir techniquement.