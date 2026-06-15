import type {
  AccessInvitation,
  AdminsManagement,
  ChildrenManagement,
  ClubCompetitionDetail,
  CombatReadModel,
  Competition,
  CompetitionDetail,
  InitialData,
  Judoka,
  JudokaProfile,
  ManagedChild,
  OperationResult,
  RpcMethods
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

export interface VueLike {
  reactive<T extends object>(value: T): T;
  createApp(options: { setup(): Record<string, unknown> }): { mount(selector: string): void };
  toRefs<T extends object>(value: T): { [K in keyof T]: { value: T[K] } };
  nextTick(callback: () => void): Promise<void>;
}

export type ActionMap = Record<string, (...args: never[]) => unknown>;

export type ViewId =
  | "loginView"
  | "homeView"
  | "judokaView"
  | "adminsView"
  | "childrenView"
  | "competitionView"
  | "clubCompetitionFormView"
  | "clubCompetitionDetailView"
  | "competitionFormView"
  | "competitionFinalizationView"
  | "combatFormView";

export interface KirokuUi {
  $(id: string): HTMLElement;
  cleanText(value: unknown): string;
  createMountedViewModel<T extends object>(id: string, defaultState: T, actions?: ActionMap): T;
  formatDate(value: unknown): string;
  formatDateTime(value: unknown): string;
  formatResultat(value: unknown): string;
  getClassementBadgeClass(value: unknown): string;
  getCompactJudokaLabel(judoka: Partial<Judoka> | null | undefined): string;
  getCurrentLocalDate(): string;
  getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
  getJudokaInitials(judoka: Partial<Judoka> | null | undefined): string;
  mountViewModel<T extends object>(id: string, viewModel: T, actions?: ActionMap): void;
  normalizeDisplayName(value: unknown): string;
  normalizeLastName(value: unknown): string;
  showView(id: ViewId): void;
  toInputDate(value: unknown): string;
  viewIds: readonly ViewId[];
}

export interface ManagedChildCard {
  judokaId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  accountEmail: string;
  directAccessState: string;
}

export interface ManagedAdminCard {
  judokaId: string;
  fullName: string;
  accountEmail: string;
  isCurrentAdmin: boolean;
}

export interface AccessInvitationCard {
  email: string;
  invitedProfileType: string;
  createdAt: string;
}

export interface CompetitionCombatCard {
  combatId: string;
  judokaId: string;
  competitionId: string;
  opponent: string;
  result: string;
  victoryType?: string;
  resultClass: string;
  judokaDisplayName: string;
  showJudoka: boolean;
  canEdit: boolean;
  notes: string;
}

export interface ScreenProjections {
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
  projectAccessInvitations(
    filteredInvitations: AccessInvitation[],
    search: string,
    currentPage: number,
    pageSize: number,
    helpers: { formatDateTime(value: unknown): string }
  ): {
    accessInvitations: AccessInvitationCard[];
    accessInvitationsSummary: string;
    accessInvitationsEmptyMessage: string;
    canResetAccessInvitationSearch: boolean;
    canShowPreviousAccessInvitationPage: boolean;
    canShowNextAccessInvitationPage: boolean;
    hasAccessInvitations: boolean;
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
  projectManagedChildren(
    children: Judoka[],
    helpers: {
      getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
      normalizeDisplayName(value: unknown): string;
      normalizeLastName(value: unknown): string;
    }
  ): {
    children: ManagedChildCard[];
    hasChildren: boolean;
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
  showHome(): void;
  showChildrenManagement?(keepMessage?: boolean): void;
}

export interface JudokaScreen {
  renderJudokaProfile(): void;
  showJudokaProfile(idJudoka?: string, keepMessage?: boolean): void;
}

export interface CompetitionScreen {
  bindEvents(): void;
  confirmDeleteClubCompetitionById(idClubCompetition: string, name?: string): void;
  deleteCompetitionFromList(idCompetition: string, name?: string): void;
  openClubCompetition(idClubCompetition: string): void;
  openCompetition(idCompetition: string, keepMessage?: boolean): void;
  showClubCompetitionForm(idClubCompetition?: string): void;
  showCompetitionForm(idCompetition?: string): void;
}

export interface ChildrenScreen {
  showChildrenManagement(keepMessage?: boolean): void;
}

export interface AdminsScreen {
  showAdminsManagement(keepMessage?: boolean): void;
}

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
  children: ChildrenScreen;
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
  canManageChildren: boolean;
  competitions: Competition[];
  clubCompetitions: Array<{ clubCompetitionId: string; name: string; competitionDate: string }>;
  currentCompetition: CompetitionDetail["competition"] | null;
  judokas: Judoka[];
  currentCombats: CompetitionDetail["combats"];
  currentJudokaProfile: JudokaProfile | null;
  managedAdmins: AdminsManagement["admins"];
  managedAccessInvitations: AdminsManagement["accessInvitations"];
  managedChildren: ChildrenManagement["children"];
  canEditCurrentCompetition: boolean;
  previousView: ViewId;
  accessInvitationSearch: string;
  accessInvitationCurrentPage: number;
  competitionsCurrentPage: number;
  clubCompetitionsCurrentPage: number;
  clubCompetitionParticipantsCurrentPage: number;
  clubCompetitionAvailableJudokasCurrentPage: number;
  clubCompetitionFormParticipantsCurrentPage: number;
  judokaCompetitionResultsCurrentPage: number;
  adminsCurrentPage: number;
}

export interface RunServerOptions {
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
  defaultAccessInvitationVisibleCount: number;
  defaultListPageSize: number;
  loginScreen?: LoginScreen;
  notifications: NotificationsApi;
  reloadInitialData(openCompetitionId?: string): void;
  reloadInitialDataAndShowAdmins(): void;
  reloadInitialDataAndShowChildren(): void;
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
  ChildrenManagement,
  ClubCompetitionDetail,
  CombatReadModel,
  Competition,
  CompetitionDetail,
  InitialData,
  Judoka,
  JudokaProfile,
  ManagedChild,
  OperationResult
};
