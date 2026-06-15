const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(_req, res) {
  const clientFiles = [
    "vendor/vue.global.prod.js",
    "app-ui.js",
    "app-auth.js",
    "app-screen-projections.js",
    "app-screen-login.js",
    "app-screen-home.js",
    "app-judoka-presentation.js",
    "app-screen-judoka.js",
    "app-screen-competition.js",
    "app-screen-children.js",
    "app-screen-admins.js",
    "app-runtime.js",
    "app.js"
  ];
  // Compiled from assets/app-notifications.ts by `npm run build:assets` (scripts/build-assets.js).
  const builtClientFiles = { "app-ui.js": ["app-notifications.js"] };
  const client = clientFiles
    .flatMap((file) => [
      fs.readFileSync(path.join(process.cwd(), "assets", file), "utf8"),
      ...(builtClientFiles[file] || []).map((builtFile) =>
        fs.readFileSync(path.join(process.cwd(), "assets", "dist", builtFile), "utf8")
      )
    ])
    .join("\n\n");

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(client);
};
