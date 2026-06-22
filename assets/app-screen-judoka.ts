(() => {
  type KirokuApp = import("./types").KirokuApp;
  type JudokaProfileViewModel = import("./types").JudokaProfileViewModel;

  function createKirokuJudokaScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      formatCompetitionRanking,
      formatDate,
      getClassementBadgeClass,
      getJudokaDisplayName,
      getJudokaInitials,
      showView
    } = ui;
    const { clearMessage } = notifications;
    let mounted = false;
    let currentJudokaId = "";
    const judokaLocalState = window.Vue.reactive({
      ageCategoryEditing: "",
      weightCategoryEditing: "",
      beltColorEditing: "",
      genderEditing: "",
      yearInCategoryEditing: "",
      handednessEditing: "",
      viewedJudokaId: ""
    });

    function getCurrentSeasonStartYear() {
      const now = new Date();
      return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    }

    function getDisplayedSeasonStartYear(): number | null {
      if (!state.currentJudokaProfile) return null;
      return parseInt(state.currentJudokaProfile.season.start.slice(0, 4), 10);
    }

    const defaultJudokaProfile: JudokaProfileViewModel = {
      profileTitle: "Fiche judoka",
      profileSubtitle: "",
      heroAvatar: "JJ",
      heroName: "Judoka",
      heroSummary: "",
      heroCategory: "",
      heroWeightCategory: "",
      heroBeltColor: "",
      heroGender: "",
      heroYearInCategory: "",
      heroHandedness: "",
      heroSeason: "",
      seasonLabel: "",
      seasonCompetitionCount: "0",
      seasonCombatCount: "0",
      seasonWins: "0",
      seasonLosses: "0",
      seasonDraws: "0",
      victoryRate: "0%",
      victoriesByDecisionType: [],
      defeatsByDecisionType: [],
      topWinTechniques: [],
      hasTopWinTechniques: false,
      hasCompetitionResults: false,
      competitionResults: []
    };

    const judokaProfile = window.Vue.computed<JudokaProfileViewModel>(() => {
      if (!state.currentJudokaProfile) {
        return defaultJudokaProfile;
      }
      return (
        window.createJudokaProfileViewModel(state.currentJudokaProfile, {
          formatDate,
          formatCompetitionRanking,
          getClassementBadgeClass,
          getJudokaDisplayName,
          getJudokaInitials
        }) ?? defaultJudokaProfile
      );
    });

    const competitionResultsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        judokaProfile.value.competitionResults,
        state.judokaCompetitionResultsCurrentPage,
        defaultListPageSize
      )
    );

    const profileTitle = window.Vue.computed(() => judokaProfile.value.profileTitle);
    const profileSubtitle = window.Vue.computed(() => judokaProfile.value.profileSubtitle);
    const heroAvatar = window.Vue.computed(() => judokaProfile.value.heroAvatar);
    const heroName = window.Vue.computed(() => judokaProfile.value.heroName);
    const heroSummary = window.Vue.computed(() => judokaProfile.value.heroSummary);
    const heroCategory = window.Vue.computed(() => judokaProfile.value.heroCategory);
    const heroWeightCategory = window.Vue.computed(() => judokaProfile.value.heroWeightCategory);
    const heroBeltColor = window.Vue.computed(() => judokaProfile.value.heroBeltColor);
    const heroGender = window.Vue.computed(() => judokaProfile.value.heroGender);
    const heroYearInCategory = window.Vue.computed(() => judokaProfile.value.heroYearInCategory);
    const heroHandedness = window.Vue.computed(() => judokaProfile.value.heroHandedness);
    const heroSeason = window.Vue.computed(() => judokaProfile.value.heroSeason);
    const seasonLabel = window.Vue.computed(() => judokaProfile.value.seasonLabel);
    const seasonCompetitionCount = window.Vue.computed(
      () => judokaProfile.value.seasonCompetitionCount
    );
    const seasonCombatCount = window.Vue.computed(() => judokaProfile.value.seasonCombatCount);
    const seasonWins = window.Vue.computed(() => judokaProfile.value.seasonWins);
    const seasonLosses = window.Vue.computed(() => judokaProfile.value.seasonLosses);
    const seasonDraws = window.Vue.computed(() => judokaProfile.value.seasonDraws);
    const victoryRate = window.Vue.computed(() => judokaProfile.value.victoryRate);
    const victoriesByDecisionType = window.Vue.computed(
      () => judokaProfile.value.victoriesByDecisionType
    );
    const defeatsByDecisionType = window.Vue.computed(
      () => judokaProfile.value.defeatsByDecisionType
    );
    const topWinTechniques = window.Vue.computed(() => judokaProfile.value.topWinTechniques);
    const hasTopWinTechniques = window.Vue.computed(() => judokaProfile.value.hasTopWinTechniques);
    const hasCompetitionResults = window.Vue.computed(
      () => judokaProfile.value.hasCompetitionResults
    );
    const competitionResultsPage = window.Vue.computed(
      () => competitionResultsPagination.value.pageItems
    );
    const competitionResultsTotalPages = window.Vue.computed(
      () => competitionResultsPagination.value.totalPages
    );
    const competitionResultsCurrentPage = window.Vue.computed(
      () => competitionResultsPagination.value.currentPage
    );
    const competitionResultsTotalCount = window.Vue.computed(
      () => competitionResultsPagination.value.totalItems
    );
    const competitionResultsCanShowPreviousPage = window.Vue.computed(
      () => competitionResultsPagination.value.canShowPreviousPage
    );
    const competitionResultsCanShowNextPage = window.Vue.computed(
      () => competitionResultsPagination.value.canShowNextPage
    );

    const weightCategoryOptions = window.Vue.computed(() =>
      window.KirokuScreenProjections.getWeightCategoryOptions(
        judokaLocalState.ageCategoryEditing,
        judokaLocalState.genderEditing
      )
    );
    const yearInCategoryOptions = window.Vue.computed(() =>
      window.KirokuScreenProjections.getYearInCategoryOptions(judokaLocalState.ageCategoryEditing)
    );
    const isOwnProfile = window.Vue.computed(() =>
      Boolean(judokaLocalState.viewedJudokaId && state.currentUser &&
        String(judokaLocalState.viewedJudokaId) === String(state.currentUser.judokaId))
    );
    const isManagedProfile = window.Vue.computed(() =>
      Boolean(
        judokaLocalState.viewedJudokaId &&
          state.isParent &&
          state.judokas.some((j) => String(j.judokaId) === String(judokaLocalState.viewedJudokaId))
      )
    );
    const canEditJudokaInfo = window.Vue.computed(
      () => state.isCoach || state.isAdmin || isOwnProfile.value || isManagedProfile.value
    );
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);

    const canShowPreviousSeason = window.Vue.computed(() => Boolean(state.currentJudokaProfile));
    const canShowNextSeason = window.Vue.computed(() => {
      const displayed = getDisplayedSeasonStartYear();
      if (displayed === null) return false;
      return displayed < getCurrentSeasonStartYear();
    });

    function loadJudokaProfile(idJudoka: string, seasonStartYear?: number) {
      app.runServer(
        "getJudokaProfile",
        [idJudoka, seasonStartYear],
        (data) => {
          ensureJudokaView();
          state.currentJudokaProfile = data;
          judokaLocalState.ageCategoryEditing = data.judoka?.ageCategory || "";
          judokaLocalState.weightCategoryEditing = data.judoka?.weightCategory || "";
          judokaLocalState.beltColorEditing = data.judoka?.beltColor || "";
          judokaLocalState.genderEditing = data.judoka?.gender || "";
          judokaLocalState.yearInCategoryEditing = data.judoka?.yearInCategory || "";
          judokaLocalState.handednessEditing = data.judoka?.handedness || "";
          judokaLocalState.viewedJudokaId = data.judoka?.judokaId || "";
          state.judokaCompetitionResultsCurrentPage = 1;
          showView("judokaView");
        },
        notifications.showError
      );
    }

    function showPreviousSeason() {
      const displayed = getDisplayedSeasonStartYear();
      if (!currentJudokaId || displayed === null) return;
      loadJudokaProfile(currentJudokaId, displayed - 1);
    }

    function showNextSeason() {
      const displayed = getDisplayedSeasonStartYear();
      if (!currentJudokaId || displayed === null) return;
      loadJudokaProfile(currentJudokaId, displayed + 1);
    }

    function openCompetitionFromProfile(competitionId: string) {
      app.screens.competition.openCompetitionFromJudokaProfile(competitionId);
    }

    function onJudokaInfoAgeOrGenderChange() {
      if (!judokaLocalState.ageCategoryEditing) {
        judokaLocalState.weightCategoryEditing = "";
      } else if (
        weightCategoryOptions.value.length &&
        !weightCategoryOptions.value.includes(judokaLocalState.weightCategoryEditing)
      ) {
        judokaLocalState.weightCategoryEditing = "";
      }
      if (!yearInCategoryOptions.value.includes(judokaLocalState.yearInCategoryEditing)) {
        judokaLocalState.yearInCategoryEditing = "";
      }
    }

    function saveJudokaInfo() {
      if (!currentJudokaId) return;
      const ageCategory = judokaLocalState.ageCategoryEditing || "";
      const weightCategory = judokaLocalState.weightCategoryEditing || "";
      const beltColor = judokaLocalState.beltColorEditing || "";
      const gender = judokaLocalState.genderEditing || "";
      const yearInCategory = judokaLocalState.yearInCategoryEditing || "";
      const handedness = judokaLocalState.handednessEditing || "";
      app.runServer(
        "saveJudokaInfo",
        [currentJudokaId, ageCategory, weightCategory, beltColor, gender, yearInCategory, handedness],
        (response) => {
          notifications.showSuccess(response.message);
          const displayed = getDisplayedSeasonStartYear();
          loadJudokaProfile(currentJudokaId, displayed === null ? undefined : displayed);
        },
        notifications.showError
      );
    }

    function ensureJudokaView() {
      if (mounted) {
        return;
      }
      mounted = true;
      ui.mountViewModel(
        "judokaView",
        judokaLocalState,
        {
          showHome: () => app.showHome && app.showHome(),
          openCompetitionFromProfile,
          onJudokaInfoAgeOrGenderChange,
          saveJudokaInfo,
          showPreviousSeason,
          showNextSeason,
          showCompetitionResultsPreviousPage,
          showCompetitionResultsNextPage
        },
        {
          profileTitle,
          profileSubtitle,
          heroAvatar,
          heroName,
          heroSummary,
          heroCategory,
          heroWeightCategory,
          heroBeltColor,
          heroGender,
          heroYearInCategory,
          heroHandedness,
          heroSeason,
          seasonLabel,
          seasonCompetitionCount,
          seasonCombatCount,
          seasonWins,
          seasonLosses,
          seasonDraws,
          victoryRate,
          victoriesByDecisionType,
          defeatsByDecisionType,
          topWinTechniques,
          hasTopWinTechniques,
          hasCompetitionResults,
          competitionResultsPage,
          competitionResultsTotalPages,
          competitionResultsCurrentPage,
          competitionResultsTotalCount,
          competitionResultsCanShowPreviousPage,
          competitionResultsCanShowNextPage,
          canShowPreviousSeason,
          canShowNextSeason,
          canEditJudokaInfo,
          isManagedProfile,
          isSubmitting,
          weightCategoryOptions,
          yearInCategoryOptions
        }
      );
    }

    function showCompetitionResultsPreviousPage() {
      state.judokaCompetitionResultsCurrentPage = Math.max(
        state.judokaCompetitionResultsCurrentPage - 1,
        1
      );
    }

    function showCompetitionResultsNextPage() {
      state.judokaCompetitionResultsCurrentPage += 1;
    }

    function showJudokaProfile(idJudoka: string, keepMessage?: boolean) {
      if (!keepMessage) {
        clearMessage();
      }
      currentJudokaId = idJudoka;
      loadJudokaProfile(idJudoka);
    }

    return {
      showJudokaProfile
    };
  }

  window.createKirokuJudokaScreen = createKirokuJudokaScreen;
})();
