# Schema Supabase initial

## Objectif

Preparer le schema Supabase cible pour migrer les donnees actuellement stockees dans Google Sheets.

## Tables

Le schema contient trois tables metier :

- `public.judokas`
- `public.competitions`
- `public.combats`

Les identifiants actuels sont conserves en `text` afin de permettre un import direct depuis les onglets existants sans reecriture des references.

## Relations

`competitions.id_judoka` reference le proprietaire dans `judokas.id_judoka`.

`combats.id_judoka` reference le judoka concerne par le combat.

`combats.id_competition` reference la competition concernee et applique `on delete cascade`, afin qu'une competition supprimee ne laisse pas de combats orphelins.

## Contraintes

Le role d'un judoka est limite a `ADMIN` ou `JUDOKA`.

Le resultat d'un combat est limite a `V` ou `D`, comme l'interface actuelle.

Les dates de competition sont stockees en type `date`.

## Securite

Le schema active Row Level Security sur les trois tables. Dans la prochaine etape, l'application Google Apps Script devra acceder a Supabase via une cle stockee dans `PropertiesService`, pas dans le code source.
