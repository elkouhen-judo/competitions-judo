import type {
  AppScreens,
  AuthApi,
  Competition,
  CompetitionDetail,
  InitialData,
  KirokuApp,
  KirokuAppState,
  NotificationsApi,
  PendingOfflineOperation,
  PendingOfflineOperationType,
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
    competitions: [],
    clubCompetitions: [],
    currentCompetition: null,
    judokas: [],
    currentCombats: [],
    currentJudokaProfile: null,
    managedAdmins: [],
    managedUsers: [],
    managedAccessInvitations: [],
    canEditCurrentCompetition: false,
    isLoadingCompetition: false,
    isSubmitting: false,
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    isUsingCachedData: false,
    cachedDataLoadedAt: "",
    pendingRpcKeys: {},
    pendingOperations: [],
    homeFilterJudokaId: "",
    competitionsCurrentPage: 1,
    clubCompetitionsCurrentPage: 1,
    clubCompetitionParticipantsCurrentPage: 1,
    clubCompetitionAvailableJudokasCurrentPage: 1,
    clubCompetitionFormParticipantsCurrentPage: 1,
    coachDashboardCompetitionOptionsCurrentPage: 1,
    judokaCompetitionResultsCurrentPage: 1,
    adminsCurrentPage: 1,
    usersSearch: "",
    usersCurrentPage: 1
  };
}

(() => {

  window.createKirokuApp = function createKirokuApp() {
    const runtimeConfig: RuntimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const defaultListPageSize = 10;
    const state = window.Vue.reactive(createInitialState());

    const ui = window.KirokuUI;
    const { $, viewIds } = ui;
    const notifications: NotificationsApi = window.createKirokuNotifications();
    const { clearMessage, showError, showSuccess } = notifications;

    // Assigned once below, but must stay `let`: closures defined here (getLoginScreen,
    // onInvitationRequired) capture it by reference before that assignment runs.
    // eslint-disable-next-line prefer-const
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
      roleLabel: "",
      showOfflineStatus: false,
      offlineStatusText: ""
    });
    const initialDataCachePrefix = "kiroku_initial_data:";
    const lastInitialDataCacheKey = "kiroku_initial_data:last";
    const competitionDetailCachePrefix = "kiroku_competition_detail:";
    const pendingOperationsStoragePrefix = "kiroku_pending_ops:";
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
      cancelPendingOperation,
      confirmAndRun,
      defaultListPageSize,
      loadCachedInitialData,
      notifications,
      reloadInitialData,
      reloadInitialDataAndShowAdmins,
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
    screens.admins = window.createKirokuAdminsScreen(app);
    screens.coachDashboard = window.createKirokuCoachDashboardScreen(app);
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

      if (pendingKey && state.pendingRpcKeys[pendingKey]) {
        showError({ message: "Action déjà en cours. Patientez quelques secondes avant de réessayer." });
        return;
      }

      if (pendingKey) {
        state.pendingRpcKeys[pendingKey] = true;
        state.isSubmitting = true;
      }

      try {
        if (!state.isOnline && !options.bypassOfflineQueue) {
          handleOfflineRequest(method, args, success, failure);
          return;
        }

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

          if (String(method) === "getCompetitionDetail") {
            saveCompetitionDetailCache(getCurrentUserEmailKey(), payload.result as unknown as CompetitionDetail);
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
            clearVercelSession();
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

    function getInitialDataCacheUserKey(data: InitialData) {
      return String(data.user && data.user.accountEmail || "").trim().toLowerCase();
    }

    function getInitialDataCacheStorageKey(userKey: string) {
      return userKey ? `${initialDataCachePrefix}${userKey}` : "";
    }

    function saveInitialDataCache(data: InitialData) {
      const userKey = getInitialDataCacheUserKey(data);
      const storageKey = getInitialDataCacheStorageKey(userKey);
      if (!storageKey) {
        return;
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify({ cachedAt: new Date().toISOString(), data }));
        localStorage.setItem(lastInitialDataCacheKey, storageKey);
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function readInitialDataCache(): { cachedAt: string; data: InitialData } | null {
      if (!auth.hasLocalVercelSession()) {
        return null;
      }

      const storageKey = localStorage.getItem(lastInitialDataCacheKey) || "";
      if (!storageKey || !storageKey.startsWith(initialDataCachePrefix)) {
        return null;
      }

      try {
        const cached = JSON.parse(localStorage.getItem(storageKey) || "null") as {
          cachedAt?: string;
          data?: InitialData;
        } | null;
        if (!cached || !cached.data || !cached.data.user) {
          return null;
        }

        return {
          cachedAt: cached.cachedAt || "",
          data: cached.data
        };
      } catch (_error) {
        return null;
      }
    }

    function getCurrentUserEmailKey(): string {
      return String((state.currentUser && state.currentUser.accountEmail) || "")
        .trim()
        .toLowerCase();
    }

    function getCompetitionDetailCacheKey(email: string, competitionId: string) {
      return email && competitionId ? `${competitionDetailCachePrefix}${email}:${competitionId}` : "";
    }

    function saveCompetitionDetailCache(email: string, data: CompetitionDetail) {
      const key = getCompetitionDetailCacheKey(email, (data.competition && data.competition.competitionId) || "");
      if (!key) {
        return;
      }

      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function readCompetitionDetailCache(email: string, competitionId: string): CompetitionDetail | null {
      const key = getCompetitionDetailCacheKey(email, competitionId);
      if (!key) {
        return null;
      }

      try {
        return JSON.parse(localStorage.getItem(key) || "null") as CompetitionDetail | null;
      } catch (_error) {
        return null;
      }
    }

    function getPendingOperationsStorageKey(email: string) {
      return email ? `${pendingOperationsStoragePrefix}${email}` : "";
    }

    function persistPendingOperations() {
      const key = getPendingOperationsStorageKey(getCurrentUserEmailKey());
      if (!key) {
        return;
      }

      try {
        localStorage.setItem(key, JSON.stringify(state.pendingOperations));
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function loadPendingOperationsForUser(email: string) {
      const key = getPendingOperationsStorageKey(email);
      if (!key) {
        state.pendingOperations = [];
        return;
      }

      try {
        const stored = JSON.parse(localStorage.getItem(key) || "null") as PendingOfflineOperation[] | null;
        state.pendingOperations = Array.isArray(stored) ? stored : [];
      } catch (_error) {
        state.pendingOperations = [];
      }
    }

    function getOfflineMutationDedupKey(type: PendingOfflineOperationType, args: unknown[]): string {
      if (type === "finalizeCompetition") {
        return `finalizeCompetition:${String(args[0] || "")}`;
      }
      if (type === "updateCombat") {
        const combat = args[0] as { combatId?: string } | undefined;
        return combat && combat.combatId ? `updateCombat:${combat.combatId}` : "";
      }
      return "";
    }

    function buildPendingOperationSummary(type: PendingOfflineOperationType, args: unknown[]): string {
      if (type === "finalizeCompetition") {
        return `Classement : ${String(args[1] || "")}`;
      }
      const combat = args[0] as { opponent?: string; result?: string } | undefined;
      return `Combat vs ${(combat && combat.opponent) || "adversaire"} — ${(combat && combat.result) || ""}`;
    }

    function upsertPendingOperation(type: PendingOfflineOperationType, args: unknown[]): PendingOfflineOperation {
      const dedupKey = getOfflineMutationDedupKey(type, args);
      if (dedupKey) {
        state.pendingOperations = state.pendingOperations.filter(
          (op) => getOfflineMutationDedupKey(op.type, op.payload) !== dedupKey
        );
      }

      const competitionId =
        type === "finalizeCompetition"
          ? String(args[0] || "")
          : String((args[0] as { competitionId?: string } | undefined)?.competitionId || "");

      const op: PendingOfflineOperation = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        competitionId,
        payload: args,
        userEmail: getCurrentUserEmailKey(),
        createdAt: new Date().toISOString(),
        status: "pending",
        summary: buildPendingOperationSummary(type, args)
      };
      state.pendingOperations.push(op);
      persistPendingOperations();
      return op;
    }

    function cancelPendingOperation(operationId: string) {
      state.pendingOperations = state.pendingOperations.filter((op) => op.id !== operationId);
      persistPendingOperations();
    }

    function canManageJudokaLocally(judokaId: unknown): boolean {
      if (!judokaId) {
        return false;
      }
      if (state.isCoach) {
        return true;
      }
      if (state.isParent) {
        return state.judokas.some((j) => String(j.judokaId) === String(judokaId));
      }
      return Boolean(state.currentUser) && String(state.currentUser?.judokaId) === String(judokaId);
    }

    function findCompetitionLocally(competitionId: string): Competition | null {
      if (state.currentCompetition && String(state.currentCompetition.competitionId) === competitionId) {
        return state.currentCompetition;
      }
      return state.competitions.find((c) => String(c.competitionId) === competitionId) || null;
    }

    function getLocalOfflineMutationError(method: string, args: unknown[]): string {
      if (method === "ajouterCombat" || method === "updateCombat") {
        const combat = args[0] as { judokaId?: string } | undefined;
        if (!canManageJudokaLocally(combat && combat.judokaId)) {
          return "Ajout ou modification de ce combat non autorisé hors connexion.";
        }
        return "";
      }
      if (method === "finalizeCompetition") {
        const competitionId = String(args[0] || "");
        const competition = findCompetitionLocally(competitionId);
        if (!competition || !canManageJudokaLocally(competition.ownerJudokaId)) {
          return "Finalisation de cette compétition non autorisée hors connexion.";
        }
        return "";
      }
      return "";
    }

    function isOfflineQueueableMethod(method: string): method is PendingOfflineOperationType {
      return method === "ajouterCombat" || method === "updateCombat" || method === "finalizeCompetition";
    }

    function handleOfflineRequest<M extends RpcClientMethod>(
      method: M,
      args: RpcClientArgs<M>,
      success?: (result: RpcClientResult<M>) => void,
      failure?: (error: unknown) => void
    ) {
      const methodName = String(method);
      const methodArgs = args as unknown[];

      if (methodName === "getCompetitionDetail") {
        const competitionId = String(methodArgs[0] || "");
        const cached = readCompetitionDetailCache(getCurrentUserEmailKey(), competitionId);
        if (cached) {
          success?.(cached as unknown as RpcClientResult<M>);
          return;
        }
      } else if (isOfflineQueueableMethod(methodName)) {
        const scopeError = getLocalOfflineMutationError(methodName, methodArgs);
        if (scopeError) {
          const error = new Error(scopeError);
          failure ? failure(error) : showError(error);
          return;
        }

        const op = upsertPendingOperation(methodName, methodArgs);
        const queuedResult = {
          success: true,
          message: "Enregistré localement. En attente de synchronisation.",
          competitionId: op.competitionId
        };
        success?.(queuedResult as unknown as RpcClientResult<M>);
        return;
      }

      const offlineError = new Error("Connexion indisponible. Réessayez quand le réseau revient.");
      failure ? failure(offlineError) : showError(offlineError);
    }

    async function syncPendingOperations() {
      const pending = state.pendingOperations
        .filter((op) => op.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const op of pending) {
        op.status = "syncing";
        persistPendingOperations();

        await runServerWithOptions(
          op.type,
          op.payload as RpcClientArgs<typeof op.type>,
          () => cancelPendingOperation(op.id),
          (error) => {
            op.status = "failed";
            op.errorMessage =
              error && typeof error === "object" && "message" in error
                ? String((error as { message?: unknown }).message || "")
                : String(error || "");
            persistPendingOperations();
          },
          { bypassOfflineQueue: true }
        );
      }

      if (state.currentCompetition) {
        screens.competition.openCompetition(state.currentCompetition.competitionId, true);
      }
    }

    function applyInitialData(data: InitialData) {
      applyInitialDataSnapshot(data, { cachedAt: "", isCached: false });
      saveInitialDataCache(data);
    }

    function loadCachedInitialData() {
      const cached = readInitialDataCache();
      if (!cached) {
        return false;
      }

      applyInitialDataSnapshot(cached.data, { cachedAt: cached.cachedAt, isCached: true });
      return true;
    }

    function applyInitialDataSnapshot(
      data: InitialData,
      cacheInfo: { cachedAt: string; isCached: boolean }
    ) {
      state.currentUser = data.user;
      state.isAdmin = Boolean(data.isAdmin);
      state.isCoach = Boolean(data.isCoach);
      state.isParent = Boolean(data.isParent);
      state.isUsingCachedData = Boolean(cacheInfo.isCached);
      state.cachedDataLoadedAt = cacheInfo.cachedAt || "";
      state.competitions = Array.isArray(data.competitions) ? data.competitions : [];
      state.clubCompetitions = Array.isArray(data.clubCompetitions) ? data.clubCompetitions : [];
      state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
      loadPendingOperationsForUser(getInitialDataCacheUserKey(data));
      const profileTypeLabel = state.isParent ? "PARENT" : "JUDOKA";
      const roleLabel = state.isAdmin
        ? `ADMIN · ${profileTypeLabel}`
        : state.isCoach
          ? `COACH · ${profileTypeLabel}`
          : profileTypeLabel;
      Object.assign(headerViewModel, {
        showHeader: true,
        userName: ui.getJudokaDisplayName(state.currentUser) || "",
        roleLabel,
        showOfflineStatus: state.isUsingCachedData || !state.isOnline,
        offlineStatusText: getOfflineStatusText()
      });
      screens.home.applyInitialData();
      if (state.isOnline && state.pendingOperations.some((op) => op.status === "pending")) {
        syncPendingOperations();
      }
    }

    function getOfflineStatusText() {
      if (state.isUsingCachedData) {
        const cachedDate = ui.formatDateTime(state.cachedDataLoadedAt);
        return cachedDate
          ? `Hors connexion - données du ${cachedDate}`
          : "Hors connexion - données du dernier chargement";
      }

      if (!state.isOnline) {
        return "Hors connexion - actions bloquées";
      }

      return "";
    }

    function syncOfflineStatusHeader() {
      headerViewModel.showOfflineStatus = Boolean(headerViewModel.showHeader) && (state.isUsingCachedData || !state.isOnline);
      headerViewModel.offlineStatusText = getOfflineStatusText();
    }

    function setHeaderVisible(visible: boolean) {
      headerViewModel.showHeader = Boolean(visible);
      syncOfflineStatusHeader();
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

    function reloadInitialDataAndShowAdmins() {
      reloadInitialDataThen(() => screens.admins.showAdminsManagement(true));
    }

    function showHome() {
      screens.home.showHome();
    }

    function setupNetworkStatus() {
      window.addEventListener("online", async () => {
        state.isOnline = true;
        syncOfflineStatusHeader();
        showSuccess("Connexion rétablie.");
        await syncPendingOperations();
        if (state.currentUser && state.isUsingCachedData) {
          reloadInitialData();
        }
      });
      window.addEventListener("offline", () => {
        state.isOnline = false;
        syncOfflineStatusHeader();
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
