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
  niveau text not null default '',
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
  constraint combats_resultat_check check (resultat in ('Victoire', 'Défaite', 'Egalité'))
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
  add column if not exists categorie_age text not null default '';

alter table public.judokas
  add column if not exists categorie_poids text not null default '';

alter table public.judokas
  add column if not exists couleur_ceinture text not null default '';

alter table public.judokas
  add column if not exists genre text not null default '';

alter table public.judokas
  add column if not exists annee_categorie text not null default '';

alter table public.judokas
  add column if not exists lateralite text not null default '';

alter table public.judokas
  add column if not exists pending_parent_email text;

alter table public.club_competitions
  add column if not exists niveau text not null default '';

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
  check (resultat in ('Victoire', 'Défaite', 'Egalité'));

alter table public.combats
  add column if not exists garde_adversaire text not null default '';

alter table public.combats
  add column if not exists etape text not null default '';

alter table public.combats
  drop constraint if exists combats_etape_check;

alter table public.combats
  add constraint combats_etape_check
  check (etape in ('', 'Poule', '1/32', '1/16', '1/8', '1/4', '1/2', 'Finale', 'Repêchage', 'Place de 3'));

alter table public.combats
  drop column if exists categorie_technique;

alter table public.judokas
  drop column if exists notes_coach;

create table if not exists public.combat_scores (
  id_combat_score text primary key,
  id_combat text not null,
  categorie text not null,
  technique text not null default '',
  type_ne_waza text not null default '',
  valeur text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  constraint combat_scores_id_combat_fkey
    foreign key (id_combat)
    references public.combats (id_combat)
    on update cascade
    on delete cascade,
  constraint combat_scores_categorie_check check (categorie in ('Tachi-waza', 'Ne-waza')),
  constraint combat_scores_valeur_check check (valeur in ('Ippon', 'Waza-ari', 'Yuko'))
);

create index if not exists combat_scores_id_combat_idx
  on public.combat_scores (id_combat);

-- Points subis : le même tableau porte les points du judoka (JUDOKA) et ceux de l'adversaire (ADVERSAIRE).
alter table public.combat_scores
  add column if not exists camp text not null default 'JUDOKA';

alter table public.combat_scores
  drop constraint if exists combat_scores_camp_check;

alter table public.combat_scores
  add constraint combat_scores_camp_check check (camp in ('JUDOKA', 'ADVERSAIRE'));

-- Score officiel IWY - IWY, saisi à part des points détaillés. Vide (null) = non renseigné.
alter table public.combats
  add column if not exists score_judoka_ippon smallint,
  add column if not exists score_judoka_wazaari smallint,
  add column if not exists score_judoka_yuko smallint,
  add column if not exists score_adversaire_ippon smallint,
  add column if not exists score_adversaire_wazaari smallint,
  add column if not exists score_adversaire_yuko smallint;

alter table public.combats
  drop constraint if exists combats_score_check;

alter table public.combats
  add constraint combats_score_check check (
    (
      score_judoka_ippon is null and score_judoka_wazaari is null and score_judoka_yuko is null
      and score_adversaire_ippon is null and score_adversaire_wazaari is null and score_adversaire_yuko is null
    )
    or (
      score_judoka_ippon between 0 and 9 and score_judoka_wazaari between 0 and 9 and score_judoka_yuko between 0 and 9
      and score_adversaire_ippon between 0 and 9 and score_adversaire_wazaari between 0 and 9 and score_adversaire_yuko between 0 and 9
    )
  );

-- COMBAT-SHIDO : shidos de chaque camp, rattachés au score officiel (null = score non renseigné).
alter table public.combats
  add column if not exists score_judoka_shido smallint,
  add column if not exists score_adversaire_shido smallint;

alter table public.combats
  drop constraint if exists combats_shido_check;

alter table public.combats
  add constraint combats_shido_check check (
    (score_judoka_shido is null or score_judoka_shido between 0 and 3)
    and (score_adversaire_shido is null or score_adversaire_shido between 0 and 3)
  );

-- SCORE-VIDE : un score entièrement nul (0 0 0 - 0 0 0, sans shido) ne dit rien ; il venait d'un
-- combat sans score relu à tort comme renseigné puis réenregistré. Il redevient « non renseigné ».
update public.combats
set
  score_judoka_ippon = null,
  score_judoka_wazaari = null,
  score_judoka_yuko = null,
  score_adversaire_ippon = null,
  score_adversaire_wazaari = null,
  score_adversaire_yuko = null,
  score_judoka_shido = null,
  score_adversaire_shido = null
where score_judoka_ippon = 0 and score_judoka_wazaari = 0 and score_judoka_yuko = 0
  and score_adversaire_ippon = 0 and score_adversaire_wazaari = 0 and score_adversaire_yuko = 0
  and coalesce(score_judoka_shido, 0) = 0 and coalesce(score_adversaire_shido, 0) = 0;

-- COMBAT-TECH-OPT : un point peut être enregistré avant de connaître la technique (catégorie vide).
alter table public.combat_scores
  drop constraint if exists combat_scores_categorie_check;

alter table public.combat_scores
  add constraint combat_scores_categorie_check check (categorie in ('Tachi-waza', 'Ne-waza', ''));

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
alter table public.combat_scores enable row level security;
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

drop policy if exists "Service role access on combat_scores" on public.combat_scores;
create policy "Service role access on combat_scores"
on public.combat_scores
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
revoke all on table public.combat_scores from anon, authenticated;
revoke all on table public.parent_judokas from anon, authenticated;

grant select, insert, update, delete on table public.judokas to service_role;
grant select, insert, update, delete on table public.club_competitions to service_role;
grant select, insert, update, delete on table public.access_invitations to service_role;
grant select, insert, update, delete on table public.competitions to service_role;
grant select, insert, update, delete on table public.combats to service_role;
grant select, insert, update, delete on table public.combat_scores to service_role;
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

alter table public.club_competitions
  drop column if exists categorie_poids;


-- Aucun compte n'est créé par la migration : le premier admin est désigné par une requête
-- ponctuelle (update public.judokas set is_admin = true where email = '<email>').

-- Clubs : un judoka appartient à au plus un club, un coach coache un ou plusieurs clubs,
-- une compétition club appartient à un club. L'accès coach est limité aux judokas de ses clubs.
create table if not exists public.clubs (
  id_club text primary key,
  nom text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clubs_nom_not_blank check (btrim(nom) <> '')
);

create unique index if not exists clubs_nom_unique_idx on public.clubs (lower(btrim(nom)));

create table if not exists public.coach_clubs (
  id_coach text not null,
  id_club text not null,
  primary key (id_coach, id_club),
  constraint coach_clubs_id_coach_fkey
    foreign key (id_coach) references public.judokas (id_judoka)
    on update cascade on delete cascade,
  constraint coach_clubs_id_club_fkey
    foreign key (id_club) references public.clubs (id_club)
    on update cascade on delete cascade
);

alter table public.judokas
  add column if not exists club_id text;

alter table public.judokas
  drop constraint if exists judokas_club_id_fkey;

alter table public.judokas
  add constraint judokas_club_id_fkey
  foreign key (club_id) references public.clubs (id_club)
  on update cascade on delete restrict;

create index if not exists judokas_club_id_idx on public.judokas (club_id);

-- Droit admin indépendant du rôle : un coach peut aussi être admin.
alter table public.judokas
  add column if not exists is_admin boolean not null default false;

alter table public.club_competitions
  add column if not exists club_id text;

alter table public.club_competitions
  drop constraint if exists club_competitions_club_id_fkey;

alter table public.club_competitions
  add constraint club_competitions_club_id_fkey
  foreign key (club_id) references public.clubs (id_club)
  on update cascade on delete restrict;

create index if not exists club_competitions_club_id_idx on public.club_competitions (club_id);

drop trigger if exists clubs_set_updated_at on public.clubs;
create trigger clubs_set_updated_at
before update on public.clubs
for each row
execute function public.set_updated_at();

alter table public.clubs enable row level security;
alter table public.coach_clubs enable row level security;

drop policy if exists "Service role access on clubs" on public.clubs;
create policy "Service role access on clubs"
on public.clubs
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role access on coach_clubs" on public.coach_clubs;
create policy "Service role access on coach_clubs"
on public.coach_clubs
for all
to service_role
using (true)
with check (true);

revoke all on table public.clubs from anon, authenticated;
revoke all on table public.coach_clubs from anon, authenticated;

grant select, insert, update, delete on table public.clubs to service_role;
grant select, insert, update, delete on table public.coach_clubs to service_role;

-- STAT-17 : données du tableau de bord coach en un appel : les compétitions du périmètre
-- (clubs ou judokas autorisés, dates, catégorie d'âge), les combats des compétitions choisies
-- (toutes si aucune) et leurs points. Rien n'est calculé ici : les statistiques restent en
-- TypeScript. Le contrôle d'accès du coach est fait dans la fonction Vercel, avant l'appel.
create or replace function public.coach_dashboard_data(
  p_club_ids text[] default '{}',
  p_judoka_ids text[] default '{}',
  p_date_from date default null,
  p_date_to date default null,
  p_age_category text default null,
  p_competition_ids text[] default '{}'
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with scoped as (
    select c.*
    from public.competitions c
    left join public.judokas j on j.id_judoka = c.id_judoka
    where (
        j.club_id = any(coalesce(p_club_ids, '{}'::text[]))
        or c.id_judoka = any(coalesce(p_judoka_ids, '{}'::text[]))
      )
      and (p_date_from is null or c.date >= p_date_from)
      and (p_date_to is null or c.date <= p_date_to)
      and (coalesce(p_age_category, '') = '' or c.categorie_age = p_age_category)
  ),
  selected_combats as (
    select cb.*
    from public.combats cb
    join scoped s on s.id_competition = cb.id_competition
    where coalesce(cardinality(p_competition_ids), 0) = 0
      or cb.id_competition = any(p_competition_ids)
  )
  select jsonb_build_object(
    'competitions',
    coalesce(
      (select jsonb_agg(to_jsonb(s) order by s.date desc, s.id_competition) from scoped s),
      '[]'::jsonb
    ),
    'combats',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(cb) || jsonb_build_object(
            'combat_scores',
            coalesce(
              (
                select jsonb_agg(to_jsonb(cs) order by cs.ordre, cs.id_combat_score)
                from public.combat_scores cs
                where cs.id_combat = cb.id_combat
              ),
              '[]'::jsonb
            )
          )
          order by cb.created_at, cb.id_combat
        )
        from selected_combats cb
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.coach_dashboard_data(text[], text[], date, date, text, text[]) to service_role;
revoke execute on function public.coach_dashboard_data(text[], text[], date, date, text, text[]) from authenticated, anon, public;
