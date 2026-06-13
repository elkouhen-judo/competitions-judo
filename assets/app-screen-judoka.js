(() => {
  function createKirokuJudokaScreen(app) {
    const { state, ui, notifications } = app;
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
      competitionResults: []
    };
    let judokaViewModel = null;

    function ensureJudokaViewModel() {
      if (!window.Vue || judokaViewModel) {
        return;
      }

      judokaViewModel = ui.createMountedViewModel("judokaView", defaultJudokaViewState, {
        showHome: () => app.showHome()
      });
    }

    function showJudokaProfile(idJudoka, keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      app.runServer(
        "getJudokaProfile",
        [idJudoka],
        data => {
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

      const {
        judoka
      } = state.currentJudokaProfile;
      Object.assign(judokaViewModel, window.createJudokaProfileViewModel(state.currentJudokaProfile, {
        formatDate,
        getClassementBadgeClass,
        getJudokaDisplayName,
        getJudokaInitials
      }));
    }

    return {
      renderJudokaProfile,
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
