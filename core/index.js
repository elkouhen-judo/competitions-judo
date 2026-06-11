const { getSupabaseConfig } = require("./config/env");
const { createSupabaseClient } = require("./infra/supabase-client");
const { createSupabaseRest } = require("./infra/supabase-rest");
const createSessionAuth = require("./auth/session");
const permissions = require("./auth/permissions");
const text = require("./shared/text");
const { eqFilter } = require("./shared/filters");
const ids = require("./shared/ids");
const createJudokasRepository = require("./repositories/judokas.repository");
const createCompetitionsRepository = require("./repositories/competitions.repository");
const createCombatsRepository = require("./repositories/combats.repository");
const createInvitationsRepository = require("./repositories/invitations.repository");
const createParentLinksRepository = require("./repositories/parent-links.repository");
const createUserContextService = require("./services/user-context.service");
const createAdminService = require("./services/admin.service");
const createCompetitionsService = require("./services/competitions.service");
const createCombatsService = require("./services/combats.service");
const createChildrenService = require("./services/children.service");
const createProfileService = require("./services/profile.service");
const createRegistrationService = require("./services/registration.service");
const { getCompetitionCategoryLabel, getCompetitionResultRank } = require("./domain/competition-results");
const { getCurrentSeasonBounds, isDateWithinSeason } = require("./domain/season");
const { createManagedChildRecord, updateManagedChildRecord } = require("./domain/access/judoka");
const { createAccessInvitationRecord } = require("./domain/access/access-invitation");
const { toCompetitionRecord } = require("./domain/competitions/competition");
const { createCombatRecord, updateCombatRecord } = require("./domain/competitions/combat");

const supabaseClient = createSupabaseClient({ getSupabaseConfig });
const supabaseRest = createSupabaseRest(supabaseClient);
const sessionAuth = createSessionAuth({ getSupabaseConfig });

const repositoryDeps = {
  ...supabaseRest,
  eqFilter
};

const judokasRepository = createJudokasRepository(repositoryDeps);
const competitionsRepository = createCompetitionsRepository(repositoryDeps);
const combatsRepository = createCombatsRepository(repositoryDeps);
const invitationsRepository = createInvitationsRepository(repositoryDeps);
const parentLinksRepository = createParentLinksRepository(repositoryDeps);

const userContextService = createUserContextService({
  judokasRepository,
  parentLinksRepository,
  normalizeEmail: text.normalizeEmail,
  isAdmin: permissions.isAdmin,
  isParent: permissions.isParent
});

const adminService = createAdminService({
  invitationsRepository,
  judokasRepository,
  userContextService,
  cleanText: text.cleanText,
  createAccessInvitationRecord,
  normalizeEmail: text.normalizeEmail,
  isAdmin: permissions.isAdmin,
  isValidEmail: text.isValidEmail
});

const competitionsService = createCompetitionsService({
  combatsRepository,
  competitionsRepository,
  userContextService,
  normalizeLastName: text.normalizeLastName,
  canManageCompetition: permissions.canManageCompetition,
  isAdmin: permissions.isAdmin,
  isParent: permissions.isParent,
  resolveCompetitionOwnerId: permissions.resolveCompetitionOwnerId,
  buildCompetitionId: ids.buildCompetitionId,
  toCompetitionRecord
});

const combatsService = createCombatsService({
  combatsRepository,
  userContextService,
  canManageCombatFor: permissions.canManageCombatFor,
  buildCombatId: ids.buildCombatId,
  createCombatRecord,
  updateCombatRecord
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
  createManagedChildRecord,
  isParent: permissions.isParent,
  isValidEmail: text.isValidEmail,
  normalizeEmail: text.normalizeEmail,
  updateManagedChildRecord
});

const profileService = createProfileService({
  combatsRepository,
  competitionsRepository,
  userContextService,
  getCompetitionCategoryLabel,
  getCompetitionResultRank,
  getCurrentSeasonBounds,
  isDateWithinSeason
});

const registrationService = createRegistrationService({
  adminService,
  cleanText: text.cleanText,
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

  const userContext = await userContextService.getCurrentUserContext(email);
  const user = userContext.user;
  const admin = permissions.isAdmin(user);
  const parent = permissions.isParent(user);

  return {
    user,
    isAdmin: admin,
    isParent: parent,
    canManageChildren: permissions.canManageChildrenProfile(user),
    competitions: await competitionsService.getCompetitionsForUser(user, userContext.managedJudokaIds),
    judokas: (admin || parent) ? userContext.judokas : []
  };
}

const methods = {
  getInitialData,
  ...childrenService.methods,
  ...profileService.methods,
  ...registrationService.methods,
  ...adminService.methods,
  ...competitionsService.methods,
  ...combatsService.methods
};

module.exports = {
  getSupabaseConfig,
  methods,
  verifySupabaseUser: sessionAuth.verifySupabaseUser
};
