const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const schemaPath = path.join(__dirname, "..", "supabase", "migrations", "20260610000000_initial_schema.sql");
const schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";

test("supabase schema defines the three business tables", () => {
  assert.match(schema, /create table if not exists public\.judokas/i);
  assert.match(schema, /create table if not exists public\.competitions/i);
  assert.match(schema, /create table if not exists public\.combats/i);
});

test("supabase schema preserves current text identifiers", () => {
  assert.match(schema, /id_judoka text primary key/i);
  assert.match(schema, /id_competition text primary key/i);
  assert.match(schema, /id_combat text primary key/i);
});

test("supabase schema protects relationships and cascade delete", () => {
  assert.match(schema, /competitions_id_judoka_fkey[\s\S]*references public\.judokas \(id_judoka\)/i);
  assert.match(schema, /combats_id_judoka_fkey[\s\S]*references public\.judokas \(id_judoka\)/i);
  assert.match(schema, /combats_id_competition_fkey[\s\S]*references public\.competitions \(id_competition\)[\s\S]*on delete cascade/i);
});

test("supabase schema includes role and result constraints", () => {
  assert.match(schema, /judokas_role_check[\s\S]*role in \('ADMIN', 'JUDOKA'\)/i);
  assert.match(schema, /combats_resultat_check[\s\S]*resultat in \('V', 'D', 'E'\)/i);
});

test("supabase schema enables row level security for app tables", () => {
  assert.match(schema, /alter table public\.judokas enable row level security/i);
  assert.match(schema, /alter table public\.competitions enable row level security/i);
  assert.match(schema, /alter table public\.combats enable row level security/i);
});
