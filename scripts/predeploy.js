// Gate de déploiement : code commité (et poussé pour la prod), typage, lint, formatage, tests.
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");

function argument(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} a échoué.`);
}

function checkGit(environment) {
  const changes = git("status", "--porcelain", "--untracked-files=no");
  if (changes) {
    throw new Error(`Des fichiers suivis ne sont pas commités :\n${changes}`);
  }
  if (environment !== "prod") return;

  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== "main")
    throw new Error(`La prod se déploie depuis main (branche actuelle : ${branch}).`);
  const upstream = git("rev-parse", "@{u}");
  if (!upstream || upstream !== git("rev-parse", "HEAD")) {
    throw new Error("main n'est pas identique à origin/main : pousse avant de déployer la prod.");
  }
}

function main() {
  const environment = argument("environment");
  if (!["prod", "dev"].includes(environment)) {
    throw new Error("--environment doit être prod ou dev.");
  }
  checkGit(environment);
  run("npm", ["run", "--silent", "check"]);
  run("npm", ["test"]);
  console.log(`Gate de déploiement ${environment} : OK.`);
}

try {
  main();
} catch (error) {
  console.error(`Déploiement bloqué : ${error.message}`);
  process.exit(1);
}
