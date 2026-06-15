---
title: Kiroku Supabase Schema Notes
date_created: 2026-06-10
last_updated: 2026-06-14
owner: competitions-judo
tags:
  - database
  - supabase
---

# Schéma Supabase

Projet cible :

`https://dqtdbfmehwdexikkblwg.supabase.co`

## Migration

Le schéma initial est dans :

`supabase/migrations/20260610000000_initial_schema.sql`

Il crée les tables :

- `public.judokas`
- `public.club_competitions`
- `public.competitions`
- `public.combats`

Les identifiants existants sont conservés en `text` pour simplifier l'import depuis Google Sheets :

- `id_judoka`
- `id_club_competition`
- `id_competition`
- `id_combat`

## Relations

- `competitions.club_competition_id` référence optionnellement `club_competitions.id_club_competition`.
- `competitions.id_judoka` référence `judokas.id_judoka`.
- `combats.id_judoka` référence `judokas.id_judoka`.
- `combats.id_competition` référence `competitions.id_competition` avec `on delete cascade`.

La cascade permet de supprimer automatiquement les combats d'une compétition supprimée.
La suppression ou le détachement d'une compétition club conserve les compétitions individuelles via `club_competition_id = null`.

## Exécution

Option recommandée pour l'instant :

1. Ouvrir le SQL Editor du projet Supabase.
2. Coller le contenu de `supabase/migrations/20260610000000_initial_schema.sql`.
3. Exécuter le script.

Une fois le schéma créé, l'étape suivante sera de préparer les exports CSV des onglets Google Sheets dans cet ordre :

1. `Judokas`
2. `Competitions`
3. `Combats`

Cet ordre respecte les clés étrangères.
