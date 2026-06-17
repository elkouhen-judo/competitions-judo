const fs = require("node:fs");
const path = require("node:path");
const { runSupabaseQuery } = require("./supabase-query");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260612000000_initial_schema.sql"
);

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  await runSupabaseQuery(sql);
  console.log("Migration appliquée.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
