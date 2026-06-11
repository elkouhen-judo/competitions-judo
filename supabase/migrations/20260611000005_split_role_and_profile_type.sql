alter table public.judokas
  add column if not exists profile_type text not null default 'JUDOKA';

update public.judokas
set profile_type = case
  when coalesce(profile_type, '') in ('JUDOKA', 'PARENT') then profile_type
  when role = 'PARENT' then 'PARENT'
  else 'JUDOKA'
end;

alter table public.judokas
  drop constraint if exists judokas_profile_type_check;

alter table public.judokas
  add constraint judokas_profile_type_check
  check (profile_type in ('JUDOKA', 'PARENT'));

update public.judokas
set role = case
  when role = 'ADMIN' then 'ADMIN'
  else 'NORMAL'
end;

alter table public.judokas
  drop constraint if exists judokas_role_check;

alter table public.judokas
  add constraint judokas_role_check
  check (role in ('NORMAL', 'ADMIN'));

alter table public.access_invitations
  add column if not exists invited_profile_type text not null default 'JUDOKA';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'access_invitations'
      and column_name = 'invited_role'
  ) then
    execute $sql$
      update public.access_invitations
      set invited_profile_type = case
        when coalesce(invited_profile_type, '') in ('JUDOKA', 'PARENT') then invited_profile_type
        when invited_role = 'PARENT' then 'PARENT'
        else 'JUDOKA'
      end
    $sql$;
  else
    update public.access_invitations
    set invited_profile_type = case
      when coalesce(invited_profile_type, '') in ('JUDOKA', 'PARENT') then invited_profile_type
      else 'JUDOKA'
    end;
  end if;
end
$$;

alter table public.access_invitations
  drop constraint if exists access_invitations_invited_profile_type_check;

alter table public.access_invitations
  add constraint access_invitations_invited_profile_type_check
  check (invited_profile_type in ('JUDOKA', 'PARENT'));

alter table public.access_invitations
  drop constraint if exists access_invitations_invited_role_check;

alter table public.access_invitations
  drop column if exists invited_role;

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
  v_requested_profile_type text := upper(btrim(coalesce(p_type, '')));
  v_prenom text := btrim(coalesce(p_prenom, ''));
  v_nom text := btrim(coalesce(p_nom, ''));
  v_profile_type text;
  v_user_id text;
  v_user judokas%rowtype;
begin
  if v_email = '' then
    raise exception 'Email obligatoire.';
  end if;

  select invited_profile_type
  into v_profile_type
  from public.access_invitations
  where lower(email) = v_email;

  if v_profile_type is null then
    raise exception 'Accès non autorisé. Une invitation est requise.';
  end if;

  if exists (
    select 1
    from public.judokas
    where email is not null
      and lower(email) = v_email
  ) then
    raise exception 'Un profil existe déjà pour cet email.';
  end if;

  if v_requested_profile_type <> '' and v_requested_profile_type <> v_profile_type then
    raise exception 'Le type de profil ne correspond pas à l''invitation.';
  end if;

  if v_prenom = '' or v_nom = '' then
    raise exception 'Prénom et nom obligatoires.';
  end if;

  v_user_id := 'JUDO' || replace(gen_random_uuid()::text, '-', '');

  insert into public.judokas (id_judoka, email, prenom, nom, role, profile_type)
  values (v_user_id, v_email, v_prenom, v_nom, 'NORMAL', v_profile_type)
  returning * into v_user;

  delete from public.access_invitations
  where lower(email) = v_email;

  return jsonb_build_object(
    'success', true,
    'user', to_jsonb(v_user),
    'message', case
      when v_profile_type = 'PARENT' then 'Profil parent créé.'
      else 'Profil judoka créé.'
    end
  );
end;
$$;

grant execute on function public.register_profile(text, text, text, text, jsonb) to service_role;
