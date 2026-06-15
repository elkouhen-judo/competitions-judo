/**
 * Central JSDoc type definitions shared across `core/` and `api/`.
 *
 * This module has no runtime behavior. It exists so that `@typedef`s can be
 * referenced from other files via `import("./types").TypeName` and checked
 * by `tsc` (see jsconfig.json) without introducing a build step.
 */

/**
 * @typedef {Object} Judoka
 * @property {string} judokaId
 * @property {string} accountEmail
 * @property {string} firstName
 * @property {string} lastName
 * @property {"JUDOKA"|"PARENT"} profileType
 * @property {"NORMAL"|"COACH"|"ADMIN"} accessRole
 */

/**
 * @typedef {Object} Competition
 * @property {string} competitionId
 * @property {string|null} clubCompetitionId
 * @property {string} ownerJudokaId
 * @property {string} name
 * @property {string} competitionDate
 * @property {string} ageCategory
 * @property {string} weightCategory
 * @property {string|null} result
 */

/**
 * @typedef {Object} Combat
 * @property {string} combatId
 * @property {string} judokaId
 * @property {string} competitionId
 * @property {string} opponent
 * @property {"Victoire"|"Défaite"|"Egalité"} result
 * @property {string} [victoryType]
 * @property {string} [notes]
 */

/**
 * A {@link Combat} enriched with the display name of the judoka it belongs to.
 *
 * @typedef {Combat & { judokaDisplayName: string }} CombatReadModel
 */

/**
 * @typedef {Object} ManagedChild
 * @property {string} [judokaId]
 * @property {string} [accountEmail]
 * @property {string} firstName
 * @property {string} lastName
 */

/**
 * @typedef {Object} AccessInvitation
 * @property {string} email
 * @property {"JUDOKA"|"PARENT"} invitedProfileType
 * @property {string} invitedBy
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} ManagedJudokaScope
 * @property {string[]} ids
 * @property {(judokaId: string) => boolean} includes
 * @property {() => string[]} toIds
 */

/**
 * Result of `userContextService.getCurrentUserContext`. `user` and `judokas`
 * are raw Supabase judoka rows (not yet passed through `toCanonicalJudoka`).
 *
 * @typedef {Object} UserContext
 * @property {object} user
 * @property {object[]} judokas
 * @property {ManagedJudokaScope} managedJudokaScope
 */

/**
 * `UserContext` plus the canonical {@link Judoka} for the current user, as
 * returned by `userContextService.getDomainUserContext`.
 *
 * @typedef {UserContext & { domainUser: Judoka }} DomainUserContext
 */

/**
 * Generic shape returned by mutation RPC methods (save/delete/finalize/...).
 *
 * @typedef {Object} OperationResult
 * @property {boolean} success
 * @property {string} message
 * @property {string} [competitionId]
 * @property {string} [judokaId]
 * @property {string} [clubCompetitionId]
 * @property {string} [email]
 * @property {string} [invitedProfileType]
 */

/**
 * @typedef {Object} ChildrenManagement
 * @property {Judoka} user
 * @property {boolean} isParent
 * @property {Judoka[]} children
 */

/**
 * @typedef {Object} AdminsManagement
 * @property {Judoka} user
 * @property {Judoka[]} admins
 * @property {AccessInvitation[]} accessInvitations
 */

/**
 * @typedef {Object} CompetitionDetail
 * @property {Competition} competition
 * @property {CombatReadModel[]} combats
 * @property {boolean} isAdmin
 * @property {boolean} isCoach
 * @property {boolean} isParent
 * @property {boolean} canManageCompetition
 * @property {boolean} canEditCompetition
 * @property {Judoka[]} judokas
 */

/**
 * `clubCompetition` is the raw Supabase row for the club competition.
 *
 * @typedef {Object} ClubCompetitionDetail
 * @property {object} clubCompetition
 * @property {Competition[]} participations
 * @property {Judoka[]} judokas
 */

/**
 * Season statistics snapshot (see `core/domain/season-statistics.js`) plus
 * the canonical judoka it was computed for. The statistics fields are not
 * enumerated here yet.
 *
 * @typedef {{ judoka: Judoka, [key: string]: any }} JudokaProfile
 */

/**
 * @typedef {Object} InitialData
 * @property {Judoka} user
 * @property {boolean} isAdmin
 * @property {boolean} isCoach
 * @property {boolean} isParent
 * @property {boolean} canManageChildren
 * @property {Competition[]} competitions
 * @property {{clubCompetitionId: string, name: string, competitionDate: string}[]} clubCompetitions
 * @property {Judoka[]} judokas
 */

/**
 * The full backend RPC registry exposed via `/api/rpc`. Each property is a
 * method name dispatched by `body.method` in `api/rpc.js`.
 *
 * @typedef {Object} RpcMethods
 * @property {(email: string) => Promise<InitialData>} getInitialData
 * @property {(email: string) => Promise<ChildrenManagement>} getChildrenManagement
 * @property {(email: string, child: ManagedChild) => Promise<OperationResult>} saveManagedChild
 * @property {(email: string, idJudoka: string) => Promise<OperationResult>} deleteManagedChild
 * @property {(email: string, idJudoka?: string) => Promise<JudokaProfile>} getJudokaProfile
 * @property {(email: string, profile: object) => Promise<object>} registerProfile
 * @property {(email: string, invitedEmail: string) => Promise<OperationResult>} deleteAccessInvitation
 * @property {(email: string) => Promise<AdminsManagement>} getAdminsManagement
 * @property {(email: string, targetEmail: string) => Promise<OperationResult>} grantAdminRole
 * @property {(email: string, idJudoka: string) => Promise<OperationResult>} revokeAdminRole
 * @property {(email: string, targetEmail: string, targetProfileType: string) => Promise<OperationResult>} saveAccessInvitation
 * @property {(email: string, idClubCompetition: string) => Promise<OperationResult>} deleteClubCompetition
 * @property {(email: string, idClubCompetition: string, idCompetition: string) => Promise<OperationResult>} detachClubCompetitionParticipant
 * @property {(email: string, idClubCompetition: string) => Promise<ClubCompetitionDetail>} getClubCompetitionDetail
 * @property {(email: string, input: object) => Promise<OperationResult>} saveClubCompetition
 * @property {(email: string, idCompetition: string) => Promise<OperationResult>} deleteCompetition
 * @property {(email: string, idCompetition: string, result: string) => Promise<OperationResult>} finalizeCompetition
 * @property {(email: string, idCompetition: string) => Promise<CompetitionDetail>} getCompetitionDetail
 * @property {(email: string, competition: object) => Promise<OperationResult>} saveCompetition
 * @property {(email: string, combat: object) => Promise<OperationResult>} ajouterCombat
 * @property {(email: string, idCombat: string) => Promise<OperationResult>} deleteCombat
 * @property {(email: string, combat: object) => Promise<OperationResult>} updateCombat
 */

module.exports = {};
