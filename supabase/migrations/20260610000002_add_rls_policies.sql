-- Script pour autoriser toutes les opérations CRUD via la Service Role Key ou l'accès anonyme géré par Apps Script.

-- Autoriser TOUTES les opérations sur la table judokas
CREATE POLICY "Allow all operations on judokas" 
ON public.judokas FOR ALL USING (true) WITH CHECK (true);

-- Autoriser TOUTES les opérations sur la table competitions
CREATE POLICY "Allow all operations on competitions" 
ON public.competitions FOR ALL USING (true) WITH CHECK (true);

-- Autoriser TOUTES les opérations sur la table combats
CREATE POLICY "Allow all operations on combats" 
ON public.combats FOR ALL USING (true) WITH CHECK (true);
