const {
  getSupabaseConfig,
  getSupabaseJwtSecret,
  getMcpJwtSecret,
  getMcpTokenTtlSeconds
} = require("./config/env.js");
const { createSupabaseClient } = require("./infra/supabase-client.js");
const { createSupabaseRest } = require("./infra/supabase-rest.js");
const { memoizeInRequest } = require("./infra/request-scope.js");
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
const createClubsRepository =
  /** @type {typeof import("./repositories/clubs.repository").default} */ (
    /** @type {unknown} */ (require("../core-dist/repositories/clubs.repository.js").default)
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
const createClubsService = /** @type {typeof import("./services/clubs.service").default} */ (
  /** @type {unknown} */ (require("../core-dist/services/clubs.service.js").default)
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
const {
  countCombatResults,
  getCompetitionCategoryLabel
} = require("./domain/competition-results.js");
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
const { toCanonicalCompetition, toCanonicalJudoka } = require("./services/domain-adapters.js");

const supabaseClient = createSupabaseClient({ getSupabaseConfig });
const supabaseRest = createSupabaseRest(supabaseClient);
const sessionAuth = createSessionAuth({ getSupabaseConfig, getJwtSecret: getSupabaseJwtSecret });
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
const clubsRepository = createClubsRepository(repositoryDeps);

const userContextService = createUserContextService({
  judokasRepository,
  memoizeInRequest,
  normalizeEmail: text.normalizeEmail,
  assertCanAccessJudokaProfile: permissions.assertCanAccessJudokaProfile,
  createManagedJudokaScope,
  isAdmin: permissions.isAdmin,
  isCoach: permissions.isCoach,
  isParent: permissions.isParent
});

const adminService = createAdminService({
  clubsRepository,
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
  combatsRepository,
  userContextService,
  canManageClubCompetition: permissions.canManageClubCompetition,
  buildClubCompetitionId: ids.buildCompetitionId,
  buildCompetitionId: ids.buildCompetitionId,
  createClubCompetition,
  createCompetition
});

const coachDashboardService = createCoachDashboardService({
  combatsRepository,
  competitionsRepository,
  userContextService
});

const competitionsService = createCompetitionsService({
  combatsRepository,
  competitionsRepository,
  userContextService,
  normalizeLastName: text.normalizeLastName,
  canManageCombatFor: permissions.canManageCombatFor,
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
  normalizeLastName: text.normalizeLastName,
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

const clubsService = createClubsService({
  clubsRepository,
  clubCompetitionsRepository,
  judokasRepository,
  userContextService,
  isAdmin: permissions.isAdmin,
  buildClubId: ids.buildClubId
});

const mcpAuthService = createMcpAuthService({
  userContextService,
  isCoach: permissions.isCoach,
  isAdmin: permissions.isAdmin,
  signMcpToken: mcpTokenAuth.signToken,
  signAuthorizationCode: mcpCodeAuth.signToken
});

// Périmètre des compétitions visibles : un coach voit celles des judokas de ses clubs et les
// siennes, un parent celles de ses enfants et les siennes, les autres profils les leurs.
function getCompetitionScope(identity) {
  const domainUser = toCanonicalJudoka(identity.user);
  const selfId = String(identity.user.id_judoka);
  if (permissions.isCoach(domainUser)) {
    return { clubIds: identity.coachClubIds, judokaIds: [selfId] };
  }
  if (permissions.isParent(domainUser)) {
    return { judokaIds: [selfId, ...identity.childJudokaIds] };
  }
  return { judokaIds: [selfId] };
}

function toClubCompetitionSummary(row) {
  return {
    clubCompetitionId: row.id_club_competition,
    name: row.nom,
    competitionDate: row.date,
    clubId: row.club_id || ""
  };
}

// INIT-2 : le bilan V/D de chaque compétition vient des résultats lus avec elle.
function splitCompetitionsAndRecords(rows) {
  /** @type {Record<string, import("./domain/competition-results").CombatRecordCount>} */
  const combatRecords = {};
  const competitions = rows.map(({ combats, ...competition }) => {
    const results = Array.isArray(combats) ? combats.map((combat) => combat.resultat) : [];
    if (results.length) {
      combatRecords[String(competition.id_competition)] = countCombatResults(results);
    }
    return toCanonicalCompetition(competition);
  });
  return { competitions, combatRecords };
}

async function requireIdentity(email) {
  let identity = await userContextService.getIdentity(email);
  if (!identity) {
    const invitation = await adminService.getAccessInvitation(email);
    if (invitation) {
      await registrationService.methods.registerProfile(email, {});
      identity = await userContextService.getIdentity(email);
      if (!identity) {
        throw new Error("Profil introuvable après activation de l'invitation.");
      }
    } else {
      throw new Error("Accès non autorisé. Une invitation est requise.");
    }
  }
  return identity;
}

// INIT-1 : après le compte (1 requête), toutes les lectures partent ensemble.
// PAGE-2 : seules la saison en cours et les compétitions à venir sont chargées, sauf `allSeasons`.
async function loadInitialData(email, options = {}) {
  const identity = await requireIdentity(email);
  const domainUser = toCanonicalJudoka(identity.user);
  const admin = permissions.isAdmin(domainUser);
  const coach = permissions.isCoach(domainUser);
  const parent = permissions.isParent(domainUser);
  const scope = getCompetitionScope(identity);
  const loadedFrom = options.allSeasons ? "" : getCurrentSeasonBounds().start;

  // Un coach ne voit que les compétitions club et les clubs qu'il coache.
  const [{ user, judokas }, competitionRows, oldestCompetitionDate, clubCompetitionRows, clubRows] =
    await Promise.all([
      userContextService.getDomainUserContext(email),
      competitionsRepository.listInScopeWithResults({ ...scope, dateFrom: loadedFrom }),
      loadedFrom ? competitionsRepository.getOldestDate(scope) : "",
      coach ? clubCompetitionsRepository.listByClubIds(identity.coachClubIds, loadedFrom) : [],
      coach ? clubsRepository.listByIds(identity.coachClubIds) : []
    ]);

  return {
    user: toCanonicalJudoka(user),
    isAdmin: admin,
    isCoach: coach,
    isParent: parent,
    ...splitCompetitionsAndRecords(competitionRows),
    clubCompetitions: clubCompetitionRows.map(toClubCompetitionSummary),
    clubs: clubRows.map((club) => ({ clubId: club.id_club, name: club.nom })),
    judokas: admin || coach || parent ? judokas.map(toCanonicalJudoka) : [],
    loadedFrom,
    oldestCompetitionDate
  };
}

async function getInitialData(email) {
  return loadInitialData(email);
}

// PAGE-2 : une saison passée se charge à la demande.
async function getSeasonCompetitions(email, seasonStartYear) {
  const year = Number(seasonStartYear);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error("Saison invalide.");
  }
  const identity = await userContextService.getIdentity(email);
  if (!identity) {
    throw new Error(`Accès refusé pour : ${email}`);
  }
  const coach = permissions.isCoach(toCanonicalJudoka(identity.user));
  const bounds = getCurrentSeasonBounds(new Date(year, 9, 1));
  const [competitionRows, clubCompetitionRows] = await Promise.all([
    competitionsRepository.listInScopeWithResults({
      ...getCompetitionScope(identity),
      dateFrom: bounds.start,
      dateTo: bounds.end
    }),
    coach
      ? clubCompetitionsRepository.listByClubIds(identity.coachClubIds, bounds.start, bounds.end)
      : []
  ]);
  return {
    seasonStartYear: year,
    ...splitCompetitionsAndRecords(competitionRows),
    clubCompetitions: clubCompetitionRows.map(toClubCompetitionSummary)
  };
}

/** @type {import("./types").RpcMethods} */
const methods = {
  getInitialData,
  getSeasonCompetitions,
  ...profileService.methods,
  ...registrationService.methods,
  ...adminService.methods,
  ...clubCompetitionsService.methods,
  ...clubsService.methods,
  ...competitionsService.methods,
  ...combatsService.methods,
  ...coachDashboardService.methods
};

const mcpServerService = createMcpServerService({
  // La recherche MCP porte sur tout l'historique, pas sur la seule saison en cours.
  methods: { ...methods, getInitialData: (email) => loadInitialData(email, { allSeasons: true }) },
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
