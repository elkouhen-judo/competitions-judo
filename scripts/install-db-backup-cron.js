const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "db-backup.js");
const log = path.join(root, "backups", "supabase", "cron.log");
const schedule = process.env.BACKUP_CRON_SCHEDULE || "30 2 * * *";
const line = `${schedule} cd ${JSON.stringify(root)} && /usr/bin/env node ${JSON.stringify(script)} --environment=prod >> ${JSON.stringify(log)} 2>&1`;
const marker = "# kiroku-supabase-backup";

if (os.platform() !== "darwin") throw new Error("Ce programme installe le cron uniquement sur macOS.");
let current = "";
try {
  current = execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {}
const retained = current.split("\n").filter((entry) => !entry.includes(marker) && !entry.includes("scripts/db-backup.js --environment=prod")).filter(Boolean);
retained.push(marker, line);
execFileSync("crontab", ["-"], { input: `${retained.join("\n")}\n`, stdio: ["pipe", "inherit", "inherit"] });
console.log(`Cron installé : ${schedule} (tous les jours, heure locale) pour prod.`);
