const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

const entryPoints = [
  "core/shared/ids.ts",
  "core/shared/text.ts",
  "core/domain/shared/identity.ts",
  "core/domain/access/email.ts",
  "core/domain/access/person-name.ts",
  "core/domain/access/profile-type.ts",
  "core/domain/access/role.ts",
  "core/domain/access/managed-judoka-scope.ts",
  "core/domain/access/access-invitation.ts",
  "core/domain/access/judoka.ts",
  "core/domain/access/permission-policy.ts",
  "core/domain/competitions/combat-result.ts",
  "core/domain/competitions/combat-decision-type.ts",
  "core/domain/competitions/combat.ts",
  "core/domain/competition-results.ts",
  "core/domain/competitions/competition.ts",
  "core/domain/competitions/club-competition.ts",
  "core/domain/season.ts",
  "core/domain/season-statistics.ts"
];

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
