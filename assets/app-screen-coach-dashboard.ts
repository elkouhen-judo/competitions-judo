(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;

  function createKirokuCoachDashboardScreen(app: KirokuApp) {
    const { state, ui, notifications } = app;
    const { showView } = ui;
    const { showError } = notifications;

    const defaultCoachDashboardForm = {
      ageCategory: "",
      categoryYear: "",
      gender: "",
      handedness: "",
      competitionIds: [] as string[]
    };

    const coachDashboardViewModel = window.Vue.reactive({
      coachDashboardForm: { ...defaultCoachDashboardForm, competitionIds: [] as string[] },
      coachDashboardStats: null as CoachDashboardStats | null,
      isLoadingCoachDashboardStats: false
    });
    let coachDashboardMounted = false;

    const competitionOptions = window.Vue.computed(() =>
      [...state.competitions].sort((a, b) =>
        String(b.competitionDate || "").localeCompare(String(a.competitionDate || ""))
      )
    );
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
    const coachDashboardByCompetitionLevel = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.byCompetitionLevel || []
    );
    const coachDashboardJudokasByGender = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByGender || []
    );
    const coachDashboardJudokasByHandedness = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByHandedness || []
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
          onCoachDashboardAgeCategoryChange,
          resetCoachDashboardFilters,
          showHome: () => app.showHome && app.showHome()
        },
        {
          competitionOptions,
          isSubmitting,
          coachDashboardYearOptions,
          coachDashboardVictoriesByType,
          coachDashboardDefeatsByType,
          coachDashboardByOpponentStance,
          coachDashboardByCompetitionLevel,
          coachDashboardJudokasByGender,
          coachDashboardJudokasByHandedness
        }
      );
    }

    function fetchCoachDashboardStats() {
      coachDashboardViewModel.isLoadingCoachDashboardStats = true;

      app.runServer(
        "getCoachDashboard",
        [
          {
            competitionIds: coachDashboardViewModel.coachDashboardForm.competitionIds,
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

    function onCoachDashboardAgeCategoryChange() {
      if (!coachDashboardYearOptions.value.includes(coachDashboardViewModel.coachDashboardForm.categoryYear)) {
        coachDashboardViewModel.coachDashboardForm.categoryYear = "";
      }
    }

    function resetCoachDashboardFilters() {
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        competitionIds: [] as string[]
      });
      fetchCoachDashboardStats();
    }

    function showCoachDashboard() {
      ensureCoachDashboardViewModel();
      Object.assign(coachDashboardViewModel.coachDashboardForm, defaultCoachDashboardForm, {
        competitionIds: [] as string[]
      });
      coachDashboardViewModel.coachDashboardStats = null;
      showView("coachDashboardView");
      fetchCoachDashboardStats();
    }

    return {
      showCoachDashboard
    };
  }

  window.createKirokuCoachDashboardScreen = createKirokuCoachDashboardScreen;
})();
