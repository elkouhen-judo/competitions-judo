import type {
  AdminsScreen,
  AuthApi,
  CoachDashboardScreen,
  CompetitionScreen,
  CompetitionFormHelpers,
  HomeScreen,
  JudokaProfile,
  JudokaProfilePresentationHelpers,
  JudokaProfileViewModel,
  JudokaScreen,
  KirokuApp,
  KirokuUi,
  LoginScreen,
  NotificationsApi,
  RuntimeConfig,
  ScreenProjections,
  VueLike
} from "./types";

declare global {
  interface Window {
    Vue: VueLike;
    KIROKU_RUNTIME_CONFIG: RuntimeConfig;
    KirokuUI: KirokuUi;
    KirokuScreenProjections: ScreenProjections;
    KirokuCompetitionFormHelpers: CompetitionFormHelpers;
    createKirokuApp: () => KirokuApp;
    createKirokuAuth: (config: {
      runtimeConfig: RuntimeConfig;
      onInvitationRequired: () => void;
      onError: (error: unknown) => void;
    }) => AuthApi;
    createKirokuNotifications: () => NotificationsApi;
    createJudokaProfileViewModel: (
      profile: JudokaProfile | null,
      helpers: JudokaProfilePresentationHelpers
    ) => JudokaProfileViewModel | null;
    createKirokuHomeScreen: (app: KirokuApp) => HomeScreen;
    createKirokuJudokaScreen: (app: KirokuApp) => JudokaScreen;
    createKirokuCompetitionScreen: (app: KirokuApp) => CompetitionScreen;
    createKirokuAdminsScreen: (app: KirokuApp) => AdminsScreen;
    createKirokuCoachDashboardScreen: (app: KirokuApp) => CoachDashboardScreen;
    createKirokuLoginScreen: (app: KirokuApp) => LoginScreen;
  }
}

export {};
