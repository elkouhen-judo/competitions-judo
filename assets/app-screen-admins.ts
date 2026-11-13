(() => {
  type KirokuApp = import("./types").KirokuApp;
  type UsersPage = import("../core/types").UsersPage;

  function createKirokuAdminsScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const { cleanText, getCurrentLocalDate, getJudokaDisplayName, showView } = ui;

    // INSCR-1 : l'import inscrit les judokas pour une saison (1er septembre – 31 août), celle en cours par défaut.
    function getSeasonStartYear(dateValue: string): number {
      const [year, month] = String(dateValue || "").split("-").map(Number);
      return (month || 0) >= 9 ? year : year - 1;
    }
    const currentSeasonStartYear = getSeasonStartYear(getCurrentLocalDate());
    const importSeasonOptions = [currentSeasonStartYear - 1, currentSeasonStartYear, currentSeasonStartYear + 1].map(
      (startYear) => ({ value: startYear, label: `${startYear}-${startYear + 1}` })
    );
    const { clearMessage, showError, showSuccess } = notifications;
    const accessInvitationsPageSize = 5;
    const defaultAdminsViewState = {
      adminEmail: "",
      importUsersFileName: "",
      importUsersCsvContent: "",
      importSeasonStartYear: 0,
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
        state.managedUsersTotal,
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
          importSeasonOptions: window.Vue.computed(() => importSeasonOptions),
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

      const seasonStartYear = viewModel.importSeasonStartYear || currentSeasonStartYear;
      app.runServer(
        "importUsersCsv",
        [viewModel.importUsersCsvContent, seasonStartYear],
        (response) => {
          // INSCR-1 : le résumé dit qui est inscrit pour la saison et combien ne sont pas réinscrits.
          const seasonLabel = `${response.seasonStartYear}-${response.seasonStartYear + 1}`;
          const importSummary = `Import CSV terminé : ${response.imported} ligne(s) OK, ${response.failed} ligne(s) KO. ${response.registered} judoka(s) inscrit(s) pour ${seasonLabel}, ${response.notReregistered} non réinscrit(s).`;
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
          // Un import peut créer des judokas dans le périmètre : les données initiales sont relues.
          app.reloadInitialDataThen(refreshAdminsManagement);
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
          applyUsersPage(data, false);
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

    // ECRIT-2 : après une action d'administration, seul l'écran de gestion est relu.
    function refreshAdminsManagement() {
      showAdminsManagement(true);
    }

    // PAGE-3 : le serveur renvoie une page de 10 utilisateurs, le total et le curseur de la suite.
    let usersNextCursor: UsersPage["nextCursor"] = null;
    let usersSearchTimer: number | null = null;

    function applyUsersPage(data: UsersPage, append: boolean) {
      const users = Array.isArray(data.users) ? data.users : [];
      state.managedUsers = append ? [...state.managedUsers, ...users] : users;
      state.managedUsersTotal = Math.max(Number(data.totalUsers) || 0, state.managedUsers.length);
      usersNextCursor = data.nextCursor || null;
    }

    function loadUsersPage(append: boolean, onLoaded?: () => void) {
      const search = cleanText(state.usersSearch);
      app.runServer(
        "getUsersPage",
        [{ search, after: append ? usersNextCursor : null }],
        (data) => {
          // Une réponse arrivée après une nouvelle saisie est ignorée.
          if (search !== cleanText(state.usersSearch)) return;
          applyUsersPage(data, append);
          onLoaded?.();
        },
        showError
      );
    }

    function searchUsers() {
      if (usersSearchTimer) {
        window.clearTimeout(usersSearchTimer);
      }
      usersSearchTimer = window.setTimeout(() => {
        usersSearchTimer = null;
        loadUsersPage(false);
      }, 300);
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
      args: import("./types").RpcClientArgs<M>,
      onSuccess?: () => void
    ) {
      app.runServer(
        method,
        args,
        (response) => {
          onSuccess?.();
          showSuccess((response as { message?: string }).message || "Modification enregistrée.");
          refreshAdminsManagement();
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
          refreshAdminsManagement();
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
      // Une fois enregistré, le judoka change de club dans l'état local, pour l'espace coach.
      runClubAction("setJudokaClub", [judokaId, clubId || null], () => {
        state.judokas = state.judokas.map((judoka) =>
          String(judoka.judokaId) === String(judokaId) ? { ...judoka, clubId: clubId || "" } : judoka
        );
      });
    }

    function updateUsersSearch(value: string) {
      state.usersSearch = value || "";
      state.usersCurrentPage = 1;
      state.accessInvitationsCurrentPage = 1;
      searchUsers();
    }

    function resetUsersSearch() {
      updateUsersSearch("");
    }

    function showNextUsersPage() {
      const nextPage = state.usersCurrentPage + 1;
      const isLoaded = state.managedUsers.length > state.usersCurrentPage * defaultListPageSize;
      if (isLoaded || state.managedUsers.length >= state.managedUsersTotal) {
        state.usersCurrentPage = nextPage;
        return;
      }
      loadUsersPage(true, () => {
        state.usersCurrentPage = nextPage;
      });
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
          refreshAdminsManagement();
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
          // L'utilisateur supprimé et ses compétitions quittent l'état local.
          state.judokas = state.judokas.filter((judoka) => String(judoka.judokaId) !== String(idJudoka));
          state.competitions
            .filter((competition) => String(competition.ownerJudokaId) === String(idJudoka))
            .forEach((competition) => app.local.removeCompetition(competition.competitionId));
          refreshAdminsManagement();
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
          refreshAdminsManagement();
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
          refreshAdminsManagement();
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
