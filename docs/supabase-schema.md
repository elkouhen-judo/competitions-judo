---
title: Kiroku Supabase Schema Notes
date_created: 2026-06-10
last_updated: 2026-06-18
owner: competitions-judo
tags:
  - database
  - supabase
---

# Schéma Supabase

Projet cible :

`https://dqtdbfmehwdexikkblwg.supabase.co`

## Migration

Le schéma canonique et les évolutions idempotentes sont dans :

- `supabase/migrations/20260612000000_initial_schema.sql`

Le fichier crée les tables :

- `public.judokas`
- `public.club_competitions`
- `public.competitions`
- `public.combats`
- `public.combat_scores`
- `public.clubs`
- `public.coach_clubs`

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
- `combat_scores.id_combat` référence `combats.id_combat` avec `on delete cascade` (une ligne par prise marquée, ordre préservé par la colonne `ordre`).
- `judokas.club_id` référence optionnellement `clubs.id_club` (`on delete restrict`) : le club du judoka.
- `club_competitions.club_id` référence `clubs.id_club` (`on delete restrict`) : le club propriétaire de la compétition club.
- `coach_clubs (id_coach, id_club)` relie un coach (`judokas.id_judoka`) aux clubs qu'il coache, avec `on delete cascade` des deux côtés.

La cascade permet de supprimer automatiquement les combats d'une compétition supprimée, et les prises marquées d'un combat supprimé.
La suppression ou le détachement d'une compétition club conserve les compétitions individuelles via `club_competition_id = null`.

`public.judokas` stocke aussi `genre` (`Homme`, `Femme`, ou vide), `annee_categorie` (l'année dans la catégorie d'âge — `1`/`2` pour Poussinet à Minime, `1`/`2`/`3` pour Cadet/Junior, ou vide) et `lateralite` (`Droitier`, `Gaucher`, ou vide), utilisés pour filtrer et ventiler le tableau de bord coach.

## Exécution

```
npx supabase db push
```

En l'absence du CLI Supabase, ouvrir le SQL Editor du projet Supabase et coller le contenu de `supabase/migrations/20260612000000_initial_schema.sql`.

Une fois le schéma créé, l'étape suivante sera de préparer les exports CSV des onglets Google Sheets dans cet ordre :

1. `Judokas`
2. `Competitions`
3. `Combats`

Cet ordre respecte les clés étrangères.

`public.combats` stocke aussi `etape` : le tour du combat dans la compétition (`Poule`, `1/32`, `1/16`, `1/8`, `1/4`, `1/2`, `Repêchage`, `Place de 3`, `Finale`, ou vide), contraint par `combats_etape_check`.

`public.clubs` stocke les clubs (`id_club`, `nom` unique sans tenir compte de la casse). `public.judokas.is_admin` porte le droit admin indépendamment de `role`, pour qu'un coach puisse aussi être admin.
