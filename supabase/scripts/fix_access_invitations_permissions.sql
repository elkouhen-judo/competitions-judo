create extension if not exists pgcrypto;

create table if not exists public.access_invitations (
  email text primary key,
  invited_profile_type text not null default 'JUDOKA',
  invited_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_invitations_email_not_blank check (btrim(email) <> ''),
  constraint access_invitations_invited_profile_type_check check (invited_profile_type in ('JUDOKA', 'PARENT')),
  constraint access_invitations_invited_by_fkey
    foreign key (invited_by) references public.judokas (id_judoka)
    on update cascade
    on delete cascade
);

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
        when invited_profile_type in ('JUDOKA', 'PARENT') then invited_profile_type
        when invited_role = 'PARENT' then 'PARENT'
        else 'JUDOKA'
      end
      where invited_profile_type is null
         or invited_profile_type not in ('JUDOKA', 'PARENT')
    $sql$;
  else
    update public.access_invitations
    set invited_profile_type = case
      when invited_profile_type in ('JUDOKA', 'PARENT') then invited_profile_type
      else 'JUDOKA'
    end
    where invited_profile_type is null
       or invited_profile_type not in ('JUDOKA', 'PARENT');
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

alter table public.judokas
  add column if not exists profile_type text not null default 'JUDOKA';

update public.judokas
set profile_type = case
  when profile_type in ('JUDOKA', 'PARENT') then profile_type
  when role = 'PARENT' then 'PARENT'
  else 'JUDOKA'
end
where profile_type is null
   or profile_type not in ('JUDOKA', 'PARENT');

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

create unique index if not exists access_invitations_email_idx
  on public.access_invitations (lower(email));

drop trigger if exists access_invitations_set_updated_at on public.access_invitations;
create trigger access_invitations_set_updated_at
before update on public.access_invitations
for each row
execute function public.set_updated_at();

alter table public.access_invitations enable row level security;

drop policy if exists "Service role access on access_invitations" on public.access_invitations;
create policy "Service role access on access_invitations"
on public.access_invitations
for all
to service_role
using (true)
with check (true);

revoke all on table public.access_invitations from anon, authenticated;
grant select, insert, update, delete on table public.access_invitations to service_role;

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

  select
    invited_profile_type
  into
    v_profile_type
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

  if v_prenom = '' or v_nom = '' then
    raise exception 'Prénom et nom obligatoires.';
  end if;

  if v_requested_profile_type <> '' and v_requested_profile_type <> v_profile_type then
    raise exception 'Le type de profil ne correspond pas à l''invitation.';
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
