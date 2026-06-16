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
      filterJudokaText: "",
      filterOptions: [] as HomeFilterOption[],
      showFilterOptions: false
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

    function getHomeActiveJudokaId() {
      if (!state.currentUser) {
        return "";
      }
      if (state.isAdmin || state.isCoach || state.isParent) {
        return state.homeFilterJudokaId || "";
      }
      return String(state.currentUser.judokaId || "");
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      return (
        getAccessibleHomeJudokas().find((j) => String(j.judokaId) === String(targetId)) || null
      );
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

    // --- Computed refs ---

    const canFilterByJudoka = window.Vue.computed(() =>
      (state.isAdmin || state.isCoach || state.isParent) && state.judokas.length > 0
    );
    const canManageAdmins = window.Vue.computed(() => state.isAdmin);
    const canManageChildren = window.Vue.computed(() => state.canManageChildren);
    const canCreateCompetition = window.Vue.computed(() => !state.isCoach);
    const canCreateClubCompetition = window.Vue.computed(() => state.isCoach || state.isAdmin);
    const showClubCompetitionsSection = window.Vue.computed(() => state.isCoach || state.isAdmin);
    const showHomeActions = window.Vue.computed(() => Boolean(state.currentUser));
    const actionDisabled = window.Vue.computed(() =>
      Boolean((state.isAdmin || state.isCoach || state.isParent) && !getHomeActiveJudokaId())
    );

    const homeContext = window.Vue.computed(() => {
      const activeJudoka = getHomeActiveJudoka();
      const copy = getHomeContextCopy(activeJudoka);
      const activeJudokaLabel = activeJudoka ? getCompactJudokaLabel(activeJudoka) : copy.emptyActionMeta;
      const summaryMeta = !activeJudoka
        ? "Choisissez un judoka pour ouvrir sa fiche et parcourir ses compétitions."
        : state.isAdmin || state.isCoach
          ? "Vous consultez actuellement le parcours de ce judoka."
          : state.isParent
            ? "Toutes les actions d'accueil concernent ce profil."
            : "Toutes vos actions principales sont regroupées ici.";

      return {
        homeTitle: copy.homeTitle,
        homeSubtitle: copy.homeSubtitle,
        filterPlaceholder: copy.filterPlaceholder,
        profileButtonText: copy.profileButtonText,
        profileButtonMeta: activeJudoka ? activeJudokaLabel : copy.profileButtonMeta,
        addCompetitionButtonText: "Nouvelle compétition",
        addCompetitionButtonMeta: activeJudoka ? activeJudokaLabel : copy.addCompetitionButtonMeta,
        competitionsTitle: copy.competitionsTitle,
        competitionsSubtitle: copy.competitionsSubtitle,
        showCompetitionsSection: !state.isCoach || Boolean(activeJudoka),
        activeJudokaSummary: {
          label: "Judoka actif",
          value: activeJudoka ? (getJudokaDisplayName(activeJudoka) || "Judoka") : "Aucun judoka sélectionné",
          meta: summaryMeta
        }
      };
    });

    const homeTitle = window.Vue.computed(() => homeContext.value.homeTitle);
    const homeSubtitle = window.Vue.computed(() => homeContext.value.homeSubtitle);
    const filterPlaceholder = window.Vue.computed(() => homeContext.value.filterPlaceholder);
    const profileButtonText = window.Vue.computed(() => homeContext.value.profileButtonText);
    const profileButtonMeta = window.Vue.computed(() => homeContext.value.profileButtonMeta);
    const addCompetitionButtonText = window.Vue.computed(() => homeContext.value.addCompetitionButtonText);
    const addCompetitionButtonMeta = window.Vue.computed(() => homeContext.value.addCompetitionButtonMeta);
    const competitionsTitle = window.Vue.computed(() => homeContext.value.competitionsTitle);
    const competitionsSubtitle = window.Vue.computed(() => homeContext.value.competitionsSubtitle);
    const showCompetitionsSection = window.Vue.computed(() => homeContext.value.showCompetitionsSection);
    const activeJudokaSummary = window.Vue.computed(() => homeContext.value.activeJudokaSummary);
    const filterJudokaId = window.Vue.computed(() => state.homeFilterJudokaId);

    const competitionsProjection = window.Vue.computed(() => {
      const activeJudokaId = getHomeActiveJudokaId();
      let filteredComps = state.competitions;
      if (activeJudokaId) {
        filteredComps = state.competitions.filter(
          (c) => String(c.ownerJudokaId) === String(activeJudokaId)
        );
      }
      if (!filteredComps.length) {
        const emptyMsg = activeJudokaId
          ? "Aucune compétition enregistrée pour ce judoka."
          : state.isParent
            ? "Aucune compétition enregistrée pour votre périmètre."
            : state.isCoach
              ? "Aucune compétition enregistrée dans le club."
              : "Aucune compétition enregistrée.";
        return {
          competitions: [] as HomeCompetitionCard[],
          hasCompetitions: false,
          competitionsEmptyMessage: emptyMsg,
          page: window.KirokuScreenProjections.paginateList([] as HomeCompetitionCard[], 1, defaultListPageSize)
        };
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
      return {
        competitions: allCompetitions,
        hasCompetitions: true,
        competitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(allCompetitions, state.competitionsCurrentPage, defaultListPageSize)
      };
    });

    const competitions = window.Vue.computed(() => competitionsProjection.value.page.pageItems);
    const hasCompetitions = window.Vue.computed(() => competitionsProjection.value.hasCompetitions);
    const competitionsEmptyMessage = window.Vue.computed(() => competitionsProjection.value.competitionsEmptyMessage);
    const competitionsTotalPages = window.Vue.computed(() => competitionsProjection.value.page.totalPages);
    const competitionsCurrentPage = window.Vue.computed(() => competitionsProjection.value.page.currentPage);
    const competitionsTotalCount = window.Vue.computed(() => competitionsProjection.value.page.totalItems);
    const competitionsCanShowPreviousPage = window.Vue.computed(() => competitionsProjection.value.page.canShowPreviousPage);
    const competitionsCanShowNextPage = window.Vue.computed(() => competitionsProjection.value.page.canShowNextPage);

    const clubCompetitionsProjection = window.Vue.computed(() => {
      if (!state.clubCompetitions.length) {
        return {
          clubCompetitionsList: [] as HomeClubCompetitionCard[],
          hasClubCompetitions: false,
          clubCompetitionsEmptyMessage: "Aucune compétition club créée.",
          page: window.KirokuScreenProjections.paginateList([] as HomeClubCompetitionCard[], 1, defaultListPageSize)
        };
      }
      const all = state.clubCompetitions.map((cc) => ({
        clubCompetitionId: cc.clubCompetitionId || "",
        name: cc.name || "Compétition",
        date: formatDate(cc.competitionDate)
      }));
      return {
        clubCompetitionsList: all,
        hasClubCompetitions: true,
        clubCompetitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(all, state.clubCompetitionsCurrentPage, defaultListPageSize)
      };
    });

    const clubCompetitionsList = window.Vue.computed(() => clubCompetitionsProjection.value.page.pageItems);
    const hasClubCompetitions = window.Vue.computed(() => clubCompetitionsProjection.value.hasClubCompetitions);
    const clubCompetitionsEmptyMessage = window.Vue.computed(() => clubCompetitionsProjection.value.clubCompetitionsEmptyMessage);
    const clubCompetitionsTotalPages = window.Vue.computed(() => clubCompetitionsProjection.value.page.totalPages);
    const clubCompetitionsCurrentPage = window.Vue.computed(() => clubCompetitionsProjection.value.page.currentPage);
    const clubCompetitionsTotalCount = window.Vue.computed(() => clubCompetitionsProjection.value.page.totalItems);
    const clubCompetitionsCanShowPreviousPage = window.Vue.computed(() => clubCompetitionsProjection.value.page.canShowPreviousPage);
    const clubCompetitionsCanShowNextPage = window.Vue.computed(() => clubCompetitionsProjection.value.page.canShowNextPage);

    function ensureHomeViewModel() {
      if (homeViewModelRef) {
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
      }, {
        canFilterByJudoka,
        canManageAdmins,
        canManageChildren,
        canCreateCompetition,
        canCreateClubCompetition,
        showClubCompetitionsSection,
        showHomeActions,
        actionDisabled,
        homeTitle,
        homeSubtitle,
        filterPlaceholder,
        profileButtonText,
        profileButtonMeta,
        addCompetitionButtonText,
        addCompetitionButtonMeta,
        competitionsTitle,
        competitionsSubtitle,
        showCompetitionsSection,
        activeJudokaSummary,
        filterJudokaId,
        competitions,
        hasCompetitions,
        competitionsEmptyMessage,
        competitionsTotalPages,
        competitionsCurrentPage,
        competitionsTotalCount,
        competitionsCanShowPreviousPage,
        competitionsCanShowNextPage,
        clubCompetitionsList,
        hasClubCompetitions,
        clubCompetitionsEmptyMessage,
        clubCompetitionsTotalPages,
        clubCompetitionsCurrentPage,
        clubCompetitionsTotalCount,
        clubCompetitionsCanShowPreviousPage,
        clubCompetitionsCanShowNextPage
      });
    }

    function applyInitialData() {
      ensureHomeViewModel();
      if (!(state.isAdmin || state.isCoach || state.isParent)) {
        getHomeViewModel().filterJudokaText = "";
      }
      ensureHomeActiveJudokaSelection();
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
      state.homeFilterJudokaId = "";
      refreshHomeFilterOptions();
      viewModel.showFilterOptions = true;
      state.competitionsCurrentPage = 1;
    }

    function selectFilterJudoka(option: HomeFilterOption | null) {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
        hideFilterOptionsTimer = null;
      }
      const viewModel = getHomeViewModel();
      state.homeFilterJudokaId = option ? option.judokaId : "";
      viewModel.filterJudokaText = option ? option.name : "";
      viewModel.showFilterOptions = false;
      state.competitionsCurrentPage = 1;
    }

    function ensureHomeActiveJudokaSelection() {
      const viewModel = getHomeViewModel();
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = state.homeFilterJudokaId;

      if (!(state.isAdmin || state.isCoach || state.isParent)) {
        state.homeFilterJudokaId = "";
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
      state.homeFilterJudokaId = defaultJudoka ? String(defaultJudoka.judokaId) : "";
    }

    function showCompetitionsPreviousPage() {
      state.competitionsCurrentPage = Math.max(state.competitionsCurrentPage - 1, 1);
    }

    function showCompetitionsNextPage() {
      state.competitionsCurrentPage += 1;
    }

    function showClubCompetitionsPreviousPage() {
      state.clubCompetitionsCurrentPage = Math.max(state.clubCompetitionsCurrentPage - 1, 1);
    }

    function showClubCompetitionsNextPage() {
      state.clubCompetitionsCurrentPage += 1;
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
      showView("homeView");
    }

    return {
      applyInitialData,
      getAccessibleHomeJudokas,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      openHomeJudokaProfile,
      selectFilterJudoka,
      showHome,
      showHomeCompetitionForm,
      hideHomeFilterOptions,
      showHomeFilterOptions,
      showCompetitionsPreviousPage,
      showCompetitionsNextPage,
      showClubCompetitionsPreviousPage,
      showClubCompetitionsNextPage
    };
  }

  window.createKirokuHomeScreen = createKirokuHomeScreen;
})();
