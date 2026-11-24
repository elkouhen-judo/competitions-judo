// Gate « aucune donnée personnelle commitée » (GAT-010).
// --staged : lignes ajoutées au commit en cours ; --message=<fichier> : message de commit ;
// --all : tous les fichiers suivis et tous les messages de commit (gate de déploiement).
// Les noms réels ne sont jamais écrits dans le dépôt : ils viennent d'un fichier local ignoré par git,
// .personal-data-denylist (un terme par ligne), rempli par npm run privacy:refresh.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const DENYLIST_PATH = path.join(root, ".personal-data-denylist");

// Domaines fictifs (RFC 2606) et adresses publiques d'organisations ou de services.
const ALLOWED_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "example.invalid",
  "anthropic.com",
  "ffjudo.com",
  "users.noreply.github.com"
];
const ALLOWED_EMAIL_SUFFIXES = [".test", ".example", ".invalid", ".localhost", ".local"];
const SKIPPED_FILES = new Set(["package-lock.json", ".personal-data-denylist"]);
const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip|gz)$/i;

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
// Identifiants générés par core/shared/ids.ts : préfixe de 4 lettres et UUID sans tirets.
const DATABASE_ID = /\b[A-Z]{4}[0-9a-f]{32}\b/g;
const PHONE = /(?<![\w.-])(?:\+33[\s.]?|0)[67](?:[\s.-]?\d{2}){4}(?![\w])/g;

function isAllowedDomain(domain) {
  const lower = domain.toLowerCase();
  return (
    ALLOWED_EMAIL_DOMAINS.some((allowed) => lower === allowed || lower.endsWith(`.${allowed}`)) ||
    ALLOWED_EMAIL_SUFFIXES.some((suffix) => lower.endsWith(suffix))
  );
}

function normalize(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function loadDenylist(file = DENYLIST_PATH) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.length >= 4);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rend les problèmes d'un texte : { kind, value }. */
function findPersonalData(text, denylist = []) {
  const findings = [];
  for (const match of text.matchAll(EMAIL)) {
    if (!isAllowedDomain(match[1])) findings.push({ kind: "e-mail", value: match[0] });
  }
  for (const match of text.matchAll(DATABASE_ID)) {
    findings.push({ kind: "identifiant de la base", value: match[0] });
  }
  for (const match of text.matchAll(PHONE)) {
    // Un numéro de démonstration (06 00 00 00 00) n'est pas une donnée personnelle.
    const digits = match[0].replace(/\D/g, "").slice(-8);
    if (!/^(\d)\1{7}$/.test(digits)) findings.push({ kind: "téléphone", value: match[0] });
  }
  const normalizedText = normalize(text);
  for (const term of denylist) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(normalize(term))}(?![\\p{L}\\p{N}])`,
      "u"
    );
    if (pattern.test(normalizedText))
      findings.push({ kind: "nom réel (liste locale)", value: term });
  }
  return findings;
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} a échoué : ${result.stderr}`);
  return result.stdout;
}

function isScanned(file) {
  return !SKIPPED_FILES.has(path.basename(file)) && !BINARY_EXTENSIONS.test(file);
}

// Lignes ajoutées par fichier dans l'index.
function stagedSources() {
  const sources = [];
  let file = null;
  for (const line of git([
    "diff",
    "--cached",
    "--unified=0",
    "--no-color",
    "--diff-filter=ACMR"
  ]).split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.startsWith("+++ b/") ? line.slice(6) : null;
    } else if (file && line.startsWith("+") && isScanned(file)) {
      sources.push({ file, text: line.slice(1) });
    }
  }
  return sources;
}

function trackedSources() {
  return git(["ls-files", "-z"])
    .split("\0")
    .filter((file) => file && isScanned(file) && fs.existsSync(path.join(root, file)))
    .map((file) => ({ file, text: fs.readFileSync(path.join(root, file), "utf8") }));
}

// Messages de tous les commits : ils sont publiés avec le dépôt.
function commitMessageSources() {
  return git(["log", "--format=%H%x00%B%x01"])
    .split("\x01")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, message] = entry.split("\0");
      return { file: `message du commit ${hash.slice(0, 7)}`, text: message || "" };
    });
}

function main() {
  const messageArgument = process.argv.find((item) => item.startsWith("--message="));
  const sources = process.argv.includes("--all")
    ? [...trackedSources(), ...commitMessageSources()]
    : messageArgument
      ? [
          {
            file: "message de commit",
            text: fs.readFileSync(messageArgument.slice(10), "utf8").replace(/^#.*$/gm, "")
          }
        ]
      : stagedSources();
  const denylist = loadDenylist();
  const problems = [];
  for (const source of sources) {
    for (const finding of findPersonalData(source.text, denylist)) {
      problems.push(`${source.file} : ${finding.kind} « ${finding.value} »`);
    }
  }
  if (problems.length) {
    console.error("Données personnelles détectées :");
    [...new Set(problems)].forEach((problem) => console.error(`  - ${problem}`));
    console.error("Remplace-les par des données fictives (example.com, « Sam Test »…).");
    process.exit(1);
  }
  if (!denylist.length) {
    console.warn(
      "Contrôle des données personnelles : liste locale des noms absente (npm run privacy:refresh)."
    );
  }
}

if (require.main === module) {
  main();
}

module.exports = { findPersonalData, loadDenylist };
