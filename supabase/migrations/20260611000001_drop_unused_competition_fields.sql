-- Remove competition fields no longer used by the mobile UI.

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS categorie_age text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS categorie_poids text NOT NULL DEFAULT '';

ALTER TABLE public.competitions
  DROP COLUMN IF EXISTS lieu,
  DROP COLUMN IF EXISTS poids_pesee;
