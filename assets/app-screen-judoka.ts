(() => {
  type KirokuApp = import("./types").KirokuApp;
  type JudokaProfileViewModel = import("./types").JudokaProfileViewModel;

  function createKirokuJudokaScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      formatDate,
      getClassementBadgeClass,
      getJudokaDisplayName,
      getJudokaInitials,
      showView
    } = ui;
    const { clearMessage } = notifications;
    let mounted = false;
    let currentJudokaId = "";
    const judokaLocalState = window.Vue.reactive({
      coachNotesEditing: "",
      ageCategoryEditing: "",
      weightCategoryEditing: "",
      beltColorEditing: "",
      viewedJudokaId: ""
    });

    function getCurrentSeasonStartYear() {
      const now = new Date();
      return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    }

    function getDisplayedSeasonStartYear(): number | null {
      if (!state.currentJudokaProfile) return null;
      return parseInt(state.currentJudokaProfile.season.start.slice(0, 4), 10);
    }

    const defaultJudokaProfile: JudokaProfileViewModel = {
      profileTitle: "Fiche judoka",
      profileSubtitle: "",
      heroAvatar: "JJ",
      heroName: "Judoka",
      heroSummary: "",
      heroCategory: "",
      heroBeltColor: "",
      heroSeason: "",
      seasonLabel: "",
      seasonCompetitionCount: "0",
      seasonCombatCount: "0",
      seasonWins: "0",
      seasonLosses: "0",
      seasonDraws: "0",
      victoryRate: "0%",
      hasCombatProfileExtras: false,
      combatProfile: {
        victoryIppon: "0",
        victoryDecision: "0",
        lossIppon: "0",
        lossDecision: "0",
        lossPenalty: "0",
        lossForfeit: "0",
        draws: "0",
        penalties: "0",
        forfeits: "0"
      },
      hasCompetitionResults: false,
      competitionResults: []
    };

    const judokaProfile = window.Vue.computed<JudokaProfileViewModel>(() => {
      if (!state.currentJudokaProfile) {
        return defaultJudokaProfile;
      }
      return (
        window.createJudokaProfileViewModel(state.currentJudokaProfile, {
          formatDate,
          getClassementBadgeClass,
          getJudokaDisplayName,
          getJudokaInitials
        }) ?? defaultJudokaProfile
      );
    });

    const competitionResultsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        judokaProfile.value.competitionResults,
        state.judokaCompetitionResultsCurrentPage,
        defaultListPageSize
      )
    );

    const profileTitle = window.Vue.computed(() => judokaProfile.value.profileTitle);
    const profileSubtitle = window.Vue.computed(() => judokaProfile.value.profileSubtitle);
    const heroAvatar = window.Vue.computed(() => judokaProfile.value.heroAvatar);
    const heroName = window.Vue.computed(() => judokaProfile.value.heroName);
    const heroSummary = window.Vue.computed(() => judokaProfile.value.heroSummary);
    const heroCategory = window.Vue.computed(() => judokaProfile.value.heroCategory);
    const heroBeltColor = window.Vue.computed(() => judokaProfile.value.heroBeltColor);
    const heroSeason = window.Vue.computed(() => judokaProfile.value.heroSeason);
    const seasonLabel = window.Vue.computed(() => judokaProfile.value.seasonLabel);
    const seasonCompetitionCount = window.Vue.computed(
      () => judokaProfile.value.seasonCompetitionCount
    );
    const seasonCombatCount = window.Vue.computed(() => judokaProfile.value.seasonCombatCount);
    const seasonWins = window.Vue.computed(() => judokaProfile.value.seasonWins);
    const seasonLosses = window.Vue.computed(() => judokaProfile.value.seasonLosses);
    const seasonDraws = window.Vue.computed(() => judokaProfile.value.seasonDraws);
    const victoryRate = window.Vue.computed(() => judokaProfile.value.victoryRate);
    const hasCombatProfileExtras = window.Vue.computed(
      () => judokaProfile.value.hasCombatProfileExtras
    );
    const combatProfile = window.Vue.computed(() => judokaProfile.value.combatProfile);
    const hasCompetitionResults = window.Vue.computed(
      () => judokaProfile.value.hasCompetitionResults
    );
    const competitionResultsPage = window.Vue.computed(
      () => competitionResultsPagination.value.pageItems
    );
    const competitionResultsTotalPages = window.Vue.computed(
      () => competitionResultsPagination.value.totalPages
    );
    const competitionResultsCurrentPage = window.Vue.computed(
      () => competitionResultsPagination.value.currentPage
    );
    const competitionResultsTotalCount = window.Vue.computed(
      () => competitionResultsPagination.value.totalItems
    );
    const competitionResultsCanShowPreviousPage = window.Vue.computed(
      () => competitionResultsPagination.value.canShowPreviousPage
    );
    const competitionResultsCanShowNextPage = window.Vue.computed(
      () => competitionResultsPagination.value.canShowNextPage
    );

    const canEditCoachNotes = window.Vue.computed(() => state.isCoach || state.isAdmin);
    const isOwnProfile = window.Vue.computed(() =>
      Boolean(judokaLocalState.viewedJudokaId && state.currentUser &&
        String(judokaLocalState.viewedJudokaId) === String(state.currentUser.judokaId))
    );
    const isManagedProfile = window.Vue.computed(() =>
      Boolean(
        judokaLocalState.viewedJudokaId &&
          state.isParent &&
          state.judokas.some((j) => String(j.judokaId) === String(judokaLocalState.viewedJudokaId))
      )
    );
    const canEditJudokaInfo = window.Vue.computed(
      () => state.isCoach || state.isAdmin || isOwnProfile.value || isManagedProfile.value
    );
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);

    const canShowPreviousSeason = window.Vue.computed(() => Boolean(state.currentJudokaProfile));
    const canShowNextSeason = window.Vue.computed(() => {
      const displayed = getDisplayedSeasonStartYear();
      if (displayed === null) return false;
      return displayed < getCurrentSeasonStartYear();
    });

    function loadJudokaProfile(idJudoka: string, seasonStartYear?: number) {
      app.runServer(
        "getJudokaProfile",
        [idJudoka, seasonStartYear],
        (data) => {
          ensureJudokaView();
          state.currentJudokaProfile = data;
          judokaLocalState.coachNotesEditing = data.coachNotes ?? "";
          judokaLocalState.ageCategoryEditing = data.judoka?.ageCategory || "";
          judokaLocalState.weightCategoryEditing = data.judoka?.weightCategory || "";
          judokaLocalState.beltColorEditing = data.judoka?.beltColor || "";
          judokaLocalState.viewedJudokaId = data.judoka?.judokaId || "";
          state.judokaCompetitionResultsCurrentPage = 1;
          showView("judokaView");
        },
        notifications.showError
      );
    }

    function showPreviousSeason() {
      const displayed = getDisplayedSeasonStartYear();
      if (!currentJudokaId || displayed === null) return;
      loadJudokaProfile(currentJudokaId, displayed - 1);
    }

    function showNextSeason() {
      const displayed = getDisplayedSeasonStartYear();
      if (!currentJudokaId || displayed === null) return;
      loadJudokaProfile(currentJudokaId, displayed + 1);
    }

    function openCompetitionFromProfile(competitionId: string) {
      app.screens.competition.openCompetitionFromJudokaProfile(competitionId);
    }

    function saveCoachNotes() {
      if (!currentJudokaId) return;
      app.runServer(
        "saveCoachNotes",
        [currentJudokaId, judokaLocalState.coachNotesEditing],
        (response) => notifications.showSuccess(response.message),
        notifications.showError
      );
    }

    function saveJudokaInfo() {
      if (!currentJudokaId) return;
      const ageCategory = judokaLocalState.ageCategoryEditing || "";
      const weightCategory = judokaLocalState.weightCategoryEditing || "";
      const beltColor = judokaLocalState.beltColorEditing || "";
      app.runServer(
        "saveJudokaInfo",
        [currentJudokaId, ageCategory, weightCategory, beltColor],
        (response) => {
          notifications.showSuccess(response.message);
          const displayed = getDisplayedSeasonStartYear();
          loadJudokaProfile(currentJudokaId, displayed === null ? undefined : displayed);
        },
        notifications.showError
      );
    }

    function ensureJudokaView() {
      if (mounted) {
        return;
      }
      mounted = true;
      ui.mountViewModel(
        "judokaView",
        judokaLocalState,
        {
          showHome: () => app.showHome && app.showHome(),
          openCompetitionFromProfile,
          saveCoachNotes,
          saveJudokaInfo,
          showPreviousSeason,
          showNextSeason,
          showCompetitionResultsPreviousPage,
          showCompetitionResultsNextPage
        },
        {
          profileTitle,
          profileSubtitle,
          heroAvatar,
          heroName,
          heroSummary,
          heroCategory,
          heroBeltColor,
          heroSeason,
          seasonLabel,
          seasonCompetitionCount,
          seasonCombatCount,
          seasonWins,
          seasonLosses,
          seasonDraws,
          victoryRate,
          hasCombatProfileExtras,
          combatProfile,
          hasCompetitionResults,
          competitionResultsPage,
          competitionResultsTotalPages,
          competitionResultsCurrentPage,
          competitionResultsTotalCount,
          competitionResultsCanShowPreviousPage,
          competitionResultsCanShowNextPage,
          canShowPreviousSeason,
          canShowNextSeason,
          canEditCoachNotes,
          canEditJudokaInfo,
          isManagedProfile,
          isSubmitting
        }
      );
    }

    function showCompetitionResultsPreviousPage() {
      state.judokaCompetitionResultsCurrentPage = Math.max(
        state.judokaCompetitionResultsCurrentPage - 1,
        1
      );
    }

    function showCompetitionResultsNextPage() {
      state.judokaCompetitionResultsCurrentPage += 1;
    }

    function showJudokaProfile(idJudoka: string, keepMessage?: boolean) {
      if (!keepMessage) {
        clearMessage();
      }
      currentJudokaId = idJudoka;
      loadJudokaProfile(idJudoka);
    }

    return {
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
