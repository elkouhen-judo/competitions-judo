const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

const entryPoints = ["core/shared/ids.ts", "core/shared/text.ts"];

esbuild
  .build({
    entryPoints: entryPoints.map((entry) => path.join(root, entry)),
    outdir: path.join(root, "core-dist"),
    outbase: path.join(root, "core"),
    bundle: false,
    platform: "node",
    format: "cjs",
    target: "node20",
    charset: "utf8",
    sourcemap: false,
    logLevel: "info"
  })
  .catch(() => process.exit(1));
