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
  ageCategory: string;
  weightCategory: string;
  beltColor: string;
  gender: string;
  yearInCategory: string;
  handedness: string;
  /** Club du judoka ("" si non rattaché). */
  clubId?: string;
  /** Droit admin indépendant du rôle (un coach peut aussi être admin). */
  adminAccess?: boolean;
}

export interface Club {
  clubId: string;
  name: string;
}

export interface Competition {
  competitionId: string;
  clubCompetitionId: string | null;
  ownerJudokaId: string;
  name: string;
  competitionDate: string;
  ageCategory: string;
  weightCategory: string;
  level: string;
  result: string | null;
  coachObjective: string;
  coachReview: string;
}

export interface CombatScore {
  category: string;
  technique?: string;
  neWazaType?: string;
  value: string;
}

export interface CombatSideScore {
  ippon: number;
  wazaAri: number;
  yuko: number;
}

export interface CombatOfficialScore {
  judoka: CombatSideScore;
  opponent: CombatSideScore;
}

export interface Combat {
  combatId: string;
  judokaId: string;
  competitionId: string;
  opponent: string;
  opponentStance?: string;
  stage?: string;
  result: "Victoire" | "Défaite" | "Egalité";
  victoryType?: string;
  scores: CombatScore[];
  /** Points marqués par l'adversaire (techniques subies). */
  concededScores?: CombatScore[];
  /** Score officiel IWY - IWY ; null = non renseigné. */
  officialScore?: CombatOfficialScore | null;
  notes?: string;
}

/**
 * A {@link Combat} enriched with the display name of the judoka it belongs to.
 */
export type CombatReadModel = Combat & { judokaDisplayName: string; judokaHandedness?: string };

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
  /** Clubs coachés par l'utilisateur (vide si l'utilisateur n'est pas coach). */
  coachClubIds?: string[];
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
}

export interface AdminsManagement {
  user: Judoka;
  admins: Judoka[];
  users: Judoka[];
  accessInvitations: AccessInvitation[];
}

export interface ClubsManagement {
  clubs: { clubId: string; name: string; coachIds: string[]; judokaCount: number }[];
  coaches: Pick<Judoka, "judokaId" | "firstName" | "lastName" | "accountEmail">[];
}

export interface UserImportRowResult {
  row: number;
  name: string;
  email: string | null;
  success: boolean;
  message: string;
}

export interface UserImportSummary {
  success: boolean;
  imported: number;
  failed: number;
  results: UserImportRowResult[];
}

export interface CompetitionDetail {
  competition: Competition;
  combats: CombatReadModel[];
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
  canManageCompetition: boolean;
  canEditCompetition: boolean;
  hasInheritedClubCompetitionFields: boolean;
  judokas: Judoka[];
}

/**
 * `clubCompetition` is the raw Supabase row for the club competition.
 */
export interface ClubCompetitionDetail {
  clubCompetition: ClubCompetitionRow;
  participations: Competition[];
  judokas: Judoka[];
  /** Bilan des combats saisis, indexé par identifiant de participation. */
  combatRecords?: Record<string, { total: number; wins: number; losses: number; draws: number }>;
}

export interface SeasonBounds {
  start: string;
  end: string;
  label: string;
}

export interface DecisionBreakdownEntry {
  decisionType: string;
  count: number;
  total: number;
  rate: number;
}

export interface TechniqueBreakdownEntry {
  technique: string;
  count: number;
}

export interface CompetitionResultBadge {
  label: string;
  className: string;
}

export interface CoachDashboardFilters {
  /** Limite les statistiques à un des clubs du coach. */
  clubId?: string;
  competitionIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  ageCategory?: string;
}

export interface CoachDashboardLateralMatchupBreakdownEntry {
  matchup: "same" | "opposite";
  label: string;
  combats: number;
  victories: number;
  victoryRate: number;
}

export interface CoachDashboardGenderBreakdownEntry {
  gender: string;
  judokaCount: number;
}

export interface CoachDashboardHandednessBreakdownEntry {
  handedness: string;
  judokaCount: number;
}

export interface CoachDashboardQualityIssueEntry {
  criterion: string;
  label: string;
  count: number;
  total: number;
  rate: number;
}

export interface CoachDashboardPodiumBreakdownEntry {
  place: "1er" | "2e" | "3e";
  label: string;
  count: number;
}

export interface CoachDashboardLevelPodiumBreakdownEntry {
  level: string;
  podiums: CoachDashboardPodiumBreakdownEntry[];
}

export interface CoachDashboardStats {
  analyzedCompetitions: number;
  totalCombats: number;
  victories: number;
  victoryRate: number;
  tachiWazaIpponVictories: number;
  tachiWazaIpponVictoryRate: number;
  neWazaIpponVictories: number;
  neWazaIpponVictoryRate: number;
  victoriesByDecisionType: DecisionBreakdownEntry[];
  defeatsByDecisionType: DecisionBreakdownEntry[];
  byLateralMatchup: CoachDashboardLateralMatchupBreakdownEntry[];
  judokasByGender: CoachDashboardGenderBreakdownEntry[];
  judokasByHandedness: CoachDashboardHandednessBreakdownEntry[];
  dataQualityIssues: CoachDashboardQualityIssueEntry[];
  podiumsByLevel: CoachDashboardLevelPodiumBreakdownEntry[];
  topWinTechniques: TechniqueBreakdownEntry[];
}

export interface CoachDashboardCompetitionOption {
  competitionId: string;
  competitionIds: string[];
  name: string;
  competitionDate: string;
}

export interface CoachDashboard {
  stats: CoachDashboardStats;
  availableCompetitions: CoachDashboardCompetitionOption[];
}

export interface CoachChatFilters {
  ageCategory?: string;
  beltColor?: string;
  categoryYear?: string;
  competitionDate?: string;
  competitionLevel?: string;
  gender?: string;
  handedness?: string;
  neWazaType?: string;
  opponent?: string;
  opponentStance?: string;
  result?: string;
  scoreValue?: string;
  tachiWazaTechnique?: string;
  victoryType?: string;
  text?: string[];
}

export interface CoachAssistantMatch {
  judokaId: string;
  judokaName: string;
  beltColor: string;
  gender: string;
  yearInCategory: string;
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  opponent: string;
  result: string;
  victoryType: string;
  scoreLabel: string;
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
  victoriesByDecisionType: DecisionBreakdownEntry[];
  defeatsByDecisionType: DecisionBreakdownEntry[];
  topWinTechniques: TechniqueBreakdownEntry[];
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
  competitions: Competition[];
  /** Bilan des combats saisis, indexé par identifiant de compétition. */
  combatRecords?: Record<string, { total: number; wins: number; losses: number; draws: number }>;
  clubCompetitions: { clubCompetitionId: string; name: string; competitionDate: string; clubId?: string }[];
  /** Clubs coachés par l'utilisateur (vide si l'utilisateur n'est pas coach). */
  clubs?: Club[];
  judokas: Judoka[];
}

export type McpScope =
  | "access:read"
  | "judokas:read"
  | "competitions:read"
  | "competitions:write"
  | "combats:read"
  | "combats:write"
  | "coach-dashboard:read";

export interface McpTokenClaims {
  sub: string;
  email: string;
  role: string;
  scopes: McpScope[];
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface McpAuthorizationCodeClaims {
  email: string;
  role: string;
  scopes: McpScope[];
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface McpRegisteredClientClaims {
  redirectUris: string[];
  clientName: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

/**
 * The full backend RPC registry exposed via `/api/rpc`. Each property is a
 * method name dispatched by `body.method` in `api/rpc.js`.
 */
export interface RpcMethods {
  /** Charge le contexte de l'utilisateur courant, ses compétitions et celles du club. */
  getInitialData: (email: string) => Promise<InitialData>;
  /** Calcule le profil saisonnier d'un judoka (soi-même par défaut, ou un profil accessible). */
  getJudokaProfile: (email: string, idJudoka?: string, seasonStartYear?: number) => Promise<JudokaProfile>;
  /** Finalise l'inscription d'un compte après une invitation. */
  registerProfile: (email: string, profile: object) => Promise<object>;
  /** Supprime définitivement un utilisateur et ses compétitions/combats. */
  deleteUser: (email: string, idJudoka: string) => Promise<OperationResult>;
  /** Annule une invitation d'accès en attente. */
  deleteAccessInvitation: (email: string, invitedEmail: string) => Promise<OperationResult>;
  /** Liste les administrateurs, les utilisateurs et les invitations d'accès en attente. */
  getAdminsManagement: (email: string) => Promise<AdminsManagement>;
  /** Promeut un judoka au rôle administrateur. */
  grantAdminRole: (email: string, targetEmail: string) => Promise<OperationResult>;
  /** Retire le rôle administrateur d'un judoka. */
  revokeAdminRole: (email: string, idJudoka: string) => Promise<OperationResult>;
  /** Liste les clubs (avec leurs coachs et leur nombre de judokas) et les coachs. Admin uniquement. */
  getClubsManagement: (email: string) => Promise<ClubsManagement>;
  /** Crée un club, ou le renomme si clubId est fourni. Admin uniquement. */
  saveClub: (email: string, input: { clubId?: string; name?: string }) => Promise<OperationResult>;
  /** Supprime un club sans judoka, sans coach et sans compétition. Admin uniquement. */
  deleteClub: (email: string, idClub: string) => Promise<OperationResult>;
  /** Remplace la liste des clubs coachés par un coach. Admin uniquement. */
  setCoachClubs: (email: string, idCoach: string, clubIds: string[]) => Promise<OperationResult>;
  /** Rattache un judoka à un club (ou l'en retire avec null). Admin uniquement. */
  setJudokaClub: (email: string, idJudoka: string, idClub: string | null) => Promise<OperationResult>;
  /** Importe des profils JUDOKA/PARENT en masse depuis un fichier CSV. */
  importUsersCsv: (email: string, csvContent: string) => Promise<UserImportSummary>;
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
  /** Enregistre l'objectif pré-compétition défini par le coach. */
  saveCoachObjective: (email: string, idCompetition: string, objective: string) => Promise<OperationResult>;
  /** Enregistre le bilan post-compétition rédigé par le coach. */
  saveCoachReview: (email: string, idCompetition: string, review: string) => Promise<OperationResult>;
  /** Met à jour la catégorie d'âge, le poids, la ceinture, le genre, l'année dans la catégorie et la garde d'un judoka. */
  saveJudokaInfo: (
    email: string,
    idJudoka: string,
    ageCategory: string,
    weightCategory: string,
    beltColor: string,
    gender: string,
    yearInCategory: string,
    handedness: string
  ) => Promise<OperationResult>;
  /** Ajoute un combat à une compétition. */
  ajouterCombat: (email: string, combat: Record<string, unknown>) => Promise<OperationResult>;
  /** Supprime un combat. */
  deleteCombat: (email: string, idCombat: string) => Promise<OperationResult>;
  /** Met à jour un combat existant. */
  updateCombat: (email: string, combat: Record<string, unknown>) => Promise<OperationResult>;
  /** Calcule les statistiques agrégées du tableau de bord coach selon les filtres fournis. */
  getCoachDashboard: (email: string, filters: CoachDashboardFilters) => Promise<CoachDashboard>;
  /** Cherche des combats visibles par le coach selon des filtres structurés (outil MCP combats.search). */
  searchCombats: (
    email: string,
    filters?: CoachChatFilters,
    limit?: number
  ) => Promise<{ matches: CoachAssistantMatch[] }>;
}
