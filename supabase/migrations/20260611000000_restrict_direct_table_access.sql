-- Correctif de sécurité pour les environnements où les anciennes politiques ouvertes
-- ont déjà été appliquées.

DROP POLICY IF EXISTS "Allow all operations on judokas" ON public.judokas;
DROP POLICY IF EXISTS "Allow all operations on competitions" ON public.competitions;
DROP POLICY IF EXISTS "Allow all operations on combats" ON public.combats;
DROP POLICY IF EXISTS "Allow all operations on parent_judokas" ON public.parent_judokas;

REVOKE ALL ON TABLE public.judokas FROM anon, authenticated;
REVOKE ALL ON TABLE public.competitions FROM anon, authenticated;
REVOKE ALL ON TABLE public.combats FROM anon, authenticated;
REVOKE ALL ON TABLE public.parent_judokas FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.judokas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.competitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.combats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.parent_judokas TO service_role;
