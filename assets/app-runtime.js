(() => {
  window.createKirokuApp = function createKirokuApp() {
    const runtimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const defaultAccessInvitationVisibleCount = 5;
    const state = createInitialState();

    function createInitialState() {
      return {
        currentUser: null,
        isAdmin: false,
        isCoach: false,
        isParent: false,
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
        previousView: "homeView",
        accessInvitationSearch: "",
        accessInvitationCurrentPage: 1
      };
    }

    const ui = window.KirokuUI;
    const {
      $,
      viewIds
    } = ui;
    const notifications = window.createKirokuNotifications();
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;

    let loginScreen;
    const headerViewModel = window.Vue.reactive({
      showHeader: false,
      userName: "",
      roleLabel: ""
    });

    ui.mountViewModel("appHeader", headerViewModel, {
      logoutUser
    });

    const auth = window.createKirokuAuth({
      runtimeConfig,
      onInvitationRequired: () => loginScreen && loginScreen.showInvitationRequired(),
      onError: showError
    });
    const {
      clearVercelSession,
      getValidVercelSession,
      logoutSupabaseSession
    } = auth;

    ui.showView = showView;

    const screens = {};
    const app = {
      applyInitialData,
      auth,
      confirmAndRun,
      defaultAccessInvitationVisibleCount,
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

    async function runServer(method, args, success, failure) {
      return runServerWithOptions(method, args, success, failure);
    }

    async function runServerWithOptions(method, args, success, failure, options = {}) {
      const maxAttempts = options.retrySessionOnce ? 2 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const session = await getValidVercelSession();
          if (!session) {
            loginScreen.showVercelLogin();
            return;
          }

          const response = await fetch("/api/rpc", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + session.access_token,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ method, args })
          });
          const payload = await response.json();

          if (!response.ok || payload.error) {
            throw new Error(payload.error || "Erreur serveur.");
          }

          success && success(payload.result);
          return;
        } catch (error) {
          const errorMessage = String(error.message || "");
          if (options.retrySessionOnce && attempt < maxAttempts && isSessionAuthError(errorMessage)) {
            await wait(600);
            continue;
          }

          if (isSessionAuthError(errorMessage)) {
            clearVercelSession();
            loginScreen.showVercelLogin();
          } else if (method === "getInitialData" && errorMessage.includes("Invitation trouvée")) {
            loginScreen.showProfileRegistration();
            return;
          } else if (method === "getInitialData" && errorMessage.includes("invitation est requise")) {
            clearVercelSession();
            loginScreen.showInvitationRequired();
            return;
          }
          failure ? failure(error) : showError(error);
          return;
        }
      }
    }

    function isSessionAuthError(message) {
      return message.includes("Session Supabase invalide") || message.includes("Utilisateur non identifié");
    }

    function wait(delayMs) {
      return new Promise(resolve => window.setTimeout(resolve, delayMs));
    }

    function resetApplicationState() {
      Object.assign(state, createInitialState());
    }

    async function logoutUser() {
      clearMessage();
      await logoutSupabaseSession();
      resetApplicationState();
      loginScreen.showVercelLogin();
      showSuccess("Vous êtes déconnecté.");
    }

    function applyInitialData(data) {
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

    function setHeaderVisible(visible) {
      headerViewModel.showHeader = Boolean(visible);
    }

    function confirmAndRun({ message, method, args, onSuccess }) {
      if (!window.confirm(message)) {
        return;
      }

      runServer(method, args, onSuccess, showError);
    }

    function reloadInitialData(openCompetitionId) {
      reloadInitialDataThen(() => {
        if (openCompetitionId) {
          screens.competition.openCompetition(openCompetitionId, true);
        } else {
          showHome();
        }
      });
    }

    function reloadInitialDataThen(afterReload) {
      runServer(
        "getInitialData",
        [],
        data => {
          if (data.error) {
            showError({ message: data.error });
            return;
          }

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

    function showView(id) {
      viewIds.forEach(viewId => {
        $(viewId).classList.add("hidden");
      });

      $(id).classList.remove("hidden");
    }

    app.showHome = showHome;

    return app;
  };
})();
