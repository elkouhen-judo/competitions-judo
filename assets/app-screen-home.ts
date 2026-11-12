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
    ageCategory: string;
    searchText: string;
  }

  interface HomeClubCompetitionCard {
    clubCompetitionId: string;
    name: string;
    dateLabel: string;
    whenLabel: string;
    isToday: boolean;
    isUpcoming: boolean;
    summary: string;
    missingRankingCount: number;
    missingRankingLabel: string;
    missingCoachReviewCount: number;
    missingCoachReviewLabel: string;
  }

  interface HomeCompetitionCard {
    competitionId: string;
    name: string;
    dateLabel: string;
    whenLabel: string;
    isToday: boolean;
    isUpcoming: boolean;
    resultLabel: string;
    resultClass: string;
    recordLabel: string;
    needsRanking: boolean;
    hasCoachReview: boolean;
  }

  interface HomeChildOption {
    judokaId: string;
    firstName: string;
    name: string;
    ageCategory: string;
  }

  // Mode/context concern: which modes are available, which one is active, and the
  // labels/visibility flags that depend purely on the current mode + active judoka.
  function createHomeModeController(deps: {
    state: KirokuAppState;
    screens: AppScreens;
    ui: KirokuUi;
    getCurrentMode: () => HomeMode;
    getHomeActiveJudoka: () => Judoka | null;
    getHomeActiveJudokaId: () => string;
    getHomeViewModel: () => { filterJudokaText: string; showFilterOptions: boolean };
    ensureHomeActiveJudokaSelection: () => void;
    hasCompetitions: () => boolean;
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
      hasCompetitions
    } = deps;
    const { cleanText, getJudokaDisplayName, showView } = ui;

    function isPrimaryModeActive(modeKey: string): boolean {
      return modeKey === getCurrentMode();
    }

    function getJudokaFirstName(judoka: Judoka): string {
      const firstName = ui.normalizeDisplayName(cleanText(judoka.firstName));
      if (firstName) return firstName;
      return cleanText(getJudokaDisplayName(judoka)).split(/\s+/)[0] || "";
    }

    // Espaces hors coach : « Mon espace » pour un compte qui pratique, « Famille » pour un parent.
    const availableModes = window.Vue.computed(() => {
      const hasOwnSpace = state.currentUser?.profileType !== "PARENT";
      const modes: Array<{ key: string; label: string }> = hasOwnSpace ? [{ key: "judoka", label: "Mon espace" }] : [];
      if (state.isParent) {
        modes.push({ key: "family", label: "Famille" });
      }
      return modes;
    });

    // NAV-2 : les mêmes onglets sur tous les écrans coach ; « Mon espace » et « Gestion des accès »
    // passent dans le menu du compte (en-tête).
    const coachSubModes = window.Vue.computed(() => [
      { key: "coachHome", label: "Accueil" },
      { key: "coach", label: "Compétitions" },
      { key: "coachJudoka", label: "Judokas" },
      { key: "coachDashboard", label: "Stats" }
    ]);

    const showCoachSubTabs = window.Vue.computed(() => state.isCoach);
    const showModeTabs = window.Vue.computed(() => !state.isCoach && availableModes.value.length > 1);
    const currentHomeMode = window.Vue.computed(() => getCurrentMode());

    const canFilterByJudoka = window.Vue.computed(() => getCurrentMode() === "coachJudoka" && state.judokas.length > 0);

    const canCreateCompetition = window.Vue.computed(
      () => !(state.isAdmin && !state.isCoach && !state.isParent) && ["judoka", "family"].includes(getCurrentMode())
    );
    // ACCUEIL-4 : sans compétition, l'état vide porte le seul bouton d'ajout.
    const showAddCompetitionAction = window.Vue.computed(() => canCreateCompetition.value && hasCompetitions());
    const canCreateClubCompetition = window.Vue.computed(() => getCurrentMode() === "coach" && state.isCoach);
    const canOpenJudokaProfile = window.Vue.computed(() => {
      const mode = getCurrentMode();
      if (mode === "judoka") return true;
      return (mode === "family" || mode === "coachJudoka") && Boolean(getHomeActiveJudokaId());
    });
    const showClubCompetitionsSection = window.Vue.computed(() => getCurrentMode() === "coach");
    const showCoachHub = window.Vue.computed(() => getCurrentMode() === "coachHome");
    const showHomeHero = window.Vue.computed(() => showCoachSubTabs.value || showModeTabs.value);
    const showHomeActions = window.Vue.computed(
      () =>
        Boolean(state.currentUser) &&
        (showAddCompetitionAction.value || canCreateClubCompetition.value || canOpenJudokaProfile.value)
    );
    const actionDisabled = window.Vue.computed(() => {
      const mode = getCurrentMode();
      return (mode === "family" || mode === "coachJudoka") && !getHomeActiveJudokaId();
    });

    const homeContext = window.Vue.computed(() => {
      const mode = getCurrentMode();
      const activeJudoka = getHomeActiveJudoka();
      const firstName = activeJudoka ? getJudokaFirstName(activeJudoka) : "";

      if (mode === "judoka") {
        return {
          filterPlaceholder: "",
          profileButtonText: "Ma fiche",
          addCompetitionButtonText: "Nouvelle compétition",
          showCompetitionsSection: true
        };
      }
      if (mode === "coachJudoka") {
        return {
          filterPlaceholder: "Nom du judoka…",
          profileButtonText: firstName ? `Fiche de ${firstName}` : "Voir la fiche",
          addCompetitionButtonText: "",
          showCompetitionsSection: Boolean(activeJudoka)
        };
      }
      if (mode === "family") {
        return {
          filterPlaceholder: "",
          profileButtonText: firstName ? `Fiche de ${firstName}` : "Voir la fiche",
          addCompetitionButtonText: "Nouvelle compétition",
          showCompetitionsSection: Boolean(activeJudoka)
        };
      }
      return {
        filterPlaceholder: "",
        profileButtonText: "",
        addCompetitionButtonText: "",
        showCompetitionsSection: false
      };
    });

    const filterPlaceholder = window.Vue.computed(() => homeContext.value.filterPlaceholder);
    const profileButtonText = window.Vue.computed(() => homeContext.value.profileButtonText);
    const addCompetitionButtonText = window.Vue.computed(() => homeContext.value.addCompetitionButtonText);
    const showCompetitionsSection = window.Vue.computed(() => homeContext.value.showCompetitionsSection);

    function setHomeMode(mode: HomeMode) {
      // L'ancien accueil parent est fusionné dans « Famille ».
      const targetMode: HomeMode = mode === "parentHome" ? "family" : mode;
      state.homeMode = targetMode;
      state.competitionsCurrentPage = 1;
      state.clubCompetitionsCurrentPage = 1;
      const vm = getHomeViewModel();
      vm.showFilterOptions = false;
      ensureHomeActiveJudokaSelection();
      showView("homeView", { routeState: { homeMode: targetMode }, replace: true });
      window.Vue.nextTick(() => window.scrollTo({ top: 0 }));
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
      setHomeMode(modeKey as HomeMode);
    }

    function openCoachCompetitionsHub() {
      setHomeMode("coach");
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
      showAddCompetitionAction,
      canCreateClubCompetition,
      canOpenJudokaProfile,
      showClubCompetitionsSection,
      showCoachHub,
      showHomeHero,
      showHomeActions,
      actionDisabled,
      filterPlaceholder,
      profileButtonText,
      addCompetitionButtonText,
      showCompetitionsSection,
      setHomeMode,
      handleModeTabClick,
      openCoachCompetitionsHub
    };
  }

  function createKirokuHomeScreen(app: KirokuApp) {
    const { defaultListPageSize, state, screens, ui, notifications } = app;
    const { cleanText, formatCompetitionName, formatDate, getJudokaDisplayName, showView } = ui;
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
      // Un profil PARENT n'a pas de pratique sportive : seuls ses enfants sont sélectionnables.
      if (state.currentUser.profileType === "PARENT" && !state.isCoach) {
        const selfId = String(state.currentUser.judokaId || "");
        const children = state.judokas.filter((j) => String(j.judokaId) !== selfId);
        if (children.length > 0) return children;
      }
      // Coach de plusieurs clubs : le filtre club de l'accueil restreint la liste des judokas.
      if (state.isCoach && state.selectedClubId) {
        return state.judokas.filter((j) => String(j.clubId || "") === state.selectedClubId);
      }
      return state.judokas.length > 0 ? state.judokas : [state.currentUser];
    }

    function getHomeActiveJudokaId() {
      if (!state.currentUser) return "";
      const mode = getCurrentMode();
      if (mode === "judoka") return String(state.currentUser.judokaId || "");
      if (mode === "family" || mode === "parentHome" || mode === "coachJudoka") return state.homeFilterJudokaId || "";
      return "";
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      if (!targetId) return null;
      return getAccessibleHomeJudokas().find((j) => String(j.judokaId) === String(targetId)) || null;
    }

    // Enfants suivis par le compte (le profil du parent lui-même est exclu).
    function getChildren(): Judoka[] {
      const selfId = String(state.currentUser?.judokaId || "");
      return getAccessibleHomeJudokas()
        .filter((j) => String(j.judokaId) !== selfId)
        .sort((a, b) => cleanText(a.firstName).localeCompare(cleanText(b.firstName), "fr"));
    }

    const lastChildStorageKey = () => `kiroku_last_child_${String(state.currentUser?.judokaId || "")}`;

    function readRememberedChildId(): string {
      try {
        return localStorage.getItem(lastChildStorageKey()) || "";
      } catch {
        return "";
      }
    }

    function rememberChild(judokaId: string) {
      try {
        localStorage.setItem(lastChildStorageKey(), judokaId);
      } catch {
        // Stockage indisponible (navigation privée) : le choix vaut pour la session.
      }
    }

    function ensureHomeActiveJudokaSelection() {
      const mode = getCurrentMode();
      if (mode !== "family" && mode !== "parentHome" && mode !== "coachJudoka") return;

      const viewModel = getHomeViewModel();
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = state.homeFilterJudokaId;

      if (currentValue && accessibleJudokas.some((j) => String(j.judokaId) === String(currentValue))) {
        return;
      }

      // ACCUEIL-2 : un parent retrouve le dernier enfant consulté, sinon le premier ; le coach
      // choisit toujours le judoka consulté.
      let autoJudoka: Judoka | null = null;
      if (mode !== "coachJudoka") {
        const children = getChildren();
        const remembered = readRememberedChildId();
        autoJudoka = children.find((j) => String(j.judokaId) === remembered) || children[0] || null;
      }
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
        showError({ message: "Choisissez d'abord un judoka." });
        return;
      }
      screens.judoka.showJudokaProfile(targetJudokaId);
    }

    const competitionsHaveItems = () => competitionsProjection.value.hasCompetitions;

    const homeMode = createHomeModeController({
      state,
      screens,
      ui,
      getCurrentMode,
      getHomeActiveJudoka,
      getHomeActiveJudokaId,
      getHomeViewModel,
      ensureHomeActiveJudokaSelection,
      hasCompetitions: competitionsHaveItems
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
      showAddCompetitionAction,
      canCreateClubCompetition,
      canOpenJudokaProfile,
      showClubCompetitionsSection,
      showCoachHub,
      showHomeHero,
      showHomeActions,
      actionDisabled,
      filterPlaceholder,
      profileButtonText,
      addCompetitionButtonText,
      showCompetitionsSection,
      setHomeMode,
      handleModeTabClick,
      openCoachCompetitionsHub
    } = homeMode;

    const homeFilterLabel = window.Vue.computed(() => "Judoka consulté");
    const filterJudokaId = window.Vue.computed(() => state.homeFilterJudokaId);
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const isHomeReady = window.Vue.computed(() => Boolean(state.currentUser));
    const childOptions = window.Vue.computed((): HomeChildOption[] =>
      getChildren().map((child) => ({
        judokaId: String(child.judokaId || ""),
        firstName: ui.normalizeDisplayName(cleanText(child.firstName)) || getJudokaDisplayName(child),
        name: getJudokaDisplayName(child),
        ageCategory: cleanText(child.ageCategory)
      }))
    );
    const showChildPills = window.Vue.computed(
      () => (getCurrentMode() === "family" || getCurrentMode() === "parentHome") && childOptions.value.length > 1
    );

    // Les compétitions à venir (date du jour comprise) passent en tête par date croissante,
    // puis les compétitions passées de la plus récente à la plus ancienne.
    function sortUpcomingFirst<T extends { competitionDate: string }>(items: T[], today: string): T[] {
      const upcoming = items
        .filter((item) => item.competitionDate >= today)
        .sort((a, b) => a.competitionDate.localeCompare(b.competitionDate));
      const past = items
        .filter((item) => item.competitionDate < today)
        .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate));
      return [...upcoming, ...past];
    }

    // « aujourd'hui », « demain », « dans 3 jours » ; rien pour une date passée.
    function getWhenLabel(competitionDate: string, today: string): string {
      if (competitionDate < today) return "";
      const label = ui.formatRelativeDay(competitionDate);
      return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
    }

    // LISTE-2 : deux intertitres, « À venir » et « Passées ».
    function groupByTiming<T extends { isUpcoming: boolean }>(items: T[]) {
      const upcoming = items.filter((item) => item.isUpcoming);
      const past = items.filter((item) => !item.isUpcoming);
      return [
        ...(upcoming.length ? [{ key: "upcoming", title: "À venir", items: upcoming }] : []),
        ...(past.length ? [{ key: "past", title: "Passées", items: past }] : [])
      ];
    }

    const competitionsProjection = window.Vue.computed(() => {
      const today = getTodayStr();
      const mode = getCurrentMode();
      const activeJudokaId = getHomeActiveJudokaId();
      const emptyPage = window.KirokuScreenProjections.paginateList([] as HomeCompetitionCard[], 1, defaultListPageSize);

      if ((mode === "coachJudoka" || mode === "family") && !activeJudokaId) {
        return {
          hasCompetitions: false,
          competitionsEmptyMessage: mode === "family" ? "Aucun enfant n'est rattaché à votre compte." : "Choisissez un judoka.",
          page: emptyPage
        };
      }

      const filteredComps = activeJudokaId
        ? state.competitions.filter((c) => String(c.ownerJudokaId) === String(activeJudokaId))
        : state.competitions;
      const sortedComps = sortUpcomingFirst(filteredComps, today);

      if (!sortedComps.length) {
        const emptyMsg =
          mode === "coachJudoka"
            ? "Aucune compétition enregistrée pour ce judoka."
            : "Ajoutez la prochaine compétition pour suivre les combats et le classement.";
        return { hasCompetitions: false, competitionsEmptyMessage: emptyMsg, page: emptyPage };
      }

      const allCompetitions = sortedComps.map((c): HomeCompetitionCard => {
        const isUpcoming = c.competitionDate >= today;
        const record = state.combatRecords[String(c.competitionId)];
        const result = cleanText(c.result || "");
        return {
          competitionId: c.competitionId || "",
          name: formatCompetitionName(c.name) || "Compétition",
          dateLabel: ui.formatDateLong(c.competitionDate),
          whenLabel: getWhenLabel(c.competitionDate, today),
          isToday: c.competitionDate === today,
          isUpcoming,
          resultLabel: ui.formatCompetitionRanking(result),
          resultClass: ui.getClassementBadgeClass(result),
          recordLabel: record && record.total ? ui.formatRecord(record.wins, record.losses, record.draws) : "",
          needsRanking: c.competitionDate < today && !result,
          hasCoachReview: Boolean(c.coachReview)
        };
      });
      return {
        hasCompetitions: true,
        competitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(allCompetitions, state.competitionsCurrentPage, defaultListPageSize)
      };
    });

    const competitionsPage = window.Vue.computed(() => competitionsProjection.value.page);
    const competitionsPaginationRefs = ui.createPaginationRefs(competitionsPage);
    const competitions = competitionsPaginationRefs.page;
    const competitionGroups = window.Vue.computed(() => groupByTiming(competitions.value));
    const hasCompetitions = window.Vue.computed(() => competitionsProjection.value.hasCompetitions);
    const competitionsEmptyMessage = window.Vue.computed(() => competitionsProjection.value.competitionsEmptyMessage);
    const competitionsTotalPages = competitionsPaginationRefs.totalPages;
    const competitionsCurrentPage = competitionsPaginationRefs.currentPage;
    const competitionsTotalCount = competitionsPaginationRefs.totalCount;
    const competitionsCanShowPreviousPage = competitionsPaginationRefs.canShowPreviousPage;
    const competitionsCanShowNextPage = competitionsPaginationRefs.canShowNextPage;

    // PAGE-2 : l'ouverture charge la saison en cours ; une saison passée se charge à la demande.
    function getSeasonStartYear(dateValue: string) {
      const [year, month] = dateValue.split("-").map(Number);
      return (month || 0) >= 9 ? year || 0 : (year || 0) - 1;
    }
    const olderSeasonStartYear = window.Vue.computed(() => {
      if (!state.loadedFrom || !state.oldestCompetitionDate) {
        return 0;
      }
      const loadedYears = [getSeasonStartYear(state.loadedFrom), ...state.loadedSeasonStartYears];
      const previousYear = Math.min(...loadedYears) - 1;
      return getSeasonStartYear(state.oldestCompetitionDate) <= previousYear ? previousYear : 0;
    });
    const olderSeasonLabel = window.Vue.computed(() => {
      const year = olderSeasonStartYear.value;
      return year ? `Voir la saison ${year}-${year + 1}` : "";
    });
    const isLoadingSeason = window.Vue.computed(() => state.isLoadingSeason);

    function loadOlderSeason() {
      const seasonStartYear = olderSeasonStartYear.value;
      if (!seasonStartYear || state.isLoadingSeason) {
        return;
      }
      state.isLoadingSeason = true;
      app.runServer(
        "getSeasonCompetitions",
        [seasonStartYear],
        (season) => {
          state.isLoadingSeason = false;
          app.local.addSeason(season);
        },
        (error) => {
          state.isLoadingSeason = false;
          showError(error);
        }
      );
    }

    // Compétitions club du club sélectionné sur l'accueil (toutes celles du coach sinon).
    function getClubCompetitionsInSelectedClub() {
      return state.selectedClubId
        ? state.clubCompetitions.filter((cc) => String(cc.clubId || "") === state.selectedClubId)
        : state.clubCompetitions;
    }

    const showClubFilter = window.Vue.computed(() => state.isCoach && state.clubs.length > 1);
    const coachClubOptions = window.Vue.computed(() => state.clubs);
    const selectedClubId = window.Vue.computed(() => state.selectedClubId);

    function selectHomeClub(clubId: string) {
      state.selectedClubId = String(clubId || "");
      state.clubCompetitionsCurrentPage = 1;
      // Le judoka actif doit appartenir au club choisi.
      const activeId = state.homeFilterJudokaId;
      if (activeId && !getAccessibleHomeJudokas().some((j) => String(j.judokaId) === String(activeId))) {
        state.homeFilterJudokaId = "";
        getHomeViewModel().filterJudokaText = "";
      }
    }

    function getClubCompetitionStats(clubCompetitionId: string, competitionDate: string, today: string) {
      const linked = state.competitions.filter(
        (competition) => String(competition.clubCompetitionId || "") === String(clubCompetitionId || "")
      );
      const participantCount = linked.length;
      const rankedCount = linked.filter((competition) => cleanText(competition.result || "")).length;
      const podiumCount = linked.filter((competition) => ["1er", "2e", "3e"].includes(cleanText(competition.result || ""))).length;
      // Un classement se saisit à partir du jour J ; un bilan ne manque qu'après la compétition.
      const missingRankingCount = competitionDate <= today ? participantCount - rankedCount : 0;
      const missingCoachReviewCount =
        competitionDate < today ? linked.filter((competition) => !cleanText(competition.coachReview || "")).length : 0;
      return { participantCount, rankedCount, podiumCount, missingRankingCount, missingCoachReviewCount };
    }

    const clubCompetitionsProjection = window.Vue.computed(() => {
      const today = getTodayStr();
      const search = cleanText(state.clubCompetitionsSearchText).toLowerCase();
      const sorted = sortUpcomingFirst(getClubCompetitionsInSelectedClub(), today).filter(
        (cc) =>
          !search ||
          String(cc.name || "").toLowerCase().includes(search) ||
          formatDate(cc.competitionDate).includes(search)
      );
      if (!sorted.length) {
        return {
          hasClubCompetitions: false,
          clubCompetitionsEmptyMessage: search
            ? "Aucune compétition ne correspond à cette recherche."
            : "Créez la prochaine compétition et inscrivez les judokas.",
          page: window.KirokuScreenProjections.paginateList([] as HomeClubCompetitionCard[], 1, defaultListPageSize)
        };
      }
      const all = sorted.map((cc): HomeClubCompetitionCard => {
        const stats = getClubCompetitionStats(cc.clubCompetitionId, cc.competitionDate, today);
        const isUpcoming = cc.competitionDate >= today;
        const participants = ui.pluralize(stats.participantCount, "participant");
        // CLUB-3 : compteurs accordés, podiums seulement après la compétition.
        const summary = isUpcoming || !stats.rankedCount
          ? participants
          : `${participants} · ${ui.pluralize(stats.podiumCount, "podium")}`;
        return {
          clubCompetitionId: cc.clubCompetitionId || "",
          name: formatCompetitionName(cc.name) || "Compétition",
          dateLabel: ui.formatDateLong(cc.competitionDate),
          whenLabel: getWhenLabel(cc.competitionDate, today),
          isToday: cc.competitionDate === today,
          isUpcoming,
          summary,
          missingRankingCount: stats.missingRankingCount,
          missingRankingLabel: `${ui.pluralize(stats.missingRankingCount, "classement")} à saisir`,
          missingCoachReviewCount: stats.missingCoachReviewCount,
          missingCoachReviewLabel: `${ui.pluralize(stats.missingCoachReviewCount, "bilan")} à écrire`
        };
      });
      return {
        hasClubCompetitions: true,
        clubCompetitionsEmptyMessage: "",
        page: window.KirokuScreenProjections.paginateList(all, state.clubCompetitionsCurrentPage, defaultListPageSize)
      };
    });

    const clubCompetitionsPage = window.Vue.computed(() => clubCompetitionsProjection.value.page);
    const clubCompetitionsPaginationRefs = ui.createPaginationRefs(clubCompetitionsPage);
    const clubCompetitionsList = clubCompetitionsPaginationRefs.page;
    const clubCompetitionGroups = window.Vue.computed(() => groupByTiming(clubCompetitionsList.value));
    const hasClubCompetitions = window.Vue.computed(() => clubCompetitionsProjection.value.hasClubCompetitions);
    const clubCompetitionsEmptyMessage = window.Vue.computed(() => clubCompetitionsProjection.value.clubCompetitionsEmptyMessage);
    const clubCompetitionsTotalPages = clubCompetitionsPaginationRefs.totalPages;
    const clubCompetitionsCurrentPage = clubCompetitionsPaginationRefs.currentPage;
    const clubCompetitionsTotalCount = clubCompetitionsPaginationRefs.totalCount;
    const clubCompetitionsCanShowPreviousPage = clubCompetitionsPaginationRefs.canShowPreviousPage;
    const clubCompetitionsCanShowNextPage = clubCompetitionsPaginationRefs.canShowNextPage;
    const clubCompetitionsSearchText = window.Vue.computed(() => state.clubCompetitionsSearchText);

    function updateClubCompetitionsSearch(value: string) {
      state.clubCompetitionsSearchText = String(value || "");
      state.clubCompetitionsCurrentPage = 1;
    }

    // ACCUEIL-3 : ce qui attend le coach — compétitions de la semaine, classements à saisir,
    // bilans à écrire.
    const coachAgenda = window.Vue.computed(() => {
      const today = getTodayStr();
      const limit = new Date(`${today}T00:00:00`);
      limit.setDate(limit.getDate() + 6);
      const pad = (n: number) => String(n).padStart(2, "0");
      const limitStr = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`;
      const events = getClubCompetitionsInSelectedClub();
      const toItem = (cc: (typeof events)[number], detail: string, pillClass: string) => ({
        clubCompetitionId: cc.clubCompetitionId || "",
        name: formatCompetitionName(cc.name) || "Compétition",
        dateLabel: cc.competitionDate === today ? "Aujourd'hui" : ui.formatDateLong(cc.competitionDate),
        isToday: cc.competitionDate === today,
        detail,
        pillClass
      });

      const thisWeek = events
        .filter((cc) => cc.competitionDate >= today && cc.competitionDate <= limitStr)
        .sort((a, b) => a.competitionDate.localeCompare(b.competitionDate))
        .slice(0, 5)
        .map((cc) => {
          const stats = getClubCompetitionStats(cc.clubCompetitionId, cc.competitionDate, today);
          return toItem(cc, ui.pluralize(stats.participantCount, "participant"), cc.competitionDate === today ? "pill-now" : "pill-accent");
        });
      const pastByRecency = events
        .filter((cc) => cc.competitionDate <= today)
        .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate));
      // Une compétition déjà listée « Cette semaine » n'est pas répétée plus bas.
      const listedIds = new Set(thisWeek.map((item) => item.clubCompetitionId));
      const rankings = pastByRecency
        .filter((cc) => !listedIds.has(cc.clubCompetitionId || ""))
        .map((cc) => ({ cc, stats: getClubCompetitionStats(cc.clubCompetitionId, cc.competitionDate, today) }))
        .filter(({ stats }) => stats.missingRankingCount > 0)
        .slice(0, 5)
        .map(({ cc, stats }) => toItem(cc, `${ui.pluralize(stats.missingRankingCount, "classement")} à saisir`, "pill-todo"));
      const reviews = pastByRecency
        .map((cc) => ({ cc, stats: getClubCompetitionStats(cc.clubCompetitionId, cc.competitionDate, today) }))
        .filter(({ stats }) => stats.missingCoachReviewCount > 0)
        .slice(0, 5)
        .map(({ cc, stats }) => toItem(cc, `${ui.pluralize(stats.missingCoachReviewCount, "bilan")} à écrire`, "pill-todo"));

      return [
        ...(thisWeek.length ? [{ key: "week", title: "Cette semaine", items: thisWeek }] : []),
        ...(rankings.length ? [{ key: "rankings", title: "Classements à saisir", items: rankings }] : []),
        ...(reviews.length ? [{ key: "reviews", title: "Bilans à écrire", items: reviews }] : [])
      ];
    });

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
        openCoachCompetitionsHub,
        updateClubCompetitionsSearch,
        selectHomeClub,
        showClubCompetitionForm: screens.competition.showClubCompetitionForm,
        showHomeCompetitionForm,
        showHomeFilterOptions,
        hideHomeFilterOptions,
        showCompetitionsPreviousPage,
        showCompetitionsNextPage,
        loadOlderSeason,
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
        showAddCompetitionAction,
        canCreateClubCompetition,
        canOpenJudokaProfile,
        showCoachHub,
        showClubCompetitionsSection,
        showHomeHero,
        showHomeActions,
        showChildPills,
        childOptions,
        coachAgenda,
        isHomeReady,
        isSubmitting,
        actionDisabled,
        homeFilterLabel,
        filterPlaceholder,
        profileButtonText,
        addCompetitionButtonText,
        showCompetitionsSection,
        filterJudokaId,
        competitionGroups,
        hasCompetitions,
        competitionsEmptyMessage,
        competitionsTotalPages,
        competitionsCurrentPage,
        competitionsTotalCount,
        competitionsCanShowPreviousPage,
        competitionsCanShowNextPage,
        olderSeasonLabel,
        isLoadingSeason,
        clubCompetitionGroups,
        hasClubCompetitions,
        clubCompetitionsEmptyMessage,
        clubCompetitionsTotalPages,
        clubCompetitionsCurrentPage,
        clubCompetitionsTotalCount,
        clubCompetitionsCanShowPreviousPage,
        clubCompetitionsCanShowNextPage,
        clubCompetitionsSearchText,
        showClubFilter,
        coachClubOptions,
        selectedClubId
      };
      homeViewModelRef = ui.createMountedViewModel("homeView", defaultHomeViewState, homeActions, homeComputedRefs);
    }

    function applyInitialData() {
      ensureHomeViewModel();
      if (getCurrentMode() === "parentHome") {
        state.homeMode = "family";
      }
      if (state.isCoach && getCurrentMode() === "judoka") {
        state.homeMode = "coachHome";
      } else if (state.isParent && getCurrentMode() === "judoka" && state.currentUser?.profileType === "PARENT") {
        state.homeMode = "family";
      }
      if (getCurrentMode() === "judoka") {
        getHomeViewModel().filterJudokaText = "";
      }
      ensureHomeActiveJudokaSelection();
    }

    const AGE_CATEGORY_ORDER = ["Poussinet", "Poussin", "Benjamin", "Minime", "Cadet", "Junior", "Senior", "Vétéran"];

    function getAgeCategoryOrder(ageCategory: string): number {
      const index = AGE_CATEGORY_ORDER.indexOf(ageCategory);
      return index === -1 ? AGE_CATEGORY_ORDER.length : index;
    }

    function getHomeFilterOption(judoka: Judoka): HomeFilterOption {
      return {
        judokaId: String(judoka.judokaId || ""),
        name: getJudokaDisplayName(judoka) || "Judoka",
        meta: [judoka.ageCategory, judoka.weightCategory].map((value) => cleanText(value)).filter(Boolean).join(" · "),
        ageCategory: cleanText(judoka.ageCategory),
        searchText: `${getJudokaDisplayName(judoka)} ${judoka.ageCategory || ""}`.toLowerCase()
      };
    }

    function refreshHomeFilterOptions(queryOverride?: string) {
      const viewModel = getHomeViewModel();
      const query =
        queryOverride !== undefined
          ? cleanText(queryOverride).toLowerCase()
          : cleanText(viewModel.filterJudokaText).toLowerCase();
      // Options regroupées par catégorie d'âge (ordre sportif), puis par nom.
      viewModel.filterOptions = getAccessibleHomeJudokas()
        .map(getHomeFilterOption)
        .filter((option) => !query || option.searchText.includes(query))
        .sort(
          (a, b) =>
            getAgeCategoryOrder(a.ageCategory) - getAgeCategoryOrder(b.ageCategory) ||
            a.name.localeCompare(b.name, "fr")
        );
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

    function selectFilterJudoka(option: { judokaId: string; name: string } | null) {
      if (hideFilterOptionsTimer) {
        window.clearTimeout(hideFilterOptionsTimer);
        hideFilterOptionsTimer = null;
      }
      const viewModel = getHomeViewModel();
      state.homeFilterJudokaId = option ? option.judokaId : "";
      viewModel.filterJudokaText = option ? option.name : "";
      if (option && getCurrentMode() === "family") {
        rememberChild(option.judokaId);
      }
      viewModel.showFilterOptions = false;
      state.competitionsCurrentPage = 1;
      // Met à jour l'adresse (paramètre judoka) pour qu'un rechargement garde ce judoka.
      showView("homeView", { replace: true, preserveScroll: true });
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
          message: "Ouvrez « Mon espace » depuis le menu du compte pour enregistrer vos propres compétitions."
        });
        return;
      }
      if (getCurrentMode() === "family" && !getHomeActiveJudokaId()) {
        showError({ message: "Choisissez d'abord l'enfant concerné." });
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
