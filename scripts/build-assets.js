const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

const entryPoints = ["assets/app-notifications.ts"];

esbuild
  .build({
    entryPoints: entryPoints.map((entry) => path.join(root, entry)),
    outdir: path.join(root, "assets", "dist"),
    bundle: false,
    target: "es2022",
    sourcemap: false,
    logLevel: "info"
  })
  .catch(() => process.exit(1));
