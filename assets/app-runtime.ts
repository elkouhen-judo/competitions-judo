import type {
  AppScreens,
  AuthApi,
  CombatReadModel,
  Competition,
  CompetitionDetail,
  InitialData,
  KirokuApp,
  KirokuAppState,
  KirokuUi,
  LocalDataApi,
  NavigationSnapshot,
  NotificationsApi,
  PendingOfflineOperation,
  PendingOfflineOperationType,
  RpcClientArgs,
  RpcClientMethod,
  RpcClientResult,
  RunServerOptions,
  RuntimeConfig,
  SeasonCompetitions,
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
    clubs: [],
    combatRecords: {},
    selectedClubId: "",
    currentCompetition: null,
    judokas: [],
    currentCombats: [],
    currentCombatSuggestions: null,
    loadedFrom: "",
    oldestCompetitionDate: "",
    loadedSeasonStartYears: [],
    isLoadingSeason: false,
    currentJudokaProfile: null,
    managedAdmins: [],
    managedUsers: [],
    managedUsersTotal: 0,
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
    clubCompetitionsSearchText: "",
    clubCompetitionParticipantsCurrentPage: 1,
    clubCompetitionAvailableJudokasCurrentPage: 1,
    clubCompetitionFormParticipantsCurrentPage: 1,
    judokaCompetitionResultsCurrentPage: 1,
    adminsCurrentPage: 1,
    usersSearch: "",
    usersCurrentPage: 1,
    accessInvitationsCurrentPage: 1
  };
}

(() => {
  const initialDataCachePrefix = "kiroku_initial_data:";
  const lastInitialDataCacheKey = "kiroku_initial_data:last";
  const competitionDetailCachePrefix = "kiroku_competition_detail:";
  const judokaProfileCachePrefix = "kiroku_judoka_profile:";
  const seasonCachePrefix = "kiroku_season:";
  const combatSuggestionsCachePrefix = "kiroku_combat_suggestions:";
  const pendingOperationsStoragePrefix = "kiroku_pending_ops:";

  interface HeaderViewModel {
    showHeader: boolean;
    userName: string;
    roleLabel: string;
    showOfflineStatus: boolean;
    offlineStatusText: string;
  }

  function setupTooltipPositioning() {
    const tooltipSelector = ".tooltip, .info-tip";
    const contentSelector = ".tooltip-content, .info-tip-bubble";
    const viewportPadding = 12;

    const findTooltip = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) {
        return null;
      }
      const tooltip = target.closest(tooltipSelector);
      return tooltip instanceof HTMLElement ? tooltip : null;
    };

    const syncTooltipPosition = (tooltip: HTMLElement) => {
      const content = tooltip.querySelector(contentSelector);
      if (!(content instanceof HTMLElement)) {
        return;
      }

      tooltip.style.removeProperty("--tooltip-shift-x");
      tooltip.style.removeProperty("--tooltip-arrow-shift-x");
      const rect = content.getBoundingClientRect();
      const rightLimit = window.innerWidth - viewportPadding;
      let shift = 0;

      if (rect.left < viewportPadding) {
        shift = viewportPadding - rect.left;
      } else if (rect.right > rightLimit) {
        shift = rightLimit - rect.right;
      }

      const roundedShift = Math.round(shift);
      tooltip.style.setProperty("--tooltip-shift-x", `${roundedShift}px`);
      tooltip.style.setProperty("--tooltip-arrow-shift-x", `${-roundedShift}px`);
    };

    document.addEventListener("pointerover", (event) => {
      const tooltip = findTooltip(event.target);
      if (tooltip) {
        syncTooltipPosition(tooltip);
      }
    });
    document.addEventListener("focusin", (event) => {
      const tooltip = findTooltip(event.target);
      if (tooltip) {
        syncTooltipPosition(tooltip);
      }
    });
    window.addEventListener("resize", () => {
      document.querySelectorAll<HTMLElement>(tooltipSelector).forEach(syncTooltipPosition);
    });
  }

  // Routing/history concern: which view is shown, how it's reflected in the URL/history
  // entry, and how a navigation snapshot is persisted/restored across reloads. Decoupled
  // from the data layer below — it only ever reaches into `screens` and `state`.
  function createNavigationController(ui: KirokuUi, state: KirokuAppState, screens: AppScreens) {
    const { $, viewIds } = ui;
    const navigationStateStorageKey = "kiroku_navigation_state";
    let currentViewId: ViewId = "loginView";
    let hasNavigationState = false;

    function showHome() {
      screens.home.showHome();
    }

    function readHistoryViewId(stateValue: unknown): ViewId {
      const navigationState = readHistoryNavigationState(stateValue);
      if (navigationState) {
        return navigationState.viewId;
      }

      const hashView = getViewFromHash(window.location.hash);
      return hashView || currentViewId || "homeView";
    }

    function readHistoryNavigationState(stateValue: unknown): NavigationSnapshot | null {
      if (stateValue && typeof stateValue === "object" && "kirokuNavigation" in stateValue) {
        return normalizeNavigationSnapshot(
          (stateValue as { kirokuNavigation?: unknown }).kirokuNavigation
        );
      }
      if (stateValue && typeof stateValue === "object" && "kirokuView" in stateValue) {
        const viewId = String((stateValue as { kirokuView?: unknown }).kirokuView || "");
        if (isViewId(viewId)) {
          return { viewId };
        }
      }
      return null;
    }

    function isViewId(value: string): value is ViewId {
      return viewIds.includes(value as ViewId);
    }

    function getViewFromHash(hash: string): ViewId | "" {
      const slug = String(hash || "").replace(/^#\/?/, "").split("?", 1)[0];
      const found = viewIds.find((viewId) => viewId.replace(/View$/, "").toLowerCase() === slug);
      return found || "";
    }

    function getHashNavigationState(hash: string): Partial<NavigationSnapshot> {
      const query = String(hash || "").split("?")[1] || "";
      const params = new URLSearchParams(query);
      return {
        homeMode: params.get("mode") || undefined,
        homeFilterJudokaId: params.get("judoka") || undefined,
        competitionId: params.get("competition") || undefined,
        clubCompetitionId: params.get("clubCompetition") || undefined
      };
    }

    function getViewHash(id: ViewId, navigationState: NavigationSnapshot) {
      const params = new URLSearchParams();
      if (id === "homeView" && navigationState.homeMode) params.set("mode", navigationState.homeMode);
      if (navigationState.homeFilterJudokaId) params.set("judoka", navigationState.homeFilterJudokaId);
      if (navigationState.competitionId) params.set("competition", navigationState.competitionId);
      if (navigationState.clubCompetitionId) params.set("clubCompetition", navigationState.clubCompetitionId);
      const query = params.toString();
      return `#${id.replace(/View$/, "").toLowerCase()}${query ? `?${query}` : ""}`;
    }

    function syncHistory(id: ViewId, replace: boolean, navigationState: NavigationSnapshot) {
      const stateValue = { kirokuView: id, kirokuNavigation: navigationState };
      const url = getViewHash(id, navigationState);
      if (replace || !hasNavigationState) {
        window.history.replaceState(stateValue, "", url);
        hasNavigationState = true;
        return;
      }

      if (window.history.state && window.history.state.kirokuView === id) {
        window.history.replaceState(stateValue, "", url);
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
      options: {
        replace?: boolean;
        routeState?: Partial<NavigationSnapshot>;
        skipHistory?: boolean;
        preserveScroll?: boolean;
      } = {}
    ) {
      viewIds.forEach((viewId) => {
        $(viewId).classList.add("hidden");
      });

      $(id).classList.remove("hidden");
      currentViewId = id;
      const navigationState = persistNavigationState({ ...options.routeState, viewId: id });
      if (!options.skipHistory) {
        syncHistory(id, Boolean(options.replace), navigationState);
      }
      focusActiveView(id, Boolean(options.preserveScroll));
    }

    function getCurrentNavigationSnapshot(routeState: Partial<NavigationSnapshot> = {}): NavigationSnapshot {
      return {
        viewId: routeState.viewId || currentViewId,
        homeMode: routeState.homeMode || state.homeMode,
        homeFilterJudokaId:
          routeState.homeFilterJudokaId !== undefined
            ? routeState.homeFilterJudokaId
            : state.homeFilterJudokaId,
        competitionId:
          routeState.competitionId !== undefined
            ? routeState.competitionId
            : state.currentCompetition?.competitionId || "",
        judokaId:
          routeState.judokaId !== undefined
            ? routeState.judokaId
            : state.currentJudokaProfile?.judoka?.judokaId || "",
        clubCompetitionId: routeState.clubCompetitionId || ""
      };
    }

    function normalizeNavigationSnapshot(value: unknown): NavigationSnapshot | null {
      if (!value || typeof value !== "object") {
        return null;
      }
      const candidate = value as Partial<NavigationSnapshot>;
      const viewId = String(candidate.viewId || "");
      if (!isViewId(viewId) || viewId === "loginView") {
        return null;
      }
      return {
        viewId,
        homeMode: isHomeMode(candidate.homeMode) ? candidate.homeMode : undefined,
        homeFilterJudokaId: String(candidate.homeFilterJudokaId || ""),
        competitionId: String(candidate.competitionId || ""),
        judokaId: String(candidate.judokaId || ""),
        clubCompetitionId: String(candidate.clubCompetitionId || "")
      };
    }

    function isHomeMode(value: unknown): value is KirokuAppState["homeMode"] {
      return ["judoka", "parentHome", "coachHome", "coach", "coachJudoka", "family"].includes(
        String(value)
      );
    }

    function persistNavigationState(routeState: Partial<NavigationSnapshot> = {}): NavigationSnapshot {
      const snapshot = getCurrentNavigationSnapshot(routeState);
      try {
        sessionStorage.setItem(navigationStateStorageKey, JSON.stringify(snapshot));
      } catch (_error) {
        // Navigation restore is best-effort; browser storage can be unavailable in private contexts.
      }
      return snapshot;
    }

    function readSavedNavigationState(): NavigationSnapshot | null {
      try {
        const saved = sessionStorage.getItem(navigationStateStorageKey);
        return saved ? normalizeNavigationSnapshot(JSON.parse(saved)) : null;
      } catch (_error) {
        return null;
      }
    }

    function clearNavigationState() {
      try {
        sessionStorage.removeItem(navigationStateStorageKey);
      } catch (_error) {
        // Nothing to clear when session storage is unavailable.
      }
    }

    function restoreNavigationState() {
      const restored =
        readHistoryNavigationState(window.history.state) ||
        readSavedNavigationState() ||
        normalizeNavigationSnapshot({ viewId: getViewFromHash(window.location.hash), ...getHashNavigationState(window.location.hash) });
      showRestoredNavigationState(restored, { replace: true });
    }

    function showRestoredNavigationState(
      restored: NavigationSnapshot | null,
      options: { preserveScroll?: boolean; replace?: boolean; skipHistory?: boolean } = {}
    ) {
      if (!restored) {
        showHome();
        return;
      }
      if (restored.viewId === "competitionView" && restored.competitionId) {
        screens.competition.openCompetition(restored.competitionId, true);
        return;
      }
      // Un formulaire lié à une compétition (combat, modification, finalisation) ne peut pas être
      // reconstruit après un rechargement : on rouvre la compétition plutôt qu'un formulaire vide
      // rattaché à aucune compétition.
      if (
        restored.viewId === "combatFormView" ||
        restored.viewId === "competitionFormView" ||
        String(restored.viewId) === "competitionFinalizationView"
      ) {
        if (restored.competitionId) {
          screens.competition.openCompetition(restored.competitionId, true);
        } else {
          showHome();
        }
        return;
      }
      if (restored.viewId === "judokaView" && restored.judokaId) {
        screens.judoka.showJudokaProfile(restored.judokaId, true);
        return;
      }
      if (restored.viewId === "clubCompetitionDetailView" && restored.clubCompetitionId) {
        screens.competition.openClubCompetition(restored.clubCompetitionId);
        return;
      }
      if (restored.viewId === "adminsView" && state.isAdmin) {
        screens.admins.showAdminsManagement(true);
        return;
      }
      if (restored.viewId === "coachDashboardView" && state.isCoach) {
        screens.coachDashboard.showCoachDashboard();
        return;
      }
      if (restored.viewId === "homeView") {
        if (isHomeMode(restored.homeMode)) {
          screens.home.setHomeMode(restored.homeMode);
        }
        if (restored.homeFilterJudokaId) {
          state.homeFilterJudokaId = restored.homeFilterJudokaId;
        }
        showHome();
        return;
      }
      showView(restored.viewId, options);
    }

    function setupHistoryNavigation() {
      window.addEventListener("popstate", (event) => {
        const navigationState = readHistoryNavigationState(event.state);
        showRestoredNavigationState(navigationState, { preserveScroll: true, skipHistory: true });
      });
    }

    return {
      showHome,
      showView,
      persistNavigationState,
      restoreNavigationState,
      clearNavigationState,
      setupHistoryNavigation
    };
  }

  // Data concern: RPC calls (with session retry), the offline mutation queue, and the
  // initial-data/competition-detail local caches that back them. Kept as one unit because
  // every piece of it ultimately feeds the same request/response loop (an offline RPC call
  // is queued here and later replayed through the same `runServerWithOptions`).
  function createDataController(deps: {
    state: KirokuAppState;
    auth: AuthApi;
    screens: AppScreens;
    ui: KirokuUi;
    headerViewModel: HeaderViewModel;
    showError: NotificationsApi["showError"];
    getLoginScreen: () => AppScreens["login"];
  }) {
    const { state, auth, screens, ui, headerViewModel, showError, getLoginScreen } = deps;
    const { clearVercelSession, getValidVercelSession } = auth;
    const rpcTimeoutMs = 20000;

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
          } else if (String(method) === "getSeasonCompetitions") {
            saveSeasonCache(getCurrentUserEmailKey(), payload.result as unknown as SeasonCompetitions);
          } else if (String(method) === "getCombatSuggestions") {
            saveCombatSuggestionsCache(getCurrentUserEmailKey(), String(args[0] || ""), payload.result);
          } else if (String(method) === "getJudokaProfile") {
            saveJudokaProfileCache(
              getCurrentUserEmailKey(),
              String(args[0] || ""),
              args[1] as number | undefined,
              payload.result
            );
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

    function getInitialDataCacheUserKey(data: InitialData) {
      return String(data.user && data.user.accountEmail || "").trim().toLowerCase();
    }

    function getInitialDataCacheStorageKey(userKey: string) {
      return userKey ? `${initialDataCachePrefix}${userKey}` : "";
    }

    function saveInitialDataCache(data: InitialData, cachedAt = new Date().toISOString()) {
      const userKey = getInitialDataCacheUserKey(data);
      const storageKey = getInitialDataCacheStorageKey(userKey);
      if (!storageKey) {
        return;
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify({ cachedAt, data }));
        localStorage.setItem(lastInitialDataCacheKey, storageKey);
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function readInitialDataCache(): { cachedAt: string; data: InitialData } | null {
      if (!auth.hasLocalVercelSession()) {
        return null;
      }
      const expectedUserKey = auth.getLocalSessionEmailKey();
      if (!expectedUserKey) {
        return null;
      }

      const storageKey = localStorage.getItem(lastInitialDataCacheKey) || "";
      if (!storageKey || !storageKey.startsWith(initialDataCachePrefix)) {
        return null;
      }
      if (storageKey !== getInitialDataCacheStorageKey(expectedUserKey)) {
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
        if (getInitialDataCacheUserKey(cached.data) !== expectedUserKey) {
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

    // PAGE-2 : une saison passée déjà consultée reste lisible hors connexion.
    function getSeasonCacheKey(email: string, seasonStartYear: number) {
      return email ? `${seasonCachePrefix}${email}:${seasonStartYear}` : "";
    }

    function saveSeasonCache(email: string, season: SeasonCompetitions) {
      const key = getSeasonCacheKey(email, season.seasonStartYear);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(season));
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function readSeasonCache(email: string, seasonStartYear: number): SeasonCompetitions | null {
      const key = getSeasonCacheKey(email, seasonStartYear);
      if (!key) return null;
      try {
        return JSON.parse(localStorage.getItem(key) || "null") as SeasonCompetitions | null;
      } catch (_error) {
        return null;
      }
    }

    function getJudokaProfileCacheKey(email: string, judokaId: string, seasonStartYear?: number) {
      const season = seasonStartYear === undefined ? "current" : String(seasonStartYear);
      return email && judokaId ? `${judokaProfileCachePrefix}${email}:${judokaId}:${season}` : "";
    }

    function saveJudokaProfileCache(
      email: string,
      judokaId: string,
      seasonStartYear: number | undefined,
      data: unknown
    ) {
      const key = getJudokaProfileCacheKey(email, judokaId, seasonStartYear);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function readJudokaProfileCache(email: string, judokaId: string, seasonStartYear?: number) {
      const key = getJudokaProfileCacheKey(email, judokaId, seasonStartYear);
      if (!key) return null;
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch (_error) {
        return null;
      }
    }

    // DETAIL-2 : les suggestions de saisie déjà chargées restent disponibles hors connexion.
    function getCombatSuggestionsCacheKey(email: string, judokaId: string) {
      return email && judokaId ? `${combatSuggestionsCachePrefix}${email}:${judokaId}` : "";
    }

    function saveCombatSuggestionsCache(email: string, judokaId: string, data: unknown) {
      const key = getCombatSuggestionsCacheKey(email, judokaId);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
    }

    function readCombatSuggestionsCache(email: string, judokaId: string) {
      const key = getCombatSuggestionsCacheKey(email, judokaId);
      if (!key) return null;
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
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
      syncOfflineStatusHeader();
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
      } else if (methodName === "getSeasonCompetitions") {
        const cached = readSeasonCache(getCurrentUserEmailKey(), Number(methodArgs[0]));
        if (cached) {
          success?.(cached as unknown as RpcClientResult<M>);
          return;
        }
      } else if (methodName === "getCombatSuggestions") {
        const cached = readCombatSuggestionsCache(getCurrentUserEmailKey(), String(methodArgs[0] || ""));
        if (cached) {
          success?.(cached as RpcClientResult<M>);
          return;
        }
      } else if (methodName === "getJudokaProfile") {
        const cached = readJudokaProfileCache(
          getCurrentUserEmailKey(),
          String(methodArgs[0] || ""),
          methodArgs[1] as number | undefined
        );
        if (cached) {
          success?.(cached as RpcClientResult<M>);
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
        if (methodName === "finalizeCompetition") {
          const competitionId = String(methodArgs[0] || "");
          const result = String(methodArgs[1] || "");
          state.competitions = state.competitions.map((competition) =>
            String(competition.competitionId) === competitionId
              ? { ...competition, result }
              : competition
          );
          if (state.currentCompetition && String(state.currentCompetition.competitionId) === competitionId) {
            state.currentCompetition = { ...state.currentCompetition, result };
          }
        }
        syncOfflineStatusHeader();
        const queuedResult = {
          success: true,
          message: "Enregistré localement. En attente de synchronisation.",
          competitionId: op.competitionId
        };
        success?.(queuedResult as unknown as RpcClientResult<M>);
        return;
      }

      const offlineError = new Error(
        "Cette action nécessite une connexion. Les données déjà chargées restent disponibles hors connexion."
      );
      failure ? failure(offlineError) : showError(offlineError);
    }

    async function syncPendingOperations() {
      const pending = state.pendingOperations
        .filter((op) => op.status === "pending")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const op of pending) {
        op.status = "syncing";
        persistPendingOperations();
        syncOfflineStatusHeader();

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
            syncOfflineStatusHeader();
            showError(op.errorMessage);
          },
          { bypassOfflineQueue: true }
        );
      }

      syncOfflineStatusHeader();
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
      state.combatRecords = data.combatRecords && typeof data.combatRecords === "object" ? data.combatRecords : {};
      state.loadedFrom = String(data.loadedFrom || "");
      state.oldestCompetitionDate = String(data.oldestCompetitionDate || "");
      state.loadedSeasonStartYears = [];
      state.clubCompetitions = Array.isArray(data.clubCompetitions) ? data.clubCompetitions : [];
      state.clubs = Array.isArray(data.clubs) ? data.clubs : [];
      if (state.selectedClubId && !state.clubs.some((club) => club.clubId === state.selectedClubId)) {
        state.selectedClubId = "";
      }
      state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
      loadPendingOperationsForUser(getInitialDataCacheUserKey(data));
      // NAV-4 : un seul rôle affiché ; l'accès admin se voit dans le menu du compte.
      const roleLabel = state.isCoach
        ? "Coach"
        : state.currentUser?.profileType === "PARENT"
          ? "Parent"
          : state.isAdmin
            ? "Admin"
            : "Judoka";
      Object.assign(headerViewModel, {
        showHeader: true,
        userName: ui.getJudokaDisplayName(state.currentUser) || "",
        roleLabel,
        showOfflineStatus: state.isUsingCachedData || !state.isOnline || state.pendingOperations.length > 0,
        offlineStatusText: getOfflineStatusText()
      });
      screens.home.applyInitialData();
      if (state.isOnline && state.pendingOperations.some((op) => op.status === "pending")) {
        syncPendingOperations();
      }
    }

    function getOfflineStatusText() {
      const pendingCount = state.pendingOperations.filter(
        (op) => op.status === "pending" || op.status === "syncing"
      ).length;
      const failedCount = state.pendingOperations.filter((op) => op.status === "failed").length;

      if (failedCount) {
        return `${failedCount} modification${failedCount > 1 ? "s" : ""} à vérifier`;
      }

      if (pendingCount && state.isOnline) {
        return `Synchronisation de ${pendingCount} modification${pendingCount > 1 ? "s" : ""}…`;
      }

      if (pendingCount && !state.isOnline) {
        return `Hors connexion - ${pendingCount} modification${pendingCount > 1 ? "s" : ""} enregistrée${pendingCount > 1 ? "s" : ""} localement`;
      }

      if (state.isUsingCachedData) {
        const cachedDate = ui.formatDateTime(state.cachedDataLoadedAt);
        const cachedText = cachedDate
          ? `Hors connexion - données du ${cachedDate}`
          : "Hors connexion - données du dernier chargement";
        return state.isOnline ? cachedText : `${cachedText} · modifications locales conservées`;
      }

      if (!state.isOnline) {
        return "Hors connexion - mode local activé";
      }

      return "";
    }

    function syncOfflineStatusHeader() {
      const hasPendingOperations = state.pendingOperations.some(
        (op) => op.status === "pending" || op.status === "syncing" || op.status === "failed"
      );
      headerViewModel.showOfflineStatus = Boolean(headerViewModel.showHeader) &&
        (state.isUsingCachedData || !state.isOnline || hasPendingOperations);
      headerViewModel.offlineStatusText = getOfflineStatusText();
    }

    function setHeaderVisible(visible: boolean) {
      headerViewModel.showHeader = Boolean(visible);
      syncOfflineStatusHeader();
    }

    // Appelé à l'ouverture, au retour en ligne et après un import : jamais après une écriture.
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

    function reloadInitialData() {
      reloadInitialDataThen(() => screens.home.showHome());
    }

    function getSeasonStartYear(dateValue: unknown): number {
      const [year, month] = String(dateValue || "").split("-").map(Number);
      return (month || 0) >= 9 ? year || 0 : (year || 0) - 1;
    }

    function pickCombatRecords(competitions: Competition[]) {
      const records: KirokuAppState["combatRecords"] = {};
      competitions.forEach((competition) => {
        const record = state.combatRecords[String(competition.competitionId)];
        if (record) {
          records[String(competition.competitionId)] = record;
        }
      });
      return records;
    }

    // ECRIT-2 : le cache local suit l'état après chaque écriture confirmée par le serveur.
    function persistLocalData() {
      if (!state.currentUser) {
        return;
      }
      const isLoadedAtOpening = (dateValue: unknown) => !state.loadedFrom || String(dateValue || "") >= state.loadedFrom;
      const competitions = state.competitions.filter((c) => isLoadedAtOpening(c.competitionDate));
      saveInitialDataCache(
        {
          user: state.currentUser,
          isAdmin: state.isAdmin,
          isCoach: state.isCoach,
          isParent: state.isParent,
          competitions,
          combatRecords: pickCombatRecords(competitions),
          clubCompetitions: state.clubCompetitions.filter((cc) => isLoadedAtOpening(cc.competitionDate)),
          clubs: state.clubs,
          judokas: state.judokas,
          loadedFrom: state.loadedFrom,
          oldestCompetitionDate: state.oldestCompetitionDate
        },
        state.isUsingCachedData && state.cachedDataLoadedAt ? state.cachedDataLoadedAt : undefined
      );
      state.loadedSeasonStartYears.forEach((seasonStartYear) => {
        const inSeason = (dateValue: unknown) =>
          !isLoadedAtOpening(dateValue) && getSeasonStartYear(dateValue) === seasonStartYear;
        const seasonCompetitions = state.competitions.filter((c) => inSeason(c.competitionDate));
        saveSeasonCache(getCurrentUserEmailKey(), {
          seasonStartYear,
          competitions: seasonCompetitions,
          combatRecords: pickCombatRecords(seasonCompetitions),
          clubCompetitions: state.clubCompetitions.filter((cc) => inSeason(cc.competitionDate))
        });
      });
    }

    function upsertBy<T>(list: T[], item: T, getId: (value: T) => string): T[] {
      const id = getId(item);
      return list.some((value) => getId(value) === id)
        ? list.map((value) => (getId(value) === id ? item : value))
        : [...list, item];
    }

    const getCompetitionId = (competition: Competition) => String(competition.competitionId);

    function rememberOldestCompetitionDate(competitions: Competition[]) {
      competitions.forEach((competition) => {
        const date = String(competition.competitionDate || "");
        if (date && (!state.oldestCompetitionDate || date < state.oldestCompetitionDate)) {
          state.oldestCompetitionDate = date;
        }
      });
    }

    function saveCompetitionLocally(competition: Competition) {
      state.competitions = upsertBy(state.competitions, competition, getCompetitionId);
      if (state.currentCompetition && getCompetitionId(state.currentCompetition) === getCompetitionId(competition)) {
        state.currentCompetition = competition;
      }
      rememberOldestCompetitionDate([competition]);
      persistLocalData();
    }

    function removeCompetitionLocally(competitionId: string) {
      state.competitions = state.competitions.filter((c) => getCompetitionId(c) !== String(competitionId));
      const records = { ...state.combatRecords };
      delete records[String(competitionId)];
      state.combatRecords = records;
      try {
        localStorage.removeItem(getCompetitionDetailCacheKey(getCurrentUserEmailKey(), String(competitionId)));
      } catch (_error) {
        // Cache storage is opportunistic; connected usage must keep working without it.
      }
      persistLocalData();
    }

    // Le bilan V/D de la carte d'accueil et le cache de la fiche suivent les combats affichés.
    function syncCurrentCombats(combats: KirokuAppState["currentCombats"]) {
      state.currentCombats = combats;
      const competitionId = state.currentCompetition ? getCompetitionId(state.currentCompetition) : "";
      if (!competitionId) {
        return;
      }
      const record = { total: 0, wins: 0, losses: 0, draws: 0 };
      combats.forEach((combat) => {
        record.total += 1;
        if (combat.result === "Victoire") record.wins += 1;
        else if (combat.result === "Défaite") record.losses += 1;
        else if (combat.result) record.draws += 1;
      });
      state.combatRecords = { ...state.combatRecords, [competitionId]: record };
      const cachedDetail = readCompetitionDetailCache(getCurrentUserEmailKey(), competitionId);
      if (cachedDetail) {
        saveCompetitionDetailCache(getCurrentUserEmailKey(), { ...cachedDetail, combats });
      }
      persistLocalData();
    }

    function saveCombatLocally(combat: CombatReadModel) {
      if (!state.currentCompetition || getCompetitionId(state.currentCompetition) !== String(combat.competitionId)) {
        return;
      }
      syncCurrentCombats(upsertBy(state.currentCombats, combat, (value) => String(value.combatId)));
    }

    function removeCombatLocally(combatId: string) {
      syncCurrentCombats(state.currentCombats.filter((combat) => String(combat.combatId) !== String(combatId)));
    }

    function saveClubCompetitionLocally(
      clubCompetition: InitialData["clubCompetitions"][number],
      competitions: Competition[]
    ) {
      const clubCompetitionId = String(clubCompetition.clubCompetitionId);
      state.clubCompetitions = upsertBy(state.clubCompetitions, clubCompetition, (value) =>
        String(value.clubCompetitionId)
      );
      const savedIds = new Set(competitions.map(getCompetitionId));
      state.competitions = [
        ...state.competitions.filter(
          (c) => String(c.clubCompetitionId || "") !== clubCompetitionId && !savedIds.has(getCompetitionId(c))
        ),
        ...competitions
      ];
      rememberOldestCompetitionDate(competitions);
      persistLocalData();
    }

    // La suppression d'une compétition club garde les compétitions des judokas, détachées.
    function removeClubCompetitionLocally(clubCompetitionId: string) {
      const id = String(clubCompetitionId);
      state.clubCompetitions = state.clubCompetitions.filter((cc) => String(cc.clubCompetitionId) !== id);
      state.competitions = state.competitions.map((c) =>
        String(c.clubCompetitionId || "") === id ? { ...c, clubCompetitionId: null } : c
      );
      persistLocalData();
    }

    function addSeasonLocally(season: SeasonCompetitions) {
      const competitions = Array.isArray(season.competitions) ? season.competitions : [];
      const clubCompetitions = Array.isArray(season.clubCompetitions) ? season.clubCompetitions : [];
      const seasonCompetitionIds = new Set(competitions.map(getCompetitionId));
      const seasonClubCompetitionIds = new Set(clubCompetitions.map((cc) => String(cc.clubCompetitionId)));
      state.competitions = [
        ...state.competitions.filter((c) => !seasonCompetitionIds.has(getCompetitionId(c))),
        ...competitions
      ];
      state.clubCompetitions = [
        ...state.clubCompetitions.filter((cc) => !seasonClubCompetitionIds.has(String(cc.clubCompetitionId))),
        ...clubCompetitions
      ];
      state.combatRecords = { ...state.combatRecords, ...(season.combatRecords || {}) };
      if (!state.loadedSeasonStartYears.includes(season.seasonStartYear)) {
        state.loadedSeasonStartYears = [...state.loadedSeasonStartYears, season.seasonStartYear];
      }
    }

    const local: LocalDataApi = {
      saveCompetition: saveCompetitionLocally,
      removeCompetition: removeCompetitionLocally,
      saveCombat: saveCombatLocally,
      removeCombat: removeCombatLocally,
      saveClubCompetition: saveClubCompetitionLocally,
      removeClubCompetition: removeClubCompetitionLocally,
      addSeason: addSeasonLocally
    };

    return {
      runServer,
      runServerWithOptions,
      applyInitialData,
      loadCachedInitialData,
      local,
      reloadInitialData,
      reloadInitialDataThen,
      cancelPendingOperation,
      syncPendingOperations,
      setHeaderVisible,
      syncOfflineStatusHeader
    };
  }

  window.createKirokuApp = function createKirokuApp() {
    const runtimeConfig: RuntimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const defaultListPageSize = 10;
    const state = window.Vue.reactive(createInitialState());

    const ui = window.KirokuUI;
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

    const headerViewModel: HeaderViewModel = window.Vue.reactive({
      showHeader: false,
      userName: "",
      roleLabel: "",
      showOfflineStatus: false,
      offlineStatusText: ""
    });

    ui.mountViewModel(
      "appHeader",
      headerViewModel,
      {
        logoutUser,
        openPersonalSpace: () => screens.home.setHomeMode("judoka"),
        openFamilySpace: () => screens.home.setHomeMode("family"),
        openAccessManagement: () => screens.admins.showAdminsManagement()
      },
      {
        // Le coach retrouve « Mon espace » ici ; un compte uniquement parent n'en a pas.
        showPersonalSpaceLink: window.Vue.computed(
          () => state.isCoach && state.currentUser?.profileType !== "PARENT"
        ),
        showFamilyLink: window.Vue.computed(() => state.isCoach && state.isParent),
        showAdminLink: window.Vue.computed(() => state.isAdmin)
      }
    );

    const screens = {} as AppScreens;
    const navigation = createNavigationController(ui, state, screens);
    const { showHome, persistNavigationState, restoreNavigationState, clearNavigationState, setupHistoryNavigation } =
      navigation;
    ui.showView = navigation.showView;

    const auth: AuthApi = window.createKirokuAuth({
      runtimeConfig,
      onInvitationRequired: () => loginScreen && loginScreen.showInvitationRequired(),
      onError: showError
    });

    const data = createDataController({ state, auth, screens, ui, headerViewModel, showError, getLoginScreen });
    const {
      runServer,
      runServerWithOptions,
      applyInitialData,
      loadCachedInitialData,
      local,
      reloadInitialData,
      reloadInitialDataThen,
      cancelPendingOperation,
      syncPendingOperations,
      setHeaderVisible,
      syncOfflineStatusHeader
    } = data;

    const app: KirokuApp = {
      applyInitialData,
      auth,
      cancelPendingOperation,
      confirmAndRun,
      defaultListPageSize,
      loadCachedInitialData,
      local,
      notifications,
      persistNavigationState,
      reloadInitialData,
      reloadInitialDataThen,
      resetApplicationState,
      runtimeConfig,
      runServer,
      runServerWithOptions,
      setHeaderVisible,
      restoreNavigationState,
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
    setupTooltipPositioning();

    function resetApplicationState() {
      Object.assign(state, createInitialState());
      clearNavigationState();
    }

    async function logoutUser() {
      clearMessage();
      await auth.logoutSupabaseSession();
      purgeLocalUserData();
      resetApplicationState();
      getLoginScreen().showVercelLogin();
      showSuccess("Vous êtes déconnecté.");
    }

    function purgeLocalUserData() {
      const prefixes = [
        initialDataCachePrefix,
        competitionDetailCachePrefix,
        judokaProfileCachePrefix,
        seasonCachePrefix,
        combatSuggestionsCachePrefix,
        pendingOperationsStoragePrefix,
        "kiroku_supabase_session"
      ];
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index) || "";
        if (prefixes.some((prefix) => key === prefix || key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }
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
      });
    }

    app.showHome = showHome;

    return app;
  };
})();
