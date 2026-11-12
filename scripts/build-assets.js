const crypto = require("node:crypto");
const fs = require("node:fs");
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
  "assets/app-competition-form-helpers.ts",
  "assets/app-screen-competition-form.ts",
  "assets/app-screen-club-competition.ts",
  "assets/app-screen-combat-form.ts",
  "assets/app-screen-competition.ts",
  "assets/app-screen-admins.ts",
  "assets/app-screen-coach-dashboard.ts",
  "assets/app-runtime.ts",
  "assets/app.ts"
];

// Every entry is transpile-only (bundle: false): screens load through the single
// /api/client concatenation and Vue is vendored as a global.
const transpileBuild = esbuild.build({
  entryPoints: entryPoints.map((entry) => path.join(root, entry)),
  outdir: path.join(root, "assets", "dist"),
  bundle: false,
  target: "es2022",
  charset: "utf8",
  sourcemap: false,
  logLevel: "info"
});

function contentHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

// SHELL-2 : un seul JS minifié (Vue, déjà minifié, puis les écrans dans l'ordre de chargement),
// un CSS minifié, et l'empreinte de chacun pour des URL mises en cache un an.
async function bundleForDelivery() {
  const dist = path.join(root, "assets", "dist");
  const minify = async (file, loader) =>
    (
      await esbuild.transform(fs.readFileSync(file, "utf8"), {
        loader,
        minify: true,
        target: "es2022",
        charset: "utf8"
      })
    ).code;

  const screens = await Promise.all(
    entryPoints.map((entry) => minify(path.join(dist, `${path.basename(entry, ".ts")}.js`), "js"))
  );
  const client = [
    fs.readFileSync(path.join(root, "assets", "vendor", "vue.global.prod.js"), "utf8"),
    ...screens
  ].join("\n");
  const styles = await minify(path.join(root, "assets", "app.css"), "css");

  fs.writeFileSync(path.join(dist, "client.min.js"), client);
  fs.writeFileSync(path.join(dist, "styles.min.css"), styles);
  fs.writeFileSync(
    path.join(dist, "asset-manifest.json"),
    JSON.stringify({ client: contentHash(client), styles: contentHash(styles) })
  );
}

transpileBuild.then(bundleForDelivery).catch((error) => {
  console.error(error);
  process.exit(1);
});
