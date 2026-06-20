(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachAssistantResponse = import("./types").CoachAssistantResponse;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;
  type CoachDashboardCompetitionOption = import("../core/types").CoachDashboardCompetitionOption;

  const COACH_DASHBOARD_REFRESH_DEBOUNCE_MS = 300;
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
      "La garde (droitier/gaucher) du judoka suivi n'est pas renseignée sur ce combat — elle alimente la Répartition des gardes.",
    opponentStance:
      "La garde de l'adversaire n'est pas renseignée sur ce combat — elle alimente la Répartition des gardes.",
    victoryType:
      "Le type de décision finale (Ippon, Waza-ari...) n'est pas renseigné sur ce combat — il alimente les répartitions par décision.",
    scores:
      "Aucune prise n'a été détaillée sur ce combat — cela aide à distinguer les Ippon debout et au sol.",
    competitionLevel:
      "Le niveau de la compétition n'est pas renseigné — il alimente les Podiums par niveau.",
    judokaGender:
      "Le genre du judoka suivi n'est pas renseigné — il alimente la répartition Judokas par genre.",
    inconsistentIppon:
      "Le combat est gagné par décision Ippon, mais aucune prise marquée à Ippon n'a été enregistrée : la saisie mérite une vérification."
  };

  interface CoachAssistantMessage {
    id: number;
    role: "coach" | "assistant";
    text: string;
    matches?: CoachAssistantResponse["matches"];
  }

  function createKirokuCoachDashboardScreen(app: KirokuApp) {
    const { defaultListPageSize, state, screens, ui, notifications } = app;
    const { cleanText, showView } = ui;
    const { showError } = notifications;

    const defaultCoachDashboardForm = {
      ageCategory: "",
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
      coachAssistantQuestion: "",
      coachAssistantMessages: [
        {
          id: 1,
          role: "assistant",
          text: "Mode bêta. Essaie : « Trouve les judokas qui ont gagné par Osaekomi ».",
          matches: []
        }
      ] as CoachAssistantMessage[],
      isLoadingCoachAssistant: false,
      coachDashboardStats: null as CoachDashboardStats | null,
      isLoadingCoachDashboardStats: false
    });
    let coachAssistantMessageId = 1;
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
    const coachDashboardMainQualityIssue = window.Vue.computed(() => {
      const [issue] = coachDashboardDataQualityIssues.value;
      return issue ? `${issue.label} · ${issue.rate}%` : "Données complètes";
    });
    const coachDashboardSummaryInsight = window.Vue.computed(() => {
      const stats = coachDashboardViewModel.coachDashboardStats;
      if (!stats || !stats.totalCombats) {
        return "Aucun combat à analyser sur ce périmètre.";
      }
      const qualityIssue = coachDashboardDataQualityIssues.value[0];
      if (qualityIssue) {
        return `Priorité saisie : ${qualityIssue.label.toLowerCase()} concerne ${qualityIssue.count} combat(s).`;
      }
      if (stats.victoryRate >= 60) {
        return "Point fort : le taux de victoire est favorable sur ce périmètre.";
      }
      return "Point d'attention : comparez les décisions et les gardes pour orienter le prochain travail.";
    });
    const coachDashboardCompetitionOptionsFiltered = window.Vue.computed(() => {
      const query = cleanText(coachDashboardViewModel.competitionSearchText).toLowerCase();
      const selectedIds = new Set(
        coachDashboardViewModel.coachDashboardForm.competitionIds.map(String)
      );
      return coachDashboardViewModel.availableCompetitions.filter(
        (option) =>
          selectedIds.has(String(option.competitionId)) ||
          !query ||
          option.name.toLowerCase().includes(query) ||
          option.competitionDate.includes(query)
      );
    });
    const coachDashboardCompetitionOptionsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        coachDashboardCompetitionOptionsFiltered.value,
        state.coachDashboardCompetitionOptionsCurrentPage,
        defaultListPageSize
      )
    );
    const coachDashboardCompetitionOptionsPaginationRefs = ui.createPaginationRefs(
      coachDashboardCompetitionOptionsPagination
    );
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
          askCoachAssistant,
          getDataQualityIssueDescription,
          resetCoachDashboardFilters,
          scheduleCoachDashboardRefresh,
          showCoachHome,
          showPersonalSpace,
          showCoachCompetitions,
          toggleCoachDashboardFilters,
          updateCoachDashboardCompetitionSearch,
          showCoachDashboardCompetitionOptionsPreviousPage,
          showCoachDashboardCompetitionOptionsNextPage,
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
          coachDashboardMainQualityIssue,
          coachDashboardSummaryInsight,
          coachDashboardCompetitionOptionsPage: coachDashboardCompetitionOptionsPaginationRefs.page,
          coachDashboardCompetitionOptionsTotalPages:
            coachDashboardCompetitionOptionsPaginationRefs.totalPages,
          coachDashboardCompetitionOptionsCurrentPage:
            coachDashboardCompetitionOptionsPaginationRefs.currentPage,
          coachDashboardCompetitionOptionsTotalCount:
            coachDashboardCompetitionOptionsPaginationRefs.totalCount,
          coachDashboardCompetitionOptionsCanShowPreviousPage:
            coachDashboardCompetitionOptionsPaginationRefs.canShowPreviousPage,
          coachDashboardCompetitionOptionsCanShowNextPage:
            coachDashboardCompetitionOptionsPaginationRefs.canShowNextPage,
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

    function updateCoachDashboardCompetitionSearch() {
      state.coachDashboardCompetitionOptionsCurrentPage = 1;
    }

    function showCoachDashboardCompetitionOptionsPreviousPage() {
      state.coachDashboardCompetitionOptionsCurrentPage = Math.max(
        state.coachDashboardCompetitionOptionsCurrentPage - 1,
        1
      );
    }

    function showCoachDashboardCompetitionOptionsNextPage() {
      state.coachDashboardCompetitionOptionsCurrentPage += 1;
    }

    function askCoachAssistant() {
      const question = ui.cleanText(coachDashboardViewModel.coachAssistantQuestion);
      if (!question || coachDashboardViewModel.isLoadingCoachAssistant) {
        return;
      }
      coachDashboardViewModel.coachAssistantMessages.push({
        id: (coachAssistantMessageId += 1),
        role: "coach",
        text: question
      });
      coachDashboardViewModel.coachAssistantQuestion = "";
      coachDashboardViewModel.isLoadingCoachAssistant = true;

      app.runServer(
        "askCoachAssistant",
        [question],
        (response) => {
          coachDashboardViewModel.coachAssistantMessages.push({
            id: (coachAssistantMessageId += 1),
            role: "assistant",
            text: response.answer,
            matches: response.matches
          });
          coachDashboardViewModel.isLoadingCoachAssistant = false;
        },
        (error) => {
          coachDashboardViewModel.isLoadingCoachAssistant = false;
          showError(error);
        }
      );
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
      showView("coachDashboardView");
      if (tab === "stats") {
        fetchCoachDashboardStats();
      }
    }

    function showCoachDashboard() {
      showCoachDashboardMode("stats");
    }

    function showCoachChat() {
      showCoachDashboardMode("chat");
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
