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
 * @typedef {Object} SeasonBounds
 * @property {string} start
 * @property {string} end
 * @property {string} label
 */

/**
 * @typedef {Object} CombatProfile
 * @property {number} victoryIppon
 * @property {number} victoryDecision
 * @property {number} lossIppon
 * @property {number} lossDecision
 * @property {number} lossPenalty
 * @property {number} lossForfeit
 * @property {number} draws
 * @property {number} penalties
 * @property {number} forfeits
 */

/**
 * @typedef {Object} CompetitionResultBadge
 * @property {string} label
 * @property {string} className
 */

/**
 * @typedef {Object} CompetitionCombatRecord
 * @property {number} total
 * @property {number} wins
 * @property {number} losses
 * @property {number} draws
 * @property {string} label
 */

/**
 * @typedef {Object} SeasonCompetitionResult
 * @property {string} competitionId
 * @property {string} name
 * @property {string} competitionDate
 * @property {string} result
 * @property {string} category
 * @property {string} weightCategory
 * @property {CompetitionResultBadge} resultBadge
 * @property {CompetitionCombatRecord} combatRecord
 */

/**
 * @typedef {Object} JudokaProfileLastCompetition
 * @property {string} competitionId
 * @property {string} name
 * @property {string} competitionDate
 * @property {string} category
 * @property {string} weightCategory
 */

/**
 * Season statistics snapshot (see `core/domain/season-statistics.js`) plus
 * the canonical judoka it was computed for.
 *
 * @typedef {Object} JudokaProfile
 * @property {Judoka} judoka
 * @property {SeasonBounds} season
 * @property {JudokaProfileLastCompetition|null} lastCompetition
 * @property {CombatProfile} combatProfile
 * @property {SeasonCompetitionResult[]} competitionResults
 * @property {number} seasonCombatCount
 * @property {number} seasonCompetitionCount
 * @property {number} seasonWins
 * @property {number} seasonLosses
 * @property {number} seasonDraws
 * @property {number} victoryRate
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
 * @property {(email: string) => Promise<InitialData>} getInitialData - Charge le contexte de l'utilisateur courant, ses compétitions et celles du club.
 * @property {(email: string) => Promise<ChildrenManagement>} getChildrenManagement - Liste les enfants gérés par l'utilisateur (profil parent).
 * @property {(email: string, child: ManagedChild) => Promise<OperationResult>} saveManagedChild - Crée ou met à jour un enfant géré.
 * @property {(email: string, idJudoka: string) => Promise<OperationResult>} deleteManagedChild - Supprime un enfant géré.
 * @property {(email: string, idJudoka?: string) => Promise<JudokaProfile>} getJudokaProfile - Calcule le profil saisonnier d'un judoka (soi-même par défaut, ou un profil accessible).
 * @property {(email: string, profile: object) => Promise<object>} registerProfile - Finalise l'inscription d'un compte après une invitation.
 * @property {(email: string, invitedEmail: string) => Promise<OperationResult>} deleteAccessInvitation - Annule une invitation d'accès en attente.
 * @property {(email: string) => Promise<AdminsManagement>} getAdminsManagement - Liste les administrateurs et les invitations d'accès en attente.
 * @property {(email: string, targetEmail: string) => Promise<OperationResult>} grantAdminRole - Promeut un judoka au rôle administrateur.
 * @property {(email: string, idJudoka: string) => Promise<OperationResult>} revokeAdminRole - Retire le rôle administrateur d'un judoka.
 * @property {(email: string, targetEmail: string, targetProfileType: string) => Promise<OperationResult>} saveAccessInvitation - Crée ou met à jour une invitation d'accès.
 * @property {(email: string, idClubCompetition: string) => Promise<OperationResult>} deleteClubCompetition - Supprime une compétition de club.
 * @property {(email: string, idClubCompetition: string, idCompetition: string) => Promise<OperationResult>} detachClubCompetitionParticipant - Détache une participation personnelle d'une compétition de club.
 * @property {(email: string, idClubCompetition: string) => Promise<ClubCompetitionDetail>} getClubCompetitionDetail - Détail d'une compétition de club et de ses participations.
 * @property {(email: string, input: object) => Promise<OperationResult>} saveClubCompetition - Crée ou met à jour une compétition de club.
 * @property {(email: string, idCompetition: string) => Promise<OperationResult>} deleteCompetition - Supprime une compétition personnelle.
 * @property {(email: string, idCompetition: string, result: string) => Promise<OperationResult>} finalizeCompetition - Enregistre le classement final d'une compétition.
 * @property {(email: string, idCompetition: string) => Promise<CompetitionDetail>} getCompetitionDetail - Détail d'une compétition personnelle (combats, droits, judokas accessibles).
 * @property {(email: string, competition: object) => Promise<OperationResult>} saveCompetition - Crée ou met à jour une compétition personnelle.
 * @property {(email: string, combat: object) => Promise<OperationResult>} ajouterCombat - Ajoute un combat à une compétition.
 * @property {(email: string, idCombat: string) => Promise<OperationResult>} deleteCombat - Supprime un combat.
 * @property {(email: string, combat: object) => Promise<OperationResult>} updateCombat - Met à jour un combat existant.
 */

module.exports = {};
