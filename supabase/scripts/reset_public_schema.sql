-- DANGER: destructive reset for the current Kiroku application database.
-- Run this only when you intentionally want to delete all application data,
-- tables, functions, triggers, policies, and indexes from the public schema.
--
-- Supabase system schemas such as auth, storage, extensions, realtime, and
-- vault are intentionally not dropped.
--
-- After running this script, recreate the application schema by applying:
-- supabase/migrations/20260612000000_initial_schema.sql

begin;

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres;
grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant usage on schema public to service_role;
grant usage on schema public to supabase_auth_admin;

grant all privileges on schema public to postgres;
grant all privileges on schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to postgres;

alter default privileges in schema public
  grant all privileges on sequences to postgres;

alter default privileges in schema public
  grant all privileges on functions to postgres;

alter default privileges in schema public
  grant all privileges on tables to service_role;

alter default privileges in schema public
  grant all privileges on sequences to service_role;

alter default privileges in schema public
  grant all privileges on functions to service_role;

commit;
