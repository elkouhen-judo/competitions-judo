(() => {
  function createKirokuJudokaScreen(app) {
    const { state, ui, notifications } = app;
    const {
      $,
      emptyState,
      escapeAttribute,
      escapeHtml,
      formatDate,
      getClassementBadgeClass,
      getJudokaDisplayName,
      getJudokaInitials,
      setText,
      setTexts,
      showView
    } = ui;
    const { clearMessage } = notifications;

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

      setTexts({
        judokaProfileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
        judokaProfileSubtitle: judoka.accountEmail,
        judokaSeasonLabel: `Saison ${season.label}`,
        judokaSeasonCompetitionCount: String(seasonCompetitionCount || 0),
        judokaSeasonCombatCount: String(seasonCombatCount || 0),
        judokaSeasonWins: String(seasonWins || 0),
        judokaSeasonLosses: String(seasonLosses || 0),
        judokaHeroAvatar: getJudokaInitials(judoka),
        judokaHeroName: getJudokaDisplayName(judoka) || "Judoka",
        judokaHeroSummary: `Saison ${season.label} · ${seasonCompetitionCount || 0} compétition(s) · ${seasonCombatCount || 0} combat(s)`,
        judokaHeroCategory: lastCompetition && lastCompetition.category ? lastCompetition.category : "Catégorie à confirmer",
        judokaHeroRecord: `${seasonWins || 0} V · ${seasonLosses || 0} D`
      });

      const lastCompetitionTarget = $("judokaLastCompetition");
      if (!lastCompetition) {
        lastCompetitionTarget.innerHTML = emptyState("Aucune compétition enregistrée pour l'instant.");
      } else {
        lastCompetitionTarget.innerHTML = `
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

      const bestResultsTarget = $("judokaBestResults");
      if (!bestSeasonResults.length) {
        bestResultsTarget.innerHTML = emptyState("Pas encore de classement sur cette saison.");
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
        bestResultsTarget.innerHTML = html;
      }
    }

    return {
      renderJudokaProfile,
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
