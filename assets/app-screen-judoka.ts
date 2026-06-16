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

    const defaultJudokaProfile: JudokaProfileViewModel = {
      profileTitle: "Fiche judoka",
      profileSubtitle: "",
      heroAvatar: "JJ",
      heroName: "Judoka",
      heroSummary: "",
      heroCategory: "",
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

    function ensureJudokaView() {
      if (mounted) {
        return;
      }
      mounted = true;
      ui.mountViewModel(
        "judokaView",
        {},
        {
          showHome: () => app.showHome && app.showHome(),
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
          competitionResultsCanShowNextPage
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

      app.runServer(
        "getJudokaProfile",
        [idJudoka],
        (data) => {
          ensureJudokaView();
          state.currentJudokaProfile = data;
          state.judokaCompetitionResultsCurrentPage = 1;
          showView("judokaView");
        },
        notifications.showError
      );
    }

    return {
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
