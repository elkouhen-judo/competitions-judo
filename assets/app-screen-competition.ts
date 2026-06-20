(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CompetitionDetailScreen = import("./types").CompetitionDetailScreen;

  function createKirokuCompetitionScreen(app: KirokuApp) {
    // Assigned once below, but must stay `let`: the combatForm closures capture it by
    // reference before that assignment runs (combatForm and competitionDetail depend on
    // each other).
    // eslint-disable-next-line prefer-const
    let competitionDetail!: CompetitionDetailScreen;

    const combatForm = window.createKirokuCombatFormScreen(app, {
      getCurrentCompetition: () => competitionDetail.getCurrentCompetition(),
      openCompetition: (idCompetition, keepMessage, onLoaded) =>
        competitionDetail.openCompetition(idCompetition, keepMessage, onLoaded)
    });

    competitionDetail = window.createKirokuCompetitionDetailScreen(app, {
      showCombatForm: combatForm.showCombatForm,
      deleteCombat: combatForm.deleteCombat
    });

    const clubCompetition = window.createKirokuClubCompetitionScreen(app, {
      openCompetitionFromClubDetail: competitionDetail.openCompetitionFromClubDetail
    });

    function bindEvents() {
      combatForm.bindEvents();
    }

    return {
      bindEvents,
      ...competitionDetail,
      ...clubCompetition,
      ...combatForm
    };
  }

  window.createKirokuCompetitionScreen = createKirokuCompetitionScreen;
})();
