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
      heroRecord: "",
      seasonLabel: "",
      seasonCompetitionCount: "0",
      seasonCombatCount: "0",
      seasonWins: "0",
      seasonLosses: "0",
      hasLastCompetition: false,
      lastCompetition: {
        name: "",
        date: "",
        category: "",
        weightCategory: ""
      },
      hasBestResults: false,
      bestResults: []
    };
    let judokaViewModel = null;

    function ensureJudokaViewModel() {
      if (!window.Vue || judokaViewModel) {
        return;
      }

      judokaViewModel = window.Vue.reactive({ ...defaultJudokaViewState });

      window.Vue.createApp({
        setup() {
          return {
            ...window.Vue.toRefs(judokaViewModel),
            showHome: () => app.showHome()
          };
        }
      }).mount("#judokaView");
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
        judoka,
        season,
        lastCompetition,
        bestSeasonResults,
        seasonCombatCount,
        seasonCompetitionCount,
        seasonWins,
        seasonLosses
      } = state.currentJudokaProfile;

      Object.assign(judokaViewModel, {
        profileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
        profileSubtitle: judoka.accountEmail,
        seasonLabel: `Saison ${season.label}`,
        seasonCompetitionCount: String(seasonCompetitionCount || 0),
        seasonCombatCount: String(seasonCombatCount || 0),
        seasonWins: String(seasonWins || 0),
        seasonLosses: String(seasonLosses || 0),
        heroAvatar: getJudokaInitials(judoka),
        heroName: getJudokaDisplayName(judoka) || "Judoka",
        heroSummary: `Saison ${season.label} · ${seasonCompetitionCount || 0} compétition(s) · ${seasonCombatCount || 0} combat(s)`,
        heroCategory: lastCompetition && lastCompetition.category ? lastCompetition.category : "Catégorie à confirmer",
        heroRecord: `${seasonWins || 0} V · ${seasonLosses || 0} D`
      });

      judokaViewModel.hasLastCompetition = Boolean(lastCompetition);
      judokaViewModel.lastCompetition = lastCompetition
        ? {
            name: lastCompetition.name || "",
            date: formatDate(lastCompetition.competitionDate),
            category: lastCompetition.category || "Non renseignée",
            weightCategory: lastCompetition.weightCategory || "Non renseigné"
          }
        : { ...defaultJudokaViewState.lastCompetition };

      judokaViewModel.bestResults = bestSeasonResults.map(result => ({
        name: result.name || "Compétition",
        date: formatDate(result.competitionDate),
        result: result.result || "",
        badgeClass: getClassementBadgeClass(result.result)
      }));
      judokaViewModel.hasBestResults = judokaViewModel.bestResults.length > 0;
    }

    return {
      renderJudokaProfile,
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
