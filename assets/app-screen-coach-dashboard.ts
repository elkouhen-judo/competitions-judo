(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;
  type CoachDashboardCompetitionOption = import("../core/types").CoachDashboardCompetitionOption;

  const COACH_DASHBOARD_REFRESH_DEBOUNCE_MS = 300;
  const COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT = 8;
  const PODIUM_LEVEL_PRIORITY = ["International", "National", "Régional", "Départemental"];
  const PODIUM_LEVEL_LABELS: Record<string, string> = {
    International: "Int.",
    National: "Nat.",
    Régional: "Rég.",
    Départemental: "Dép."
  };
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
    const { cleanText, showView } = ui;
    const { showError } = notifications;

    const defaultCoachDashboardForm = {
      ageCategory: "Minime",
      dateFrom: "",
      dateTo: "",
      competitionIds: [] as string[]
    };

    const coachDashboardViewModel = window.Vue.reactive({
      coachDashboardForm: { ...defaultCoachDashboardForm, competitionIds: [] as string[] },
      availableCompetitions: [] as CoachDashboardCompetitionOption[],
      competitionSearchText: "",
      activeCoachDashboardTab: "stats",
      filtersExpanded: true,
      coachDashboardStats: null as CoachDashboardStats | null,
      isLoadingCoachDashboardStats: false
    });
    let coachDashboardMounted = false;
    let coachChatWidgetMounted = false;
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
    const coachDashboardTopPodiumLevel = window.Vue.computed(() => {
      const entries = coachDashboardPodiumsByLevel.value;
      const podiumHighlights: string[] = [];
      for (const level of PODIUM_LEVEL_PRIORITY) {
        const entry = entries.find((candidate) => candidate.level === level);
        if (!entry) {
          continue;
        }
        for (const place of PODIUM_PLACE_PRIORITY) {
          const podium = entry.podiums.find((candidate) => candidate.place === place);
          const podiumCount = Number(podium?.count || 0);
          if (podiumCount > 0) {
            podiumHighlights.push(`${PODIUM_LEVEL_LABELS[level] || level} ${podiumCount}x${PODIUM_PLACE_EMOJIS[place]}`);
            break;
          }
        }
      }
      return podiumHighlights.length ? podiumHighlights.join("\n") : "Aucun podium";
    });
    const coachDashboardTopQualityIssue = window.Vue.computed(() =>
      coachDashboardDataQualityIssues.value.reduce(
        (topIssue, issue) => (!topIssue || issue.rate > topIssue.rate ? issue : topIssue),
        null as CoachDashboardStats["dataQualityIssues"][number] | null
      )
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
        return `Priorité saisie : ${qualityIssue.label.toLowerCase()} concerne ${qualityIssue.count} combat(s).`;
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
    const coachDashboardTitle = window.Vue.computed(() =>
      coachDashboardViewModel.activeCoachDashboardTab === "chat"
        ? "Chat coach — quota LLM limité"
        : "Tableau de bord coach"
    );
    const coachDashboardSubtitle = window.Vue.computed(() =>
      coachDashboardViewModel.activeCoachDashboardTab === "chat"
        ? "Recherche bêta dans les informations des judokas et combats."
        : "Statistiques agrégées sur une ou plusieurs compétitions"
    );

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
          showPersonalSpace,
          showCoachCompetitions,
          toggleCoachDashboardFilters,
          addCoachDashboardCompetition,
          removeCoachDashboardCompetition,
          showCoachJudoka,
          showCoachDashboard,
          showCoachChat
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
          coachDashboardTopPodiumLevel,
          coachDashboardTopWinTechniques,
          coachDashboardMainQualityIssue,
          coachDashboardSummaryInsight,
          coachDashboardSelectedCompetitions,
          coachDashboardCompetitionSuggestions,
          coachDashboardTitle,
          coachDashboardSubtitle
        }
      );
    }

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

    function mountCoachChatWidget() {
      if (coachChatWidgetMounted) {
        return;
      }
      coachChatWidgetMounted = true;
      window.mountKirokuCoachChatWidget({
        elementId: "coachChatWidget",
        getAccessToken: () =>
          app.auth.getValidVercelSession().then((session) => session?.access_token || ""),
        onSelectJudoka: (judokaId) => screens.judoka.showJudokaProfile(judokaId),
        onSelectCompetition: (competitionId) => screens.competition.openCompetition(competitionId)
      });
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
      coachDashboardViewModel.activeCoachDashboardTab = "stats";
      fetchCoachDashboardStats();
    }

    function toggleCoachDashboardFilters() {
      coachDashboardViewModel.filtersExpanded = !coachDashboardViewModel.filtersExpanded;
    }

    function showCoachDashboardMode(tab: "stats" | "chat") {
      ensureCoachDashboardViewModel();
      if (coachDashboardRefreshTimer) {
        window.clearTimeout(coachDashboardRefreshTimer);
        coachDashboardRefreshTimer = null;
      }
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        competitionIds: [] as string[]
      });
      coachDashboardViewModel.competitionSearchText = "";
      coachDashboardViewModel.activeCoachDashboardTab = tab;
      coachDashboardViewModel.filtersExpanded = true;
      coachDashboardViewModel.coachDashboardStats = null;
      showView("coachDashboardView", { routeState: { coachDashboardTab: tab } });
      if (tab === "stats") {
        fetchCoachDashboardStats();
      }
    }

    function showCoachDashboard() {
      showCoachDashboardMode("stats");
    }

    function showCoachChat() {
      showCoachDashboardMode("chat");
      mountCoachChatWidget();
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

    function showPersonalSpace() {
      showCoachHomeMode("judoka");
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
      showCoachChat,
      showCoachDashboard
    };
  }

  window.createKirokuCoachDashboardScreen = createKirokuCoachDashboardScreen;
})();
