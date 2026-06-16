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
    isSubmitting: false,
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    pendingRpcKeys: {},
    homeFilterJudokaId: "",
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
    const rpcTimeoutMs = 20000;
    let currentViewId: ViewId = "loginView";
    let hasNavigationState = false;

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
    setupNetworkStatus();
    setupHistoryNavigation();

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
      const pendingKey = getPendingRpcKey(method, args, options);

      if (!state.isOnline) {
        const offlineError = new Error("Connexion indisponible. Réessayez quand le réseau revient.");
        failure ? failure(offlineError) : showError(offlineError);
        return;
      }

      if (pendingKey && state.pendingRpcKeys[pendingKey]) {
        showError({ message: "Action déjà en cours. Patientez quelques secondes avant de réessayer." });
        return;
      }

      if (pendingKey) {
        state.pendingRpcKeys[pendingKey] = true;
        state.isSubmitting = true;
      }

      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
          const session = await getValidVercelSession();
          if (!session) {
            getLoginScreen().showVercelLogin();
            return;
          }

          const response = await fetchRpc(method, args, session.access_token);
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
      } finally {
        if (pendingKey) {
          delete state.pendingRpcKeys[pendingKey];
          state.isSubmitting = Object.keys(state.pendingRpcKeys).length > 0;
        }
      }
    }

    function getPendingRpcKey<M extends RpcClientMethod>(
      method: M,
      args: RpcClientArgs<M>,
      options: RunServerOptions
    ) {
      if (!isMutatingRpcMethod(String(method))) {
        return "";
      }

      return options.actionKey || `${String(method)}:${JSON.stringify(args)}`;
    }

    function isMutatingRpcMethod(method: string) {
      return !method.startsWith("get");
    }

    async function fetchRpc<M extends RpcClientMethod>(
      method: M,
      args: RpcClientArgs<M>,
      accessToken: string
    ) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), rpcTimeoutMs);
      try {
        return await fetch("/api/rpc", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ method, args }),
          signal: controller.signal
        });
      } catch (error) {
        if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
          throw new Error("Réseau trop lent. Vérifiez la connexion et réessayez.");
        }

        throw error;
      } finally {
        window.clearTimeout(timeout);
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

    function setupNetworkStatus() {
      window.addEventListener("online", () => {
        state.isOnline = true;
        showSuccess("Connexion rétablie.");
      });
      window.addEventListener("offline", () => {
        state.isOnline = false;
        showError({ message: "Connexion perdue. Les actions seront bloquées jusqu'au retour du réseau." });
      });
    }

    function setupHistoryNavigation() {
      window.addEventListener("popstate", (event) => {
        const viewId = readHistoryViewId(event.state);
        showView(viewId, { skipHistory: true, preserveScroll: true });
      });
    }

    function readHistoryViewId(stateValue: unknown): ViewId {
      if (stateValue && typeof stateValue === "object" && "kirokuView" in stateValue) {
        const viewId = String((stateValue as { kirokuView?: unknown }).kirokuView || "");
        if (isViewId(viewId)) {
          return viewId;
        }
      }

      const hashView = getViewFromHash(window.location.hash);
      return hashView || currentViewId || "homeView";
    }

    function isViewId(value: string): value is ViewId {
      return viewIds.includes(value as ViewId);
    }

    function getViewFromHash(hash: string): ViewId | "" {
      const slug = String(hash || "").replace(/^#\/?/, "");
      const found = viewIds.find((viewId) => viewId.replace(/View$/, "").toLowerCase() === slug);
      return found || "";
    }

    function getViewHash(id: ViewId) {
      return `#${id.replace(/View$/, "").toLowerCase()}`;
    }

    function syncHistory(id: ViewId, replace: boolean) {
      const stateValue = { kirokuView: id };
      const url = getViewHash(id);
      if (replace || !hasNavigationState) {
        window.history.replaceState(stateValue, "", url);
        hasNavigationState = true;
        return;
      }

      if (window.history.state && window.history.state.kirokuView === id) {
        return;
      }

      window.history.pushState(stateValue, "", url);
    }

    function focusActiveView(id: ViewId, preserveScroll: boolean) {
      const view = $(id);
      if (!preserveScroll) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      view.setAttribute("tabindex", "-1");
      window.Vue.nextTick(() => view.focus({ preventScroll: true }));
    }

    function showView(
      id: ViewId,
      options: { replace?: boolean; skipHistory?: boolean; preserveScroll?: boolean } = {}
    ) {
      viewIds.forEach((viewId) => {
        $(viewId).classList.add("hidden");
      });

      $(id).classList.remove("hidden");
      currentViewId = id;
      if (!options.skipHistory) {
        syncHistory(id, Boolean(options.replace));
      }
      focusActiveView(id, Boolean(options.preserveScroll));
    }

    app.showHome = showHome;

    return app;
  };
})();
