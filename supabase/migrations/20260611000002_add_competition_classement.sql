-- Add final competition ranking/result used by season statistics.

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS classement text NOT NULL DEFAULT '';
