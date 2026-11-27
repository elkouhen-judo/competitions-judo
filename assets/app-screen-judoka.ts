(() => {
  type KirokuApp = import("./types").KirokuApp;
  type JudokaProfileViewModel = import("./types").JudokaProfileViewModel;

  function createKirokuJudokaScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      formatCompetitionName,
      formatCompetitionRanking,
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
      viewedJudokaId: "",
      profileEditing: false
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
      heroYearInCategory: "",
      heroHandedness: "",
      heroUnregistered: "",
      heroSeason: "",
      seasonCompetitionCount: "0",
      seasonCombatCount: "0",
      seasonWins: "0",
      seasonLosses: "0",
      seasonDraws: "0",
      victoryRate: "0 %",
      winShare: 0,
      lossShare: 0,
      heroBeltBackground: "",
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
          // UI-2 : dates en clair sur la fiche.
          formatDate: ui.formatDateLong,
          formatCompetitionName,
          formatCompetitionRanking,
          getJudokaDisplayName,
          getJudokaInitials,
          getCurrentLocalDate: ui.getCurrentLocalDate,
          formatRelativeDay: ui.formatRelativeDay,
          formatCountdown: ui.formatCountdown,
          getBeltBackground: ui.getBeltBackground,
          isRegisteredForDate: ui.isRegisteredForDate
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
    // V2 A : « Judo Club Nantes · Ceinture orange · Homme » sous le nom.
    const profileSubtitle = window.Vue.computed(() => {
      const judoka = state.currentJudokaProfile?.judoka;
      const club = judoka ? state.clubs.find((candidate) => candidate.clubId === String(judoka.clubId || "")) : null;
      return [club ? club.name : "", judokaProfile.value.profileSubtitle].filter(Boolean).join(" · ");
    });
    const heroBeltBackground = window.Vue.computed(() => judokaProfile.value.heroBeltBackground);
    const winShare = window.Vue.computed(() => judokaProfile.value.winShare);
    const lossShare = window.Vue.computed(() => judokaProfile.value.lossShare);
    const heroAvatar = window.Vue.computed(() => judokaProfile.value.heroAvatar);
    const heroName = window.Vue.computed(() => judokaProfile.value.heroName);
    const heroSummary = window.Vue.computed(() => judokaProfile.value.heroSummary);
    const heroCategory = window.Vue.computed(() => judokaProfile.value.heroCategory);
    const heroWeightCategory = window.Vue.computed(() => judokaProfile.value.heroWeightCategory);
    const heroYearInCategory = window.Vue.computed(() => judokaProfile.value.heroYearInCategory);
    const heroHandedness = window.Vue.computed(() => judokaProfile.value.heroHandedness);
    const heroUnregistered = window.Vue.computed(() => judokaProfile.value.heroUnregistered);
    const heroSeason = window.Vue.computed(() => judokaProfile.value.heroSeason);
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
    // ADMIN-3 : les droits admin seuls ne modifient pas un profil sportif (ROL-004), le serveur le refuserait.
    const canEditJudokaInfo = window.Vue.computed(
      () => state.isCoach || isOwnProfile.value || isManagedProfile.value
    );
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);

    // V2 A : la saison en contrôle segmenté, de la plus ancienne connue à la saison en cours.
    const seasonOptions = window.Vue.computed(() => {
      const current = getCurrentSeasonStartYear();
      const displayed = getDisplayedSeasonStartYear() ?? current;
      const judokaId = String(state.currentJudokaProfile?.judoka?.judokaId || "");
      const knownYears = [
        displayed,
        current - 1,
        ...state.competitions
          .filter((competition) => String(competition.ownerJudokaId) === judokaId)
          .map((competition) => ui.getSeasonStartYear(competition.competitionDate)),
        state.oldestCompetitionDate ? ui.getSeasonStartYear(state.oldestCompetitionDate) : null
      ].filter((year): year is number => typeof year === "number");
      const oldest = Math.min(...knownYears);
      const years = [];
      for (let year = oldest; year <= current; year += 1) years.push(year);
      return years.map((year) => ({ year, label: ui.formatSeasonLabel(year), isActive: year === displayed }));
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
          judokaLocalState.profileEditing = false;
          state.judokaCompetitionResultsCurrentPage = 1;
          showView("judokaView");
        },
        notifications.showError
      );
    }

    function selectSeason(seasonStartYear: number) {
      if (!currentJudokaId || seasonStartYear === getDisplayedSeasonStartYear()) return;
      loadJudokaProfile(currentJudokaId, seasonStartYear);
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
          startProfileEdit: () => {
            judokaLocalState.profileEditing = true;
            window.Vue.nextTick(() =>
              document.getElementById("judokaProfileEditSection")?.scrollIntoView({ behavior: "smooth", block: "start" })
            );
          },
          cancelProfileEdit: () => {
            judokaLocalState.profileEditing = false;
          },
          selectSeason,
          onChoiceKeydown: ui.onChoiceKeydown,
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
          heroYearInCategory,
          heroHandedness,
          heroUnregistered,
          heroSeason,
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
          seasonOptions,
          heroBeltBackground,
          winShare,
          lossShare,
          canEditJudokaInfo,
          isManagedProfile,
          isOwnProfile,
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
