// Active les gates locales (.githooks/) ; sans dépôt git (build Vercel), ne fait rien.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");

if (fs.existsSync(path.join(root, ".git"))) {
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "inherit" });
}
