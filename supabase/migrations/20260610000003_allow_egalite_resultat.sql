-- Script to allow "E" (Egalite) in combats_resultat_check

ALTER TABLE public.combats DROP CONSTRAINT IF EXISTS combats_resultat_check;
ALTER TABLE public.combats ADD CONSTRAINT combats_resultat_check CHECK (resultat IN ('V', 'D', 'E'));
