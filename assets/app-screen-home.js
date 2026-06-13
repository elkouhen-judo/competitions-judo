(() => {
  function createKirokuHomeScreen(app) {
    const { state, screens, ui, notifications } = app;
    const {
      cleanText,
      formatDate,
      getCompactJudokaLabel,
      getJudokaDisplayName,
      showView
    } = ui;
    const { showError } = notifications;
    const defaultHomeViewState = {
      homeTitle: "Mon espace judoka",
      homeSubtitle: "Retrouvez votre fiche et vos compétitions.",
      filterPlaceholder: "Tous les judokas...",
      filterJudokaText: "",
      filterJudokaId: "",
      filterOptions: [],
      showFilterOptions: false,
      canFilterByJudoka: false,
      showHomeActions: false,
      canManageAdmins: false,
      canManageChildren: false,
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
      competitions: [],
      competitionsEmptyMessage: "",
      hasCompetitions: false
    };
    let homeViewModel = null;

    function applyInitialData() {
      ensureHomeViewModel();
      const canFilterByJudoka = (state.isAdmin || state.isParent) && state.judokas.length > 0;
      homeViewModel.canFilterByJudoka = canFilterByJudoka;
      if (!canFilterByJudoka) {
        homeViewModel.filterJudokaText = "";
        homeViewModel.filterJudokaId = "";
      }

      ensureHomeActiveJudokaSelection();
      syncHomeContext();
    }

    function ensureHomeViewModel() {
      if (!window.Vue || homeViewModel) {
        return;
      }

      homeViewModel = window.Vue.reactive({ ...defaultHomeViewState });

      ui.mountViewModel("homeView", homeViewModel, {
        deleteCompetitionFromList: screens.competition.deleteCompetitionFromList,
        openCompetition: screens.competition.openCompetition,
        openHomeJudokaProfile,
        selectFilterJudoka,
        showAdminsManagement: screens.admins.showAdminsManagement,
        showChildrenManagement: screens.children.showChildrenManagement,
        showHomeCompetitionForm,
        showHomeFilterOptions,
        updateFilterJudokaText
      });
    }

    function getAccessibleHomeJudokas() {
      if (!state.currentUser) {
        return [];
      }
      return (state.isAdmin || state.isParent) ? state.judokas : [state.currentUser];
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
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = homeViewModel.filterJudokaId;

      if (!(state.isAdmin || state.isParent)) {
        homeViewModel.filterJudokaText = "";
        homeViewModel.filterJudokaId = "";
        return;
      }

      if (currentValue && accessibleJudokas.some(j => String(j.judokaId) === String(currentValue))) {
        return;
      }

      const defaultId = getDefaultHomeJudokaId();
      const defaultJudoka = accessibleJudokas.find(j => String(j.judokaId) === String(defaultId));
      homeViewModel.filterJudokaText = defaultJudoka ? getJudokaDisplayName(defaultJudoka) : "";
      homeViewModel.filterJudokaId = defaultJudoka ? String(defaultJudoka.judokaId) : "";
    }

    function getHomeActiveJudokaId() {
      if (!state.currentUser) {
        return "";
      }
      if (state.isAdmin || state.isParent) {
        return homeViewModel ? homeViewModel.filterJudokaId || "" : "";
      }
      return String(state.currentUser.judokaId || "");
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      return getAccessibleHomeJudokas().find(j => String(j.judokaId) === String(targetId)) || null;
    }

    function getHomeFilterOption(judoka) {
      return {
        judokaId: String(judoka.judokaId || ""),
        name: getJudokaDisplayName(judoka) || "Judoka",
        meta: cleanText(judoka.accountEmail) ? judoka.accountEmail : `ID ${String(judoka.judokaId || "").slice(-6)}`,
        searchText: `${getJudokaDisplayName(judoka)} ${judoka.accountEmail || ""} ${judoka.judokaId || ""}`.toLowerCase()
      };
    }

    function refreshHomeFilterOptions() {
      const query = cleanText(homeViewModel.filterJudokaText).toLowerCase();
      homeViewModel.filterOptions = getAccessibleHomeJudokas()
        .map(getHomeFilterOption)
        .filter(option => !query || option.searchText.includes(query));
    }

    function showHomeFilterOptions() {
      refreshHomeFilterOptions();
      homeViewModel.showFilterOptions = true;
    }

    function updateFilterJudokaText() {
      homeViewModel.filterJudokaId = "";
      refreshHomeFilterOptions();
      homeViewModel.showFilterOptions = true;
      syncHomeContext();
      renderCompetitions();
    }

    function selectFilterJudoka(option) {
      homeViewModel.filterJudokaId = option ? option.judokaId : "";
      homeViewModel.filterJudokaText = option ? option.name : "";
      homeViewModel.showFilterOptions = false;
      syncHomeContext();
      renderCompetitions();
    }

    function syncHomeContext() {
      ensureHomeViewModel();
      const activeJudoka = getHomeActiveJudoka();
      const copy = getHomeContextCopy(activeJudoka);
      const activeJudokaLabel = activeJudoka ? getCompactJudokaLabel(activeJudoka) : copy.emptyActionMeta;

      Object.assign(homeViewModel, {
        homeTitle: copy.homeTitle,
        homeSubtitle: copy.homeSubtitle,
        filterPlaceholder: copy.filterPlaceholder,
        showHomeActions: true,
        canManageAdmins: state.isAdmin,
        canManageChildren: state.canManageChildren,
        profileButtonText: copy.profileButtonText,
        profileButtonMeta: activeJudoka ? activeJudokaLabel : copy.profileButtonMeta,
        addCompetitionButtonText: "Nouvelle compétition",
        addCompetitionButtonMeta: activeJudoka ? activeJudokaLabel : copy.addCompetitionButtonMeta,
        competitionsTitle: copy.competitionsTitle,
        competitionsSubtitle: copy.competitionsSubtitle
      });

      if (!activeJudoka) {
        homeViewModel.activeJudokaSummary = {
          label: "Judoka actif",
          value: "Aucun judoka sélectionné",
          meta: "Choisissez un judoka pour ouvrir sa fiche et parcourir ses compétitions."
        };
      } else {
        const summaryMeta = state.isAdmin
          ? "Vous consultez actuellement le parcours de ce judoka."
          : state.isParent
            ? "Toutes les actions d'accueil concernent ce profil."
            : "Toutes vos actions principales sont regroupées ici.";
        homeViewModel.activeJudokaSummary = {
          label: "Judoka actif",
          value: getJudokaDisplayName(activeJudoka) || "Judoka",
          meta: summaryMeta
        };
      }

      const actionDisabled = Boolean((state.isAdmin || state.isParent) && !activeJudoka);
      homeViewModel.actionDisabled = actionDisabled;
    }

    function getHomeContextCopy(activeJudoka) {
      if (state.isAdmin) {
        return {
          homeTitle: "Suivi des judokas",
          homeSubtitle: activeJudoka
            ? "Le parcours d'accueil est centré sur le judoka actif."
            : "Choisissez un judoka pour afficher sa fiche et ses compétitions.",
          filterPlaceholder: "Choisir un judoka...",
          profileButtonText: "Voir la fiche",
          profileButtonMeta: "Choisir un judoka",
          addCompetitionButtonMeta: "Choisir un judoka",
          competitionsTitle: activeJudoka ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}` : "Compétitions du judoka actif",
          competitionsSubtitle: activeJudoka
            ? "Touchez une carte pour ouvrir ses combats."
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
          competitionsTitle: activeJudoka ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}` : "Compétitions du judoka actif",
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

    function renderCompetitions() {
      ensureHomeViewModel();
      const activeJudoka = getHomeActiveJudoka();
      const activeJudokaId = getHomeActiveJudokaId();

      if ((state.isAdmin || state.isParent) && !activeJudoka) {
        homeViewModel.competitions = [];
        homeViewModel.hasCompetitions = false;
        homeViewModel.competitionsEmptyMessage = "Sélectionnez un judoka pour afficher son parcours.";
        return;
      }

      let filteredComps = state.competitions;
      if (activeJudokaId) {
        filteredComps = state.competitions.filter(c => String(c.ownerJudokaId) === String(activeJudokaId));
      }

      if (!filteredComps.length) {
        homeViewModel.competitions = [];
        homeViewModel.hasCompetitions = false;
        homeViewModel.competitionsEmptyMessage = "Aucune compétition enregistrée pour ce judoka.";
        return;
      }

      const judokasById = new Map(state.judokas.map(j => [String(j.judokaId), j]));

      homeViewModel.competitions = filteredComps.map(c => {
        const judoka = judokasById.get(String(c.ownerJudokaId));
        return {
          competitionId: c.competitionId || "",
          name: c.name || "Compétition",
          date: formatDate(c.competitionDate),
          judokaName: judoka ? getJudokaDisplayName(judoka) : "",
          showJudoka: state.isAdmin || state.isParent,
          canDelete: state.isAdmin
        };
      });
      homeViewModel.hasCompetitions = homeViewModel.competitions.length > 0;
      homeViewModel.competitionsEmptyMessage = "";
    }

    function openHomeJudokaProfile() {
      if (!state.currentUser) {
        showError({ message: "Utilisateur introuvable." });
        return;
      }

      const accessibleJudokas = getAccessibleHomeJudokas();
      const targetJudokaId = getHomeActiveJudokaId();

      if ((state.isAdmin || state.isParent) && !targetJudokaId) {
        showError({
          message: state.isAdmin
            ? "Sélectionnez un judoka actif pour ouvrir sa fiche."
            : "Sélectionnez votre profil ou l'un de vos enfants comme judoka actif pour ouvrir la fiche."
        });
        return;
      }

      if (!targetJudokaId || !accessibleJudokas.some(j => String(j.judokaId) === String(targetJudokaId))) {
        showError({ message: "Sélectionnez d'abord un judoka." });
        return;
      }

      screens.judoka.showJudokaProfile(targetJudokaId);
    }

    function showHomeCompetitionForm() {
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
      showView("homeView");
    }

    return {
      applyInitialData,
      getAccessibleHomeJudokas,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      openHomeJudokaProfile,
      renderCompetitions,
      selectFilterJudoka,
      showHome,
      showHomeCompetitionForm,
      showHomeFilterOptions,
      syncHomeContext
    };
  }

  window.createKirokuHomeScreen = createKirokuHomeScreen;
})();
