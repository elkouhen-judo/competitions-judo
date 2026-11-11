(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;
  type CoachDashboardCompetitionOption = import("../core/types").CoachDashboardCompetitionOption;

  const COACH_DASHBOARD_REFRESH_DEBOUNCE_MS = 300;
  const COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT = 8;
  const PODIUM_LEVEL_PRIORITY = ["International", "National", "Régional", "Départemental"];
  const PODIUM_PLACE_PRIORITY = ["1er", "2e", "3e"];
  const PODIUM_PLACE_EMOJIS: Record<string, string> = { "1er": "🥇", "2e": "🥈", "3e": "🥉" };

  const DATA_QUALITY_ISSUE_DESCRIPTIONS: Record<string, string> = {
    judokaHandedness:
      "La garde du judoka suivi (droitier/gaucher) n'est pas renseignée sur ce combat — elle alimente les statistiques par garde.",
    opponentStance:
      "La garde de l'adversaire (droitier/gaucher) n'est pas renseignée sur ce combat — elle alimente les statistiques par garde.",
    victoryType:
      "La manière dont le combat s'est terminé (Ippon, Waza-ari...) n'est pas renseignée sur ce combat.",
    scores:
      "Aucun point marqué n'a été détaillé sur ce combat — cela aide à distinguer les Ippon debout et au sol.",
    competitionLevel:
      "Le niveau de la compétition n'est pas renseigné — il alimente les Podiums par niveau.",
    judokaGender:
      "Le genre du judoka suivi n'est pas renseigné — il alimente la répartition Judokas par genre.",
    inconsistentIppon:
      "Le combat est gagné par Ippon, mais aucun point Ippon n'a été détaillé : la saisie mérite une vérification."
  };

  function createKirokuCoachDashboardScreen(app: KirokuApp) {
    const { state, screens, ui, notifications } = app;
    const { cleanText, formatDate, showView } = ui;
    const { showError } = notifications;

    const defaultCoachDashboardForm = {
      // Aucun filtre appliqué d'office : le coach voit tous ses clubs, puis affine.
      clubId: "",
      ageCategory: "",
      dateFrom: "",
      dateTo: "",
      competitionIds: [] as string[]
    };

    const coachDashboardViewModel = window.Vue.reactive({
      coachDashboardForm: { ...defaultCoachDashboardForm, competitionIds: [] as string[] },
      availableCompetitions: [] as CoachDashboardCompetitionOption[],
      competitionSearchText: "",
      filtersExpanded: false,
      coachDashboardStats: null as CoachDashboardStats | null,
      isLoadingCoachDashboardStats: false
    });
    let coachDashboardMounted = false;
    let coachDashboardRefreshTimer: number | null = null;
    let coachDashboardRequestId = 0;

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const coachDashboardVictoriesByType = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.victoriesByDecisionType || []
    );
    const coachDashboardDefeatsByType = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.defeatsByDecisionType || []
    );
    const coachDashboardByLateralMatchup = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.byLateralMatchup || []
    );
    const coachDashboardJudokasByGender = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByGender || []
    );
    const coachDashboardJudokasByHandedness = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByHandedness || []
    );
    const coachDashboardDataQualityIssues = window.Vue.computed(() =>
      (coachDashboardViewModel.coachDashboardStats?.dataQualityIssues || []).filter(
        (entry) => entry.count > 0
      )
    );
    const coachDashboardPodiumsByLevel = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.podiumsByLevel || []
    );
    const coachDashboardTopWinTechniques = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.topWinTechniques || []
    );
    // STATS-1 : podiums écrits en toutes lettres, par niveau (« National : 1 deuxième place »).
    const PODIUM_PLACE_WORDS: Record<string, [string, string]> = {
      "1er": ["première place", "premières places"],
      "2e": ["deuxième place", "deuxièmes places"],
      "3e": ["troisième place", "troisièmes places"]
    };
    const coachDashboardPodiumLines = window.Vue.computed(() =>
      [...coachDashboardPodiumsByLevel.value]
        .sort((a, b) => PODIUM_LEVEL_PRIORITY.indexOf(a.level) - PODIUM_LEVEL_PRIORITY.indexOf(b.level))
        .map((entry) => {
          const parts = PODIUM_PLACE_PRIORITY.map((place) => {
            const count = Number(entry.podiums.find((podium) => podium.place === place)?.count || 0);
            const words = PODIUM_PLACE_WORDS[place] || [place, place];
            return count ? `${PODIUM_PLACE_EMOJIS[place]} ${count} ${count > 1 ? words[1] : words[0]}` : "";
          }).filter(Boolean);
          return { level: entry.level, text: parts.join(" · ") };
        })
        .filter((line) => line.text)
    );
    const coachDashboardPodiumTotal = window.Vue.computed(() =>
      coachDashboardPodiumsByLevel.value.reduce(
        (total, entry) => total + entry.podiums.reduce((sum, podium) => sum + Number(podium.count || 0), 0),
        0
      )
    );
    // STATS-2 : les techniques s'affichent en barres relatives à la plus fréquente.
    const coachDashboardTopWinTechniqueBars = window.Vue.computed(() => {
      const entries = coachDashboardTopWinTechniques.value;
      const max = Math.max(1, ...entries.map((entry) => entry.count));
      return entries.map((entry) => ({ ...entry, rate: Math.round((entry.count / max) * 100) }));
    });
    const coachDashboardTopQualityIssue = window.Vue.computed(() =>
      coachDashboardDataQualityIssues.value.reduce(
        (topIssue, issue) => (!topIssue || issue.rate > topIssue.rate ? issue : topIssue),
        null as CoachDashboardStats["dataQualityIssues"][number] | null
      )
    );
    // Combats concernés par le critère de saisie le plus fréquent (les critères se recoupent).
    const coachDashboardIncompleteCount = window.Vue.computed(() =>
      coachDashboardDataQualityIssues.value.reduce((max, issue) => Math.max(max, issue.count), 0)
    );
    const coachDashboardMainQualityIssue = window.Vue.computed(() => {
      const issue = coachDashboardTopQualityIssue.value;
      return issue ? `${issue.label} · ${issue.rate}%` : "Données complètes";
    });
    const coachDashboardSummaryInsight = window.Vue.computed(() => {
      const stats = coachDashboardViewModel.coachDashboardStats;
      if (!stats || !stats.totalCombats) {
        return "Aucun combat à analyser sur ce périmètre.";
      }
      const qualityIssue = coachDashboardTopQualityIssue.value;
      if (qualityIssue) {
        return `À compléter en priorité : ${qualityIssue.label.toLowerCase()} (${ui.pluralize(qualityIssue.count, "combat")}).`;
      }
      if (stats.victoryRate >= 60) {
        return "Point fort : le taux de victoire est favorable sur ce périmètre.";
      }
      return "Point d'attention : comparez les décisions et les gardes pour orienter le prochain travail.";
    });
    const coachDashboardSelectedCompetitions = window.Vue.computed(() => {
      const optionsById = new Map(
        coachDashboardViewModel.availableCompetitions.map((option) => [
          String(option.competitionId),
          option
        ])
      );
      return coachDashboardViewModel.coachDashboardForm.competitionIds
        .map((id) => optionsById.get(String(id)))
        .filter((option): option is CoachDashboardCompetitionOption => Boolean(option));
    });
    const coachDashboardCompetitionSuggestions = window.Vue.computed(() => {
      const query = cleanText(coachDashboardViewModel.competitionSearchText).toLowerCase();
      if (!query) {
        return [] as CoachDashboardCompetitionOption[];
      }
      const selectedIds = new Set(
        coachDashboardViewModel.coachDashboardForm.competitionIds.map(String)
      );
      return coachDashboardViewModel.availableCompetitions
        .filter(
          (option) =>
            !selectedIds.has(String(option.competitionId)) &&
            (option.name.toLowerCase().includes(query) || option.competitionDate.includes(query))
        )
        .slice(0, COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT);
    });
    const coachDashboardTitle = window.Vue.computed(() => "Tableau de bord coach");
    const coachDashboardSubtitle = window.Vue.computed(
      () => "Statistiques agrégées sur une ou plusieurs compétitions"
    );

    function formatCoachDashboardDate(value: unknown) {
      const formatted = formatDate(value);
      if (!formatted) {
        return "Date non renseignée";
      }
      return formatted;
    }

    function ensureCoachDashboardViewModel() {
      if (coachDashboardMounted) {
        return;
      }
      coachDashboardMounted = true;
      ui.mountViewModel(
        "coachDashboardView",
        coachDashboardViewModel,
        {
          getDataQualityIssueDescription,
          resetCoachDashboardFilters,
          scheduleCoachDashboardRefresh,
          showCoachHome,
          showCoachCompetitions,
          toggleCoachDashboardFilters,
          addCoachDashboardCompetition,
          removeCoachDashboardCompetition,
          showCoachJudoka,
          showCoachDashboard,
          formatCoachDashboardDate,
          formatCompetitionName: ui.formatCompetitionName
        },
        {
          isSubmitting,
          coachDashboardVictoriesByType,
          coachDashboardDefeatsByType,
          coachDashboardByLateralMatchup,
          coachDashboardJudokasByGender,
          coachDashboardJudokasByHandedness,
          coachDashboardDataQualityIssues,
          coachDashboardPodiumsByLevel,
          coachDashboardPodiumLines,
          coachDashboardPodiumTotal,
          coachDashboardTopWinTechniques,
          coachDashboardTopWinTechniqueBars,
          coachDashboardMainQualityIssue,
          coachDashboardIncompleteCount,
          coachDashboardSummaryInsight,
          coachDashboardSelectedCompetitions,
          coachDashboardCompetitionSuggestions,
          coachDashboardTitle,
          coachDashboardSubtitle,
          showCoachDashboardClubFilter,
          coachDashboardClubOptions,
          coachDashboardClubName
        }
      );
    }

    // Filtre club : proposé aux coachs de plusieurs clubs uniquement.
    const showCoachDashboardClubFilter = window.Vue.computed(() => state.clubs.length > 1);
    const coachDashboardClubOptions = window.Vue.computed(() => state.clubs);
    const coachDashboardClubName = window.Vue.computed(() => {
      const club = state.clubs.find((candidate) => candidate.clubId === coachDashboardViewModel.coachDashboardForm.clubId);
      return club ? club.name : "";
    });

    function fetchCoachDashboardStats() {
      const dateFrom = coachDashboardViewModel.coachDashboardForm.dateFrom;
      const dateTo = coachDashboardViewModel.coachDashboardForm.dateTo;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        showError({ message: "La date de début doit être antérieure ou égale à la date de fin." });
        return;
      }

      const requestId = (coachDashboardRequestId += 1);
      coachDashboardViewModel.isLoadingCoachDashboardStats = true;

      app.runServer(
        "getCoachDashboard",
        [
          {
            clubId: coachDashboardViewModel.coachDashboardForm.clubId,
            dateFrom: coachDashboardViewModel.coachDashboardForm.dateFrom,
            dateTo: coachDashboardViewModel.coachDashboardForm.dateTo,
            ageCategory: coachDashboardViewModel.coachDashboardForm.ageCategory,
            competitionIds: getSelectedCoachDashboardCompetitionIds()
          }
        ],
        (response) => {
          if (requestId !== coachDashboardRequestId) {
            return;
          }
          coachDashboardViewModel.coachDashboardStats = response.stats;
          coachDashboardViewModel.availableCompetitions = response.availableCompetitions;
          const availableCompetitionIds = new Set(
            response.availableCompetitions.map((option) => String(option.competitionId))
          );
          coachDashboardViewModel.coachDashboardForm.competitionIds =
            coachDashboardViewModel.coachDashboardForm.competitionIds.filter((id) =>
              availableCompetitionIds.has(String(id))
            );
          coachDashboardViewModel.isLoadingCoachDashboardStats = false;
        },
        (error) => {
          if (requestId !== coachDashboardRequestId) {
            return;
          }
          coachDashboardViewModel.isLoadingCoachDashboardStats = false;
          showError(error);
        }
      );
    }

    function getSelectedCoachDashboardCompetitionIds() {
      const selectedIds = new Set(coachDashboardViewModel.coachDashboardForm.competitionIds.map(String));
      const expandedCompetitionIds: string[] = [];
      coachDashboardViewModel.availableCompetitions.forEach((option) => {
        if (!selectedIds.has(String(option.competitionId))) {
          return;
        }
        (option.competitionIds?.length ? option.competitionIds : [option.competitionId]).forEach((id) => {
          expandedCompetitionIds.push(String(id));
        });
      });
      return expandedCompetitionIds.length
        ? expandedCompetitionIds
        : coachDashboardViewModel.coachDashboardForm.competitionIds;
    }

    function scheduleCoachDashboardRefresh() {
      if (coachDashboardRefreshTimer) {
        window.clearTimeout(coachDashboardRefreshTimer);
      }
      coachDashboardRefreshTimer = window.setTimeout(() => {
        coachDashboardRefreshTimer = null;
        fetchCoachDashboardStats();
      }, COACH_DASHBOARD_REFRESH_DEBOUNCE_MS);
    }

    function addCoachDashboardCompetition(competitionId: string) {
      const id = String(competitionId);
      if (!coachDashboardViewModel.coachDashboardForm.competitionIds.includes(id)) {
        coachDashboardViewModel.coachDashboardForm.competitionIds.push(id);
      }
      coachDashboardViewModel.competitionSearchText = "";
      scheduleCoachDashboardRefresh();
    }

    function removeCoachDashboardCompetition(competitionId: string) {
      const id = String(competitionId);
      coachDashboardViewModel.coachDashboardForm.competitionIds =
        coachDashboardViewModel.coachDashboardForm.competitionIds.filter(
          (existingId) => existingId !== id
        );
      scheduleCoachDashboardRefresh();
    }

    function resetCoachDashboardFilters() {
      if (coachDashboardRefreshTimer) {
        window.clearTimeout(coachDashboardRefreshTimer);
        coachDashboardRefreshTimer = null;
      }
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        competitionIds: [] as string[]
      });
      coachDashboardViewModel.competitionSearchText = "";
      fetchCoachDashboardStats();
    }

    function toggleCoachDashboardFilters() {
      coachDashboardViewModel.filtersExpanded = !coachDashboardViewModel.filtersExpanded;
    }

    function showCoachDashboard() {
      ensureCoachDashboardViewModel();
      if (coachDashboardRefreshTimer) {
        window.clearTimeout(coachDashboardRefreshTimer);
        coachDashboardRefreshTimer = null;
      }
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        // Les statistiques s'ouvrent sur le club choisi à l'accueil.
        clubId: state.selectedClubId || "",
        competitionIds: [] as string[]
      });
      coachDashboardViewModel.competitionSearchText = "";
      coachDashboardViewModel.filtersExpanded = false;
      coachDashboardViewModel.coachDashboardStats = null;
      showView("coachDashboardView");
      fetchCoachDashboardStats();
    }

    function showCoachHomeMode(mode: "judoka" | "coachHome" | "coach" | "coachJudoka") {
      screens.home.setHomeMode(mode);
      if (app.showHome) {
        app.showHome();
      }
    }

    function showCoachHome() {
      showCoachHomeMode("coachHome");
    }

    function showCoachCompetitions() {
      showCoachHomeMode("coach");
    }

    function showCoachJudoka() {
      showCoachHomeMode("coachJudoka");
    }

    function getDataQualityIssueDescription(criterion: string): string {
      return DATA_QUALITY_ISSUE_DESCRIPTIONS[criterion] || "";
    }

    return {
      showCoachDashboard
    };
  }

  window.createKirokuCoachDashboardScreen = createKirokuCoachDashboardScreen;
})();
