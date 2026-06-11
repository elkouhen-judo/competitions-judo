-- Les tables métier ne doivent pas être accessibles directement depuis les rôles client.
-- L'API Vercel applique les règles métier puis utilise la clé service_role côté serveur.

DROP POLICY IF EXISTS "Allow all operations on judokas" ON public.judokas;
DROP POLICY IF EXISTS "Allow all operations on competitions" ON public.competitions;
DROP POLICY IF EXISTS "Allow all operations on combats" ON public.combats;

REVOKE ALL ON TABLE public.judokas FROM anon, authenticated;
REVOKE ALL ON TABLE public.competitions FROM anon, authenticated;
REVOKE ALL ON TABLE public.combats FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.judokas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.competitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.combats TO service_role;
