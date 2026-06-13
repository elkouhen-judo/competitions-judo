(() => {
  const runtimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
  const defaultAccessInvitationVisibleCount = 5;
  const state = createInitialState();

  function createInitialState() {
    return {
      currentUser: null,
      isAdmin: false,
      isParent: false,
      canManageChildren: false,
      competitions: [],
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
    escapeHtml,
    viewIds
  } = ui;
  const notifications = window.createKirokuNotifications({ $, escapeHtml });
  const {
    clearMessage,
    dismissToast,
    showError,
    showSuccess
  } = notifications;

  let loginScreen;
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

  async function runServer(method, args, success, failure) {
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
    } catch (error) {
      if (String(error.message || "").includes("Session Supabase invalide") || String(error.message || "").includes("Utilisateur non identifié")) {
        clearVercelSession();
        loginScreen.showVercelLogin();
      } else if (method === "getInitialData" && String(error.message || "").includes("Invitation trouvée")) {
        loginScreen.showProfileRegistration();
        return;
      } else if (method === "getInitialData" && String(error.message || "").includes("invitation est requise")) {
        clearVercelSession();
        loginScreen.showInvitationRequired();
        return;
      }
      failure ? failure(error) : showError(error);
    }
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
    state.isParent = Boolean(data.isParent);
    state.canManageChildren = Boolean(data.canManageChildren);
    state.competitions = Array.isArray(data.competitions) ? data.competitions : [];
    state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
    document.querySelector("header").classList.remove("hidden");

    const profileTypeLabel = state.isParent ? "PARENT" : "JUDOKA";
    const roleLabel = state.isAdmin ? `ADMIN · ${profileTypeLabel}` : profileTypeLabel;
    $("userInfo").innerHTML =
      `<strong>${escapeHtml(ui.getJudokaDisplayName(state.currentUser) || "")}</strong> - ${roleLabel}`;
    screens.home.applyInitialData();
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

  loginScreen.bindEvents();
  screens.competition.bindEvents();

  Object.assign(window, {
    cancelCombatForm: screens.competition.cancelCombatForm,
    cancelCompetitionFinalizationForm: screens.competition.cancelCompetitionFinalizationForm,
    cancelCompetitionForm: screens.competition.cancelCompetitionForm,
    deleteAccessInvitation: screens.admins.deleteAccessInvitation,
    deleteCombat: screens.competition.deleteCombat,
    deleteCompetitionFromList: screens.competition.deleteCompetitionFromList,
    deleteCurrentCompetition,
    deleteManagedChild: screens.children.deleteManagedChild,
    dismissToast,
    editCurrentCompetition: screens.competition.editCurrentCompetition,
    editManagedChild: screens.children.editManagedChild,
    finalizeCompetition: screens.competition.finalizeCompetition,
    logoutUser,
    openCompetition: screens.competition.openCompetition,
    openHomeJudokaProfile: screens.home.openHomeJudokaProfile,
    resetAccessInvitationForm: screens.admins.resetAccessInvitationForm,
    resetAccessInvitationSearch: screens.admins.resetAccessInvitationSearch,
    resetAdminForm: screens.admins.resetAdminForm,
    resetChildForm: screens.children.resetChildForm,
    revokeAdminRole: screens.admins.revokeAdminRole,
    saveAccessInvitation: screens.admins.saveAccessInvitation,
    saveAdminRole: screens.admins.saveAdminRole,
    saveCompetition: screens.competition.saveCompetition,
    saveCombat: screens.competition.saveCombat,
    saveManagedChild: screens.children.saveManagedChild,
    showAdminsManagement: screens.admins.showAdminsManagement,
    showChildrenManagement: screens.children.showChildrenManagement,
    showCombatForm: screens.competition.showCombatForm,
    showCompetitionFinalizationForm: screens.competition.showCompetitionFinalizationForm,
    showHome,
    showHomeCompetitionForm: screens.home.showHomeCompetitionForm,
    showNextAccessInvitationPage: screens.admins.showNextAccessInvitationPage,
    showPreviousAccessInvitationPage: screens.admins.showPreviousAccessInvitationPage,
    startGoogleLogin: loginScreen.startGoogleLogin,
    updateAccessInvitationSearch: screens.admins.updateAccessInvitationSearch
  });

  function deleteCurrentCompetition() {
    screens.competition.deleteCurrentCompetition();
  }

  loginScreen.init();
})();
