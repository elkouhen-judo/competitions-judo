-- Initial Supabase schema for the judo competition tracker.
-- Existing Google Sheets identifiers are kept as text to simplify import.

create table if not exists public.judokas (
  id_judoka text primary key,
  email text not null unique,
  prenom text not null,
  nom text not null,
  role text not null default 'JUDOKA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint judokas_role_check check (role in ('ADMIN', 'JUDOKA')),
  constraint judokas_email_not_blank check (btrim(email) <> ''),
  constraint judokas_prenom_not_blank check (btrim(prenom) <> ''),
  constraint judokas_nom_not_blank check (btrim(nom) <> '')
);

create table if not exists public.competitions (
  id_competition text primary key,
  id_judoka text not null,
  nom text not null,
  date date not null,
  lieu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_id_judoka_fkey
    foreign key (id_judoka)
    references public.judokas (id_judoka)
    on update cascade
    on delete restrict,
  constraint competitions_nom_not_blank check (btrim(nom) <> '')
);

create table if not exists public.combats (
  id_combat text primary key,
  id_judoka text not null,
  id_competition text not null,
  adversaire text not null default '',
  resultat text not null,
  commentaire text not null default '',
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
  constraint combats_resultat_check check (resultat in ('V', 'D'))
);

create index if not exists judokas_email_idx
  on public.judokas (lower(email));

create index if not exists competitions_id_judoka_idx
  on public.competitions (id_judoka);

create index if not exists competitions_date_idx
  on public.competitions (date desc);

create index if not exists combats_id_judoka_idx
  on public.combats (id_judoka);

create index if not exists combats_id_competition_idx
  on public.combats (id_competition);

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

drop trigger if exists combats_set_updated_at on public.combats;
create trigger combats_set_updated_at
before update on public.combats
for each row
execute function public.set_updated_at();

alter table public.judokas enable row level security;
alter table public.competitions enable row level security;
alter table public.combats enable row level security;
