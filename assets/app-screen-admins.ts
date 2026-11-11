(() => {
  type KirokuApp = import("./types").KirokuApp;

  function createKirokuAdminsScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const { cleanText, getJudokaDisplayName, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const accessInvitationsPageSize = 5;
    const defaultAdminsViewState = {
      adminEmail: "",
      importUsersFileName: "",
      importUsersCsvContent: "",
      // ADMIN-1 : la gestion des accès s'organise en quatre onglets.
      adminTab: "users",
      newClubName: "",
      renamingClubId: "",
      renamingClubName: ""
    };
    // Clubs et coachs (gestion des clubs, réservée aux admins).
    const clubsData = window.Vue.reactive({
      clubs: [] as Array<{ clubId: string; name: string; coachIds: string[]; judokaCount: number }>,
      coaches: [] as Array<{ judokaId: string; firstName: string; lastName: string; accountEmail: string }>
    });
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
    const accessInvitationsProjection = window.Vue.computed(() =>
      window.KirokuScreenProjections.projectAccessInvitations(
        state.managedAccessInvitations,
        cleanText(state.usersSearch),
        state.accessInvitationsCurrentPage,
        accessInvitationsPageSize
      )
    );

    const admins = window.Vue.computed(() => adminsProjection.value.admins);
    const hasAdmins = window.Vue.computed(() => adminsProjection.value.hasAdmins);
    const adminsPaginationRefs = ui.createPaginationRefs(adminsPagination);
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
    const accessInvitationsPage = window.Vue.computed(
      () => accessInvitationsProjection.value.invitations
    );
    const accessInvitationsSummary = window.Vue.computed(
      () => accessInvitationsProjection.value.invitationsSummary
    );
    const accessInvitationsEmptyMessage = window.Vue.computed(
      () => accessInvitationsProjection.value.invitationsEmptyMessage
    );
    const canShowPreviousAccessInvitationsPage = window.Vue.computed(
      () => accessInvitationsProjection.value.canShowPreviousInvitationsPage
    );
    const canShowNextAccessInvitationsPage = window.Vue.computed(
      () => accessInvitationsProjection.value.canShowNextInvitationsPage
    );
    const hasAccessInvitations = window.Vue.computed(
      () => accessInvitationsProjection.value.hasInvitations
    );
    const clubOptions = window.Vue.computed(() =>
      clubsData.clubs.map((club) => ({ clubId: club.clubId, name: club.name }))
    );
    const clubCards = window.Vue.computed(() =>
      clubsData.clubs.map((club) => {
        const coachNames = clubsData.coaches
          .filter((coach) => club.coachIds.includes(coach.judokaId))
          .map((coach) => getJudokaDisplayName(coach) || coach.accountEmail);
        return {
          clubId: club.clubId,
          name: club.name,
          judokaLabel: `${club.judokaCount} judoka${club.judokaCount > 1 ? "s" : ""}`,
          coachLabel: coachNames.length ? coachNames.join(", ") : "Aucun coach",
          canDelete: club.judokaCount === 0 && club.coachIds.length === 0
        };
      })
    );
    const coachCards = window.Vue.computed(() =>
      clubsData.coaches.map((coach) => ({
        judokaId: coach.judokaId,
        fullName: getJudokaDisplayName(coach) || coach.accountEmail || "Coach",
        clubIds: clubsData.clubs.filter((club) => club.coachIds.includes(coach.judokaId)).map((club) => club.clubId)
      }))
    );
    const hasClubs = window.Vue.computed(() => clubsData.clubs.length > 0);

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
          showNextAccessInvitationsPage,
          showPreviousAccessInvitationsPage,
          showHome: () => app.showHome && app.showHome(),
          updateUsersSearch,
          createClub,
          startRenameClub,
          cancelRenameClub,
          saveRenameClub,
          deleteClub,
          toggleCoachClub,
          setUserClub
        },
        {
          adminTabs: window.Vue.computed(() => [
            { key: "users", label: "Utilisateurs" },
            { key: "clubs", label: "Clubs" },
            { key: "invitations", label: "Invitations" },
            { key: "import", label: "Import" }
          ]),
          admins,
          hasAdmins,
          adminsPage: adminsPaginationRefs.page,
          adminsTotalPages: adminsPaginationRefs.totalPages,
          adminsCurrentPage: adminsPaginationRefs.currentPage,
          adminsTotalCount: adminsPaginationRefs.totalCount,
          adminsCanShowPreviousPage: adminsPaginationRefs.canShowPreviousPage,
          adminsCanShowNextPage: adminsPaginationRefs.canShowNextPage,
          managedUsersPage,
          usersSearch,
          usersSummary,
          usersEmptyMessage,
          canResetUsersSearch,
          canShowPreviousUsersPage,
          canShowNextUsersPage,
          hasUsers,
          accessInvitationsPage,
          accessInvitationsSummary,
          accessInvitationsEmptyMessage,
          canShowPreviousAccessInvitationsPage,
          canShowNextAccessInvitationsPage,
          hasAccessInvitations,
          isSubmitting,
          clubOptions,
          clubCards,
          coachCards,
          hasClubs
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
          state.accessInvitationsCurrentPage = 1;
          ensureAdminsViewModel();
          resetAdminForm();
          loadClubs(() => showView("adminsView"));
        },
        showError
      );
    }

    function loadClubs(onLoaded?: () => void) {
      app.runServer(
        "getClubsManagement",
        [],
        (data) => {
          clubsData.clubs = Array.isArray(data.clubs) ? data.clubs : [];
          clubsData.coaches = Array.isArray(data.coaches) ? data.coaches : [];
          if (onLoaded) onLoaded();
        },
        showError
      );
    }

    // Après une modification de club, on recharge la gestion (utilisateurs et clubs) pour rester cohérent.
    function runClubAction<M extends "saveClub" | "deleteClub" | "setCoachClubs" | "setJudokaClub">(
      method: M,
      args: import("./types").RpcClientArgs<M>
    ) {
      app.runServer(
        method,
        args,
        (response) => {
          showSuccess((response as { message?: string }).message || "Modification enregistrée.");
          app.reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function createClub() {
      const viewModel = getAdminsViewModel();
      const name = cleanText(viewModel.newClubName);
      if (!name) {
        showError({ message: "Saisissez le nom du club." });
        return;
      }
      viewModel.newClubName = "";
      runClubAction("saveClub", [{ name }]);
    }

    function startRenameClub(clubId: string, name: string) {
      const viewModel = getAdminsViewModel();
      viewModel.renamingClubId = clubId;
      viewModel.renamingClubName = name;
    }

    function cancelRenameClub() {
      const viewModel = getAdminsViewModel();
      viewModel.renamingClubId = "";
      viewModel.renamingClubName = "";
    }

    function saveRenameClub() {
      const viewModel = getAdminsViewModel();
      const clubId = viewModel.renamingClubId;
      const name = cleanText(viewModel.renamingClubName);
      if (!clubId || !name) {
        showError({ message: "Saisissez le nouveau nom du club." });
        return;
      }
      cancelRenameClub();
      runClubAction("saveClub", [{ clubId, name }]);
    }

    function deleteClub(clubId: string, name: string) {
      app.confirmAndRun({
        message: `Supprimer le club "${name}" ?`,
        method: "deleteClub",
        args: [clubId],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialDataAndShowAdmins();
        }
      });
    }

    function toggleCoachClub(coachId: string, clubId: string, checked: boolean) {
      const coach = coachCards.value.find((card) => card.judokaId === coachId);
      const current = coach ? coach.clubIds : [];
      const next = checked ? [...new Set([...current, clubId])] : current.filter((id) => id !== clubId);
      runClubAction("setCoachClubs", [coachId, next]);
    }

    function setUserClub(judokaId: string, clubId: string) {
      runClubAction("setJudokaClub", [judokaId, clubId || null]);
    }

    function updateUsersSearch(value: string) {
      state.usersSearch = value || "";
      state.usersCurrentPage = 1;
      state.accessInvitationsCurrentPage = 1;
    }

    function resetUsersSearch() {
      state.usersSearch = "";
      state.usersCurrentPage = 1;
      state.accessInvitationsCurrentPage = 1;
    }

    function showNextUsersPage() {
      state.usersCurrentPage += 1;
    }

    function showPreviousUsersPage() {
      state.usersCurrentPage = Math.max(state.usersCurrentPage - 1, 1);
    }

    function showNextAccessInvitationsPage() {
      state.accessInvitationsCurrentPage += 1;
    }

    function showPreviousAccessInvitationsPage() {
      state.accessInvitationsCurrentPage = Math.max(state.accessInvitationsCurrentPage - 1, 1);
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
        message: `Supprimer définitivement${label} ? Ses compétitions futures et combats associés seront aussi supprimés.`,
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
