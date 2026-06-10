-- Ajout du rôle PARENT
ALTER TABLE public.judokas DROP CONSTRAINT IF EXISTS judokas_role_check;
ALTER TABLE public.judokas ADD CONSTRAINT judokas_role_check CHECK (role IN ('ADMIN', 'JUDOKA', 'PARENT'));

-- Table de liaison parent ↔ judokas gérés
CREATE TABLE IF NOT EXISTS public.parent_judokas (
  id_parent text NOT NULL,
  id_judoka text NOT NULL,
  PRIMARY KEY (id_parent, id_judoka),
  CONSTRAINT parent_judokas_id_parent_fkey
    FOREIGN KEY (id_parent) REFERENCES public.judokas (id_judoka)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT parent_judokas_id_judoka_fkey
    FOREIGN KEY (id_judoka) REFERENCES public.judokas (id_judoka)
    ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE public.parent_judokas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on parent_judokas"
ON public.parent_judokas FOR ALL USING (true) WITH CHECK (true);
