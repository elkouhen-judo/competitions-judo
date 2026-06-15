(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;

  interface HomeFilterOption {
    judokaId: string;
    name: string;
    meta: string;
    searchText: string;
  }

  interface HomeClubCompetitionCard {
    clubCompetitionId: string;
    name: string;
    date: string;
  }

  interface HomeCompetitionCard {
    competitionId: string;
    name: string;
    date: string;
    judokaName: string;
    showJudoka: boolean;
    canDelete: boolean;
  }

  function createKirokuHomeScreen(app: KirokuApp) {
    const { defaultListPageSize, state, screens, ui, notifications } = app;
    const { cleanText, formatDate, getCompactJudokaLabel, getJudokaDisplayName, showView } = ui;
    const { showError } = notifications;
    const defaultHomeViewState = {
      homeTitle: "Mon espace judoka",
      homeSubtitle: "Retrouvez votre fiche et vos compétitions.",
      filterPlaceholder: "Tous les judokas...",
      filterJudokaText: "",
      filterJudokaId: "",
      filterOptions: [] as HomeFilterOption[],
      showFilterOptions: false,
      canFilterByJudoka: false,
      canCreateCompetition: true,
      canCreateClubCompetition: false,
      showHomeActions: false,
      canManageAdmins: false,
      canManageChildren: false,
      showClubCompetitionsSection: false,
      showCompetitionsSection: true,
      clubCompetitionsList: [] as HomeClubCompetitionCard[],
      hasClubCompetitions: false,
      clubCompetitionsEmptyMessage: "",
      clubCompetitionsTotalPages: 1,
      clubCompetitionsCurrentPage: 1,
      clubCompetitionsTotalCount: 0,
      clubCompetitionsCanShowPreviousPage: false,
      clubCompetitionsCanShowNextPage: false,
      activeJudokaSummary: {
        label: "Judoka actif",
        value: "",
        meta: ""
      },
      actionDisabled: false,
      addCompetitionButtonText: "Ajouter une compétition",
      addCompetitionButtonMeta: "",
      profileButtonText: "Ma fiche judoka",
      profileButtonMeta: "",
      competitionsTitle: "Mes compétitions",
      competitionsSubtitle: "Touchez une carte pour ouvrir ses combats.",
      competitions: [] as HomeCompetitionCard[],
      competitionsEmptyMessage: "",
      hasCompetitions: false,
      competitionsTotalPages: 1,
      competitionsCurrentPage: 1,
      competitionsTotalCount: 0,
      competitionsCanShowPreviousPage: false,
      competitionsCanShowNextPage: false
    };
    let homeViewModelRef: (typeof defaultHomeViewState) | null = null;
    let hideFilterOptionsTimer: number | null = null;

    function getHomeViewModel() {
      ensureHomeViewModel();
      if (!homeViewModelRef) {
        throw new Error("Vue model de l'accueil non initialisé.");
      }
      return homeViewModelRef;
    }

    function applyInitialData() {
      const viewModel = getHomeViewModel();
      const canFilterByJudoka =
        (state.isAdmin || state.isCoach || state.isParent) && state.judokas.length > 0;
      viewModel.canFilterByJudoka = canFilterByJudoka;
      if (!canFilterByJudoka) {
        viewModel.filterJudokaText = "";
        viewModel.filterJudokaId = "";
      }

      ensureHomeActiveJudokaSelection();
      syncHomeContext();
      if (state.isCoach || state.isAdmin) {
        renderClubCompetitions();
      }
    }

    function ensureHomeViewModel() {
      if (!window.Vue || homeViewModelRef) {
        return;
      }

      homeViewModelRef = ui.createMountedViewModel("homeView", defaultHomeViewState, {
        deleteCompetitionFromList: screens.competition.deleteCompetitionFromList,
        deleteClubCompetitionFromList: screens.competition.confirmDeleteClubCompetitionById,
        openClubCompetition: screens.competition.openClubCompetition,
        openCompetition: screens.competition.openCompetition,
        openHomeJudokaProfile,
        selectFilterJudoka,
        showAdminsManagement: screens.admins.showAdminsManagement,
        showChildrenManagement: screens.children.showChildrenManagement,
        showClubCompetitionForm: screens.competition.showClubCompetitionForm,
        showHomeCompetitionForm,
        showHomeFilterOptions,
        showCompetitionsPreviousPage,
        showCompetitionsNextPage,
        showClubCompetitionsPreviousPage,
        showClubCompetitionsNextPage,
        updateFilterJudokaText
      });
    }

    function getAccessibleHomeJudokas() {
      if (!state.currentUser) {
        return [];
      }
      return state.isAdmin || state.isCoach || state.isParent ? state.judokas : [state.currentUser];
    }

    function getDefaultHomeJudokaId() {
      if (!state.currentUser) {
        return "";
      }
      return state.currentUser.profileType === "JUDOKA"
        ? String(state.currentUser.judokaId || "")
        : "";
    }

    function ensureHomeActiveJudokaSelection() {
      const viewModel = getHomeViewModel();
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = viewModel.filterJudokaId;

      if (!(state.isAdmin || state.isCoach || state.isParent)) {
        viewModel.filterJudokaText = "";
        viewModel.filterJudokaId = "";
        return;
      }

      if (
        currentValue &&
        accessibleJudokas.some((j) => String(j.judokaId) === String(currentValue))
      ) {
        return;
      }

      const defaultId = getDefaultHomeJudokaId();
      const defaultJudoka = accessibleJudokas.find((j) => String(j.judokaId) === String(defaultId));
      viewModel.filterJudokaText = defaultJudoka ? getJudokaDisplayName(defaultJudoka) : "";
      viewModel.filterJudokaId = defaultJudoka ? String(defaultJudoka.judokaId) : "";
    }

    function getHomeActiveJudokaId() {
      if (!state.currentUser) {
        return "";
      }
      if (state.isAdmin || state.isCoach || state.isParent) {
        return homeViewModelRef ? homeViewModelRef.filterJudokaId || "" : "";
      }
      return String(state.currentUser.judokaId || "");
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      return (
        getAccessibleHomeJudokas().find((j) => String(j.judokaId) === String(targetId)) || null
      );
    }

    function getHomeFilterOption(judoka: Judoka): HomeFilterOption {
      return {
        judokaId: String(judoka.judokaId || ""),
        name: getJudokaDisplayName(judoka) || "Judoka",
        meta: cleanText(judoka.accountEmail)
          ? judoka.accountEmail
          : `ID ${String(judoka.judokaId || "").slice(-6)}`,
        searchText:
          `${getJudokaDisplayName(judoka)} ${judoka.accountEmail || ""} ${judoka.judokaId || ""}`.toLowerCase()
      };
    }

    function refreshHomeFilterOptions(queryOverride?: string) {
      const viewModel = getHomeViewModel();
      const query =
        queryOverride !== undefined
          ? cleanText(queryOverride).toLowerCase()
          : cleanText(viewModel.filterJudokaText).toLowerCase();
      viewModel.filterOptions = getAccessibleHomeJudokas()
        .map(getHomeFilterOption)
        .filter((option) => !query || option.searchText.includes(query));
    }

    function showHomeFilterOptions() {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
        hideFilterOptionsTimer = null;
      }
      refreshHomeFilterOptions("");
      getHomeViewModel().showFilterOptions = true;
    }

    function hideHomeFilterOptions() {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
      }
      hideFilterOptionsTimer = window.setTimeout(() => {
        const homeViewModel = getHomeViewModel();
        homeViewModel.showFilterOptions = false;
        hideFilterOptionsTimer = null;
      }, 120);
    }

    function updateFilterJudokaText() {
      const viewModel = getHomeViewModel();
      viewModel.filterJudokaId = "";
      refreshHomeFilterOptions();
      viewModel.showFilterOptions = true;
      state.competitionsCurrentPage = 1;
      syncHomeContext();
      renderCompetitions();
    }

    function selectFilterJudoka(option: HomeFilterOption | null) {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
        hideFilterOptionsTimer = null;
      }
      const viewModel = getHomeViewModel();
      viewModel.filterJudokaId = option ? option.judokaId : "";
      viewModel.filterJudokaText = option ? option.name : "";
      viewModel.showFilterOptions = false;
      state.competitionsCurrentPage = 1;
      syncHomeContext();
      renderCompetitions();
    }

    function syncHomeContext() {
      const viewModel = getHomeViewModel();
      const activeJudoka = getHomeActiveJudoka();
      const copy = getHomeContextCopy(activeJudoka);
      const activeJudokaLabel = activeJudoka
        ? getCompactJudokaLabel(activeJudoka)
        : copy.emptyActionMeta;

      Object.assign(viewModel, {
        homeTitle: copy.homeTitle,
        homeSubtitle: copy.homeSubtitle,
        filterPlaceholder: copy.filterPlaceholder,
        showHomeActions: true,
        canManageAdmins: state.isAdmin,
        canManageChildren: state.canManageChildren,
        canCreateCompetition: !state.isCoach,
        canCreateClubCompetition: state.isCoach || state.isAdmin,
        showClubCompetitionsSection: state.isCoach || state.isAdmin,
        showCompetitionsSection: !state.isCoach || Boolean(activeJudoka),
        profileButtonText: copy.profileButtonText,
        profileButtonMeta: activeJudoka ? activeJudokaLabel : copy.profileButtonMeta,
        addCompetitionButtonText: "Nouvelle compétition",
        addCompetitionButtonMeta: activeJudoka ? activeJudokaLabel : copy.addCompetitionButtonMeta,
        competitionsTitle: copy.competitionsTitle,
        competitionsSubtitle: copy.competitionsSubtitle
      });

      if (!activeJudoka) {
        viewModel.activeJudokaSummary = {
          label: "Judoka actif",
          value: "Aucun judoka sélectionné",
          meta: "Choisissez un judoka pour ouvrir sa fiche et parcourir ses compétitions."
        };
      } else {
        const summaryMeta =
          state.isAdmin || state.isCoach
            ? "Vous consultez actuellement le parcours de ce judoka."
            : state.isParent
              ? "Toutes les actions d'accueil concernent ce profil."
              : "Toutes vos actions principales sont regroupées ici.";
        viewModel.activeJudokaSummary = {
          label: "Judoka actif",
          value: getJudokaDisplayName(activeJudoka) || "Judoka",
          meta: summaryMeta
        };
      }

      const actionDisabled = Boolean(
        (state.isAdmin || state.isCoach || state.isParent) && !activeJudoka
      );
      const homeViewModel = getHomeViewModel();
      homeViewModel.actionDisabled = actionDisabled;
    }

    function getHomeContextCopy(activeJudoka: Judoka | null) {
      if (state.isAdmin || state.isCoach) {
        return {
          homeTitle: state.isCoach ? "Vue coach" : "Suivi des judokas",
          homeSubtitle: activeJudoka
            ? "Le parcours d'accueil est centré sur le judoka actif."
            : "Choisissez un judoka pour afficher sa fiche et ses compétitions.",
          filterPlaceholder: "Choisir un judoka...",
          profileButtonText: "Voir la fiche",
          profileButtonMeta: "Choisir un judoka",
          addCompetitionButtonMeta: "Choisir un judoka",
          competitionsTitle: activeJudoka
            ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}`
            : state.isCoach
              ? "Compétitions du club"
              : "Compétitions du judoka actif",
          competitionsSubtitle: activeJudoka
            ? "Touchez une carte pour ouvrir ses combats."
            : state.isCoach
              ? "Touchez une carte pour ouvrir les résultats de la compétition."
              : "Sélectionnez d'abord un judoka pour afficher son parcours.",
          emptyActionMeta: "Choisir un judoka"
        };
      }

      if (state.isParent) {
        return {
          homeTitle: "Suivi judoka",
          homeSubtitle: activeJudoka
            ? "Le parcours d'accueil est centré sur le judoka actif."
            : "Choisissez votre profil ou celui d'un enfant pour travailler dans son contexte.",
          filterPlaceholder: "Moi ou mes enfants...",
          profileButtonText: "Voir la fiche",
          profileButtonMeta: "Moi ou un enfant",
          addCompetitionButtonMeta: "Moi ou un enfant",
          competitionsTitle: activeJudoka
            ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}`
            : "Compétitions du judoka actif",
          competitionsSubtitle: activeJudoka
            ? "Touchez une carte pour ouvrir ses combats."
            : "Sélectionnez d'abord un judoka pour afficher son parcours.",
          emptyActionMeta: "Moi ou un enfant"
        };
      }

      return {
        homeTitle: "Mon espace judoka",
        homeSubtitle: "Retrouvez votre fiche et vos compétitions.",
        filterPlaceholder: "Tous les judokas...",
        profileButtonText: "Ma fiche",
        profileButtonMeta: getCompactJudokaLabel(state.currentUser),
        addCompetitionButtonMeta: "",
        competitionsTitle: "Mes compétitions",
        competitionsSubtitle: "Touchez une carte pour ouvrir ses combats.",
        emptyActionMeta: ""
      };
    }

    function renderClubCompetitions() {
      const viewModel = getHomeViewModel();
      if (!state.clubCompetitions.length) {
        viewModel.clubCompetitionsList = [];
        viewModel.hasClubCompetitions = false;
        viewModel.clubCompetitionsEmptyMessage = "Aucune compétition club créée.";
        viewModel.clubCompetitionsTotalPages = 1;
        viewModel.clubCompetitionsCurrentPage = 1;
        viewModel.clubCompetitionsTotalCount = 0;
        viewModel.clubCompetitionsCanShowPreviousPage = false;
        viewModel.clubCompetitionsCanShowNextPage = false;
        return;
      }
      const allClubCompetitions = state.clubCompetitions.map((cc) => ({
        clubCompetitionId: cc.clubCompetitionId || "",
        name: cc.name || "Compétition",
        date: formatDate(cc.competitionDate)
      }));
      const pagination = window.KirokuScreenProjections.paginateList(
        allClubCompetitions,
        state.clubCompetitionsCurrentPage,
        defaultListPageSize
      );
      viewModel.clubCompetitionsList = pagination.pageItems;
      viewModel.hasClubCompetitions = allClubCompetitions.length > 0;
      viewModel.clubCompetitionsEmptyMessage = "";
      viewModel.clubCompetitionsTotalPages = pagination.totalPages;
      viewModel.clubCompetitionsCurrentPage = pagination.currentPage;
      viewModel.clubCompetitionsTotalCount = pagination.totalItems;
      viewModel.clubCompetitionsCanShowPreviousPage = pagination.canShowPreviousPage;
      viewModel.clubCompetitionsCanShowNextPage = pagination.canShowNextPage;
      state.clubCompetitionsCurrentPage = pagination.currentPage;
    }

    function showClubCompetitionsPreviousPage() {
      state.clubCompetitionsCurrentPage = Math.max(state.clubCompetitionsCurrentPage - 1, 1);
      renderClubCompetitions();
    }

    function showClubCompetitionsNextPage() {
      state.clubCompetitionsCurrentPage += 1;
      renderClubCompetitions();
    }

    function renderCompetitions() {
      const viewModel = getHomeViewModel();
      const activeJudokaId = getHomeActiveJudokaId();

      let filteredComps = state.competitions;
      if (activeJudokaId) {
        filteredComps = state.competitions.filter(
          (c) => String(c.ownerJudokaId) === String(activeJudokaId)
        );
      }

      if (!filteredComps.length) {
        viewModel.competitions = [];
        viewModel.hasCompetitions = false;
        viewModel.competitionsEmptyMessage = activeJudokaId
          ? "Aucune compétition enregistrée pour ce judoka."
          : state.isParent
            ? "Aucune compétition enregistrée pour votre périmètre."
            : state.isCoach
              ? "Aucune compétition enregistrée dans le club."
              : "Aucune compétition enregistrée.";
        viewModel.competitionsTotalPages = 1;
        viewModel.competitionsCurrentPage = 1;
        viewModel.competitionsTotalCount = 0;
        viewModel.competitionsCanShowPreviousPage = false;
        viewModel.competitionsCanShowNextPage = false;
        return;
      }

      const judokasById = new Map(state.judokas.map((j) => [String(j.judokaId), j]));

      const allCompetitions = filteredComps.map((c) => {
        const judoka = judokasById.get(String(c.ownerJudokaId));
        return {
          competitionId: c.competitionId || "",
          name: c.name || "Compétition",
          date: formatDate(c.competitionDate),
          judokaName: judoka ? getJudokaDisplayName(judoka) : "",
          showJudoka: state.isAdmin || state.isCoach || state.isParent,
          canDelete: (state.isAdmin || state.isParent) && !state.isCoach
        };
      });
      const pagination = window.KirokuScreenProjections.paginateList(
        allCompetitions,
        state.competitionsCurrentPage,
        defaultListPageSize
      );
      viewModel.competitions = pagination.pageItems;
      viewModel.hasCompetitions = allCompetitions.length > 0;
      viewModel.competitionsEmptyMessage = "";
      viewModel.competitionsTotalPages = pagination.totalPages;
      viewModel.competitionsCurrentPage = pagination.currentPage;
      viewModel.competitionsTotalCount = pagination.totalItems;
      viewModel.competitionsCanShowPreviousPage = pagination.canShowPreviousPage;
      viewModel.competitionsCanShowNextPage = pagination.canShowNextPage;
      state.competitionsCurrentPage = pagination.currentPage;
    }

    function showCompetitionsPreviousPage() {
      state.competitionsCurrentPage = Math.max(state.competitionsCurrentPage - 1, 1);
      renderCompetitions();
    }

    function showCompetitionsNextPage() {
      state.competitionsCurrentPage += 1;
      renderCompetitions();
    }

    function openHomeJudokaProfile() {
      if (!state.currentUser) {
        showError({ message: "Utilisateur introuvable." });
        return;
      }

      const accessibleJudokas = getAccessibleHomeJudokas();
      const targetJudokaId = getHomeActiveJudokaId();

      if ((state.isAdmin || state.isCoach || state.isParent) && !targetJudokaId) {
        showError({
          message:
            state.isAdmin || state.isCoach
              ? "Sélectionnez un judoka actif pour ouvrir sa fiche."
              : "Sélectionnez votre profil ou l'un de vos enfants comme judoka actif pour ouvrir la fiche."
        });
        return;
      }

      if (
        !targetJudokaId ||
        !accessibleJudokas.some((j) => String(j.judokaId) === String(targetJudokaId))
      ) {
        showError({ message: "Sélectionnez d'abord un judoka." });
        return;
      }

      screens.judoka.showJudokaProfile(targetJudokaId);
    }

    function showHomeCompetitionForm() {
      if (state.isCoach) {
        showError({ message: "Le coach dispose d'un accès en lecture seule." });
        return;
      }

      const activeJudokaId = getHomeActiveJudokaId();
      if ((state.isAdmin || state.isParent) && !activeJudokaId) {
        showError({
          message: state.isAdmin
            ? "Sélectionnez un judoka actif avant d'ajouter une compétition."
            : "Sélectionnez votre profil ou l'un de vos enfants comme judoka actif avant d'ajouter une compétition."
        });
        return;
      }

      screens.competition.showCompetitionForm();
    }

    function showHome() {
      state.currentCompetition = null;
      state.currentCombats = [];
      state.currentJudokaProfile = null;
      state.canEditCurrentCompetition = false;
      syncHomeContext();
      renderCompetitions();
      if (state.isCoach || state.isAdmin) {
        renderClubCompetitions();
      }
      showView("homeView");
    }

    return {
      applyInitialData,
      getAccessibleHomeJudokas,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      openHomeJudokaProfile,
      renderClubCompetitions,
      renderCompetitions,
      selectFilterJudoka,
      showHome,
      showHomeCompetitionForm,
      hideHomeFilterOptions,
      showHomeFilterOptions,
      showCompetitionsPreviousPage,
      showCompetitionsNextPage,
      showClubCompetitionsPreviousPage,
      showClubCompetitionsNextPage,
      syncHomeContext
    };
  }

  window.createKirokuHomeScreen = createKirokuHomeScreen;
})();
