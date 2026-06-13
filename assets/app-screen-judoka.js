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

      judokaViewModel = window.Vue.reactive({ ...defaultJudokaViewState });

      ui.mountViewModel("judokaView", judokaViewModel, {
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
        judoka,
        season,
        lastCompetition,
        seasonCombatCount,
        seasonCompetitionCount,
        seasonWins,
        seasonLosses,
        seasonDraws,
        victoryRate,
        combatProfile,
        competitionResults
      } = state.currentJudokaProfile;
      const highlightedCompetition = lastCompetition || (competitionResults && competitionResults[0]) || null;
      const category = highlightedCompetition && highlightedCompetition.category
        ? highlightedCompetition.category
        : "Catégorie à confirmer";
      const weightCategory = highlightedCompetition && highlightedCompetition.weightCategory
        ? highlightedCompetition.weightCategory
        : "Poids à confirmer";

      Object.assign(judokaViewModel, {
        profileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
        profileSubtitle: `Saison ${season.label}`,
        seasonLabel: `Saison ${season.label}`,
        seasonCompetitionCount: String(seasonCompetitionCount || 0),
        seasonCombatCount: String(seasonCombatCount || 0),
        seasonWins: String(seasonWins || 0),
        seasonLosses: String(seasonLosses || 0),
        seasonDraws: String(seasonDraws || 0),
        victoryRate: `${victoryRate || 0}%`,
        heroAvatar: getJudokaInitials(judoka),
        heroName: getJudokaDisplayName(judoka) || "Judoka",
        heroSummary: `${seasonWins || 0}V · ${seasonLosses || 0}D · ${seasonDraws || 0}N · ${victoryRate || 0}% de victoires`,
        heroCategory: `${category} · ${weightCategory}`,
        heroSeason: `Saison ${season.label}`
      });

      const profile = combatProfile || {};
      Object.assign(judokaViewModel.combatProfile, {
        victoryIppon: String(profile.victoryIppon || 0),
        victoryDecision: String(profile.victoryDecision || 0),
        lossIppon: String(profile.lossIppon || 0),
        lossDecision: String(profile.lossDecision || 0),
        lossPenalty: String(profile.lossPenalty || 0),
        lossForfeit: String(profile.lossForfeit || 0),
        draws: String(profile.draws || 0),
        penalties: String(profile.penalties || 0),
        forfeits: String(profile.forfeits || 0)
      });
      judokaViewModel.hasCombatProfileExtras = Boolean(profile.draws || 0);

      judokaViewModel.competitionResults = (competitionResults || []).map(result => ({
        name: result.name || "Compétition",
        date: formatDate(result.competitionDate),
        result: result.result || "Non classé",
        resultClass: getClassementBadgeClass(result.result),
        badgeLabel: result.resultBadge ? result.resultBadge.label : "non classé",
        badgeClass: result.resultBadge ? result.resultBadge.className : "rank-unclassified",
        combatRecord: result.combatRecord ? result.combatRecord.label : "0V · 0D"
      }));
      judokaViewModel.hasCompetitionResults = judokaViewModel.competitionResults.length > 0;
    }

    return {
      renderJudokaProfile,
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
