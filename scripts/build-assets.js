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

// Every other entry above is transpile-only (bundle: false) — screens load through the
// single /api/client concatenation and Vue is vendored as a global. coach-chat-widget.ts
// is the one deliberate exception: it needs real npm `vue` + `@ai-sdk/vue` + `ai`, so it
// gets its own private bundled build, isolated from the global Vue instance.
const transpileBuild = esbuild.build({
  entryPoints: entryPoints.map((entry) => path.join(root, entry)),
  outdir: path.join(root, "assets", "dist"),
  bundle: false,
  target: "es2022",
  charset: "utf8",
  sourcemap: false,
  logLevel: "info"
});

// zod/v4/core/index.js does `export * as locales from "../locales/index.js"`, a barrel
// re-exporting all ~40 locale files for zod's own optional i18n API. `ai` (a transitive
// dependency pulled in by @ai-sdk/vue) only ever uses the default English error map, but
// esbuild can't tree-shake the barrel away because zod's own code references it
// dynamically. Stub it down to just `en` — saves well over 100kb in this one bundle.
const stubZodLocalesBarrel = {
  name: "stub-zod-v4-locales-barrel",
  setup(build) {
    build.onResolve({ filter: /^\.\.\/locales\/index\.js$/ }, (args) => {
      if (!args.importer.includes(`${path.sep}zod${path.sep}v4${path.sep}`)) {
        return null;
      }
      return { path: "zod-v4-locales-en-only", namespace: "zod-v4-locales-en-only" };
    });
    build.onLoad(
      { filter: /^zod-v4-locales-en-only$/, namespace: "zod-v4-locales-en-only" },
      () => ({
        contents: 'export { default as en } from "zod/v4/locales/en.js";',
        loader: "js",
        resolveDir: root
      })
    );
  }
};

const widgetBuild = esbuild.build({
  entryPoints: [path.join(root, "assets", "coach-chat-widget.ts")],
  outdir: path.join(root, "assets", "dist"),
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2022",
  charset: "utf8",
  sourcemap: false,
  logLevel: "info",
  plugins: [stubZodLocalesBarrel]
});

Promise.all([transpileBuild, widgetBuild]).catch(() => process.exit(1));
