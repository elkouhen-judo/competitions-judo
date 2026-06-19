const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(_req, res) {
  const vendorFile = fs.readFileSync(
    path.join(process.cwd(), "assets", "vendor", "vue.global.prod.js"),
    "utf8"
  );
  // Compiled from assets/*.ts by `npm run build:assets` (scripts/build-assets.js).
  const builtClientFiles = [
    "app-ui.js",
    "app-notifications.js",
    "app-auth.js",
    "app-screen-projections.js",
    "app-screen-login.js",
    "app-screen-home.js",
    "app-judoka-presentation.js",
    "app-screen-judoka.js",
    "app-competition-form-helpers.js",
    "app-screen-competition.js",
    "app-screen-admins.js",
    "app-screen-coach-dashboard.js",
    "app-runtime.js",
    "app.js"
  ];
  const client = [
    vendorFile,
    ...builtClientFiles.map((file) =>
      fs.readFileSync(path.join(process.cwd(), "assets", "dist", file), "utf8")
    )
  ].join("\n\n");

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(client);
};
