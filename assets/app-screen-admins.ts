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
      adminEmail: ""
    };
    let adminsViewModel: (typeof defaultAdminsViewState) | null = null;

    const adminsProjection = window.Vue.computed(() =>
      window.KirokuScreenProjections.projectManagedAdmins(state.managedAdmins, state.currentUser, {
        getJudokaDisplayName
      })
    );
    const adminsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        adminsProjection.value.admins,
        state.adminsCurrentPage,
        defaultListPageSize
      )
    );
    const adminsInvitationsProjection = window.Vue.computed(() => {
      const search = cleanText(state.accessInvitationSearch).toLowerCase();
      const filteredInvitations = !search
        ? state.managedAccessInvitations
        : state.managedAccessInvitations.filter((invitation) =>
            cleanText(invitation.email).toLowerCase().includes(search)
          );
      return window.KirokuScreenProjections.projectAccessInvitations(
        filteredInvitations,
        search,
        state.accessInvitationCurrentPage,
        defaultAccessInvitationVisibleCount,
        { formatDateTime }
      );
    });

    const admins = window.Vue.computed(() => adminsProjection.value.admins);
    const hasAdmins = window.Vue.computed(() => adminsProjection.value.hasAdmins);
    const adminsPage = window.Vue.computed(() => adminsPagination.value.pageItems);
    const adminsTotalPages = window.Vue.computed(() => adminsPagination.value.totalPages);
    const adminsCurrentPage = window.Vue.computed(() => adminsPagination.value.currentPage);
    const adminsTotalCount = window.Vue.computed(() => adminsPagination.value.totalItems);
    const adminsCanShowPreviousPage = window.Vue.computed(
      () => adminsPagination.value.canShowPreviousPage
    );
    const adminsCanShowNextPage = window.Vue.computed(
      () => adminsPagination.value.canShowNextPage
    );
    const accessInvitations = window.Vue.computed(
      () => adminsInvitationsProjection.value.accessInvitations
    );
    const accessInvitationsSummary = window.Vue.computed(
      () => adminsInvitationsProjection.value.accessInvitationsSummary
    );
    const accessInvitationsEmptyMessage = window.Vue.computed(
      () => adminsInvitationsProjection.value.accessInvitationsEmptyMessage
    );
    const canResetAccessInvitationSearch = window.Vue.computed(
      () => adminsInvitationsProjection.value.canResetAccessInvitationSearch
    );
    const canShowPreviousAccessInvitationPage = window.Vue.computed(
      () => adminsInvitationsProjection.value.canShowPreviousAccessInvitationPage
    );
    const canShowNextAccessInvitationPage = window.Vue.computed(
      () => adminsInvitationsProjection.value.canShowNextAccessInvitationPage
    );
    const hasAccessInvitations = window.Vue.computed(
      () => adminsInvitationsProjection.value.hasAccessInvitations
    );

    function ensureAdminsViewModel() {
      if (adminsViewModel) {
        return;
      }

      adminsViewModel = ui.createMountedViewModel(
        "adminsView",
        defaultAdminsViewState,
        {
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
        },
        {
          admins,
          hasAdmins,
          adminsPage,
          adminsTotalPages,
          adminsCurrentPage,
          adminsTotalCount,
          adminsCanShowPreviousPage,
          adminsCanShowNextPage,
          accessInvitations,
          accessInvitationsSummary,
          accessInvitationsEmptyMessage,
          canResetAccessInvitationSearch,
          canShowPreviousAccessInvitationPage,
          canShowNextAccessInvitationPage,
          hasAccessInvitations
        }
      );
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

    function updateAccessInvitationSearch(value: string) {
      const viewModel = getAdminsViewModel();
      state.accessInvitationSearch = value || "";
      viewModel.accessInvitationSearch = value || "";
      state.accessInvitationCurrentPage = 1;
    }

    function resetAccessInvitationSearch() {
      const viewModel = getAdminsViewModel();
      state.accessInvitationSearch = "";
      viewModel.accessInvitationSearch = "";
      state.accessInvitationCurrentPage = 1;
    }

    function showNextAccessInvitationPage() {
      state.accessInvitationCurrentPage += 1;
    }

    function showPreviousAccessInvitationPage() {
      state.accessInvitationCurrentPage = Math.max(state.accessInvitationCurrentPage - 1, 1);
    }

    function showAdminsManagement(keepMessage?: boolean) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getAdminsManagement",
        [],
        (data) => {
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations)
            ? data.accessInvitations
            : [];
          state.accessInvitationSearch = "";
          state.accessInvitationCurrentPage = 1;
          state.adminsCurrentPage = 1;
          const viewModel = getAdminsViewModel();
          viewModel.accessInvitationSearch = "";
          resetAccessInvitationForm();
          resetAdminForm();
          showView("adminsView");
        },
        showError
      );
    }

    function showAdminsPreviousPage() {
      state.adminsCurrentPage = Math.max(state.adminsCurrentPage - 1, 1);
    }

    function showAdminsNextPage() {
      state.adminsCurrentPage += 1;
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
