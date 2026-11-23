const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { runSupabaseQuery, loadEnvLocal, getProjectRef } = require("./supabase-query");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260612000000_initial_schema.sql"
);

const environmentsByProjectRef = {
  dqtdbfmehwdexikkblwg: "prod",
  ogjrxvoqrjstlarwennh: "dev"
};

// Gate : sauvegarde de la base visée par .env.local avant toute migration.
// Contournement d'urgence : npm run db:deploy -- --skip-backup
function backupTargetDatabase() {
  if (process.argv.includes("--skip-backup")) {
    console.warn("Sauvegarde ignorée (--skip-backup).");
    return;
  }
  const projectRef = getProjectRef(loadEnvLocal());
  const environment = environmentsByProjectRef[projectRef];
  if (!environment) {
    throw new Error(`Projet Supabase inconnu (${projectRef}) : sauvegarde impossible.`);
  }
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "db-backup.js"), `--environment=${environment}`],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error("Sauvegarde en échec : migration annulée.");
}

async function main() {
  backupTargetDatabase();
  const sql = fs.readFileSync(migrationPath, "utf8");
  await runSupabaseQuery(sql);
  console.log("Migration appliquée.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
