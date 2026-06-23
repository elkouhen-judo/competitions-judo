const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const coreDir = path.join(root, "core");

// `types.ts` files are type-only (erased at compile time, no runtime behavior) — see the
// doc comment on core/types.ts. They have no esbuild entry and no core-dist/ output.
function listCoreEntryPoints(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts") && path.basename(entry) !== "types.ts")
    .map((entry) => path.join(dir, entry))
    .sort();
}

const entryPoints = listCoreEntryPoints(coreDir);

esbuild
  .build({
    entryPoints,
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
