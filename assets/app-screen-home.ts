(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;
  type HomeMode = "judoka" | "parentHome" | "coachHome" | "coach" | "coachJudoka" | "family";
  type AppScreens = import("./types").AppScreens;
  type KirokuAppState = import("./types").KirokuAppState;
  type KirokuUi = import("./types").KirokuUi;

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
    participantCount: number;
    rankedCount: number;
    podiumCount: number;
    missingCoachReviewCount: number;
    summary: string;
    statusLabel: string;
  }

  interface HomeCompetitionCard {
    competitionId: string;
    name: string;
    date: string;
    judokaName: string;
    showJudoka: boolean;
    hasCoachReview: boolean;
  }

  // Mode/context concern: which modes are available, which one is active, and the
  // title/labels/visibility flags that depend purely on the current mode + active judoka.
  // Kept apart from the competitions/club-competitions list projections below, which it
  // never reads from.
  function createHomeModeController(deps: {
    state: KirokuAppState;
    screens: AppScreens;
    ui: KirokuUi;
    getCurrentMode: () => HomeMode;
    getHomeActiveJudoka: () => Judoka | null;
    getHomeActiveJudokaId: () => string;
    getHomeViewModel: () => { filterJudokaText: string; showFilterOptions: boolean };
    ensureHomeActiveJudokaSelection: () => void;
    openHomeJudokaProfile: () => void;
    persistNavigationState: KirokuApp["persistNavigationState"];
  }) {
    const {
      state,
      screens,
      ui,
      getCurrentMode,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      getHomeViewModel,
      ensureHomeActiveJudokaSelection,
      openHomeJudokaProfile,
      persistNavigationState
    } = deps;
    const { cleanText, getCompactJudokaLabel, getJudokaDisplayName, showView } = ui;

    function isPrimaryModeActive(modeKey: string): boolean {
      if (modeKey === "coachHome") {
        return ["coachHome", "coach", "coachJudoka"].includes(getCurrentMode());
      }
      if (modeKey === "parentHome") {
        return ["parentHome", "family"].includes(getCurrentMode());
      }
      return modeKey === getCurrentMode();
    }

    function getJudokaFirstName(judoka: Judoka): string {
      const firstName = cleanText(judoka.firstName);
      if (firstName) return firstName;
      return cleanText(getJudokaDisplayName(judoka)).split(/\s+/)[0] || "";
    }

    function formatParentCompetitionsHubButtonText(judoka: Judoka | null): string {
      if (!judoka) return "Gérer les compétitions";
      const firstName = getJudokaFirstName(judoka);
      if (!firstName) return "Gérer les compétitions";
      const prefix = /^[aeiouyàâäéèêëîïôöùûüh]/i.test(firstName) ? "d'" : "de ";
      return `Gérer les compétitions ${prefix}${firstName}`;
    }

    const availableModes = window.Vue.computed(() => {
      const modes: Array<{ key: string; label: string }> = [
        { key: "judoka", label: "Mon espace" }
      ];
      if (state.isCoach) {
        modes.push({ key: "coachHome", label: "Coach" });
      }
      if (state.isAdmin) {
        modes.push({ key: "admin", label: "Gestion des accès" });
      }
      if (state.isParent) {
        modes.push({ key: "parentHome", label: "Parent" });
      }
      return modes;
    });

    const coachSubModes = window.Vue.computed(() => [
      { key: "coachHome", label: "Accueil coach" },
      { key: "judoka", label: "Mon espace" }
    ]);

    const showModeTabs = window.Vue.computed(() => availableModes.value.length > 1);
    const currentHomeMode = window.Vue.computed(() => getCurrentMode());
    const showCoachSubTabs = window.Vue.computed(
      () => state.isCoach && ["coachHome", "judoka", "coach", "coachJudoka"].includes(getCurrentMode())
    );

    const canFilterByJudoka = window.Vue.computed(() => {
      const mode = getCurrentMode();
      return (mode === "coachJudoka" || mode === "family") && state.judokas.length > 0;
    });

    const canCreateCompetition = window.Vue.computed(
      () =>
        !state.isAdmin &&
        getCurrentMode() !== "parentHome" &&
        getCurrentMode() !== "coachHome" &&
        getCurrentMode() !== "coach" &&
        getCurrentMode() !== "coachJudoka"
    );
    const canCreateClubCompetition = window.Vue.computed(
      () => getCurrentMode() === "coach" && state.isCoach
    );
    const canOpenJudokaProfile = window.Vue.computed(
      () => getCurrentMode() !== "coachHome" && getCurrentMode() !== "coach"
    );
    const showClubCompetitionsSection = window.Vue.computed(
      () => getCurrentMode() === "coach"
    );
    const showParentHub = window.Vue.computed(() => getCurrentMode() === "parentHome");
    const showCoachHub = window.Vue.computed(() => getCurrentMode() === "coachHome");
    const showJudokaHub = window.Vue.computed(() => getCurrentMode() === "judoka");
    const showHomeContextTitle = window.Vue.computed(
      () => !["admin", "judoka", "family", "parentHome", "coachHome"].includes(getCurrentMode()) && !showCoachSubTabs.value
    );
    const showHomeHero = window.Vue.computed(
      () =>
        (showModeTabs.value && !showCoachSubTabs.value) ||
        showCoachSubTabs.value ||
        canFilterByJudoka.value ||
        showHomeContextTitle.value
    );
    const showHomeActions = window.Vue.computed(() => Boolean(state.currentUser) && !showParentHub.value && !showCoachHub.value);

    const actionDisabled = window.Vue.computed(() => {
      const mode = getCurrentMode();
      if (mode === "judoka") return false;
      if (mode === "coach") return false;
      if (mode === "coachHome") return false;
      if (mode === "parentHome") return !getHomeActiveJudokaId();
      if (mode === "coachJudoka") return !getHomeActiveJudokaId();
      if (mode === "family") return !getHomeActiveJudokaId();
      return false;
    });

    const homeContext = window.Vue.computed(() => {
      const mode = getCurrentMode();
      const activeJudoka = getHomeActiveJudoka();
      const activeLabel = activeJudoka ? getCompactJudokaLabel(activeJudoka) : "";
      const activeName = activeJudoka ? getJudokaDisplayName(activeJudoka) : "";

      if (mode === "judoka") {
        const selfLabel = getCompactJudokaLabel(state.currentUser);
        return {
          homeTitle: "Mon espace",
          homeSubtitle: "Mes compétitions et ma progression.",
          filterPlaceholder: "",
          profileButtonText: "Ma fiche",
          profileButtonMeta: selfLabel,
          addCompetitionButtonText: "Nouvelle compétition",
          addCompetitionButtonMeta: selfLabel,
          competitionsTitle: "Derniers résultats",
          competitionsSubtitle: "Compétitions passées, de la plus récente à la plus ancienne.",
          showCompetitionsSection: true,
        };
      }

      if (mode === "coachHome") {
        return {
          homeTitle: "Coach",
          homeSubtitle: "Choisissez l'action à lancer.",
          filterPlaceholder: "",
          profileButtonText: "",
          profileButtonMeta: "",
          addCompetitionButtonText: "",
          addCompetitionButtonMeta: "",
          competitionsTitle: "",
          competitionsSubtitle: "",
          showCompetitionsSection: false,
        };
      }

      if (mode === "coach") {
        return {
          homeTitle: "Compétition",
          homeSubtitle: "Compétitions club, suivis collectifs et bilans coach.",
          filterPlaceholder: "",
          profileButtonText: "",
          profileButtonMeta: "",
          addCompetitionButtonText: "Nouvelle compétition",
          addCompetitionButtonMeta: "Affecter plusieurs judokas",
          competitionsTitle: "",
          competitionsSubtitle: "",
          showCompetitionsSection: false,
        };
      }

      if (mode === "parentHome") {
        return {
          homeTitle: "Parent",
          homeSubtitle: "Choisissez l'action à lancer pour votre famille.",
          filterPlaceholder: "",
          profileButtonText: "",
          profileButtonMeta: activeLabel || "Choisir un judoka",
          addCompetitionButtonText: "",
          addCompetitionButtonMeta: "",
          competitionsTitle: "",
          competitionsSubtitle: "",
          showCompetitionsSection: false,
        };
      }

      if (mode === "coachJudoka") {
        return {
          homeTitle: "Judoka",
          homeSubtitle: activeJudoka
            ? `Parcours de ${activeName}`
            : "Choisissez un judoka pour consulter sa fiche et son historique.",
          filterPlaceholder: "Choisir un judoka...",
          profileButtonText: "Voir la fiche",
          profileButtonMeta: activeLabel || "Choisir un judoka",
          addCompetitionButtonText: "",
          addCompetitionButtonMeta: "",
          competitionsTitle: activeJudoka
            ? `Résultats de ${activeName}`
            : "Résultats du judoka actif",
          competitionsSubtitle: activeJudoka
            ? "Compétitions passées, de la plus récente à la plus ancienne."
            : "Sélectionnez un judoka pour voir son historique.",
          showCompetitionsSection: Boolean(activeJudoka),
        };
      }

      // family mode
      return {
        homeTitle: "Ma famille",
        homeSubtitle: activeJudoka
          ? `Parcours de ${activeName}`
          : "Choisissez un profil pour afficher ses compétitions.",
        filterPlaceholder: "Choisir un judoka...",
        profileButtonText: "Voir la fiche",
        profileButtonMeta: activeLabel || "Choisir un judoka",
        addCompetitionButtonText: "Nouvelle compétition",
        addCompetitionButtonMeta: activeLabel || "Choisir un judoka",
        competitionsTitle: activeJudoka
          ? `Résultats de ${activeName}`
          : "Résultats du judoka actif",
        competitionsSubtitle: activeJudoka
          ? "Compétitions passées, de la plus récente à la plus ancienne."
          : "Sélectionnez un judoka pour voir son historique.",
        showCompetitionsSection: Boolean(activeJudoka),
      };
    });

    const homeTitle = window.Vue.computed(() => homeContext.value.homeTitle);
    const homeSubtitle = window.Vue.computed(() => homeContext.value.homeSubtitle);
    const filterPlaceholder = window.Vue.computed(() => homeContext.value.filterPlaceholder);
    const profileButtonText = window.Vue.computed(() => homeContext.value.profileButtonText);
    const profileButtonMeta = window.Vue.computed(() => homeContext.value.profileButtonMeta);
    const parentCompetitionsHubButtonText = window.Vue.computed(() =>
      formatParentCompetitionsHubButtonText(getHomeActiveJudoka())
    );
    const addCompetitionButtonText = window.Vue.computed(() => homeContext.value.addCompetitionButtonText);
    const addCompetitionButtonMeta = window.Vue.computed(() => homeContext.value.addCompetitionButtonMeta);
    const competitionsTitle = window.Vue.computed(() => homeContext.value.competitionsTitle);
    const competitionsSubtitle = window.Vue.computed(() => homeContext.value.competitionsSubtitle);
    const showCompetitionsSection = window.Vue.computed(() => homeContext.value.showCompetitionsSection);

    function setHomeMode(mode: HomeMode) {
      state.homeMode = mode;
      state.competitionsCurrentPage = 1;
      state.clubCompetitionsCurrentPage = 1;
      const vm = getHomeViewModel();
      vm.showFilterOptions = false;
      ensureHomeActiveJudokaSelection();
      showView("homeView", { routeState: { homeMode: mode }, replace: true, preserveScroll: true });
    }

    function scrollToHomeSection(id: string) {
      window.Vue.nextTick(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    function handleModeTabClick(modeKey: string) {
      if (modeKey === "admin") {
        screens.admins.showAdminsManagement();
        return;
      }
      if (modeKey === "coachDashboard") {
        screens.coachDashboard.showCoachDashboard();
        return;
      }
      if (modeKey === "coachChat") {
        screens.coachDashboard.showCoachChat();
        return;
      }
      setHomeMode(modeKey as HomeMode);
    }

    function openCoachCompetitionsHub() {
      setHomeMode("coach");
      scrollToHomeSection("homeClubCompetitionsSection");
    }

    function openCoachJudokaHub() {
      setHomeMode("coachJudoka");
    }

    function openCoachStatsHub() {
      screens.coachDashboard.showCoachDashboard();
    }

    function openCoachChatHub() {
      screens.coachDashboard.showCoachChat();
    }

    function openParentCompetitionsHub() {
      setHomeMode("family");
      scrollToHomeSection("homeCompetitionsSection");
    }

    function openParentJudokaSelectionHub() {
      setHomeMode("family");
      state.homeFilterJudokaId = "";
      getHomeViewModel().filterJudokaText = "";
      window.Vue.nextTick(() => {
        const input = document.getElementById("filterJudokaText") as HTMLInputElement | null;
        if (input) {
          input.focus();
        }
      });
    }

    function openParentProfileHub() {
      openHomeJudokaProfile();
    }

    return {
      isPrimaryModeActive,
      availableModes,
      coachSubModes,
      showModeTabs,
      currentHomeMode,
      showCoachSubTabs,
      canFilterByJudoka,
      canCreateCompetition,
      canCreateClubCompetition,
      canOpenJudokaProfile,
      showClubCompetitionsSection,
      showParentHub,
      showCoachHub,
      showJudokaHub,
      showHomeContextTitle,
      showHomeHero,
      showHomeActions,
      actionDisabled,
      homeTitle,
      homeSubtitle,
      filterPlaceholder,
      profileButtonText,
      profileButtonMeta,
      parentCompetitionsHubButtonText,
      addCompetitionButtonText,
      addCompetitionButtonMeta,
      competitionsTitle,
      competitionsSubtitle,
      showCompetitionsSection,
      setHomeMode,
      handleModeTabClick,
      openCoachCompetitionsHub,
      openCoachJudokaHub,
      openCoachStatsHub,
      openCoachChatHub,
      openParentCompetitionsHub,
      openParentJudokaSelectionHub,
      openParentProfileHub,
      scrollToHomeSection
    };
  }

  function createKirokuHomeScreen(app: KirokuApp) {
    const { defaultListPageSize, state, screens, ui, notifications } = app;
    const { cleanText, formatDate, getJudokaDisplayName, showView } = ui;
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

    function getCurrentMode(): HomeMode {
      return state.homeMode;
    }

    function getTodayStr() {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    function getAccessibleHomeJudokas() {
      if (!state.currentUser) return [];
      if (getCurrentMode() === "judoka") return [state.currentUser];
      return state.judokas.length > 0 ? state.judokas : [state.currentUser];
    }

    function getDefaultHomeJudokaId() {
      if (!state.currentUser) return "";
      return state.currentUser.profileType === "JUDOKA"
        ? String(state.currentUser.judokaId || "")
        : "";
    }

    function getHomeActiveJudokaId() {
      if (!state.currentUser) return "";
      if (getCurrentMode() === "judoka") return String(state.currentUser.judokaId || "");
      if (getCurrentMode() === "coach") return "";
      if (getCurrentMode() === "coachHome") return "";
      return state.homeFilterJudokaId || "";
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      if (!targetId) return null;
      return getAccessibleHomeJudokas().find((j) => String(j.judokaId) === String(targetId)) || null;
    }

    function ensureHomeActiveJudokaSelection() {
      const mode = getCurrentMode();
      if (mode === "judoka") return;

      const viewModel = getHomeViewModel();
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = state.homeFilterJudokaId;

      if (currentValue && accessibleJudokas.some((j) => String(j.judokaId) === String(currentValue))) {
        return;
      }

      const shouldAutoSelectJudoka =
        mode === "family" || mode === "parentHome" || mode === "coachJudoka";
      const firstChild = shouldAutoSelectJudoka
        ? accessibleJudokas.find((j) => String(j.judokaId) !== String(state.currentUser?.judokaId || ""))
        : null;
      const autoId = shouldAutoSelectJudoka
        ? getDefaultHomeJudokaId() || String(firstChild?.judokaId || "")
        : "";
      const autoJudoka = autoId
        ? accessibleJudokas.find((j) => String(j.judokaId) === String(autoId))
        : null;
      viewModel.filterJudokaText = autoJudoka ? getJudokaDisplayName(autoJudoka) : "";
      state.homeFilterJudokaId = autoJudoka ? String(autoJudoka.judokaId) : "";
    }

    function openHomeJudokaProfile() {
      if (!state.currentUser) {
        showError({ message: "Utilisateur introuvable." });
        return;
      }
      const targetJudokaId = getHomeActiveJudokaId();
      if (!targetJudokaId) {
        showError({
          message: getCurrentMode() === "family"
            ? "Sélectionnez votre profil ou l'un de vos enfants comme judoka actif pour ouvrir la fiche."
            : "Sélectionnez un judoka actif pour ouvrir sa fiche."
        });
        return;
      }
      screens.judoka.showJudokaProfile(targetJudokaId);
    }

    const homeMode = createHomeModeController({
      state,
      screens,
      ui,
      getCurrentMode,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      getHomeViewModel,
      ensureHomeActiveJudokaSelection,
      openHomeJudokaProfile,
      persistNavigationState: app.persistNavigationState
    });
    const {
      isPrimaryModeActive,
      availableModes,
      coachSubModes,
      showModeTabs,
      currentHomeMode,
      showCoachSubTabs,
      canFilterByJudoka,
      canCreateCompetition,
      canCreateClubCompetition,
      canOpenJudokaProfile,
      showClubCompetitionsSection,
      showParentHub,
      showCoachHub,
      showJudokaHub,
      showHomeContextTitle,
      showHomeHero,
      showHomeActions,
      actionDisabled,
      homeTitle,
      homeSubtitle,
      filterPlaceholder,
      profileButtonText,
      profileButtonMeta,
      parentCompetitionsHubButtonText,
      addCompetitionButtonText,
      addCompetitionButtonMeta,
      competitionsTitle,
      competitionsSubtitle,
      showCompetitionsSection,
      setHomeMode,
      handleModeTabClick,
      openCoachCompetitionsHub,
      openCoachJudokaHub,
      openCoachStatsHub,
      openCoachChatHub,
      openParentCompetitionsHub,
      openParentJudokaSelectionHub,
      openParentProfileHub
    } = homeMode;

    const homeFilterLabel = window.Vue.computed(() =>
      getCurrentMode() === "coachJudoka" ? "Judoka consulté" : "Judoka actif"
    );
    const filterJudokaId = window.Vue.computed(() => state.homeFilterJudokaId);
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const judokasById = window.Vue.computed(() => new Map(state.judokas.map((j) => [String(j.judokaId), j])));

    const competitionsProjection = window.Vue.computed(() => {
      const today = getTodayStr();
      const mode = getCurrentMode();
      const activeJudokaId = getHomeActiveJudokaId();

      if ((mode === "coachJudoka" || mode === "family") && !activeJudokaId) {
        return {
          competitions: [] as HomeCompetitionCard[],
          hasCompetitions: false,
          competitionsEmptyMessage: "Sélectionnez un judoka pour voir ses résultats.",
          page: window.KirokuScreenProjections.paginateList([] as HomeCompetitionCard[], 1, defaultListPageSize)
        };
      }

      let filteredComps = state.competitions;
      if (activeJudokaId) {
        filteredComps = state.competitions.filter(
          (c) => String(c.ownerJudokaId) === String(activeJudokaId)
        );
      }
      const pastComps = filteredComps.filter((c) => c.competitionDate < today);

      if (!pastComps.length) {
        const isFirstTimer = filteredComps.length === 0;
        const emptyMsg = mode === "coachJudoka"
          ? "Aucune compétition enregistrée pour ce judoka."
          : mode === "family"
            ? "Aucun résultat enregistré pour votre périmètre."
            : isFirstTimer
              ? "Bienvenue ! Appuyez sur « Nouvelle compétition » pour enregistrer votre premier résultat."
              : "Vos compétitions à venir apparaissent dans « À venir ».";
        return {
          competitions: [] as HomeCompetitionCard[],
          hasCompetitions: false,
          competitionsEmptyMessage: emptyMsg,
          page: window.KirokuScreenProjections.paginateList([] as HomeCompetitionCard[], 1, defaultListPageSize)
        };
      }

      const byId = judokasById.value;
      const allCompetitions = pastComps.map((c) => {
        const judoka = byId.get(String(c.ownerJudokaId));
        return {
          competitionId: c.competitionId || "",
          name: c.name || "Compétition",
          date: formatDate(c.competitionDate),
          judokaName: judoka ? getJudokaDisplayName(judoka) : "",
          showJudoka: false,
          hasCoachReview: Boolean(c.coachReview)
        };
      });
      return {
        competitions: allCompetitions,
        hasCompetitions: true,
        competitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(allCompetitions, state.competitionsCurrentPage, defaultListPageSize)
      };
    });

    const competitionsPage = window.Vue.computed(() => competitionsProjection.value.page);
    const competitionsPaginationRefs = ui.createPaginationRefs(competitionsPage);
    const competitions = competitionsPaginationRefs.page;
    const hasCompetitions = window.Vue.computed(() => competitionsProjection.value.hasCompetitions);
    const competitionsEmptyMessage = window.Vue.computed(() => competitionsProjection.value.competitionsEmptyMessage);
    const competitionsTotalPages = competitionsPaginationRefs.totalPages;
    const competitionsCurrentPage = competitionsPaginationRefs.currentPage;
    const competitionsTotalCount = competitionsPaginationRefs.totalCount;
    const competitionsCanShowPreviousPage = competitionsPaginationRefs.canShowPreviousPage;
    const competitionsCanShowNextPage = competitionsPaginationRefs.canShowNextPage;

    const clubCompetitionsProjection = window.Vue.computed(() => {
      const today = getTodayStr();
      const past = state.clubCompetitions.filter((cc) => cc.competitionDate < today);
      if (!past.length) {
        return {
          clubCompetitionsList: [] as HomeClubCompetitionCard[],
          hasClubCompetitions: false,
          clubCompetitionsEmptyMessage: "Aucune compétition passée.",
          page: window.KirokuScreenProjections.paginateList([] as HomeClubCompetitionCard[], 1, defaultListPageSize)
        };
      }
      const all = past.map((cc) => {
        const linkedCompetitions = state.competitions.filter(
          (competition) => String(competition.clubCompetitionId || "") === String(cc.clubCompetitionId || "")
        );
        const rankedCount = linkedCompetitions.filter((competition) =>
          cleanText(competition.result || "")
        ).length;
        const podiumCount = linkedCompetitions.filter((competition) =>
          ["1er", "2e", "3e"].includes(cleanText(competition.result || ""))
        ).length;
        const missingCoachReviewCount = linkedCompetitions.filter((competition) =>
          !cleanText(competition.coachReview || "")
        ).length;
        const participantCount = linkedCompetitions.length;
        const statusLabel = participantCount && rankedCount >= participantCount
          ? "Classements complets"
          : "À compléter";
        return {
          clubCompetitionId: cc.clubCompetitionId || "",
          name: cc.name || "Compétition",
          date: formatDate(cc.competitionDate),
          participantCount,
          rankedCount,
          podiumCount,
          missingCoachReviewCount,
          summary: `${participantCount} participant(s) · ${rankedCount} classement(s) · ${podiumCount} podium(s)`,
          statusLabel
        };
      });
      return {
        clubCompetitionsList: all,
        hasClubCompetitions: true,
        clubCompetitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(all, state.clubCompetitionsCurrentPage, defaultListPageSize)
      };
    });

    const clubCompetitionsPage = window.Vue.computed(() => clubCompetitionsProjection.value.page);
    const clubCompetitionsPaginationRefs = ui.createPaginationRefs(clubCompetitionsPage);
    const clubCompetitionsList = clubCompetitionsPaginationRefs.page;
    const hasClubCompetitions = window.Vue.computed(() => clubCompetitionsProjection.value.hasClubCompetitions);
    const clubCompetitionsEmptyMessage = window.Vue.computed(() => clubCompetitionsProjection.value.clubCompetitionsEmptyMessage);
    const clubCompetitionsTotalPages = clubCompetitionsPaginationRefs.totalPages;
    const clubCompetitionsCurrentPage = clubCompetitionsPaginationRefs.currentPage;
    const clubCompetitionsTotalCount = clubCompetitionsPaginationRefs.totalCount;
    const clubCompetitionsCanShowPreviousPage = clubCompetitionsPaginationRefs.canShowPreviousPage;
    const clubCompetitionsCanShowNextPage = clubCompetitionsPaginationRefs.canShowNextPage;

    function ensureHomeViewModel() {
      if (homeViewModelRef) return;

      const homeActions = {
        openClubCompetition: screens.competition.openClubCompetition,
        openCompetition: screens.competition.openCompetition,
        openHomeJudokaProfile,
        selectFilterJudoka,
        setHomeMode,
        handleModeTabClick,
        isPrimaryModeActive,
        openParentCompetitionsHub,
        openParentJudokaSelectionHub,
        openParentProfileHub,
        openCoachCompetitionsHub,
        openCoachJudokaHub,
        openCoachStatsHub,
        openCoachChatHub,
        showClubCompetitionForm: screens.competition.showClubCompetitionForm,
        showHomeCompetitionForm,
        showHomeFilterOptions,
        hideHomeFilterOptions,
        showCompetitionsPreviousPage,
        showCompetitionsNextPage,
        showClubCompetitionsPreviousPage,
        showClubCompetitionsNextPage,
        updateFilterJudokaText
      };
      const homeComputedRefs = {
        availableModes,
        coachSubModes,
        showModeTabs,
        showCoachSubTabs,
        currentHomeMode,
        canFilterByJudoka,
        canCreateCompetition,
        canCreateClubCompetition,
        canOpenJudokaProfile,
        showParentHub,
        showCoachHub,
        showJudokaHub,
        showClubCompetitionsSection,
        showHomeContextTitle,
        showHomeHero,
        showHomeActions,
        isSubmitting,
        actionDisabled,
        homeTitle,
        homeSubtitle,
        homeFilterLabel,
        filterPlaceholder,
        profileButtonText,
        profileButtonMeta,
        parentCompetitionsHubButtonText,
        addCompetitionButtonText,
        addCompetitionButtonMeta,
        competitionsTitle,
        competitionsSubtitle,
        showCompetitionsSection,
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
        clubCompetitionsCanShowNextPage,
      };
      homeViewModelRef = ui.createMountedViewModel("homeView", defaultHomeViewState, homeActions, homeComputedRefs);
    }

    function applyInitialData() {
      ensureHomeViewModel();
      if (state.isParent && getCurrentMode() === "judoka") {
        state.homeMode = "parentHome";
      }
      if (state.isCoach && getCurrentMode() === "judoka" && !state.isParent) {
        state.homeMode = "coachHome";
      }
      if (getCurrentMode() === "judoka") {
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
      app.persistNavigationState({ viewId: "homeView" });
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

    function showHomeCompetitionForm() {
      if (getCurrentMode() === "coach" || getCurrentMode() === "coachJudoka") {
        showError({
          message: "Passez sur « Mon espace » pour enregistrer vos propres compétitions."
        });
        return;
      }
      if (getCurrentMode() === "family" && !getHomeActiveJudokaId()) {
        showError({
          message: "Sélectionnez votre profil ou l'un de vos enfants avant d'ajouter une compétition."
        });
        return;
      }
      screens.competition.showCompetitionForm();
    }

    function syncHomeFilterDisplay() {
      const selectedId = state.homeFilterJudokaId;
      if (selectedId && homeViewModelRef) {
        const judoka = state.judokas.find((j) => String(j.judokaId) === String(selectedId));
        homeViewModelRef.filterJudokaText = judoka ? getJudokaDisplayName(judoka) : "";
      }
    }

    function showHome() {
      state.currentCompetition = null;
      state.currentCombats = [];
      state.currentJudokaProfile = null;
      state.canEditCurrentCompetition = false;
      syncHomeFilterDisplay();
      showView("homeView");
    }

    return {
      applyInitialData,
      getAccessibleHomeJudokas,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      openHomeJudokaProfile,
      selectFilterJudoka,
      setHomeMode,
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
