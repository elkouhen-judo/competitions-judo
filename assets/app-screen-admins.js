(() => {
  function createKirokuAdminsScreen(app) {
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
    let adminsViewModel = null;

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
        showHome: () => app.showHome(),
        updateAccessInvitationSearch
      });
    }

    function saveAccessInvitation() {
      ensureAdminsViewModel();
      const email = adminsViewModel.accessInvitationForm.email;
      const profileType = adminsViewModel.accessInvitationForm.profileType;

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

    function deleteAccessInvitation(email) {
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
      ensureAdminsViewModel();
      if (!state.managedAccessInvitations.length) {
        Object.assign(adminsViewModel, {
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
        adminsViewModel,
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

    function updateAccessInvitationSearch(value) {
      ensureAdminsViewModel();
      state.accessInvitationSearch = cleanText(value).toLowerCase();
      adminsViewModel.accessInvitationSearch = value || "";
      state.accessInvitationCurrentPage = 1;
      renderManagedAccessInvitations();
    }

    function resetAccessInvitationSearch() {
      ensureAdminsViewModel();
      state.accessInvitationSearch = "";
      adminsViewModel.accessInvitationSearch = "";
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

    function showAdminsManagement(keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getAdminsManagement",
        [],
        (data) => {
          ensureAdminsViewModel();
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations)
            ? data.accessInvitations
            : [];
          state.accessInvitationSearch = "";
          state.accessInvitationCurrentPage = 1;
          state.adminsCurrentPage = 1;
          adminsViewModel.accessInvitationSearch = "";
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
      ensureAdminsViewModel();
      Object.assign(
        adminsViewModel,
        window.KirokuScreenProjections.projectManagedAdmins(
          state.managedAdmins,
          state.currentUser,
          {
            getJudokaDisplayName
          }
        )
      );
      const pagination = window.KirokuScreenProjections.paginateList(
        adminsViewModel.admins,
        state.adminsCurrentPage,
        defaultListPageSize
      );
      adminsViewModel.adminsPage = pagination.pageItems;
      adminsViewModel.adminsTotalPages = pagination.totalPages;
      adminsViewModel.adminsCurrentPage = pagination.currentPage;
      adminsViewModel.adminsTotalCount = pagination.totalItems;
      adminsViewModel.adminsCanShowPreviousPage = pagination.canShowPreviousPage;
      adminsViewModel.adminsCanShowNextPage = pagination.canShowNextPage;
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
      ensureAdminsViewModel();
      adminsViewModel.adminEmail = "";
    }

    function resetAccessInvitationForm() {
      ensureAdminsViewModel();
      Object.assign(adminsViewModel.accessInvitationForm, defaultAccessInvitationForm);
    }

    function saveAdminRole() {
      ensureAdminsViewModel();
      const email = adminsViewModel.adminEmail;

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

    function revokeAdminRole(idJudoka, name) {
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
