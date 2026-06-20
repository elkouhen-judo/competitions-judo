import type {
  AccessInvitation,
  AdminsManagement,
  ClubCompetitionDetail,
  CoachAssistantResponse,
  CombatReadModel,
  CombatScore,
  Competition,
  CompetitionDetail,
  InitialData,
  Judoka,
  JudokaProfile,
  OperationResult,
  RpcMethods,
  UserImportRowResult
} from "../core/types";

export interface RuntimeConfig {
  runtime?: string;
  appUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface SessionLike {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface AuthCallbackResult {
  handled?: boolean;
  completedAuth?: boolean;
}

export interface ToastErrorLike {
  message?: string;
}

export interface ComputedRef<T> {
  readonly value: T;
}

export interface VueLike {
  reactive<T extends object>(value: T): T;
  computed<T>(getter: () => T): ComputedRef<T>;
  createApp(options: { setup(): Record<string, unknown> }): { mount(selector: string): void };
  toRefs<T extends object>(value: T): { [K in keyof T]: { value: T[K] } };
  nextTick(callback: () => void): Promise<void>;
}

export type ActionMap = Record<string, (...args: never[]) => unknown>;
export type ComputedRefMap = Record<string, ComputedRef<unknown>>;

export interface PaginationResult<T> {
  pageItems: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  canShowPreviousPage: boolean;
  canShowNextPage: boolean;
}

export interface PaginationRefs<T> {
  page: ComputedRef<T[]>;
  totalPages: ComputedRef<number>;
  currentPage: ComputedRef<number>;
  totalCount: ComputedRef<number>;
  canShowPreviousPage: ComputedRef<boolean>;
  canShowNextPage: ComputedRef<boolean>;
}

export type ViewId =
  | "loginView"
  | "homeView"
  | "judokaView"
  | "adminsView"
  | "competitionView"
  | "clubCompetitionFormView"
  | "clubCompetitionDetailView"
  | "competitionFormView"
  | "competitionFinalizationView"
  | "combatFormView"
  | "coachDashboardView";

export interface KirokuUi {
  $(id: string): HTMLElement;
  cleanText(value: unknown): string;
  createMountedViewModel<T extends object>(
    id: string,
    defaultState: T,
    actions?: ActionMap,
    computedRefs?: ComputedRefMap
  ): T;
  createPaginationRefs<T>(pagination: ComputedRef<PaginationResult<T>>): PaginationRefs<T>;
  formatDate(value: unknown): string;
  formatDateTime(value: unknown): string;
  formatResultat(value: unknown): string;
  getClassementBadgeClass(value: unknown): string;
  getCompactJudokaLabel(judoka: Partial<Judoka> | null | undefined): string;
  getCurrentLocalDate(): string;
  getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
  getJudokaInitials(judoka: Partial<Judoka> | null | undefined): string;
  mountViewModel<T extends object>(
    id: string,
    viewModel: T,
    actions?: ActionMap,
    computedRefs?: ComputedRefMap
  ): void;
  normalizeDisplayName(value: unknown): string;
  normalizeLastName(value: unknown): string;
  showView(id: ViewId, options?: { replace?: boolean; skipHistory?: boolean; preserveScroll?: boolean }): void;
  toInputDate(value: unknown): string;
  viewIds: readonly ViewId[];
}

export interface ManagedAdminCard {
  judokaId: string;
  fullName: string;
  accountEmail: string;
  isCurrentAdmin: boolean;
}

export interface ManagedUserCard {
  judokaId: string;
  fullName: string;
  accountEmail: string;
  roleLabel: string;
  isAdmin: boolean;
  isCurrentUser: boolean;
  isPending: boolean;
}

export interface CompetitionCombatCard {
  combatId: string;
  judokaId: string;
  competitionId: string;
  opponent: string;
  opponentStance: string;
  judokaHandedness: string;
  result: string;
  victoryType?: string;
  scoreLabels: string[];
  missingMetricLabels: string[];
  resultClass: string;
  judokaDisplayName: string;
  showJudoka: boolean;
  canEdit: boolean;
  notes: string;
}

export interface ScreenProjections {
  getWeightCategoryOptions(ageCategory: string, gender?: string): string[];
  getYearInCategoryOptions(ageCategory: string): string[];
  paginateList<T>(
    items: T[] | null | undefined,
    currentPage: number,
    pageSize: number
  ): {
    pageItems: T[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
    canShowPreviousPage: boolean;
    canShowNextPage: boolean;
  };
  projectCompetitionCombats(
    combats: CombatReadModel[],
    helpers: {
      formatResultat(value: unknown): string;
      normalizeDisplayName(value: unknown): string;
      showJudoka: boolean;
      canEdit: boolean;
    }
  ): {
    combats: CompetitionCombatCard[];
    combatsEmptyMessage: string;
    hasCombats: boolean;
    isLoadingCombats: boolean;
  };
  projectCompetitionDetail(
    competition: Competition,
    canEditCompetition: boolean,
    helpers: { formatDate(value: unknown): string }
  ): {
    competitionTitle: string;
    competitionSubtitle: string;
    competitionDate: string;
    ageWeightLabel: string;
    competitionResult: string;
    competitionAiAnalysis: string;
    canEditCompetition: boolean;
    canFinalizeCompetition: boolean;
  };
  projectManagedAdmins(
    admins: Judoka[],
    currentUser: Judoka | null,
    helpers: { getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string }
  ): {
    admins: ManagedAdminCard[];
    hasAdmins: boolean;
  };
  projectManagedUsers(
    users: Judoka[],
    pendingInvitations: AccessInvitation[],
    search: string,
    currentPage: number,
    pageSize: number,
    currentUser: Judoka | null,
    helpers: { getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string }
  ): {
    users: ManagedUserCard[];
    usersSummary: string;
    usersEmptyMessage: string;
    canResetUsersSearch: boolean;
    canShowPreviousUsersPage: boolean;
    canShowNextUsersPage: boolean;
    hasUsers: boolean;
  };
}

export interface NotificationsApi {
  clearMessage(): void;
  dismissToast(toastId: string): void;
  showError(error: ToastErrorLike | unknown): void;
  showSuccess(message: string): void;
}

export interface AuthApi {
  clearVercelSession(): void;
  getValidVercelSession(): Promise<SessionLike | null>;
  logoutSupabaseSession(): Promise<void>;
  parseVercelAuthCallback(): Promise<AuthCallbackResult | undefined>;
  startGoogleLogin(): void;
}

export interface HomeScreen {
  applyInitialData(): void;
  getHomeActiveJudokaId(): string;
  hideHomeFilterOptions(): void;
  setHomeMode(mode: "judoka" | "coach" | "coachJudoka" | "family"): void;
  showHome(): void;
  showHomeFilterOptions(): void;
}

export interface JudokaScreen {
  showJudokaProfile(idJudoka?: string, keepMessage?: boolean): void;
}

export interface CompetitionDetailDeps {
  deleteCombat(idCombat: string): void;
  showCombatForm(idCombat?: string | Event): void;
}

export interface CompetitionDetailScreen {
  getCurrentCompetition(): Competition;
  openCompetition(idCompetition: string, keepMessage?: boolean, onLoaded?: () => void): void;
  openCompetitionFromClubDetail(idCompetition: string): void;
  openCompetitionFromJudokaProfile(idCompetition: string): void;
  showCompetitionForm(idCompetition?: string): void;
}

export interface CombatFormDeps {
  getCurrentCompetition(): Competition;
  openCompetition(idCompetition: string, keepMessage?: boolean, onLoaded?: () => void): void;
}

export interface CombatFormScreen {
  bindEvents(): void;
  deleteCombat(idCombat: string): void;
  showCombatForm(idCombat?: string | Event): void;
}

export interface ClubCompetitionDeps {
  openCompetitionFromClubDetail(idCompetition: string): void;
}

export interface ClubCompetitionScreen {
  confirmDeleteClubCompetitionById(idClubCompetition: string, name?: string): void;
  openClubCompetition(idClubCompetition: string): void;
  showClubCompetitionForm(idClubCompetition?: string): void;
}

export interface CompetitionScreen {
  bindEvents(): void;
  confirmDeleteClubCompetitionById(idClubCompetition: string, name?: string): void;
  openClubCompetition(idClubCompetition: string): void;
  openCompetition(idCompetition: string, keepMessage?: boolean, onLoaded?: () => void): void;
  openCompetitionFromJudokaProfile(idCompetition: string): void;
  showClubCompetitionForm(idClubCompetition?: string): void;
  showCompetitionForm(idCompetition?: string): void;
}

export interface AdminsScreen {
  showAdminsManagement(keepMessage?: boolean): void;
}

export interface CoachDashboardScreen {
  showCoachDashboard(): void;
  showCoachChat(): void;
}

export type { CoachAssistantResponse };

export interface LoginScreen {
  bindEvents(): void;
  init(): Promise<void>;
  showInvitationRequired(): void;
  showProfileRegistration(): void;
  showVercelLogin(): void;
  startGoogleLogin(): void;
}

export interface AppScreens {
  admins: AdminsScreen;
  coachDashboard: CoachDashboardScreen;
  competition: CompetitionScreen;
  home: HomeScreen;
  judoka: JudokaScreen;
  login: LoginScreen;
}

export interface KirokuAppState {
  currentUser: Judoka | null;
  isAdmin: boolean;
  isCoach: boolean;
  isParent: boolean;
  homeMode: "judoka" | "coach" | "coachJudoka" | "family";
  competitions: Competition[];
  clubCompetitions: Array<{ clubCompetitionId: string; name: string; competitionDate: string }>;
  currentCompetition: CompetitionDetail["competition"] | null;
  judokas: Judoka[];
  currentCombats: CompetitionDetail["combats"];
  currentJudokaProfile: JudokaProfile | null;
  managedAdmins: AdminsManagement["admins"];
  managedUsers: AdminsManagement["users"];
  managedAccessInvitations: AdminsManagement["accessInvitations"];
  canEditCurrentCompetition: boolean;
  isLoadingCompetition: boolean;
  isSubmitting: boolean;
  isOnline: boolean;
  pendingRpcKeys: Record<string, boolean>;
  homeFilterJudokaId: string;
  competitionsCurrentPage: number;
  clubCompetitionsCurrentPage: number;
  clubCompetitionParticipantsCurrentPage: number;
  clubCompetitionAvailableJudokasCurrentPage: number;
  clubCompetitionFormParticipantsCurrentPage: number;
  judokaCompetitionResultsCurrentPage: number;
  adminsCurrentPage: number;
  usersSearch: string;
  usersCurrentPage: number;
}

export interface RunServerOptions {
  actionKey?: string;
  retrySessionOnce?: boolean;
}

export type RpcClientMethod = keyof RpcMethods;
export type RpcClientArgs<M extends RpcClientMethod> = RpcMethods[M] extends (
  email: string,
  ...args: infer TArgs
) => Promise<unknown>
  ? TArgs
  : never;
export type RpcClientResult<M extends RpcClientMethod> = Awaited<ReturnType<RpcMethods[M]>>;

export interface KirokuApp {
  applyInitialData(data: InitialData): void;
  auth: AuthApi;
  confirmAndRun<M extends RpcClientMethod>(config: {
    message: string;
    method: M;
    args: RpcClientArgs<M>;
    onSuccess?: (response: RpcClientResult<M>) => void;
  }): void;
  defaultListPageSize: number;
  loginScreen?: LoginScreen;
  notifications: NotificationsApi;
  reloadInitialData(openCompetitionId?: string): void;
  reloadInitialDataAndShowAdmins(): void;
  reloadInitialDataThen(afterReload: () => void): void;
  resetApplicationState(): void;
  runServer<M extends RpcClientMethod>(
    method: M,
    args: RpcClientArgs<M>,
    success?: (result: RpcClientResult<M>) => void,
    failure?: (error: unknown) => void
  ): Promise<void>;
  runServerWithOptions<M extends RpcClientMethod>(
    method: M,
    args: RpcClientArgs<M>,
    success?: (result: RpcClientResult<M>) => void,
    failure?: (error: unknown) => void,
    options?: RunServerOptions
  ): Promise<void>;
  runtimeConfig: RuntimeConfig;
  screens: AppScreens;
  setHeaderVisible(visible: boolean): void;
  showHome?(): void;
  state: KirokuAppState;
  ui: KirokuUi;
}

export interface JudokaProfilePresentationHelpers {
  formatDate(value: unknown): string;
  getClassementBadgeClass(value: unknown): string;
  getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
  getJudokaInitials(judoka: Partial<Judoka> | null | undefined): string;
}

export interface CombatScoreFormRow {
  category: string;
  technique: string;
  neWazaType: string;
  value: string;
}

export interface CompetitionFormHelpers {
  createEmptyCombatScoreRow(): CombatScoreFormRow;
  isCombatScoreRowComplete(score: CombatScoreFormRow): boolean;
  tachiWazaTechniques: string[];
}

export interface JudokaProfileViewModel {
  profileTitle: string;
  profileSubtitle: string;
  seasonLabel: string;
  seasonCompetitionCount: string;
  seasonCombatCount: string;
  seasonWins: string;
  seasonLosses: string;
  seasonDraws: string;
  victoryRate: string;
  heroAvatar: string;
  heroName: string;
  heroSummary: string;
  heroCategory: string;
  heroWeightCategory: string;
  heroBeltColor: string;
  heroGender: string;
  heroYearInCategory: string;
  heroHandedness: string;
  heroSeason: string;
  combatProfile: Record<string, string>;
  hasCombatProfileExtras: boolean;
  competitionResults: Array<{
    competitionId: string;
    name: string;
    date: string;
    result: string;
    resultClass: string;
    badgeClass: string;
    combatRecord: string;
  }>;
  hasCompetitionResults: boolean;
}

export type {
  AccessInvitation,
  AdminsManagement,
  ClubCompetitionDetail,
  CombatReadModel,
  CombatScore,
  Competition,
  CompetitionDetail,
  InitialData,
  Judoka,
  JudokaProfile,
  OperationResult,
  UserImportRowResult
};
