const path = require("node:path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");

const entryPoints = [
  "core/shared/ids.ts",
  "core/shared/text.ts",
  "core/shared/csv.ts",
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
  "core/domain/competitions/opponent-stance.ts",
  "core/domain/competitions/combat-score-category.ts",
  "core/domain/competitions/tachi-waza-technique.ts",
  "core/domain/competitions/ne-waza-type.ts",
  "core/domain/competitions/combat-score-value.ts",
  "core/domain/competitions/combat-score.ts",
  "core/domain/competitions/combat.ts",
  "core/domain/competition-results.ts",
  "core/domain/category-reference.ts",
  "core/domain/competitions/competition.ts",
  "core/domain/competitions/club-competition.ts",
  "core/domain/season.ts",
  "core/domain/season-statistics.ts",
  "core/domain/coach-dashboard-statistics.ts",
  "core/repositories/judokas.repository.ts",
  "core/repositories/competitions.repository.ts",
  "core/repositories/combats.repository.ts",
  "core/repositories/combat-scores.repository.ts",
  "core/repositories/club-competitions.repository.ts",
  "core/repositories/invitations.repository.ts",
  "core/repositories/parent-links.repository.ts",
  "core/services/domain-adapters.ts",
  "core/services/user-context.service.ts",
  "core/services/admin.service.ts",
  "core/services/combats.service.ts",
  "core/services/club-competitions.service.ts",
  "core/services/competitions.service.ts",
  "core/services/ai-analysis.service.ts",
  "core/services/coach-dashboard.service.ts",
  "core/services/mcp-auth.service.ts",
  "core/services/mcp-server.service.ts",
  "core/services/profile.service.ts",
  "core/services/registration.service.ts"
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
