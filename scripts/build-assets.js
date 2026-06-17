const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

const entryPoints = [
  "assets/app-notifications.ts",
  "assets/app-ui.ts",
  "assets/app-auth.ts",
  "assets/app-screen-projections.ts",
  "assets/app-screen-login.ts",
  "assets/app-screen-home.ts",
  "assets/app-judoka-presentation.ts",
  "assets/app-screen-judoka.ts",
  "assets/app-screen-competition.ts",
  "assets/app-screen-admins.ts",
  "assets/app-runtime.ts",
  "assets/app.ts"
];

esbuild
  .build({
    entryPoints: entryPoints.map((entry) => path.join(root, entry)),
    outdir: path.join(root, "assets", "dist"),
    bundle: false,
    target: "es2022",
    charset: "utf8",
    sourcemap: false,
    logLevel: "info"
  })
  .catch(() => process.exit(1));
