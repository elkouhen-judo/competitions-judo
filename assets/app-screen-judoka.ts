(() => {
  function createKirokuJudokaScreen(app) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      formatDate,
      getClassementBadgeClass,
      getJudokaDisplayName,
      getJudokaInitials,
      showView
    } = ui;
    const { clearMessage } = notifications;
    const defaultJudokaViewState = {
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
      competitionResults: [],
      competitionResultsPage: [],
      competitionResultsTotalPages: 1,
      competitionResultsCurrentPage: 1,
      competitionResultsTotalCount: 0,
      competitionResultsCanShowPreviousPage: false,
      competitionResultsCanShowNextPage: false
    };
    let judokaViewModel = null;

    function ensureJudokaViewModel() {
      if (!window.Vue || judokaViewModel) {
        return;
      }

      judokaViewModel = ui.createMountedViewModel("judokaView", defaultJudokaViewState, {
        showHome: () => app.showHome(),
        showCompetitionResultsPreviousPage,
        showCompetitionResultsNextPage
      });
    }

    function renderCompetitionResultsPage() {
      const pagination = window.KirokuScreenProjections.paginateList(
        judokaViewModel.competitionResults,
        state.judokaCompetitionResultsCurrentPage,
        defaultListPageSize
      );
      judokaViewModel.competitionResultsPage = pagination.pageItems;
      judokaViewModel.competitionResultsTotalPages = pagination.totalPages;
      judokaViewModel.competitionResultsCurrentPage = pagination.currentPage;
      judokaViewModel.competitionResultsTotalCount = pagination.totalItems;
      judokaViewModel.competitionResultsCanShowPreviousPage = pagination.canShowPreviousPage;
      judokaViewModel.competitionResultsCanShowNextPage = pagination.canShowNextPage;
      state.judokaCompetitionResultsCurrentPage = pagination.currentPage;
    }

    function showCompetitionResultsPreviousPage() {
      state.judokaCompetitionResultsCurrentPage = Math.max(
        state.judokaCompetitionResultsCurrentPage - 1,
        1
      );
      renderCompetitionResultsPage();
    }

    function showCompetitionResultsNextPage() {
      state.judokaCompetitionResultsCurrentPage += 1;
      renderCompetitionResultsPage();
    }

    function showJudokaProfile(idJudoka, keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getJudokaProfile",
        [idJudoka],
        (data) => {
          state.currentJudokaProfile = data;
          renderJudokaProfile();
          showView("judokaView");
        },
        notifications.showError
      );
    }

    function renderJudokaProfile() {
      ensureJudokaViewModel();
      if (!state.currentJudokaProfile) {
        return;
      }

      Object.assign(
        judokaViewModel,
        window.createJudokaProfileViewModel(state.currentJudokaProfile, {
          formatDate,
          getClassementBadgeClass,
          getJudokaDisplayName,
          getJudokaInitials
        })
      );
      state.judokaCompetitionResultsCurrentPage = 1;
      renderCompetitionResultsPage();
    }

    return {
      renderJudokaProfile,
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
