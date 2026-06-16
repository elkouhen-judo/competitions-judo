import type {
  AppScreens,
  AuthApi,
  InitialData,
  KirokuApp,
  KirokuAppState,
  NotificationsApi,
  OperationResult,
  RpcClientArgs,
  RpcClientMethod,
  RpcClientResult,
  RunServerOptions,
  RuntimeConfig,
  ViewId
} from "./types";

function createInitialState(): KirokuAppState {
  return {
    currentUser: null,
    isAdmin: false,
    isCoach: false,
    isParent: false,
    homeMode: "judoka",
    canManageChildren: false,
    competitions: [],
    clubCompetitions: [],
    currentCompetition: null,
    judokas: [],
    currentCombats: [],
    currentJudokaProfile: null,
    managedAdmins: [],
    managedAccessInvitations: [],
    managedChildren: [],
    canEditCurrentCompetition: false,
    isLoadingCompetition: false,
    homeFilterJudokaId: "",
    previousView: "homeView",
    accessInvitationSearch: "",
    accessInvitationCurrentPage: 1,
    competitionsCurrentPage: 1,
    clubCompetitionsCurrentPage: 1,
    clubCompetitionParticipantsCurrentPage: 1,
    clubCompetitionAvailableJudokasCurrentPage: 1,
    clubCompetitionFormParticipantsCurrentPage: 1,
    judokaCompetitionResultsCurrentPage: 1,
    adminsCurrentPage: 1
  };
}

(() => {

  window.createKirokuApp = function createKirokuApp() {
    const runtimeConfig: RuntimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const defaultAccessInvitationVisibleCount = 5;
    const defaultListPageSize = 10;
    const state = window.Vue.reactive(createInitialState());

    const ui = window.KirokuUI;
    const { $, viewIds } = ui;
    const notifications: NotificationsApi = window.createKirokuNotifications();
    const { clearMessage, showError, showSuccess } = notifications;

    let loginScreen: AppScreens["login"] | undefined;

    function getLoginScreen(): AppScreens["login"] {
      if (!loginScreen) {
        throw new Error("Écran de connexion non initialisé.");
      }
      return loginScreen;
    }

    const headerViewModel = window.Vue.reactive({
      showHeader: false,
      userName: "",
      roleLabel: ""
    });

    ui.mountViewModel("appHeader", headerViewModel, {
      logoutUser
    });

    const auth: AuthApi = window.createKirokuAuth({
      runtimeConfig,
      onInvitationRequired: () => loginScreen && loginScreen.showInvitationRequired(),
      onError: showError
    });
    const { clearVercelSession, getValidVercelSession, logoutSupabaseSession } = auth;

    ui.showView = showView;

    const screens = {} as AppScreens;
    const app: KirokuApp = {
      applyInitialData,
      auth,
      confirmAndRun,
      defaultAccessInvitationVisibleCount,
      defaultListPageSize,
      notifications,
      reloadInitialData,
      reloadInitialDataAndShowAdmins,
      reloadInitialDataAndShowChildren,
      reloadInitialDataThen,
      resetApplicationState,
      runtimeConfig,
      runServer,
      runServerWithOptions,
      setHeaderVisible,
      screens,
      state,
      ui
    };

    screens.home = window.createKirokuHomeScreen(app);
    screens.judoka = window.createKirokuJudokaScreen(app);
    screens.competition = window.createKirokuCompetitionScreen(app);
    screens.children = window.createKirokuChildrenScreen(app);
    screens.admins = window.createKirokuAdminsScreen(app);
    loginScreen = window.createKirokuLoginScreen(app);
    screens.login = loginScreen;
    app.loginScreen = loginScreen;

    async function runServer<M extends RpcClientMethod>(
      method: M,
      args: RpcClientArgs<M>,
      success?: (result: RpcClientResult<M>) => void,
      failure?: (error: unknown) => void
    ) {
      return runServerWithOptions(method, args, success, failure);
    }

    function getResponsePreview(body: unknown) {
      return String(body || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
    }

    async function readJsonResponse<T>(response: Response, invalidMessage: string): Promise<T | null> {
      const body = await response.text();
      if (!body) {
        return null;
      }

      try {
        return JSON.parse(body) as T;
      } catch (_error) {
        const preview = getResponsePreview(body);
        throw new Error(preview ? `${invalidMessage} ${preview}` : invalidMessage);
      }
    }

    async function runServerWithOptions<M extends RpcClientMethod>(
      method: M,
      args: RpcClientArgs<M>,
      success?: (result: RpcClientResult<M>) => void,
      failure?: (error: unknown) => void,
      options: RunServerOptions = {}
    ) {
      const maxAttempts = options.retrySessionOnce ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const session = await getValidVercelSession();
          if (!session) {
            getLoginScreen().showVercelLogin();
            return;
          }

          const response = await fetch("/api/rpc", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + session.access_token,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ method, args })
          });
          const payload = await readJsonResponse<{
            error?: string;
            result?: RpcClientResult<M>;
          }>(response, "Réponse invalide reçue depuis /api/rpc.");
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new Error("Réponse vide ou invalide reçue depuis /api/rpc.");
          }

          if (!response.ok || payload.error || payload.result === undefined) {
            throw new Error(payload.error || "Erreur serveur.");
          }

          success?.(payload.result);
          return;
        } catch (error) {
          const errorMessage =
            error && typeof error === "object" && "message" in error
              ? String((error as { message?: unknown }).message || "")
              : String(error || "");
          if (
            options.retrySessionOnce &&
            attempt < maxAttempts &&
            isSessionAuthError(errorMessage)
          ) {
            await wait(600);
            continue;
          }

          if (isSessionAuthError(errorMessage)) {
            clearVercelSession();
            getLoginScreen().showVercelLogin();
          } else if (method === "getInitialData" && errorMessage.includes("Invitation trouvée")) {
            getLoginScreen().showProfileRegistration();
            return;
          } else if (
            method === "getInitialData" &&
            errorMessage.includes("invitation est requise")
          ) {
            clearVercelSession();
            getLoginScreen().showInvitationRequired();
            return;
          }
          failure ? failure(error) : showError(error);
          return;
        }
      }
    }

    function isSessionAuthError(message: string) {
      return (
        message.includes("Session Supabase invalide") ||
        message.includes("Utilisateur non identifié")
      );
    }

    function wait(delayMs: number): Promise<void> {
      return new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }

    function resetApplicationState() {
      Object.assign(state, createInitialState());
    }

    async function logoutUser() {
      clearMessage();
      await logoutSupabaseSession();
      resetApplicationState();
      getLoginScreen().showVercelLogin();
      showSuccess("Vous êtes déconnecté.");
    }

    function applyInitialData(data: InitialData) {
      state.currentUser = data.user;
      state.isAdmin = Boolean(data.isAdmin);
      state.isCoach = Boolean(data.isCoach);
      state.isParent = Boolean(data.isParent);
      state.canManageChildren = Boolean(data.canManageChildren);
      state.competitions = Array.isArray(data.competitions) ? data.competitions : [];
      state.clubCompetitions = Array.isArray(data.clubCompetitions) ? data.clubCompetitions : [];
      state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
      const profileTypeLabel = state.isParent ? "PARENT" : "JUDOKA";
      const roleLabel = state.isAdmin
        ? `ADMIN · ${profileTypeLabel}`
        : state.isCoach
          ? `COACH · ${profileTypeLabel}`
          : profileTypeLabel;
      Object.assign(headerViewModel, {
        showHeader: true,
        userName: ui.getJudokaDisplayName(state.currentUser) || "",
        roleLabel
      });
      screens.home.applyInitialData();
    }

    function setHeaderVisible(visible: boolean) {
      headerViewModel.showHeader = Boolean(visible);
    }

    function confirmAndRun<M extends RpcClientMethod>({
      message,
      method,
      args,
      onSuccess
    }: {
      message: string;
      method: M;
      args: RpcClientArgs<M>;
      onSuccess?: (response: RpcClientResult<M>) => void;
    }) {
      if (!window.confirm(message)) {
        return;
      }

      runServer(method, args, onSuccess, showError);
    }

    function reloadInitialData(openCompetitionId?: string) {
      reloadInitialDataThen(() => {
        if (openCompetitionId) {
          screens.competition.openCompetition(openCompetitionId, true);
        } else {
          showHome();
        }
      });
    }

    function reloadInitialDataThen(afterReload: () => void) {
      runServer(
        "getInitialData",
        [],
        (data) => {
          applyInitialData(data);
          afterReload();
        },
        showError
      );
    }

    function reloadInitialDataAndShowChildren() {
      reloadInitialDataThen(() => screens.children.showChildrenManagement(true));
    }

    function reloadInitialDataAndShowAdmins() {
      reloadInitialDataThen(() => screens.admins.showAdminsManagement(true));
    }

    function showHome() {
      screens.home.showHome();
    }

    function showView(id: ViewId) {
      viewIds.forEach((viewId) => {
        $(viewId).classList.add("hidden");
      });

      $(id).classList.remove("hidden");
    }

    app.showHome = showHome;

    return app;
  };
})();
