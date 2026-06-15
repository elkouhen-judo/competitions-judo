/**
 * Central TypeScript type definitions shared across `core/` and `api/`.
 *
 * This module has no runtime behavior (type-only, erased at compile time):
 * no entry in `scripts/build-core.js`, no `core-dist/` output, no shim.
 */

import type { JudokaRow, ClubCompetitionRow } from "./repositories/types";

export interface Judoka {
  judokaId: string;
  accountEmail: string;
  firstName: string;
  lastName: string;
  profileType: "JUDOKA" | "PARENT";
  accessRole: "NORMAL" | "COACH" | "ADMIN";
}

export interface Competition {
  competitionId: string;
  clubCompetitionId: string | null;
  ownerJudokaId: string;
  name: string;
  competitionDate: string;
  ageCategory: string;
  weightCategory: string;
  result: string | null;
}

export interface Combat {
  combatId: string;
  judokaId: string;
  competitionId: string;
  opponent: string;
  result: "Victoire" | "Défaite" | "Egalité";
  victoryType?: string;
  notes?: string;
}

/**
 * A {@link Combat} enriched with the display name of the judoka it belongs to.
 */
export type CombatReadModel = Combat & { judokaDisplayName: string };

export interface ManagedChild {
  judokaId?: string | undefined;
  accountEmail?: string | undefined;
  firstName: string;
  lastName: string;
}

export interface AccessInvitation {
  email: string;
  invitedProfileType: "JUDOKA" | "PARENT";
  invitedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ManagedJudokaScope {
  ids: string[];
  includes(judokaId: unknown): boolean;
  toIds(): string[];
}

/**
 * Result of `userContextService.getCurrentUserContext`. `user` and `judokas`
 * are raw Supabase judoka rows (not yet passed through `toCanonicalJudoka`).
 */
export interface UserContext {
  user: JudokaRow;
  judokas: JudokaRow[];
  managedJudokaScope: ManagedJudokaScope;
}

/**
 * `UserContext` plus the canonical {@link Judoka} for the current user, as
 * returned by `userContextService.getDomainUserContext`.
 */
export type DomainUserContext = UserContext & { domainUser: Judoka };

/**
 * Generic shape returned by mutation RPC methods (save/delete/finalize/...).
 */
export interface OperationResult {
  success: boolean;
  message: string;
  competitionId?: string;
  judokaId?: string;
  clubCompetitionId?: string;
  email?: string;
  invitedProfileType?: string;
}

export interface ChildrenManagement {
  user: Judoka;
  isParent: boolean;
  children: Judoka[];
}

export interface AdminsManagement {
  user: Judoka;
  admins: Judoka[];
  accessInvitations: AccessInvitation[];
}

export interface CompetitionDetail {
  competition: Competition;
  combats: CombatReadModel[];
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
  canManageCompetition: boolean;
  canEditCompetition: boolean;
  judokas: Judoka[];
}

/**
 * `clubCompetition` is the raw Supabase row for the club competition.
 */
export interface ClubCompetitionDetail {
  clubCompetition: ClubCompetitionRow;
  participations: Competition[];
  judokas: Judoka[];
}

export interface SeasonBounds {
  start: string;
  end: string;
  label: string;
}

export interface CombatProfile {
  victoryIppon: number;
  victoryDecision: number;
  lossIppon: number;
  lossDecision: number;
  lossPenalty: number;
  lossForfeit: number;
  draws: number;
  penalties: number;
  forfeits: number;
}

export interface CompetitionResultBadge {
  label: string;
  className: string;
}

export interface CompetitionCombatRecord {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  label: string;
}

export interface SeasonCompetitionResult {
  competitionId: string;
  name: string;
  competitionDate: string;
  result: string;
  category: string;
  weightCategory: string;
  resultBadge: CompetitionResultBadge;
  combatRecord: CompetitionCombatRecord;
}

export interface JudokaProfileLastCompetition {
  competitionId: string;
  name: string;
  competitionDate: string;
  category: string;
  weightCategory: string;
}

/**
 * Season statistics snapshot (see `core/domain/season-statistics.ts`) plus
 * the canonical judoka it was computed for.
 */
export interface JudokaProfile {
  judoka: Judoka;
  season: SeasonBounds;
  lastCompetition: JudokaProfileLastCompetition | null;
  combatProfile: CombatProfile;
  competitionResults: SeasonCompetitionResult[];
  seasonCombatCount: number;
  seasonCompetitionCount: number;
  seasonWins: number;
  seasonLosses: number;
  seasonDraws: number;
  victoryRate: number;
}

export interface InitialData {
  user: Judoka;
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
  canManageChildren: boolean;
  competitions: Competition[];
  clubCompetitions: { clubCompetitionId: string; name: string; competitionDate: string }[];
  judokas: Judoka[];
}

/**
 * The full backend RPC registry exposed via `/api/rpc`. Each property is a
 * method name dispatched by `body.method` in `api/rpc.js`.
 */
export interface RpcMethods {
  /** Charge le contexte de l'utilisateur courant, ses compétitions et celles du club. */
  getInitialData: (email: string) => Promise<InitialData>;
  /** Liste les enfants gérés par l'utilisateur (profil parent). */
  getChildrenManagement: (email: string) => Promise<ChildrenManagement>;
  /** Crée ou met à jour un enfant géré. */
  saveManagedChild: (email: string, child: ManagedChild) => Promise<OperationResult>;
  /** Supprime un enfant géré. */
  deleteManagedChild: (email: string, idJudoka: string) => Promise<OperationResult>;
  /** Calcule le profil saisonnier d'un judoka (soi-même par défaut, ou un profil accessible). */
  getJudokaProfile: (email: string, idJudoka?: string) => Promise<JudokaProfile>;
  /** Finalise l'inscription d'un compte après une invitation. */
  registerProfile: (email: string, profile: object) => Promise<object>;
  /** Annule une invitation d'accès en attente. */
  deleteAccessInvitation: (email: string, invitedEmail: string) => Promise<OperationResult>;
  /** Liste les administrateurs et les invitations d'accès en attente. */
  getAdminsManagement: (email: string) => Promise<AdminsManagement>;
  /** Promeut un judoka au rôle administrateur. */
  grantAdminRole: (email: string, targetEmail: string) => Promise<OperationResult>;
  /** Retire le rôle administrateur d'un judoka. */
  revokeAdminRole: (email: string, idJudoka: string) => Promise<OperationResult>;
  /** Crée ou met à jour une invitation d'accès. */
  saveAccessInvitation: (
    email: string,
    targetEmail: string,
    targetProfileType: string
  ) => Promise<OperationResult>;
  /** Supprime une compétition de club. */
  deleteClubCompetition: (email: string, idClubCompetition: string) => Promise<OperationResult>;
  /** Détache une participation personnelle d'une compétition de club. */
  detachClubCompetitionParticipant: (
    email: string,
    idClubCompetition: string,
    idCompetition: string
  ) => Promise<OperationResult>;
  /** Détail d'une compétition de club et de ses participations. */
  getClubCompetitionDetail: (
    email: string,
    idClubCompetition: string
  ) => Promise<ClubCompetitionDetail>;
  /** Crée ou met à jour une compétition de club. */
  saveClubCompetition: (email: string, input: Record<string, unknown>) => Promise<OperationResult>;
  /** Supprime une compétition personnelle. */
  deleteCompetition: (email: string, idCompetition: string) => Promise<OperationResult>;
  /** Enregistre le classement final d'une compétition. */
  finalizeCompetition: (
    email: string,
    idCompetition: string,
    result: string
  ) => Promise<OperationResult>;
  /** Détail d'une compétition personnelle (combats, droits, judokas accessibles). */
  getCompetitionDetail: (email: string, idCompetition: string) => Promise<CompetitionDetail>;
  /** Crée ou met à jour une compétition personnelle. */
  saveCompetition: (email: string, competition: Record<string, unknown>) => Promise<OperationResult>;
  /** Ajoute un combat à une compétition. */
  ajouterCombat: (email: string, combat: Record<string, unknown>) => Promise<OperationResult>;
  /** Supprime un combat. */
  deleteCombat: (email: string, idCombat: string) => Promise<OperationResult>;
  /** Met à jour un combat existant. */
  updateCombat: (email: string, combat: Record<string, unknown>) => Promise<OperationResult>;
}
