const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const backupRoot = path.join(root, "backups", "supabase");
const configRoot = path.join(root, ".backup");

function argument(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Configuration absente : ${filePath}`);
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    values[key.trim()] = rest.join("=").trim().replace(/^"(.*)"$/, "$1");
  }
  return values;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} a échoué avec le code ${result.status}.`);
}

function verifyManifest(directory) {
  const manifestPath = path.join(directory, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json absent de ${directory}.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const [file, expected] of Object.entries(manifest.files || {})) {
    const filePath = path.join(directory, file);
    if (!fs.existsSync(filePath)) throw new Error(`${file} absent de ${directory}.`);
    const actual = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    if (actual !== expected.sha256) throw new Error(`Checksum invalide pour ${file}.`);
  }
}

function main() {
  const environment = argument("environment", "prod");
  const target = argument("target", environment);
  const backup = argument("backup", "latest");
  if (!["prod", "dev"].includes(environment) || !["prod", "dev"].includes(target)) {
    throw new Error("--environment et --target doivent être prod ou dev.");
  }
  if (target === "prod" && process.env.CONFIRM_PROD_RESTORE !== "yes") {
    throw new Error("Restauration production bloquée. Ajoutez CONFIRM_PROD_RESTORE=yes après vérification.");
  }
  if (process.env.CONFIRM_RESTORE !== "yes") {
    throw new Error("Restauration bloquée. Ajoutez CONFIRM_RESTORE=yes après vérification.");
  }

  const environmentRoot = path.join(backupRoot, environment);
  const directories = fs.existsSync(environmentRoot)
    ? fs.readdirSync(environmentRoot).map((name) => path.join(environmentRoot, name)).filter((entry) => fs.statSync(entry).isDirectory()).sort().reverse()
    : [];
  const directory = backup === "latest" ? directories[0] : path.resolve(backup);
  if (!directory || !fs.existsSync(directory)) throw new Error(`Backup introuvable : ${backup}`);
  verifyManifest(directory);

  const config = readEnvFile(path.join(configRoot, `.env.${target}`));
  const databaseUrl = process.env[`SUPABASE_DB_URL_${target.toUpperCase()}`] || config.SUPABASE_DB_URL;
  if (!databaseUrl) throw new Error(`SUPABASE_DB_URL absent pour ${target}.`);
  const psql = process.env.PSQL_BIN || "/opt/homebrew/opt/libpq/bin/psql";

  console.log(`Restauration ${environment} → ${target} depuis ${directory}`);
  run(psql, ["--dbname", databaseUrl, "--single-transaction", "--set", "ON_ERROR_STOP=1", "--file", path.join(directory, "schema.sql")]);
  run(psql, ["--dbname", databaseUrl, "--single-transaction", "--set", "ON_ERROR_STOP=1", "--file", path.join(directory, "data.sql")]);
  console.log("Restauration terminée. Vérifiez les données avec : npm run db:check");
}

try {
  main();
} catch (error) {
  console.error(`Restauration impossible : ${error.message}`);
  process.exit(1);
}
