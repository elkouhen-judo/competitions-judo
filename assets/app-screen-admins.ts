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
      // CLUBADM-003 : club de l'import choisi par un admin de plusieurs clubs.
      importClubId: "",
      // ADMIN-1 : la gestion des accès s'organise en quatre onglets.
      adminTab: "users",
      newClubName: "",
      renamingClubId: "",
      renamingClubName: "",
      // ADMIN-3 : utilisateur dont le choix de club est ouvert.
      changingClubUserId: "",
      // CLUB-001 : clubs cochés et club principal en cours de choix, enregistrés ensemble.
      userClubDraft: { clubIds: [] as string[], mainClubId: "" }
    };
    // Clubs et coachs (gestion des clubs, réservée aux admins).
    const clubsData = window.Vue.reactive({
      clubs: [] as Array<{ clubId: string; name: string; coachIds: string[]; judokaCount: number; adminIds: string[] }>,
      coaches: [] as Array<{ judokaId: string; firstName: string; lastName: string; accountEmail: string }>,
      clubAdmins: [] as Array<{ judokaId: string; firstName: string; lastName: string; accountEmail: string }>,
      // CLUBADM-001 : l'admin global voit tout ; un admin de club, ses clubs seulement.
      isGlobalAdmin: true,
      // E-mail saisi pour nommer un admin, par club.
      adminEmailDrafts: {} as Record<string, string>
    });
    const isGlobalAdmin = window.Vue.computed(() => clubsData.isGlobalAdmin);
    let adminsViewModel: (typeof defaultAdminsViewState) | null = null;
    // ADMIN-2 : filtre de la liste des utilisateurs, appliqué par le serveur ("" = tous).
    const usersFilterState = window.Vue.reactive({ value: "" as "" | "noClub" | "notRegistered" | "coach" });
    const USERS_FILTER_OPTIONS = [
      { value: "", label: "Tous" },
      { value: "noClub", label: "Sans club" },
      { value: "notRegistered", label: "Non réinscrits" },
      { value: "coach", label: "Coachs" }
    ];
    const USERS_FILTER_EMPTY_MESSAGES: Record<string, string> = {
      coach: "Aucun coach.",
      noClub: "Aucun judoka sans club.",
      notRegistered: "Tous les judokas sont réinscrits pour la saison en cours."
    };

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
        { getJudokaDisplayName },
        currentSeasonStartYear
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
    // ADMIN-3 : une ligne par utilisateur : nom, puis rôle · catégorie · club.
    // V4 lot 3 : les initiales d'un nom affiché, pour les lignes de la gestion des accès.
    function getNameInitials(name: string) {
      return cleanText(name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
    }
    const managedUsersPage = window.Vue.computed(() =>
      usersProjection.value.users.map((user) => {
        // CLUB-001 : le club principal d'abord, puis les autres structures.
        const clubNames = [user.clubId, ...user.clubIds.filter((id) => id !== user.clubId)]
          .map((id) => clubsData.clubs.find((option) => option.clubId === id))
          .filter((club): club is (typeof clubsData.clubs)[number] => Boolean(club))
          .map((club) => club.name)
          .join(", ");
        const meta = [user.roleLabel, user.ageCategory, clubNames].filter(Boolean).join(" · ");
        return { ...user, meta, initials: getNameInitials(user.fullName) };
      })
    );
    // CLUBADM-002 : un admin de club ne voit pas les profils sans club.
    const usersFilterOptions = window.Vue.computed(() =>
      USERS_FILTER_OPTIONS.filter((option) => clubsData.isGlobalAdmin || option.value !== "noClub")
    );
    const usersSearch = window.Vue.computed(() => state.usersSearch);
    const usersSummary = window.Vue.computed(() => usersProjection.value.usersSummary);
    const usersFilter = window.Vue.computed(() => usersFilterState.value);
    const usersEmptyMessage = window.Vue.computed(() =>
      usersFilterState.value && !cleanText(state.usersSearch)
        ? USERS_FILTER_EMPTY_MESSAGES[usersFilterState.value]
        : usersProjection.value.usersEmptyMessage
    );
    const canResetUsersSearch = window.Vue.computed(
      () => usersProjection.value.canResetUsersSearch || Boolean(usersFilterState.value)
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
    // CLUB-001 : le club principal se choisit parmi les clubs cochés.
    const userClubDraftOptions = window.Vue.computed(() => {
      const draft = adminsViewModel ? adminsViewModel.userClubDraft : { clubIds: [] as string[] };
      return clubOptions.value.filter((club) => draft.clubIds.includes(club.clubId));
    });
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
          canDelete: clubsData.isGlobalAdmin && club.judokaCount === 0 && club.coachIds.length === 0,
          admins: (club.adminIds || [])
            .map((id) => clubsData.clubAdmins.find((person) => person.judokaId === id))
            .filter((person): person is (typeof clubsData.clubAdmins)[number] => Boolean(person))
            .map((person) => ({
              judokaId: person.judokaId,
              fullName: getJudokaDisplayName(person) || person.accountEmail
            }))
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
          getNameInitials,
          handleImportUsersFileChange,
          importUsersCsv,
          resetAdminForm,
          resetUsersSearch,
          selectUsersFilter,
          grantCoachRole,
          revokeCoachRole,
          revokeAdminRole,
          saveAdminRole,
          showAdminsPreviousPage,
          showAdminsNextPage,
          showNextUsersPage,
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
          saveUserClubs,
          toggleUserClubDraft,
          setUserMainClubDraft,
          openUserClubChoice,
          addClubAdmin,
          removeClubAdmin,
          updateClubAdminEmail
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
          usersFilter,
          usersFilterOptions,
          usersSummary,
          usersEmptyMessage,
          canResetUsersSearch,
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
          userClubDraftOptions,
          clubCards,
          coachCards,
          hasClubs,
          isGlobalAdmin,
          clubAdminEmailDrafts: window.Vue.computed(() => clubsData.adminEmailDrafts),
          importClubName: window.Vue.computed(() => (clubOptions.value.length === 1 ? clubOptions.value[0].name : ""))
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
      // CLUBADM-003 : un admin de club importe pour un de ses clubs.
      const importClubId = clubsData.isGlobalAdmin
        ? undefined
        : viewModel.importClubId || (clubOptions.value.length === 1 ? clubOptions.value[0].clubId : "");
      if (importClubId === "") {
        showError({ message: "Choisissez le club de l'import." });
        return;
      }
      app.runServer(
        "importUsersCsv",
        [viewModel.importUsersCsvContent, seasonStartYear, importClubId],
        (response) => {
          // INSCR-1 : le résumé dit qui est inscrit pour la saison et combien ne sont pas réinscrits.
          const seasonLabel = `${response.seasonStartYear}-${response.seasonStartYear + 1}`;
          const imported = ui.pluralize(response.imported, "ligne importée", "lignes importées");
          const failed = ui.pluralize(response.failed, "ligne en erreur", "lignes en erreur");
          const registered = ui.pluralize(response.registered, "judoka réinscrit", "judokas réinscrits");
          const missing = ui.pluralize(response.notReregistered, "non réinscrit", "non réinscrits");
          const importSummary = `Import CSV terminé : ${imported}, ${failed}. ${registered} pour ${seasonLabel}, ${missing}.`;
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

      // ADMIN-2 : après une action (club d'un judoka, rôle…), la recherche et le filtre en cours sont gardés.
      if (!keepMessage) {
        state.usersSearch = "";
        usersFilterState.value = "";
      }
      const request = { search: cleanText(state.usersSearch), filter: usersFilterState.value };
      app.runServer(
        "getAdminsManagement",
        [request],
        (data) => {
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          // Une recherche ou un filtre changé pendant le rechargement garde sa propre réponse.
          const isCurrentUsersRequest =
            request.search === cleanText(state.usersSearch) && request.filter === usersFilterState.value;
          if (isCurrentUsersRequest) applyUsersPage(data, false);
          state.managedAccessInvitations = Array.isArray(data.accessInvitations)
            ? data.accessInvitations
            : [];
          state.adminsCurrentPage = 1;
          if (isCurrentUsersRequest) state.usersCurrentPage = 1;
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
      const filter = usersFilterState.value;
      app.runServer(
        "getUsersPage",
        [{ search, filter, after: append ? usersNextCursor : null }],
        (data) => {
          // Une réponse arrivée après une nouvelle saisie (ou un autre filtre) est ignorée.
          if (search !== cleanText(state.usersSearch) || filter !== usersFilterState.value) return;
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
          clubsData.clubAdmins = Array.isArray(data.clubAdmins) ? data.clubAdmins : [];
          clubsData.isGlobalAdmin = data.isGlobalAdmin !== false;
          // L'admin global garde ses onglets ; « Sans club » n'existe pas pour un admin de club.
          if (!clubsData.isGlobalAdmin && usersFilterState.value === "noClub") usersFilterState.value = "";
          if (onLoaded) onLoaded();
        },
        showError
      );
    }

    // Après une modification de club, on recharge la gestion (utilisateurs et clubs) pour rester cohérent.
    function runClubAction<M extends "saveClub" | "deleteClub" | "setCoachClubs" | "addClubAdmin" | "removeClubAdmin">(
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
        message: `Supprimer le club « ${name} » ?`,
        method: "deleteClub",
        args: [clubId],
        onSuccess: (response) => {
          showSuccess(response.message);
          refreshAdminsManagement();
        }
      });
    }

    function toggleCoachClub(coachId: string, clubId: string, checked: boolean) {
      if (!clubId) return;
      const coach = coachCards.value.find((card) => card.judokaId === coachId);
      const current = coach ? coach.clubIds : [];
      const next = checked ? [...new Set([...current, clubId])] : current.filter((id) => id !== clubId);
      runClubAction("setCoachClubs", [coachId, next]);
    }

    // CLUBADM-001 : l'admin global nomme un admin du club par l'e-mail de son compte.
    function updateClubAdminEmail(clubId: string, value: string) {
      clubsData.adminEmailDrafts = { ...clubsData.adminEmailDrafts, [clubId]: String(value || "") };
    }

    function addClubAdmin(clubId: string) {
      const targetEmail = cleanText(clubsData.adminEmailDrafts[clubId]);
      if (!targetEmail) {
        showError({ message: "Saisissez l'e-mail du compte." });
        return;
      }
      runClubAction("addClubAdmin", [clubId, targetEmail], () => updateClubAdminEmail(clubId, ""));
    }

    async function removeClubAdmin(clubId: string, judokaId: string, fullName: string) {
      const confirmed = await notifications.confirmAction({
        message: `Retirer ${fullName} des admins de ${getClubName(clubId)} ?`,
        confirmLabel: "Retirer",
        cancelLabel: "Annuler",
        danger: true
      });
      if (confirmed) runClubAction("removeClubAdmin", [clubId, judokaId]);
    }

    function getClubName(clubId: string): string {
      const club = clubsData.clubs.find((option) => option.clubId === clubId);
      return club ? club.name : "";
    }

    // ADMIN-3 / CLUB-001 : « Modifier les clubs » ouvre le choix sous la ligne, prérempli.
    function openUserClubChoice(judokaId: string, clubIds: string[] = [], mainClubId = "") {
      const viewModel = getAdminsViewModel();
      const isOpen = viewModel.changingClubUserId === judokaId;
      viewModel.changingClubUserId = isOpen ? "" : judokaId;
      viewModel.userClubDraft = { clubIds: isOpen ? [] : [...clubIds], mainClubId: isOpen ? "" : mainClubId };
    }

    // Un club coché devient principal s'il est le seul ; décocher le principal passe au suivant.
    function toggleUserClubDraft(clubId: string) {
      if (!clubId) return;
      const draft = getAdminsViewModel().userClubDraft;
      const clubIds = draft.clubIds.includes(clubId)
        ? draft.clubIds.filter((id) => id !== clubId)
        : [...draft.clubIds, clubId];
      const mainClubId = clubIds.includes(draft.mainClubId) ? draft.mainClubId : clubIds[0] || "";
      getAdminsViewModel().userClubDraft = { clubIds, mainClubId };
    }

    function setUserMainClubDraft(clubId: string) {
      const draft = getAdminsViewModel().userClubDraft;
      if (draft.clubIds.includes(clubId)) draft.mainClubId = clubId;
    }

    function saveUserClubs(judokaId: string, fullName: string, previousClubIds: string[] = []) {
      const { clubIds, mainClubId } = getAdminsViewModel().userClubDraft;
      const names = clubIds.map((id) => (id === mainClubId && clubIds.length > 1 ? `${getClubName(id)} (principal)` : getClubName(id)));
      const removed = previousClubIds.filter((id) => !clubIds.includes(id)).map(getClubName).filter(Boolean);
      const target = names.length ? `à ${names.join(", ")}` : "sans club";
      const warning = removed.length ? ` Les coachs de ${removed.join(", ")} ne le verront plus.` : "";
      app.confirmAndRun({
        message: `Rattacher ${fullName} ${target} ?${warning}`,
        confirmLabel: "Enregistrer les clubs",
        method: "setJudokaClubs",
        args: [judokaId, clubIds, mainClubId || null],
        onSuccess: (response) => {
          // Une fois enregistrés, les clubs du judoka changent dans l'état local, pour l'espace coach.
          state.judokas = state.judokas.map((judoka) =>
            String(judoka.judokaId) === String(judokaId) ? { ...judoka, clubId: mainClubId || "", clubIds: [...clubIds] } : judoka
          );
          getAdminsViewModel().changingClubUserId = "";
          showSuccess(response.message || "Modification enregistrée.");
          refreshAdminsManagement();
        }
      });
    }

    function updateUsersSearch(value: string) {
      state.usersSearch = value || "";
      state.usersCurrentPage = 1;
      state.accessInvitationsCurrentPage = 1;
      searchUsers();
    }

    function resetUsersSearch() {
      usersFilterState.value = "";
      updateUsersSearch("");
    }

    // ADMIN-1 : nommer un coach se fait d'un toucher ; le retirer demande confirmation (UIX-038).
    function grantCoachRole(judokaId: string, fullName: string) {
      app.runServer(
        "grantCoachRole",
        [judokaId],
        (response) => {
          showSuccess(response.message || `${fullName} est coach.`);
          refreshAdminsManagement();
        },
        showError
      );
    }

    function revokeCoachRole(judokaId: string, fullName: string) {
      app.confirmAndRun({
        // CLUBADM-004 : un admin de club ne retire que ses clubs au coach.
        message: clubsData.isGlobalAdmin
          ? `Retirer le rôle coach de ${fullName} ? Ses clubs coachés lui seront retirés ; son profil et ses compétitions restent.`
          : `${fullName} ne coachera plus vos clubs. S'il coache un autre club, il le garde ; son profil et ses compétitions restent.`,
        confirmLabel: clubsData.isGlobalAdmin ? "Retirer le rôle coach" : "Retirer de vos clubs",
        method: "revokeCoachRole",
        args: [judokaId],
        onSuccess: (response) => {
          showSuccess(response.message);
          refreshAdminsManagement();
        }
      });
    }

    function selectUsersFilter(value: string) {
      usersFilterState.value = value === "noClub" || value === "notRegistered" || value === "coach" ? value : "";
      state.usersCurrentPage = 1;
      loadUsersPage(false);
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

    function showNextAccessInvitationsPage() {
      state.accessInvitationsCurrentPage += 1;
    }

    function showPreviousAccessInvitationsPage() {
      state.accessInvitationsCurrentPage = Math.max(state.accessInvitationsCurrentPage - 1, 1);
    }

    function cancelInvitation(email: string, name?: string) {
      const label = name ? ` « ${name} »` : "";
      app.confirmAndRun({
        message: `Annuler l'invitation${label} ?`,
        confirmLabel: "Annuler l'invitation",
        cancelLabel: "Garder l'invitation",
        method: "deleteAccessInvitation",
        args: [email],
        onSuccess: (response) => {
          showSuccess(response.message);
          refreshAdminsManagement();
        }
      });
    }

    function deleteUser(idJudoka: string, name?: string) {
      const label = name ? ` « ${name} »` : "";
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
      const label = name ? ` « ${name} »` : "";
      app.confirmAndRun({
        message: `Retirer les droits admin${label} ?`,
        confirmLabel: "Retirer les droits",
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
      updateUsersSearch
    };
  }

  window.createKirokuAdminsScreen = createKirokuAdminsScreen;
})();
