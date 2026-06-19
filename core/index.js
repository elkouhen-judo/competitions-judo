const {
  getSupabaseConfig,
  getGroqApiKey,
  getGroqModel,
  getMcpJwtSecret,
  getMcpTokenTtlSeconds
} = require("./config/env.js");
const { createSupabaseClient } = require("./infra/supabase-client.js");
const { createSupabaseRest } = require("./infra/supabase-rest.js");
const { createGroqClient } = require("./infra/groq-client.js");
const createSessionAuth = require("./auth/session.js");
const { createMcpTokenAuth, sha256Base64Url } = require("./auth/mcp-token.js");
const permissions = require("./auth/permissions.js");
const text = require("./shared/text.js");
const { eqFilter } = require("./shared/filters.js");
const ids = require("./shared/ids.js");
const createJudokasRepository =
  /** @type {typeof import("./repositories/judokas.repository").default} */ (
    /** @type {unknown} */ (require("../core-dist/repositories/judokas.repository.js").default)
  );
const createClubCompetitionsRepository =
  /** @type {typeof import("./repositories/club-competitions.repository").default} */ (
    /** @type {unknown} */ (
      require("../core-dist/repositories/club-competitions.repository.js").default
    )
  );
const createCompetitionsRepository =
  /** @type {typeof import("./repositories/competitions.repository").default} */ (
    /** @type {unknown} */ (require("../core-dist/repositories/competitions.repository.js").default)
  );
const createCombatsRepository =
  /** @type {typeof import("./repositories/combats.repository").default} */ (
    /** @type {unknown} */ (require("../core-dist/repositories/combats.repository.js").default)
  );
const createCombatScoresRepository =
  /** @type {typeof import("./repositories/combat-scores.repository").default} */ (
    /** @type {unknown} */ (
      require("../core-dist/repositories/combat-scores.repository.js").default
    )
  );
const createInvitationsRepository =
  /** @type {typeof import("./repositories/invitations.repository").default} */ (
    /** @type {unknown} */ (require("../core-dist/repositories/invitations.repository.js").default)
  );
const createParentLinksRepository =
  /** @type {typeof import("./repositories/parent-links.repository").default} */ (
    /** @type {unknown} */ (require("../core-dist/repositories/parent-links.repository.js").default)
  );
const createUserContextService =
  /** @type {typeof import("./services/user-context.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/user-context.service.js").default)
  );
const createAdminService = /** @type {typeof import("./services/admin.service").default} */ (
  /** @type {unknown} */ (require("../core-dist/services/admin.service.js").default)
);
const createClubCompetitionsService =
  /** @type {typeof import("./services/club-competitions.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/club-competitions.service.js").default)
  );
const createCompetitionsService =
  /** @type {typeof import("./services/competitions.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/competitions.service.js").default)
  );
const createCoachDashboardService =
  /** @type {typeof import("./services/coach-dashboard.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/coach-dashboard.service.js").default)
  );
const createCombatsService = /** @type {typeof import("./services/combats.service").default} */ (
  /** @type {unknown} */ (require("../core-dist/services/combats.service.js").default)
);
const createProfileService = /** @type {typeof import("./services/profile.service").default} */ (
  /** @type {unknown} */ (require("../core-dist/services/profile.service.js").default)
);
const createRegistrationService =
  /** @type {typeof import("./services/registration.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/registration.service.js").default)
  );
const createMcpAuthService =
  /** @type {typeof import("./services/mcp-auth.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/mcp-auth.service.js").default)
  );
const createMcpServerService =
  /** @type {typeof import("./services/mcp-server.service").default} */ (
    /** @type {unknown} */ (require("../core-dist/services/mcp-server.service.js").default)
  );
const { getCompetitionCategoryLabel } = require("./domain/competition-results.js");
const { getCurrentSeasonBounds, isDateWithinSeason } = require("./domain/season.js");
const { createJudoka, createManagedChild } = require("./domain/access/judoka.js");
const { createEmail } = require("./domain/access/email.js");
const { createProfileType } = require("./domain/access/profile-type.js");
const {
  createHandedness,
  createWeightCategory,
  createYearInCategory
} = require("./domain/category-reference.js");
const { createManagedJudokaScope } = require("./domain/access/managed-judoka-scope.js");
const { createClubCompetition } = require("./domain/competitions/club-competition.js");
const {
  createCompetition,
  createPersistedCompetition
} = require("./domain/competitions/competition.js");
const { updateCombat } = require("./domain/competitions/combat.js");
const { buildJudokaProfileSnapshot } = require("./domain/season-statistics.js");
const { toCanonicalJudoka } = require("./services/domain-adapters.js");

const supabaseClient = createSupabaseClient({ getSupabaseConfig });
const supabaseRest = createSupabaseRest(supabaseClient);
const sessionAuth = createSessionAuth({ getSupabaseConfig });
const mcpTokenAuth = createMcpTokenAuth({
  getSecret: getMcpJwtSecret,
  getIssuer: () => "kiroku",
  getAudience: () => "kiroku-mcp",
  getTtlSeconds: getMcpTokenTtlSeconds
});
const mcpCodeAuth = createMcpTokenAuth({
  getSecret: getMcpJwtSecret,
  getIssuer: () => "kiroku",
  getAudience: () => "kiroku-mcp-code",
  getTtlSeconds: () => 120
});
const mcpClientAuth = createMcpTokenAuth({
  getSecret: getMcpJwtSecret,
  getIssuer: () => "kiroku",
  getAudience: () => "kiroku-mcp-client",
  getTtlSeconds: () => 60 * 60 * 24 * 365 * 50
});
const groqClient = createGroqClient({ getGroqApiKey, getGroqModel });
const repositoryDeps = {
  ...supabaseRest,
  eqFilter
};

const judokasRepository = createJudokasRepository(repositoryDeps);
const clubCompetitionsRepository = createClubCompetitionsRepository(repositoryDeps);
const competitionsRepository = createCompetitionsRepository(repositoryDeps);
const combatsRepository = createCombatsRepository(repositoryDeps);
const combatScoresRepository = createCombatScoresRepository(repositoryDeps);
const invitationsRepository = createInvitationsRepository(repositoryDeps);
const parentLinksRepository = createParentLinksRepository(repositoryDeps);

const userContextService = createUserContextService({
  judokasRepository,
  parentLinksRepository,
  normalizeEmail: text.normalizeEmail,
  assertCanAccessJudokaProfile: permissions.assertCanAccessJudokaProfile,
  createManagedJudokaScope,
  isAdmin: permissions.isAdmin,
  isCoach: permissions.isCoach,
  isParent: permissions.isParent
});

const adminService = createAdminService({
  competitionsRepository,
  invitationsRepository,
  judokasRepository,
  parentLinksRepository,
  userContextService,
  buildJudokaId: ids.buildJudokaId,
  cleanText: text.cleanText,
  createEmail,
  createJudoka,
  createManagedChild,
  createProfileType,
  createHandedness,
  createWeightCategory,
  createYearInCategory,
  normalizeEmail: text.normalizeEmail
});

const clubCompetitionsService = createClubCompetitionsService({
  clubCompetitionsRepository,
  competitionsRepository,
  judokasRepository,
  userContextService,
  canManageClubCompetition: permissions.canManageClubCompetition,
  buildClubCompetitionId: ids.buildCompetitionId,
  buildCompetitionId: ids.buildCompetitionId,
  createClubCompetition,
  createCompetition
});

const coachDashboardService = createCoachDashboardService({
  combatsRepository,
  combatScoresRepository,
  competitionsRepository,
  groqClient,
  judokasRepository,
  userContextService
});

const competitionsService = createCompetitionsService({
  combatsRepository,
  combatScoresRepository,
  competitionsRepository,
  userContextService,
  normalizeLastName: text.normalizeLastName,
  canManageCompetition: permissions.canManageCompetition,
  assertCanAccessCompetition: permissions.assertCanAccessCompetition,
  assertCanManageCompetition: permissions.assertCanManageCompetition,
  resolveJudokaDataAccess: permissions.resolveJudokaDataAccess,
  resolveCompetitionOwnerId: permissions.resolveCompetitionOwnerId,
  buildCompetitionId: ids.buildCompetitionId,
  createCompetition,
  createPersistedCompetition
});

const combatsService = createCombatsService({
  combatsRepository,
  combatScoresRepository,
  competitionsRepository,
  userContextService,
  assertCanManageCombatFor: permissions.assertCanManageCombatFor,
  createCombatUpdate: updateCombat,
  createPersistedCompetition,
  buildCombatId: ids.buildCombatId
});

const profileService = createProfileService({
  combatsRepository,
  competitionsRepository,
  buildJudokaProfileSnapshot,
  userContextService,
  getCompetitionCategoryLabel,
  getCurrentSeasonBounds,
  isDateWithinSeason
});

const registrationService = createRegistrationService({
  adminService,
  createEmail,
  supabaseRpc: supabaseClient.supabaseRpc
});

const mcpAuthService = createMcpAuthService({
  userContextService,
  isCoach: permissions.isCoach,
  isAdmin: permissions.isAdmin,
  signMcpToken: mcpTokenAuth.signToken,
  signAuthorizationCode: mcpCodeAuth.signToken
});

async function getInitialData(email) {
  let currentUser = await userContextService.getCurrentUser(email);
  if (!currentUser) {
    const invitation = await adminService.getAccessInvitation(email);
    if (invitation) {
      await registrationService.methods.registerProfile(email, {});
      currentUser = await userContextService.getCurrentUser(email);
      if (!currentUser) {
        throw new Error("Profil introuvable après activation de l'invitation.");
      }
    } else {
      throw new Error("Accès non autorisé. Une invitation est requise.");
    }
  }

  const { user, judokas, managedJudokaScope, domainUser } =
    await userContextService.getDomainUserContext(email);
  const admin = permissions.isAdmin(domainUser);
  const coach = permissions.isCoach(domainUser);
  const parent = permissions.isParent(domainUser);

  const clubCompetitionsRaw = coach ? await clubCompetitionsRepository.listAll() : [];
  const clubCompetitions = clubCompetitionsRaw.map((cc) => ({
    clubCompetitionId: cc.id_club_competition,
    name: cc.nom,
    competitionDate: cc.date
  }));

  return {
    user: toCanonicalJudoka(user),
    isAdmin: admin,
    isCoach: coach,
    isParent: parent,
    competitions: await competitionsService.getCompetitionsForUser(user, managedJudokaScope),
    clubCompetitions,
    judokas: admin || coach || parent ? judokas.map(toCanonicalJudoka) : []
  };
}

/** @type {import("./types").RpcMethods} */
const methods = {
  getInitialData,
  ...profileService.methods,
  ...registrationService.methods,
  ...adminService.methods,
  ...clubCompetitionsService.methods,
  ...competitionsService.methods,
  ...combatsService.methods,
  ...coachDashboardService.methods
};

const mcpServerService = createMcpServerService({
  methods,
  getJudokas: async (email) => {
    const { judokas } = await userContextService.getCurrentUserContext(email);
    return judokas;
  }
});

module.exports = {
  getSupabaseConfig,
  methods,
  mcpAuthService,
  mcpServerService,
  signMcpToken: mcpTokenAuth.signToken,
  verifyMcpToken: mcpTokenAuth.verifyToken,
  verifyMcpAuthorizationCode: mcpCodeAuth.verifyToken,
  verifyMcpClient: mcpClientAuth.verifyToken,
  signMcpClient: mcpClientAuth.signToken,
  getMcpTokenTtlSeconds,
  sha256Base64Url,
  verifySupabaseUser: sessionAuth.verifySupabaseUser
};
