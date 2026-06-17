-- Canonical Supabase schema for Kiroku.
-- Business data is accessed through the Vercel API with the service_role key.

create extension if not exists pgcrypto;

create table if not exists public.judokas (
  id_judoka text primary key,
  email text unique,
  prenom text not null,
  nom text not null,
  role text not null default 'NORMAL',
  profile_type text not null default 'JUDOKA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint judokas_role_check check (role in ('NORMAL', 'COACH', 'ADMIN')),
  constraint judokas_profile_type_check check (profile_type in ('JUDOKA', 'PARENT')),
  constraint judokas_email_not_blank check (email is null or btrim(email) <> ''),
  constraint judokas_prenom_not_blank check (btrim(prenom) <> ''),
  constraint judokas_nom_not_blank check (btrim(nom) <> '')
);

create table if not exists public.club_competitions (
  id_club_competition text primary key,
  nom text not null,
  date date not null,
  categorie_age text not null default '',
  categorie_poids text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_competitions_nom_not_blank check (btrim(nom) <> '')
);

create table if not exists public.competitions (
  id_competition text primary key,
  id_judoka text not null,
  club_competition_id text,
  nom text not null,
  date date not null,
  categorie_age text not null default '',
  categorie_poids text not null default '',
  classement text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_id_judoka_fkey
    foreign key (id_judoka)
    references public.judokas (id_judoka)
    on update cascade
    on delete restrict,
  constraint competitions_club_competition_id_fkey
    foreign key (club_competition_id)
    references public.club_competitions (id_club_competition)
    on update cascade
    on delete set null,
  constraint competitions_nom_not_blank check (btrim(nom) <> '')
);

create table if not exists public.combats (
  id_combat text primary key,
  id_judoka text not null,
  id_competition text not null,
  adversaire text not null default '',
  resultat text not null,
  deroule text not null default '',
  type_victoire text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint combats_id_judoka_fkey
    foreign key (id_judoka)
    references public.judokas (id_judoka)
    on update cascade
    on delete restrict,
  constraint combats_id_competition_fkey
    foreign key (id_competition)
    references public.competitions (id_competition)
    on update cascade
    on delete cascade,
  constraint combats_resultat_check check (resultat in ('Victoire', 'Défaite', 'Egalité', 'V', 'D', 'E'))
);

create table if not exists public.parent_judokas (
  id_parent text not null,
  id_judoka text not null,
  primary key (id_parent, id_judoka),
  constraint parent_judokas_id_parent_fkey
    foreign key (id_parent) references public.judokas (id_judoka)
    on update cascade on delete cascade,
  constraint parent_judokas_id_judoka_fkey
    foreign key (id_judoka) references public.judokas (id_judoka)
    on update cascade on delete cascade
);

create table if not exists public.access_invitations (
  email text primary key,
  invited_profile_type text not null default 'JUDOKA',
  invited_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_invitations_email_not_blank check (btrim(email) <> ''),
  constraint access_invitations_invited_profile_type_check
    check (invited_profile_type in ('JUDOKA', 'PARENT')),
  constraint access_invitations_invited_by_fkey
    foreign key (invited_by) references public.judokas (id_judoka)
    on update cascade
    on delete cascade
);

alter table public.competitions
  add column if not exists classement text not null default '',
  add column if not exists club_competition_id text,
  drop column if exists lieu,
  drop column if exists poids_pesee;

alter table public.competitions
  drop constraint if exists competitions_club_competition_id_fkey;

alter table public.competitions
  add constraint competitions_club_competition_id_fkey
  foreign key (club_competition_id)
  references public.club_competitions (id_club_competition)
  on update cascade
  on delete set null;

alter table public.judokas
  add column if not exists notes_coach text not null default '';

alter table public.judokas
  add column if not exists categorie_age text not null default '';

alter table public.judokas
  add column if not exists categorie_poids text not null default '';

alter table public.judokas
  add column if not exists couleur_ceinture text not null default '';

alter table public.judokas
  add column if not exists pending_parent_email text;

create index if not exists judokas_pending_parent_email_idx
  on public.judokas (lower(pending_parent_email))
  where pending_parent_email is not null;

alter table public.competitions
  add column if not exists niveau text not null default '';

alter table public.competitions
  add column if not exists coach_objective text not null default '',
  add column if not exists coach_review text not null default '';

alter table public.competitions
  add column if not exists ai_analysis text not null default '';

alter table public.judokas
  drop constraint if exists judokas_role_check;

alter table public.judokas
  add constraint judokas_role_check
  check (role in ('NORMAL', 'COACH', 'ADMIN'));

alter table public.combats
  drop constraint if exists combats_resultat_check;

alter table public.combats
  add constraint combats_resultat_check
  check (resultat in ('Victoire', 'Défaite', 'Egalité', 'V', 'D', 'E'));

alter table public.combats
  add column if not exists garde_adversaire text not null default '',
  add column if not exists categorie_technique text not null default '';

create unique index if not exists judokas_email_idx
  on public.judokas (lower(email))
  where email is not null;

create index if not exists competitions_id_judoka_idx
  on public.competitions (id_judoka);

create index if not exists competitions_date_idx
  on public.competitions (date desc);

create index if not exists competitions_club_competition_id_idx
  on public.competitions (club_competition_id);

create index if not exists combats_id_judoka_idx
  on public.combats (id_judoka);

create index if not exists combats_id_competition_idx
  on public.combats (id_competition);

create index if not exists parent_judokas_id_judoka_idx
  on public.parent_judokas (id_judoka);

create unique index if not exists access_invitations_email_idx
  on public.access_invitations (lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists judokas_set_updated_at on public.judokas;
create trigger judokas_set_updated_at
before update on public.judokas
for each row
execute function public.set_updated_at();

drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at
before update on public.competitions
for each row
execute function public.set_updated_at();

drop trigger if exists club_competitions_set_updated_at on public.club_competitions;
create trigger club_competitions_set_updated_at
before update on public.club_competitions
for each row
execute function public.set_updated_at();

drop trigger if exists combats_set_updated_at on public.combats;
create trigger combats_set_updated_at
before update on public.combats
for each row
execute function public.set_updated_at();

drop trigger if exists access_invitations_set_updated_at on public.access_invitations;
create trigger access_invitations_set_updated_at
before update on public.access_invitations
for each row
execute function public.set_updated_at();

alter table public.judokas enable row level security;
alter table public.club_competitions enable row level security;
alter table public.competitions enable row level security;
alter table public.combats enable row level security;
alter table public.parent_judokas enable row level security;
alter table public.access_invitations enable row level security;

drop policy if exists "Allow all operations on judokas" on public.judokas;
drop policy if exists "Allow all operations on club_competitions" on public.club_competitions;
drop policy if exists "Allow all operations on competitions" on public.competitions;
drop policy if exists "Allow all operations on combats" on public.combats;
drop policy if exists "Allow all operations on parent_judokas" on public.parent_judokas;
drop policy if exists "Allow all operations on access_invitations" on public.access_invitations;

drop policy if exists "Service role access on judokas" on public.judokas;
create policy "Service role access on judokas"
on public.judokas
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role access on club_competitions" on public.club_competitions;
create policy "Service role access on club_competitions"
on public.club_competitions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role access on competitions" on public.competitions;
create policy "Service role access on competitions"
on public.competitions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role access on combats" on public.combats;
create policy "Service role access on combats"
on public.combats
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role access on parent_judokas" on public.parent_judokas;
create policy "Service role access on parent_judokas"
on public.parent_judokas
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role access on access_invitations" on public.access_invitations;
create policy "Service role access on access_invitations"
on public.access_invitations
for all
to service_role
using (true)
with check (true);

revoke all on table public.judokas from anon, authenticated;
revoke all on table public.club_competitions from anon, authenticated;
revoke all on table public.access_invitations from anon, authenticated;
revoke all on table public.competitions from anon, authenticated;
revoke all on table public.combats from anon, authenticated;
revoke all on table public.parent_judokas from anon, authenticated;

grant select, insert, update, delete on table public.judokas to service_role;
grant select, insert, update, delete on table public.club_competitions to service_role;
grant select, insert, update, delete on table public.access_invitations to service_role;
grant select, insert, update, delete on table public.competitions to service_role;
grant select, insert, update, delete on table public.combats to service_role;
grant select, insert, update, delete on table public.parent_judokas to service_role;

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
  v_email_name text := replace(split_part(v_email, '@', 1), '.', ' ');
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

  if v_prenom = '' then
    v_prenom := initcap(coalesce(nullif(split_part(v_email_name, ' ', 1), ''), 'Utilisateur'));
  end if;

  if v_nom = '' then
    v_nom := initcap(coalesce(nullif(btrim(regexp_replace(v_email_name, '^[^ ]+ ?', '')), ''), 'Kiroku'));
  end if;

  v_user_id := 'JUDO' || replace(gen_random_uuid()::text, '-', '');

  insert into public.judokas (id_judoka, email, prenom, nom, role, profile_type)
  values (v_user_id, v_email, v_prenom, v_nom, 'NORMAL', v_profile_type)
  returning * into v_user;

  delete from public.access_invitations
  where lower(email) = v_email;

  if v_profile_type = 'PARENT' then
    insert into public.parent_judokas (id_parent, id_judoka)
    select v_user_id, id_judoka
    from public.judokas
    where pending_parent_email is not null
      and lower(pending_parent_email) = v_email
    on conflict (id_parent, id_judoka) do nothing;

    update public.judokas
    set pending_parent_email = null
    where pending_parent_email is not null
      and lower(pending_parent_email) = v_email;
  end if;

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
revoke execute on function public.register_profile(text, text, text, text, jsonb) from authenticated, anon, public;

create or replace function public.hook_check_invited_signup(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  normalized_email text := lower(btrim(coalesce(event->'user'->>'email', '')));
begin
  if normalized_email = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Adresse email Google introuvable.',
        'http_code', 400
      )
    );
  end if;

  if exists (
    select 1
    from public.judokas
    where email is not null
      and lower(email) = normalized_email
  ) then
    return '{}'::jsonb;
  end if;

  if exists (
    select 1
    from public.access_invitations
    where lower(email) = normalized_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Accès non autorisé. Une invitation est requise.',
      'http_code', 403
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_check_invited_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_check_invited_signup(jsonb) from authenticated, anon, public;

grant select on table public.judokas to supabase_auth_admin;
grant select on table public.access_invitations to supabase_auth_admin;

drop policy if exists "Supabase auth admin read judokas for signup hook" on public.judokas;
create policy "Supabase auth admin read judokas for signup hook"
on public.judokas
for select
to supabase_auth_admin
using (true);

drop policy if exists "Supabase auth admin read invitations for signup hook" on public.access_invitations;
create policy "Supabase auth admin read invitations for signup hook"
on public.access_invitations
for select
to supabase_auth_admin
using (true);

insert into public.judokas (id_judoka, email, prenom, nom, role, profile_type)
values (
  'JUDO_MEHDI_EL_KOUHEN',
  'mehdi.elkouhen@gmail.com',
  'Mehdi',
  'EL KOUHEN',
  'ADMIN',
  'JUDOKA'
)
on conflict (email) do update
set
  prenom = excluded.prenom,
  nom = excluded.nom,
  role = excluded.role,
  profile_type = excluded.profile_type,
  updated_at = now();
