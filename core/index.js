const { getSupabaseConfig } = require("./config/env");
const { createSupabaseClient } = require("./infra/supabase-client");
const { createSupabaseRest } = require("./infra/supabase-rest");
const createSessionAuth = require("./auth/session");
const permissions = require("./auth/permissions");
const text = require("./shared/text");
const { eqFilter } = require("./shared/filters");
const ids = require("./shared/ids");
const createJudokasRepository =
  /** @type {typeof import("./repositories/judokas.repository").default} */ (
    /** @type {unknown} */ (require("./repositories/judokas.repository"))
  );
const createClubCompetitionsRepository =
  /** @type {typeof import("./repositories/club-competitions.repository").default} */ (
    /** @type {unknown} */ (require("./repositories/club-competitions.repository"))
  );
const createCompetitionsRepository =
  /** @type {typeof import("./repositories/competitions.repository").default} */ (
    /** @type {unknown} */ (require("./repositories/competitions.repository"))
  );
const createCombatsRepository =
  /** @type {typeof import("./repositories/combats.repository").default} */ (
    /** @type {unknown} */ (require("./repositories/combats.repository"))
  );
const createInvitationsRepository =
  /** @type {typeof import("./repositories/invitations.repository").default} */ (
    /** @type {unknown} */ (require("./repositories/invitations.repository"))
  );
const createParentLinksRepository =
  /** @type {typeof import("./repositories/parent-links.repository").default} */ (
    /** @type {unknown} */ (require("./repositories/parent-links.repository"))
  );
const createUserContextService =
  /** @type {typeof import("./services/user-context.service").default} */ (
    /** @type {unknown} */ (require("./services/user-context.service"))
  );
const createAdminService =
  /** @type {typeof import("./services/admin.service").default} */ (
    /** @type {unknown} */ (require("./services/admin.service"))
  );
const createClubCompetitionsService =
  /** @type {typeof import("./services/club-competitions.service").default} */ (
    /** @type {unknown} */ (require("./services/club-competitions.service"))
  );
const createCompetitionsService =
  /** @type {typeof import("./services/competitions.service").default} */ (
    /** @type {unknown} */ (require("./services/competitions.service"))
  );
const createCombatsService =
  /** @type {typeof import("./services/combats.service").default} */ (
    /** @type {unknown} */ (require("./services/combats.service"))
  );
const createChildrenService =
  /** @type {typeof import("./services/children.service").default} */ (
    /** @type {unknown} */ (require("./services/children.service"))
  );
const createProfileService =
  /** @type {typeof import("./services/profile.service").default} */ (
    /** @type {unknown} */ (require("./services/profile.service"))
  );
const createRegistrationService =
  /** @type {typeof import("./services/registration.service").default} */ (
    /** @type {unknown} */ (require("./services/registration.service"))
  );
const { getCompetitionCategoryLabel } = require("./domain/competition-results");
const { getCurrentSeasonBounds, isDateWithinSeason } = require("./domain/season");
const {
  createJudoka,
  createManagedChild,
  decideManagedChildRemoval,
  updateManagedChild
} = require("./domain/access/judoka");
const { createEmail } = require("./domain/access/email");
const { createManagedJudokaScope } = require("./domain/access/managed-judoka-scope");
const { createAccessInvitation } = require("./domain/access/access-invitation");
const { createClubCompetition } = require("./domain/competitions/club-competition");
const {
  createCompetition,
  createPersistedCompetition
} = require("./domain/competitions/competition");
const { updateCombat } = require("./domain/competitions/combat");
const { buildJudokaProfileSnapshot } = require("./domain/season-statistics");
const { toCanonicalJudoka } = require("./services/domain-adapters");

const supabaseClient = createSupabaseClient({ getSupabaseConfig });
const supabaseRest = createSupabaseRest(supabaseClient);
const sessionAuth = createSessionAuth({ getSupabaseConfig });

const repositoryDeps = {
  ...supabaseRest,
  eqFilter
};

const judokasRepository = createJudokasRepository(repositoryDeps);
const clubCompetitionsRepository = createClubCompetitionsRepository(repositoryDeps);
const competitionsRepository = createCompetitionsRepository(repositoryDeps);
const combatsRepository = createCombatsRepository(repositoryDeps);
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
  invitationsRepository,
  judokasRepository,
  userContextService,
  createAccessInvitation,
  createEmail,
  createJudoka,
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

const competitionsService = createCompetitionsService({
  combatsRepository,
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
  competitionsRepository,
  userContextService,
  assertCanManageCombatFor: permissions.assertCanManageCombatFor,
  createCombatUpdate: updateCombat,
  createPersistedCompetition,
  buildCombatId: ids.buildCombatId
});

const childrenService = createChildrenService({
  combatsRepository,
  competitionsRepository,
  judokasRepository,
  parentLinksRepository,
  userContextService,
  assertCanManageChildrenProfile: permissions.assertCanManageChildrenProfile,
  buildJudokaId: ids.buildJudokaId,
  cleanText: text.cleanText,
  createJudoka,
  createManagedChild,
  decideManagedChildRemoval,
  isParent: permissions.isParent,
  updateManagedChild
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

async function getInitialData(email) {
  const currentUser = await userContextService.getCurrentUser(email);
  if (!currentUser) {
    const invitation = await adminService.getAccessInvitation(email);
    if (invitation) {
      throw new Error("Invitation trouvée. Finalisez votre profil.");
    }

    throw new Error("Accès non autorisé. Une invitation est requise.");
  }

  const { user, judokas, managedJudokaScope, domainUser } =
    await userContextService.getDomainUserContext(email);
  const admin = permissions.isAdmin(domainUser);
  const coach = permissions.isCoach(domainUser);
  const parent = permissions.isParent(domainUser);

  const clubCompetitionsRaw = admin || coach ? await clubCompetitionsRepository.listAll() : [];
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
    canManageChildren: permissions.canManageChildrenProfile(domainUser),
    competitions: await competitionsService.getCompetitionsForUser(user, managedJudokaScope),
    clubCompetitions,
    judokas: admin || coach || parent ? judokas.map(toCanonicalJudoka) : []
  };
}

/** @type {import("./types").RpcMethods} */
const methods = {
  getInitialData,
  ...childrenService.methods,
  ...profileService.methods,
  ...registrationService.methods,
  ...adminService.methods,
  ...clubCompetitionsService.methods,
  ...competitionsService.methods,
  ...combatsService.methods
};

module.exports = {
  getSupabaseConfig,
  methods,
  verifySupabaseUser: sessionAuth.verifySupabaseUser
};
