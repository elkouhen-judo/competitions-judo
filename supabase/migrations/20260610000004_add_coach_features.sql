-- Script to add coach-specific fields

ALTER TABLE public.competitions 
  ADD COLUMN IF NOT EXISTS categorie_age text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS categorie_poids text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS poids_pesee text NOT NULL DEFAULT '';

ALTER TABLE public.combats 
  ADD COLUMN IF NOT EXISTS type_victoire text NOT NULL DEFAULT '';
