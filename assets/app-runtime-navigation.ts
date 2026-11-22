import type {
  AppScreens,
  KirokuAppState,
  KirokuUi,
  NavigationSnapshot,
  ViewId
} from "./types";

// Routing/history concern: which view is shown, how it's reflected in the URL/history
// entry, and how a navigation snapshot is persisted/restored across reloads.
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
    const homeMode = params.get("mode");
    return {
      homeMode: isHomeMode(homeMode) ? homeMode : undefined,
      homeFilterJudokaId: params.get("judoka") || undefined,
      competitionId: params.get("competition") || undefined,
      clubCompetitionId: params.get("clubCompetition") || undefined,
      coachDashboardTab: params.get("tab") === "chat" ? "chat" : undefined
    };
  }

  function getViewHash(id: ViewId, navigationState: NavigationSnapshot) {
    const params = new URLSearchParams();
    if (id === "homeView" && navigationState.homeMode) params.set("mode", navigationState.homeMode);
    if (navigationState.homeFilterJudokaId) params.set("judoka", navigationState.homeFilterJudokaId);
    if (navigationState.competitionId) params.set("competition", navigationState.competitionId);
    if (navigationState.clubCompetitionId) params.set("clubCompetition", navigationState.clubCompetitionId);
    if (id === "coachDashboardView" && navigationState.coachDashboardTab) params.set("tab", navigationState.coachDashboardTab);
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
      clubCompetitionId: routeState.clubCompetitionId || "",
      coachDashboardTab: routeState.coachDashboardTab
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
      clubCompetitionId: String(candidate.clubCompetitionId || ""),
      coachDashboardTab: candidate.coachDashboardTab === "chat" ? "chat" : "stats"
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
      restored.coachDashboardTab === "chat"
        ? screens.coachDashboard.showCoachChat()
        : screens.coachDashboard.showCoachDashboard();
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

window.createKirokuNavigationController = createNavigationController;
