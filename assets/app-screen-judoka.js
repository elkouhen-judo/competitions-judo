(() => {
  function createKirokuJudokaScreen(app) {
    const { state, ui, notifications } = app;
    const {
      emptyState,
      escapeAttribute,
      escapeHtml,
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
      lastCompetitionHtml: "",
      bestResultsHtml: ""
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

      if (!lastCompetition) {
        judokaViewModel.lastCompetitionHtml = emptyState("Aucune compétition enregistrée pour l'instant.");
      } else {
        judokaViewModel.lastCompetitionHtml = `
          <div class="meta-row">
            <span class="meta-label">Compétition</span>
            <span class="meta-value">${escapeHtml(lastCompetition.name || "")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Date</span>
            <span class="meta-value">${escapeHtml(formatDate(lastCompetition.competitionDate))}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Catégorie judoka</span>
            <span class="meta-value">${escapeHtml(lastCompetition.category || "Non renseignée")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Poids</span>
            <span class="meta-value">${escapeHtml(lastCompetition.weightCategory || "Non renseigné")}</span>
          </div>
        `;
      }

      if (!bestSeasonResults.length) {
        judokaViewModel.bestResultsHtml = emptyState("Pas encore de classement sur cette saison.");
      } else {
        let html = `<div class="list">`;
        bestSeasonResults.forEach(result => {
          html += `
            <article class="card">
              <p class="card-title">${escapeHtml(result.name || "Compétition")}</p>
              <div class="card-meta">
                <div class="meta-row">
                  <span class="meta-label">Date</span>
                  <span class="meta-value">${escapeHtml(formatDate(result.competitionDate))}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Résultat</span>
                  <span class="meta-value"><span class="result-badge classement-badge ${escapeAttribute(getClassementBadgeClass(result.result))}">${escapeHtml(result.result)}</span></span>
                </div>
              </div>
            </article>
          `;
        });
        html += `</div>`;
        judokaViewModel.bestResultsHtml = html;
      }
    }

    return {
      renderJudokaProfile,
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
