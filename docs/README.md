---
title: Kiroku Documentation Index
last_updated: 2026-06-23
owner: competitions-judo
tags:
  - index
---

# Documentation - Kiroku

Index court des documents de ce dossier. Voir `AGENTS.md` à la racine pour le workflow agent et le routage par tâche.

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `prd.md` | PRD : problème, solution, principes produit, décisions d'implémentation et de tests, hors périmètre | Comprendre le "pourquoi" avant une décision produit, ou avoir une vue d'ensemble du besoin |
| `spec.md` | Règles fonctionnelles, rôles, écrans, critères d'acceptation (`REQ-*`, `COMP-*`, `CBT-*`, ...) | Tout changement de comportement métier ou d'écran |
| `spec-tech.md` | Architecture, modèle de données, auth, sécurité, configuration, déploiement | Changement touchant l'architecture, les données, l'auth, la sécurité ou le déploiement |
| `supabase-schema.md` | Schéma Supabase, tables, relations, migration initiale | Travail sur le schéma ou les migrations |
| `codebase-memory-mcp.md` | Prompt d'analyse d'impact (architecte senior) : composants touchés, flux, risques, tests, plan de déploiement et rollback | Avant un changement à fort rayon d'impact (services, repositories, API, flux asynchrones) |
