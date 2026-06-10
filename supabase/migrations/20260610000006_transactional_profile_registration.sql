create extension if not exists pgcrypto;

alter table public.judokas
  alter column email drop not null;

create or replace function public.register_profile(
  p_email text,
  p_type text,
  p_prenom text,
  p_nom text,
  p_children jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_type text := upper(btrim(coalesce(p_type, '')));
  v_prenom text := btrim(coalesce(p_prenom, ''));
  v_nom text := btrim(coalesce(p_nom, ''));
  v_parent_id text;
  v_child_id text;
  v_user judokas%rowtype;
  v_child jsonb;
  v_children jsonb := coalesce(p_children, '[]'::jsonb);
begin
  if v_email = '' then
    raise exception 'Email obligatoire.';
  end if;

  if exists (
    select 1
    from public.judokas
    where email is not null
      and lower(email) = v_email
  ) then
    raise exception 'Un profil existe déjà pour cet email.';
  end if;

  if v_type not in ('JUDOKA', 'PARENT') then
    raise exception 'Type de profil obligatoire.';
  end if;

  if v_prenom = '' or v_nom = '' then
    raise exception 'Prénom et nom obligatoires.';
  end if;

  if v_type = 'PARENT' and not exists (
    select 1
    from jsonb_array_elements(v_children) as child
    where btrim(coalesce(child->>'prenom', '')) <> ''
      and btrim(coalesce(child->>'nom', '')) <> ''
  ) then
    raise exception 'Au moins un enfant est obligatoire pour un profil parent.';
  end if;

  v_parent_id := 'JUDO' || replace(gen_random_uuid()::text, '-', '');

  insert into public.judokas (id_judoka, email, prenom, nom, role)
  values (v_parent_id, v_email, v_prenom, v_nom, v_type)
  returning * into v_user;

  if v_type = 'PARENT' then
    for v_child in
      select child
      from jsonb_array_elements(v_children) as child
      where btrim(coalesce(child->>'prenom', '')) <> ''
        and btrim(coalesce(child->>'nom', '')) <> ''
    loop
      v_child_id := 'JUDO' || replace(gen_random_uuid()::text, '-', '');

      insert into public.judokas (id_judoka, email, prenom, nom, role)
      values (
        v_child_id,
        null,
        btrim(v_child->>'prenom'),
        btrim(v_child->>'nom'),
        'JUDOKA'
      );

      insert into public.parent_judokas (id_parent, id_judoka)
      values (v_parent_id, v_child_id);
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'user', to_jsonb(v_user),
    'message', case when v_type = 'PARENT' then 'Profil parent créé.' else 'Profil judoka créé.' end
  );
end;
$$;

grant execute on function public.register_profile(text, text, text, text, jsonb) to service_role;
