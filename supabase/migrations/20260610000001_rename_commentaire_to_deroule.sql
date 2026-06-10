-- Migration script to rename "commentaire" to "deroule" in the "combats" table
ALTER TABLE public.combats RENAME COLUMN commentaire TO deroule;
