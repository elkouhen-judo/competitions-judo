// Remplit .personal-data-denylist (ignoré par git) avec les noms complets et e-mails réels de la base,
// pour que la gate GAT-010 les refuse dans le code. Rien de ce fichier n'est commité.
// Usage : npm run privacy:refresh [-- --remote=<ref Supabase>] (prod par défaut).
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const DENYLIST_PATH = path.join(root, ".personal-data-denylist");
const PROD_PROJECT_REF = "dqtdbfmehwdexikkblwg";

const SQL = `
select btrim(prenom) || ' ' || btrim(nom) as term from public.judokas
union select btrim(nom) || ' ' || btrim(prenom) from public.judokas
union select email from public.judokas where email is not null
union select pending_parent_email from public.judokas where pending_parent_email is not null
union select email from public.access_invitations
`;

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function main() {
  const ref = argument("remote", PROD_PROJECT_REF);
  const result = spawnSync("supabase", ["db", "query", `--remote=${ref}`, "--yes", SQL], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const output = result.stdout || "";
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (result.status !== 0 || start === -1) {
    throw new Error(`Lecture Supabase impossible : ${result.stderr || output}`);
  }
  const rows = JSON.parse(output.slice(start, end + 1)).rows || [];
  const terms = [
    ...new Set(rows.map((row) => String(row.term || "").trim()).filter(Boolean))
  ].sort();
  fs.writeFileSync(
    DENYLIST_PATH,
    `# Généré par npm run privacy:refresh (${ref}). Ne jamais commiter ce fichier.\n${terms.join("\n")}\n`,
    { mode: 0o600 }
  );
  console.log(`${terms.length} termes écrits dans .personal-data-denylist.`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
