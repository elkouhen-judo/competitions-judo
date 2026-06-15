(() => {
  type KirokuApp = import("./types").KirokuApp;

  function createKirokuAdminsScreen(app: KirokuApp) {
    const { defaultAccessInvitationVisibleCount, defaultListPageSize, state, ui, notifications } =
      app;
    const { cleanText, formatDateTime, getJudokaDisplayName, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const defaultAccessInvitationForm = {
      email: "",
      profileType: "JUDOKA"
    };
    const defaultAdminsViewState = {
      accessInvitationForm: { ...defaultAccessInvitationForm },
      accessInvitationSearch: "",
      accessInvitations: [],
      accessInvitationsSummary: "",
      accessInvitationsEmptyMessage: "Aucune invitation en attente.",
      canResetAccessInvitationSearch: false,
      canShowPreviousAccessInvitationPage: false,
      canShowNextAccessInvitationPage: false,
      hasAccessInvitations: false,
      admins: [],
      adminsPage: [],
      adminsTotalPages: 1,
      adminsCurrentPage: 1,
      adminsTotalCount: 0,
      adminsCanShowPreviousPage: false,
      adminsCanShowNextPage: false,
      hasAdmins: false,
      adminEmail: ""
    };
    let adminsViewModel: (typeof defaultAdminsViewState) | null = null;

    function ensureAdminsViewModel() {
      if (!window.Vue || adminsViewModel) {
        return;
      }

      adminsViewModel = ui.createMountedViewModel("adminsView", defaultAdminsViewState, {
        deleteAccessInvitation,
        resetAccessInvitationSearch,
        resetAccessInvitationForm,
        resetAdminForm,
        revokeAdminRole,
        saveAccessInvitation,
        saveAdminRole,
        showNextAccessInvitationPage,
        showPreviousAccessInvitationPage,
        showAdminsPreviousPage,
        showAdminsNextPage,
        showHome: () => app.showHome && app.showHome(),
        updateAccessInvitationSearch
      });
    }

    function getAdminsViewModel() {
      ensureAdminsViewModel();
      if (!adminsViewModel) {
        throw new Error("Vue model des administrateurs non initialisé.");
      }
      return adminsViewModel;
    }

    function saveAccessInvitation() {
      const viewModel = getAdminsViewModel();
      const email = viewModel.accessInvitationForm.email;
      const profileType = viewModel.accessInvitationForm.profileType;

      app.runServer(
        "saveAccessInvitation",
        [email, profileType],
        (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function deleteAccessInvitation(email: string) {
      const label = email ? ` pour "${email}"` : "";
      app.confirmAndRun({
        message: `Supprimer l'invitation${label} ?`,
        method: "deleteAccessInvitation",
        args: [email],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
    }

    function renderManagedAccessInvitations() {
      const viewModel = getAdminsViewModel();
      if (!state.managedAccessInvitations.length) {
        Object.assign(viewModel, {
          accessInvitations: [],
          accessInvitationsSummary: "",
          accessInvitationsEmptyMessage: "Aucune invitation en attente.",
          canResetAccessInvitationSearch: false,
          canShowPreviousAccessInvitationPage: false,
          canShowNextAccessInvitationPage: false,
          hasAccessInvitations: false
        });
        return;
      }
      const filteredInvitations = getFilteredAccessInvitations();
      const pageSize = defaultAccessInvitationVisibleCount;
      Object.assign(
        viewModel,
        window.KirokuScreenProjections.projectAccessInvitations(
          filteredInvitations,
          state.accessInvitationSearch,
          state.accessInvitationCurrentPage,
          pageSize,
          {
            formatDateTime
          }
        )
      );
    }

    function getFilteredAccessInvitations() {
      if (!state.accessInvitationSearch) {
        return state.managedAccessInvitations;
      }

      return state.managedAccessInvitations.filter((invitation) =>
        cleanText(invitation.email).toLowerCase().includes(state.accessInvitationSearch)
      );
    }

    function updateAccessInvitationSearch(value: string) {
      const viewModel = getAdminsViewModel();
      state.accessInvitationSearch = cleanText(value).toLowerCase();
      viewModel.accessInvitationSearch = value || "";
      state.accessInvitationCurrentPage = 1;
      renderManagedAccessInvitations();
    }

    function resetAccessInvitationSearch() {
      const viewModel = getAdminsViewModel();
      state.accessInvitationSearch = "";
      viewModel.accessInvitationSearch = "";
      state.accessInvitationCurrentPage = 1;
      renderManagedAccessInvitations();
    }

    function showNextAccessInvitationPage() {
      state.accessInvitationCurrentPage += 1;
      renderManagedAccessInvitations();
    }

    function showPreviousAccessInvitationPage() {
      state.accessInvitationCurrentPage = Math.max(state.accessInvitationCurrentPage - 1, 1);
      renderManagedAccessInvitations();
    }

    function showAdminsManagement(keepMessage?: boolean) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getAdminsManagement",
        [],
        (data) => {
          const viewModel = getAdminsViewModel();
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations)
            ? data.accessInvitations
            : [];
          state.accessInvitationSearch = "";
          state.accessInvitationCurrentPage = 1;
          state.adminsCurrentPage = 1;
          viewModel.accessInvitationSearch = "";
          renderManagedAdmins();
          renderManagedAccessInvitations();
          resetAccessInvitationForm();
          resetAdminForm();
          showView("adminsView");
        },
        showError
      );
    }

    function renderManagedAdmins() {
      const viewModel = getAdminsViewModel();
      Object.assign(
        viewModel,
        window.KirokuScreenProjections.projectManagedAdmins(
          state.managedAdmins,
          state.currentUser,
          {
            getJudokaDisplayName
          }
        )
      );
      const pagination = window.KirokuScreenProjections.paginateList(
        viewModel.admins,
        state.adminsCurrentPage,
        defaultListPageSize
      );
      viewModel.adminsPage = pagination.pageItems;
      viewModel.adminsTotalPages = pagination.totalPages;
      viewModel.adminsCurrentPage = pagination.currentPage;
      viewModel.adminsTotalCount = pagination.totalItems;
      viewModel.adminsCanShowPreviousPage = pagination.canShowPreviousPage;
      viewModel.adminsCanShowNextPage = pagination.canShowNextPage;
      state.adminsCurrentPage = pagination.currentPage;
    }

    function showAdminsPreviousPage() {
      state.adminsCurrentPage = Math.max(state.adminsCurrentPage - 1, 1);
      renderManagedAdmins();
    }

    function showAdminsNextPage() {
      state.adminsCurrentPage += 1;
      renderManagedAdmins();
    }

    function resetAdminForm() {
      getAdminsViewModel().adminEmail = "";
    }

    function resetAccessInvitationForm() {
      Object.assign(getAdminsViewModel().accessInvitationForm, defaultAccessInvitationForm);
    }

    function saveAdminRole() {
      const email = getAdminsViewModel().adminEmail;

      app.runServer(
        "grantAdminRole",
        [email],
        (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function revokeAdminRole(idJudoka: string, name?: string) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Retirer les droits admin${label} ?`,
        method: "revokeAdminRole",
        args: [idJudoka],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
    }

    return {
      deleteAccessInvitation,
      renderManagedAccessInvitations,
      renderManagedAdmins,
      resetAccessInvitationForm,
      resetAccessInvitationSearch,
      resetAdminForm,
      revokeAdminRole,
      saveAccessInvitation,
      saveAdminRole,
      showAdminsManagement,
      showAdminsNextPage,
      showAdminsPreviousPage,
      showNextAccessInvitationPage,
      showPreviousAccessInvitationPage,
      updateAccessInvitationSearch
    };
  }

  window.createKirokuAdminsScreen = createKirokuAdminsScreen;
})();
