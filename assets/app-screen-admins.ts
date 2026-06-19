(() => {
  type KirokuApp = import("./types").KirokuApp;

  function createKirokuAdminsScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const { cleanText, getJudokaDisplayName, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const defaultAdminsViewState = {
      adminEmail: "",
      importUsersFileName: "",
      importUsersCsvContent: ""
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
    const usersProjection = window.Vue.computed(() =>
      window.KirokuScreenProjections.projectManagedUsers(
        state.managedUsers,
        state.managedAccessInvitations,
        cleanText(state.usersSearch),
        state.usersCurrentPage,
        defaultListPageSize,
        state.currentUser,
        { getJudokaDisplayName }
      )
    );

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
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const managedUsersPage = window.Vue.computed(() => usersProjection.value.users);
    const usersSearch = window.Vue.computed(() => state.usersSearch);
    const usersSummary = window.Vue.computed(() => usersProjection.value.usersSummary);
    const usersEmptyMessage = window.Vue.computed(() => usersProjection.value.usersEmptyMessage);
    const canResetUsersSearch = window.Vue.computed(() => usersProjection.value.canResetUsersSearch);
    const canShowPreviousUsersPage = window.Vue.computed(
      () => usersProjection.value.canShowPreviousUsersPage
    );
    const canShowNextUsersPage = window.Vue.computed(
      () => usersProjection.value.canShowNextUsersPage
    );
    const hasUsers = window.Vue.computed(() => usersProjection.value.hasUsers);

    function ensureAdminsViewModel() {
      if (adminsViewModel) {
        return;
      }

      adminsViewModel = ui.createMountedViewModel(
        "adminsView",
        defaultAdminsViewState,
        {
          cancelInvitation,
          deleteUser,
          handleImportUsersFileChange,
          importUsersCsv,
          resetAdminForm,
          resetUsersSearch,
          revokeAdminRole,
          saveAdminRole,
          showAdminsPreviousPage,
          showAdminsNextPage,
          showNextUsersPage,
          showPreviousUsersPage,
          showHome: () => app.showHome && app.showHome(),
          updateUsersSearch
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
          managedUsersPage,
          usersSearch,
          usersSummary,
          usersEmptyMessage,
          canResetUsersSearch,
          canShowPreviousUsersPage,
          canShowNextUsersPage,
          hasUsers,
          isSubmitting
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

    function handleImportUsersFileChange(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files && input.files[0];
      const viewModel = getAdminsViewModel();

      if (!file) {
        viewModel.importUsersFileName = "";
        viewModel.importUsersCsvContent = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        viewModel.importUsersFileName = file.name;
        viewModel.importUsersCsvContent = String(reader.result || "");
      };
      reader.onerror = () => {
        showError({ message: "Impossible de lire le fichier sélectionné." });
      };
      reader.readAsText(file);
    }

    function importUsersCsv() {
      const viewModel = getAdminsViewModel();
      if (!viewModel.importUsersCsvContent) {
        showError({ message: "Sélectionnez un fichier CSV à importer." });
        return;
      }

      app.runServer(
        "importUsersCsv",
        [viewModel.importUsersCsvContent],
        (response) => {
          const importSummary = `Import CSV terminé : ${response.imported} ligne(s) OK, ${response.failed} ligne(s) KO.`;
          viewModel.importUsersFileName = "";
          viewModel.importUsersCsvContent = "";
          const fileInput = document.getElementById("importUsersFile") as HTMLInputElement | null;
          if (fileInput) {
            fileInput.value = "";
          }

          if (response.success) {
            showSuccess(importSummary);
          } else {
            showError({ message: importSummary });
          }
          app.reloadInitialDataAndShowAdmins();
        },
        showError
      );
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
          state.managedUsers = Array.isArray(data.users) ? data.users : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations)
            ? data.accessInvitations
            : [];
          state.adminsCurrentPage = 1;
          state.usersSearch = "";
          state.usersCurrentPage = 1;
          ensureAdminsViewModel();
          resetAdminForm();
          showView("adminsView");
        },
        showError
      );
    }

    function updateUsersSearch(value: string) {
      state.usersSearch = value || "";
      state.usersCurrentPage = 1;
    }

    function resetUsersSearch() {
      state.usersSearch = "";
      state.usersCurrentPage = 1;
    }

    function showNextUsersPage() {
      state.usersCurrentPage += 1;
    }

    function showPreviousUsersPage() {
      state.usersCurrentPage = Math.max(state.usersCurrentPage - 1, 1);
    }

    function cancelInvitation(email: string, name?: string) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Annuler l'invitation${label} ?`,
        method: "deleteAccessInvitation",
        args: [email],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
    }

    function deleteUser(idJudoka: string, name?: string) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Supprimer définitivement${label} ? Ses compétitions et combats seront aussi supprimés.`,
        method: "deleteUser",
        args: [idJudoka],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
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
      cancelInvitation,
      deleteUser,
      resetAdminForm,
      resetUsersSearch,
      revokeAdminRole,
      saveAdminRole,
      showAdminsManagement,
      showAdminsNextPage,
      showAdminsPreviousPage,
      showNextUsersPage,
      showPreviousUsersPage,
      updateUsersSearch
    };
  }

  window.createKirokuAdminsScreen = createKirokuAdminsScreen;
})();
