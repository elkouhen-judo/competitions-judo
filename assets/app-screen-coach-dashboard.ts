(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachAssistantResponse = import("./types").CoachAssistantResponse;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;

  interface CoachAssistantMessage {
    id: number;
    role: "coach" | "assistant";
    text: string;
    matches?: CoachAssistantResponse["matches"];
  }

  function createKirokuCoachDashboardScreen(app: KirokuApp) {
    const { state, ui, notifications } = app;
    const { showView } = ui;
    const { showError } = notifications;

    const defaultCoachDashboardForm = {
      ageCategory: "",
      categoryYear: "",
      dateFrom: "",
      dateTo: "",
      gender: "",
      handedness: "",
      competitionIds: [] as string[]
    };

    const coachDashboardViewModel = window.Vue.reactive({
      coachDashboardForm: { ...defaultCoachDashboardForm, competitionIds: [] as string[] },
      activeCoachDashboardTab: "stats",
      competitionSearchText: "",
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

    const competitionOptions = window.Vue.computed(() => {
      const query = ui.cleanText(coachDashboardViewModel.competitionSearchText).toLowerCase();
      return [...state.competitions]
        .sort((a, b) => String(b.competitionDate || "").localeCompare(String(a.competitionDate || "")))
        .filter((competition) => {
          if (!query) return true;
          return `${competition.name || ""} ${competition.competitionDate || ""}`.toLowerCase().includes(query);
        });
    });
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const coachDashboardYearOptions = window.Vue.computed(() =>
      window.KirokuScreenProjections.getYearInCategoryOptions(
        coachDashboardViewModel.coachDashboardForm.ageCategory
      )
    );
    const coachDashboardVictoriesByType = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.victoriesByDecisionType || []
    );
    const coachDashboardDefeatsByType = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.defeatsByDecisionType || []
    );
    const coachDashboardByOpponentStance = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.byOpponentStance || []
    );
    const coachDashboardByLateralMatchup = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.byLateralMatchup || []
    );
    const coachDashboardByCompetitionLevel = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.byCompetitionLevel || []
    );
    const coachDashboardJudokasByGender = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByGender || []
    );
    const coachDashboardJudokasByHandedness = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByHandedness || []
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
          applyCoachDashboardFilters,
          askCoachAssistant,
          onCoachDashboardAgeCategoryChange,
          resetCoachDashboardFilters,
          toggleCoachDashboardFilters,
          updateCoachDashboardCompetitionSearch,
          showHome: () => app.showHome && app.showHome()
        },
        {
          competitionOptions,
          isSubmitting,
          coachDashboardYearOptions,
          coachDashboardVictoriesByType,
          coachDashboardDefeatsByType,
          coachDashboardByOpponentStance,
          coachDashboardByLateralMatchup,
          coachDashboardByCompetitionLevel,
          coachDashboardJudokasByGender,
          coachDashboardJudokasByHandedness,
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

      coachDashboardViewModel.isLoadingCoachDashboardStats = true;

      app.runServer(
        "getCoachDashboard",
        [
          {
            competitionIds: coachDashboardViewModel.coachDashboardForm.competitionIds,
            dateFrom: coachDashboardViewModel.coachDashboardForm.dateFrom,
            dateTo: coachDashboardViewModel.coachDashboardForm.dateTo,
            ageCategory: coachDashboardViewModel.coachDashboardForm.ageCategory,
            categoryYear: coachDashboardViewModel.coachDashboardForm.categoryYear,
            gender: coachDashboardViewModel.coachDashboardForm.gender,
            handedness: coachDashboardViewModel.coachDashboardForm.handedness
          }
        ],
        (response) => {
          coachDashboardViewModel.coachDashboardStats = response.stats;
          coachDashboardViewModel.isLoadingCoachDashboardStats = false;
        },
        (error) => {
          coachDashboardViewModel.isLoadingCoachDashboardStats = false;
          showError(error);
        }
      );
    }

    function applyCoachDashboardFilters() {
      fetchCoachDashboardStats();
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

    function onCoachDashboardAgeCategoryChange() {
      if (!coachDashboardYearOptions.value.includes(coachDashboardViewModel.coachDashboardForm.categoryYear)) {
        coachDashboardViewModel.coachDashboardForm.categoryYear = "";
      }
    }

    function resetCoachDashboardFilters() {
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        competitionIds: [] as string[]
      });
      coachDashboardViewModel.activeCoachDashboardTab = "stats";
      coachDashboardViewModel.competitionSearchText = "";
      fetchCoachDashboardStats();
    }

    function toggleCoachDashboardFilters() {
      coachDashboardViewModel.filtersExpanded = !coachDashboardViewModel.filtersExpanded;
    }

    function updateCoachDashboardCompetitionSearch() {
      // The selection intentionally survives search changes so a coach can build
      // a multi-competition scope across several queries.
    }

    function showCoachDashboardMode(tab: "stats" | "chat") {
      ensureCoachDashboardViewModel();
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        competitionIds: [] as string[]
      });
      coachDashboardViewModel.activeCoachDashboardTab = tab;
      coachDashboardViewModel.competitionSearchText = "";
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

    return {
      showCoachChat,
      showCoachDashboard
    };
  }

  window.createKirokuCoachDashboardScreen = createKirokuCoachDashboardScreen;
})();
