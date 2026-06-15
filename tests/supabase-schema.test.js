const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
const schema = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf8"))
  .join("\n");

test("supabase schema defines the three business tables", () => {
  assert.match(schema, /create table if not exists public\.judokas/i);
  assert.match(schema, /create table if not exists public\.access_invitations/i);
  assert.match(schema, /create table if not exists public\.competitions/i);
  assert.match(schema, /create table if not exists public\.combats/i);
});

test("supabase schema preserves current text identifiers", () => {
  assert.match(schema, /id_judoka text primary key/i);
  assert.match(schema, /id_competition text primary key/i);
  assert.match(schema, /id_combat text primary key/i);
});

test("supabase schema protects relationships and cascade delete", () => {
  assert.match(
    schema,
    /competitions_id_judoka_fkey[\s\S]*references public\.judokas \(id_judoka\)/i
  );
  assert.match(schema, /combats_id_judoka_fkey[\s\S]*references public\.judokas \(id_judoka\)/i);
  assert.match(
    schema,
    /combats_id_competition_fkey[\s\S]*references public\.competitions \(id_competition\)[\s\S]*on delete cascade/i
  );
});

test("supabase schema includes role and result constraints", () => {
  assert.match(schema, /judokas_role_check[\s\S]*role in \('NORMAL', 'COACH', 'ADMIN'\)/i);
  assert.match(schema, /judokas_profile_type_check[\s\S]*profile_type in \('JUDOKA', 'PARENT'\)/i);
  assert.match(
    schema,
    /access_invitations_invited_profile_type_check[\s\S]*invited_profile_type in \('JUDOKA', 'PARENT'\)/i
  );
  assert.match(
    schema,
    /combats_resultat_check[\s\S]*resultat in \('Victoire', 'Défaite', 'Egalité', 'V', 'D', 'E'\)/i
  );
});

test("supabase schema stores club competitions and linked participations", () => {
  assert.match(schema, /create table if not exists public\.club_competitions/i);
  assert.match(schema, /id_club_competition text primary key/i);
  assert.match(
    schema,
    /competitions_club_competition_id_fkey[\s\S]*references public\.club_competitions \(id_club_competition\)[\s\S]*on delete set null/i
  );
  assert.match(schema, /add column if not exists club_competition_id text/i);
  assert.match(
    schema,
    /grant select,\s*insert,\s*update,\s*delete on table public\.club_competitions to service_role/i
  );
});

test("supabase schema enables row level security for app tables", () => {
  assert.match(schema, /alter table public\.judokas enable row level security/i);
  assert.match(schema, /alter table public\.access_invitations enable row level security/i);
  assert.match(schema, /alter table public\.competitions enable row level security/i);
  assert.match(schema, /alter table public\.combats enable row level security/i);
  assert.match(schema, /alter table public\.parent_judokas enable row level security/i);
});

test("supabase schema removes unused competition place and actual weight fields", () => {
  assert.match(schema, /drop column if exists lieu/i);
  assert.match(schema, /drop column if exists poids_pesee/i);
});

test("supabase schema stores final competition ranking for season stats", () => {
  assert.match(schema, /add column if not exists classement text not null default ''/i);
});

test("supabase schema blocks direct client table access", () => {
  assert.match(
    schema,
    /create policy "Service role access on access_invitations"[\s\S]*for all[\s\S]*to service_role[\s\S]*using\s*\(\s*true\s*\)[\s\S]*with check\s*\(\s*true\s*\)/i
  );
  assert.match(schema, /revoke all on table public\.judokas from anon,\s*authenticated/i);
  assert.match(
    schema,
    /revoke all on table public\.access_invitations from anon,\s*authenticated/i
  );
  assert.match(schema, /revoke all on table public\.competitions from anon,\s*authenticated/i);
  assert.match(schema, /revoke all on table public\.combats from anon,\s*authenticated/i);
  assert.match(schema, /revoke all on table public\.parent_judokas from anon,\s*authenticated/i);
  assert.match(
    schema,
    /grant select,\s*insert,\s*update,\s*delete on table public\.judokas to service_role/i
  );
  assert.match(
    schema,
    /grant select,\s*insert,\s*update,\s*delete on table public\.access_invitations to service_role/i
  );
  assert.match(
    schema,
    /grant select,\s*insert,\s*update,\s*delete on table public\.competitions to service_role/i
  );
  assert.match(
    schema,
    /grant select,\s*insert,\s*update,\s*delete on table public\.combats to service_role/i
  );
  assert.match(
    schema,
    /grant select,\s*insert,\s*update,\s*delete on table public\.parent_judokas to service_role/i
  );
});

test("supabase schema provides an invitation-only signup hook for auth", () => {
  assert.match(
    schema,
    /create or replace function public\.hook_check_invited_signup\(event jsonb\)/i
  );
  assert.match(schema, /from public\.judokas[\s\S]*lower\(email\) = normalized_email/i);
  assert.match(schema, /from public\.access_invitations[\s\S]*lower\(email\) = normalized_email/i);
  assert.match(schema, /'Accès non autorisé\. Une invitation est requise\.'/i);
  assert.match(schema, /grant usage on schema public to supabase_auth_admin/i);
  assert.match(
    schema,
    /grant execute on function public\.hook_check_invited_signup\(jsonb\) to supabase_auth_admin/i
  );
  assert.match(schema, /grant select on table public\.judokas to supabase_auth_admin/i);
  assert.match(schema, /grant select on table public\.access_invitations to supabase_auth_admin/i);
  assert.match(
    schema,
    /create policy "Supabase auth admin read judokas for signup hook"[\s\S]*for select[\s\S]*to supabase_auth_admin[\s\S]*using\s*\(\s*true\s*\)/i
  );
  assert.match(
    schema,
    /create policy "Supabase auth admin read invitations for signup hook"[\s\S]*for select[\s\S]*to supabase_auth_admin[\s\S]*using\s*\(\s*true\s*\)/i
  );
});
