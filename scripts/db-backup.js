const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const backupRoot = path.join(root, "backups", "supabase");
const configRoot = path.join(root, ".backup");
const retentionCount = 7;

function argument(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Configuration absente : ${filePath}\nCopiez .backup/.env.example puis renseignez SUPABASE_PROJECT_REF ou SUPABASE_DB_URL.`);
  }

  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    values[key.trim()] = rest.join("=").trim().replace(/^"(.*)"$/, "$1");
  }
  return values;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...options.env }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} a échoué avec le code ${result.status}.`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listBackupDirectories(environment) {
  const environmentRoot = path.join(backupRoot, environment);
  if (!fs.existsSync(environmentRoot)) return [];
  return fs.readdirSync(environmentRoot)
    .map((name) => path.join(environmentRoot, name))
    .filter((entry) => fs.statSync(entry).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function prune(environment) {
  const directories = listBackupDirectories(environment);
  for (const oldDirectory of directories.slice(retentionCount)) {
    fs.rmSync(oldDirectory, { recursive: true, force: true });
    console.log(`Backup supprimé (rétention ${retentionCount}) : ${oldDirectory}`);
  }
}

function main() {
  const environment = argument("environment", "prod");
  if (!["prod", "dev"].includes(environment)) {
    throw new Error("--environment doit être prod ou dev.");
  }

  const configPath = path.join(configRoot, `.env.${environment}`);
  const config = readEnvFile(configPath);
  const databaseUrl = process.env[`SUPABASE_DB_URL_${environment.toUpperCase()}`] || config.SUPABASE_DB_URL;
  const projectRef = process.env[`SUPABASE_PROJECT_REF_${environment.toUpperCase()}`] || config.SUPABASE_PROJECT_REF;
  if (!databaseUrl && !projectRef) throw new Error(`SUPABASE_PROJECT_REF ou SUPABASE_DB_URL absent de ${configPath}.`);

  const environmentRoot = path.join(backupRoot, environment);
  fs.mkdirSync(environmentRoot, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDirectory = path.join(environmentRoot, timestamp);
  fs.mkdirSync(outputDirectory, { mode: 0o700 });
  const lockPath = path.join(environmentRoot, ".backup.lock");

  if (fs.existsSync(lockPath)) throw new Error(`Un autre backup semble être en cours : ${lockPath}`);
  fs.writeFileSync(lockPath, `${process.pid}\n`, { mode: 0o600 });

  try {
    const supabase = process.env.SUPABASE_CLI_BIN || (fs.existsSync("/opt/homebrew/bin/supabase") ? "/opt/homebrew/bin/supabase" : "supabase");
    const common = ["db", "dump", projectRef ? "--project-ref" : "--db-url", projectRef || databaseUrl];
    const commandEnv = { SUPABASE_CLI_TELEMETRY_OPTOUT: "1" };
    run(supabase, [...common, "--file", path.join(outputDirectory, "schema.sql")], { env: commandEnv });
    run(supabase, [...common, "--data-only", "--use-copy", "--file", path.join(outputDirectory, "data.sql")], { env: commandEnv });
    run(supabase, [...common, "--role-only", "--file", path.join(outputDirectory, "roles.sql")], { env: commandEnv });

    const files = ["schema.sql", "data.sql", "roles.sql"];
    const manifest = {
      createdAt: new Date().toISOString(),
      host: os.hostname(),
      environment,
      files: Object.fromEntries(files.map((file) => [file, { bytes: fs.statSync(path.join(outputDirectory, file)).size, sha256: sha256(path.join(outputDirectory, file)) }]))
    };
    fs.writeFileSync(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    prune(environment);
    console.log(`Backup Supabase créé : ${outputDirectory}`);
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`Backup impossible : ${error.message}`);
  process.exit(1);
}
