(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;
  type Competition = import("../core/types").Competition;
  type CompetitionDetail = import("../core/types").CompetitionDetail;
  type CompetitionDetailDeps = import("./types").CompetitionDetailDeps;

  interface CompetitionOwnerOption {
    judokaId: string;
    name: string;
    meta: string;
    searchText: string;
  }

  function createKirokuCompetitionDetailScreen(app: KirokuApp, deps: CompetitionDetailDeps) {
    const { state, ui, notifications } = app;
    const {
      cleanText,
      formatDate,
      formatResultat,
      getCurrentLocalDate,
      getJudokaDisplayName,
      normalizeDisplayName,
      toInputDate,
      showView
    } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { showCombatForm, deleteCombat } = deps;

    const defaultCompetitionDetailViewState = {
      coachObjectiveText: "",
      coachReviewText: ""
    };
    const defaultCompetitionForm = {
      competitionId: "",
      name: "",
      competitionDate: "",
      ageCategory: "",
      weightCategory: "",
      level: "",
      result: ""
    };
    const defaultCompetitionFormViewState = {
      competitionFormTitle: "Compétition",
      showCompetitionOwnerBlock: false,
      competitionInheritedFieldsLocked: false,
      ownerJudokaText: "",
      ownerJudokaId: "",
      ownerOptions: [] as CompetitionOwnerOption[],
      showOwnerOptions: false,
      competitionForm: { ...defaultCompetitionForm }
    };
    const defaultCompetitionFinalizationViewState = {
      finalizationSubtitle: "",
      finalizationForm: {
        competitionId: "",
        result: ""
      }
    };

    let competitionDetailRef: { coachObjectiveText: string; coachReviewText: string } | null = null;
    let competitionDetailMounted = false;
    const competitionFormViewModel = window.Vue.reactive({
      ...defaultCompetitionFormViewState,
      competitionForm: { ...defaultCompetitionFormViewState.competitionForm }
    });
    let competitionFormMounted = false;
    const competitionFinalizationViewModel = window.Vue.reactive({
      ...defaultCompetitionFinalizationViewState,
      finalizationForm: { ...defaultCompetitionFinalizationViewState.finalizationForm }
    });
    let competitionFinalizationMounted = false;
    let hideOwnerOptionsTimer: number | null = null;
    let currentCompetitionReturnView: "homeView" | "clubCompetitionDetailView" | "judokaView" = "homeView";
    let previousCompetitionFormView: "homeView" | "competitionView" = "homeView";

    const competitionDetailProjection = window.Vue.computed(() => {
      if (!state.currentCompetition) return null;
      return window.KirokuScreenProjections.projectCompetitionDetail(
        state.currentCompetition,
        state.canEditCurrentCompetition,
        { formatDate }
      );
    });

    const combatsProjection = window.Vue.computed(() =>
      window.KirokuScreenProjections.projectCompetitionCombats(state.currentCombats, {
        formatResultat,
        normalizeDisplayName,
        showJudoka: state.isCoach,
        canEdit: state.canEditCurrentCompetition
      })
    );

    const competitionTitle = window.Vue.computed(() => {
      if (state.isLoadingCompetition) return "Chargement...";
      return competitionDetailProjection.value?.competitionTitle ?? "Compétition";
    });
    const competitionSubtitle = window.Vue.computed(() => competitionDetailProjection.value?.competitionSubtitle ?? "");
    const competitionDate = window.Vue.computed(() => competitionDetailProjection.value?.competitionDate ?? "");
    const ageWeightLabel = window.Vue.computed(() => competitionDetailProjection.value?.ageWeightLabel ?? "");
    const competitionResult = window.Vue.computed(() => competitionDetailProjection.value?.competitionResult ?? "");
    const competitionAiAnalysis = window.Vue.computed(() => competitionDetailProjection.value?.competitionAiAnalysis ?? "");
    const canEditCompetition = window.Vue.computed(() => competitionDetailProjection.value?.canEditCompetition ?? false);
    const canFinalizeCompetition = window.Vue.computed(() => competitionDetailProjection.value?.canFinalizeCompetition ?? false);
    const competitionInheritedFieldsLocked = window.Vue.computed(() =>
      Boolean(competitionFormViewModel.competitionInheritedFieldsLocked)
    );
    const competitionLevel = window.Vue.computed(() => state.currentCompetition?.level ?? "");
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const competitionWeightCategoryOptions = window.Vue.computed(() =>
      window.KirokuScreenProjections.getWeightCategoryOptions(
        competitionFormViewModel.competitionForm.ageCategory
      )
    );
    const combats = window.Vue.computed(() => {
      if (state.isLoadingCompetition) return [];
      return combatsProjection.value.combats;
    });
    const combatsEmptyMessage = window.Vue.computed(() => {
      if (state.isLoadingCompetition) return "Chargement des combats...";
      return combatsProjection.value.combatsEmptyMessage;
    });
    const hasCombats = window.Vue.computed(() => !state.isLoadingCompetition && combatsProjection.value.hasCombats);
    const isLoadingCombats = window.Vue.computed(() => state.isLoadingCompetition);
    const competitionSportSummary = window.Vue.computed(() => {
      const total = state.currentCombats.length;
      const wins = state.currentCombats.filter((combat) => combat.result === "Victoire").length;
      const losses = state.currentCombats.filter((combat) => combat.result === "Défaite").length;
      const draws = state.currentCombats.filter((combat) => combat.result === "Egalité").length;
      const scoredCombats = state.currentCombats.filter((combat) => (combat.scores || []).length > 0).length;
      const victoryRate = total ? Math.round((wins / total) * 100) : 0;
      const finalizationStatus = state.currentCompetition?.result
        ? `Classement ${state.currentCompetition.result}`
        : "À finaliser";
      return {
        total,
        record: `${wins}V · ${losses}D · ${draws}N`,
        victoryRate: `${victoryRate}%`,
        scoredCombats,
        finalizationStatus
      };
    });

    const showCoachAssessment = window.Vue.computed(() =>
      Boolean(
        state.currentCompetition &&
        (state.isCoach || state.isParent || state.currentCompetition.coachObjective || state.currentCompetition.coachReview)
      )
    );
    const canEditCoachAssessment = window.Vue.computed(() => state.isCoach);

    function ensureCompetitionDetailViewModel() {
      if (competitionDetailMounted) {
        return;
      }
      competitionDetailMounted = true;
      competitionDetailRef = ui.createMountedViewModel(
        "competitionView",
        defaultCompetitionDetailViewState,
        {
          deleteCurrentCompetition,
          deleteCombat,
          editCurrentCompetition,
          navigateBackFromCompetition,
          showCombatForm,
          showCompetitionFinalizationForm,
          saveCoachObjective,
          saveCoachReview
        },
        {
          competitionTitle,
          competitionSubtitle,
          competitionDate,
          ageWeightLabel,
          competitionLevel,
          competitionResult,
          competitionAiAnalysis,
          canEditCompetition,
          canFinalizeCompetition,
          isSubmitting,
          combats,
          combatsEmptyMessage,
          hasCombats,
          isLoadingCombats,
          competitionSportSummary,
          showCoachAssessment,
          canEditCoachAssessment
        }
      );
    }

    function ensureCompetitionFormViewModel() {
      if (competitionFormMounted) {
        return;
      }
      competitionFormMounted = true;
      ui.mountViewModel(
        "competitionFormView",
        competitionFormViewModel,
        {
          cancelCompetitionForm,
          onCompetitionFormAgeCategoryChange,
          saveCompetition,
          selectCompetitionOwner,
          showCompetitionOwnerOptions,
          updateCompetitionOwnerText,
          hideCompetitionOwnerOptions
        },
        { isSubmitting, competitionInheritedFieldsLocked, competitionWeightCategoryOptions }
      );
    }

    function ensureCompetitionFinalizationViewModel() {
      if (competitionFinalizationMounted) {
        return;
      }
      competitionFinalizationMounted = true;
      ui.mountViewModel(
        "competitionFinalizationView",
        competitionFinalizationViewModel,
        {
          cancelCompetitionFinalizationForm,
          finalizeCompetition
        },
        { isSubmitting }
      );
    }

    function saveCoachObjective() {
      if (!competitionDetailRef) return;
      const competitionId = getCurrentCompetition().competitionId;
      const objective = competitionDetailRef.coachObjectiveText;
      app.runServer(
        "saveCoachObjective",
        [competitionId, objective],
        (response) => {
          showSuccess(response.message);
          if (state.currentCompetition) {
            state.currentCompetition = { ...state.currentCompetition, coachObjective: objective };
          }
        },
        showError
      );
    }

    function saveCoachReview() {
      if (!competitionDetailRef) return;
      const competitionId = getCurrentCompetition().competitionId;
      const review = competitionDetailRef.coachReviewText;
      app.runServer(
        "saveCoachReview",
        [competitionId, review],
        (response) => {
          showSuccess(response.message);
          if (state.currentCompetition) {
            state.currentCompetition = { ...state.currentCompetition, coachReview: review };
          }
        },
        showError
      );
    }

    function navigateBackFromCompetition() {
      if (currentCompetitionReturnView === "clubCompetitionDetailView") {
        showView("clubCompetitionDetailView");
      } else if (currentCompetitionReturnView === "judokaView") {
        showView("judokaView");
      } else {
        app.showHome && app.showHome();
      }
    }

    function getCurrentCompetition(): Competition {
      if (!state.currentCompetition) {
        throw new Error("Compétition introuvable.");
      }
      return state.currentCompetition;
    }

    function openCompetitionFromClubDetail(competitionId: string) {
      openCompetition(competitionId);
      currentCompetitionReturnView = "clubCompetitionDetailView";
    }

    function openCompetitionFromJudokaProfile(competitionId: string) {
      openCompetition(competitionId);
      currentCompetitionReturnView = "judokaView";
    }

    function openCompetition(id: string, keepMessage = false, onLoaded?: () => void) {
      if (!keepMessage) {
        clearMessage();
        currentCompetitionReturnView = "homeView";
      }
      ensureCompetitionDetailViewModel();
      state.currentCompetition = null;
      state.currentCombats = [];
      state.isLoadingCompetition = true;
      showView("competitionView");

      app.runServer(
        "getCompetitionDetail",
        [id],
        (data: CompetitionDetail) => {
          state.currentCompetition = data.competition;
          state.currentCombats = Array.isArray(data.combats) ? data.combats : [];
          state.canEditCurrentCompetition = Boolean(data.canEditCompetition);
          state.isLoadingCompetition = false;
          if (competitionDetailRef) {
            competitionDetailRef.coachObjectiveText = data.competition.coachObjective || "";
            competitionDetailRef.coachReviewText = data.competition.coachReview || "";
          }
          onLoaded?.();
        },
        (error) => {
          state.isLoadingCompetition = false;
          showError(error);
        }
      );
    }

    function editCurrentCompetition() {
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(state.currentCompetition.competitionId);
    }

    function showCompetitionForm(id?: string) {
      clearMessage();
      ensureCompetitionFormViewModel();
      previousCompetitionFormView = state.currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c: Competition | null =
          state.competitions.find((x) => String(x.competitionId) === String(id)) ||
          state.currentCompetition;

        if (!c) {
          showError({ message: "Compétition introuvable." });
          return;
        }

        competitionFormViewModel.competitionFormTitle = "Modifier la compétition";
        competitionFormViewModel.competitionInheritedFieldsLocked = Boolean(c.clubCompetitionId);
        setCompetitionOwnerField(c.ownerJudokaId || "");
        Object.assign(competitionFormViewModel.competitionForm, {
          competitionId: c.competitionId || "",
          name: c.name || "",
          competitionDate: toInputDate(c.competitionDate),
          ageCategory: c.ageCategory || "",
          weightCategory: c.weightCategory || "",
          level: c.level || "",
          result: c.result || ""
        });
      } else {
        previousCompetitionFormView = "homeView";
        competitionFormViewModel.competitionFormTitle = "Ajouter une compétition";
        competitionFormViewModel.competitionInheritedFieldsLocked = false;
        setCompetitionOwnerField(app.screens.home.getHomeActiveJudokaId());
        Object.assign(competitionFormViewModel.competitionForm, {
          ...defaultCompetitionForm,
          competitionDate: getCurrentLocalDate()
        });
      }

      showView("competitionFormView");
    }

    function cancelCompetitionForm() {
      showView(previousCompetitionFormView);
    }

    function onCompetitionFormAgeCategoryChange() {
      if (!competitionFormViewModel.competitionForm.ageCategory) {
        competitionFormViewModel.competitionForm.weightCategory = "";
      } else if (
        competitionWeightCategoryOptions.value.length &&
        !competitionWeightCategoryOptions.value.includes(competitionFormViewModel.competitionForm.weightCategory)
      ) {
        competitionFormViewModel.competitionForm.weightCategory = "";
      }
    }

    function getCompetitionOwnerRequiredMessage() {
      return "Sélectionnez votre profil ou l'un de vos enfants avant d'enregistrer la compétition.";
    }

    function saveCompetition() {
      ensureCompetitionFormViewModel();
      const isNewCompetition = !competitionFormViewModel.competitionForm.competitionId;
      const competition = {
        competitionId: competitionFormViewModel.competitionForm.competitionId,
        name: competitionFormViewModel.competitionForm.name,
        competitionDate: competitionFormViewModel.competitionForm.competitionDate,
        ageCategory: competitionFormViewModel.competitionForm.ageCategory,
        weightCategory: competitionFormViewModel.competitionForm.weightCategory,
        level: competitionFormViewModel.competitionForm.level,
        result: competitionFormViewModel.competitionForm.result,
        ownerJudokaId: undefined as string | undefined
      };

      if (!competition.ageCategory) {
        showError({ message: "Sélectionnez une catégorie d'âge avant d'enregistrer la compétition." });
        return;
      }

      if (state.isParent) {
        competition.ownerJudokaId = resolveCompetitionOwnerSelection();
        if (!competition.ownerJudokaId) {
          showError({ message: getCompetitionOwnerRequiredMessage() });
          return;
        }
      }

      app.runServer(
        "saveCompetition",
        [competition],
        (response) => {
          showSuccess(response.message);
          const competitionId = response.competitionId || "";
          if (isNewCompetition && competitionId) {
            app.reloadInitialDataThen(() => {
              openCompetition(competitionId, true, showCombatForm);
            });
          } else {
            app.reloadInitialData(competitionId);
          }
        },
        showError
      );
    }

    function showCompetitionFinalizationForm() {
      clearMessage();
      ensureCompetitionFinalizationViewModel();
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      competitionFinalizationViewModel.finalizationSubtitle = state.currentCompetition.name || "";
      Object.assign(competitionFinalizationViewModel.finalizationForm, {
        competitionId: state.currentCompetition.competitionId || "",
        result: state.currentCompetition.result || ""
      });
      showView("competitionFinalizationView");
    }

    function cancelCompetitionFinalizationForm() {
      showView("competitionView");
    }

    function finalizeCompetition() {
      ensureCompetitionFinalizationViewModel();
      const competitionId = competitionFinalizationViewModel.finalizationForm.competitionId;
      const result = competitionFinalizationViewModel.finalizationForm.result;

      app.runServer(
        "finalizeCompetition",
        [competitionId, result],
        (response) => {
          showSuccess(response.message);
          openCompetition(response.competitionId || competitionId, true);
        },
        showError
      );
    }

    function deleteCurrentCompetition() {
      if (!state.currentCompetition) return;

      const competitionId = state.currentCompetition.competitionId;
      const label = state.currentCompetition.name ? ` "${state.currentCompetition.name}"` : "";
      app.confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [competitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          state.currentCompetition = null;
          app.reloadInitialData();
        }
      });
    }

    function normalizeJudokaSelectionKey(value: string) {
      return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("fr-FR");
    }

    function resolveCompetitionOwnerSelection() {
      const hiddenValue = String(competitionFormViewModel.ownerJudokaId || "").trim();

      if (hiddenValue && state.judokas.some((j) => String(j.judokaId) === hiddenValue)) {
        return hiddenValue;
      }

      const typedValue = normalizeJudokaSelectionKey(competitionFormViewModel.ownerJudokaText);
      if (!typedValue) {
        const activeJudokaId = String(app.screens.home.getHomeActiveJudokaId() || "").trim();
        if (activeJudokaId && state.judokas.some((j) => String(j.judokaId) === activeJudokaId)) {
          competitionFormViewModel.ownerJudokaId = activeJudokaId;
          return activeJudokaId;
        }
        return "";
      }

      const matches = state.judokas.filter((j) => {
        return [getJudokaDisplayName(j), ui.getCompactJudokaLabel(j), j.judokaId].some(
          (label) => normalizeJudokaSelectionKey(label) === typedValue
        );
      });

      if (matches.length === 1) {
        const match = matches[0];
        if (!match) {
          return "";
        }
        const resolvedId = String(match.judokaId || "");
        competitionFormViewModel.ownerJudokaId = resolvedId;
        competitionFormViewModel.ownerJudokaText = getJudokaDisplayName(match);
        return resolvedId;
      }

      return "";
    }

    function setCompetitionOwnerField(idJudoka: string) {
      if (!state.isParent) {
        Object.assign(competitionFormViewModel, {
          showCompetitionOwnerBlock: false,
          ownerJudokaId: "",
          ownerJudokaText: "",
          ownerOptions: [],
          showOwnerOptions: false
        });
        return;
      }

      const owner = state.judokas.find((j) => String(j.judokaId) === String(idJudoka));
      Object.assign(competitionFormViewModel, {
        showCompetitionOwnerBlock: true,
        ownerJudokaId: owner ? String(owner.judokaId || "") : "",
        ownerJudokaText: owner ? getJudokaDisplayName(owner) : "",
        ownerOptions: [],
        showOwnerOptions: false
      });
    }

    function getJudokaSecondaryText(judoka: Judoka) {
      if (cleanText(judoka.accountEmail)) {
        return judoka.accountEmail;
      }

      return `ID ${String(judoka.judokaId || "").slice(-6)}`;
    }

    function getJudokaSearchText(judoka: Judoka) {
      return `${getJudokaDisplayName(judoka)} ${getJudokaSecondaryText(judoka)}`.toLowerCase();
    }

    function getOwnerOption(judoka: Judoka): CompetitionOwnerOption {
      return {
        judokaId: String(judoka.judokaId || ""),
        name: getJudokaDisplayName(judoka) || "Judoka",
        meta: getJudokaSecondaryText(judoka),
        searchText: getJudokaSearchText(judoka)
      };
    }

    function refreshCompetitionOwnerOptions(queryOverride?: string) {
      const query =
        queryOverride !== undefined
          ? cleanText(queryOverride).toLowerCase()
          : cleanText(competitionFormViewModel.ownerJudokaText).toLowerCase();
      competitionFormViewModel.ownerOptions = state.judokas
        .map(getOwnerOption)
        .filter((option) => !query || option.searchText.includes(query));
    }

    function showCompetitionOwnerOptions() {
      if (hideOwnerOptionsTimer) {
        window.clearTimeout(hideOwnerOptionsTimer);
        hideOwnerOptionsTimer = null;
      }
      refreshCompetitionOwnerOptions("");
      competitionFormViewModel.showOwnerOptions = true;
    }

    function hideCompetitionOwnerOptions() {
      if (hideOwnerOptionsTimer) {
        window.clearTimeout(hideOwnerOptionsTimer);
      }
      hideOwnerOptionsTimer = window.setTimeout(() => {
        competitionFormViewModel.showOwnerOptions = false;
        hideOwnerOptionsTimer = null;
      }, 120);
    }

    function updateCompetitionOwnerText() {
      competitionFormViewModel.ownerJudokaId = "";
      refreshCompetitionOwnerOptions();
      competitionFormViewModel.showOwnerOptions = true;
    }

    function selectCompetitionOwner(option: CompetitionOwnerOption | null) {
      if (hideOwnerOptionsTimer) {
        window.clearTimeout(hideOwnerOptionsTimer);
        hideOwnerOptionsTimer = null;
      }
      competitionFormViewModel.ownerJudokaId = option ? option.judokaId : "";
      competitionFormViewModel.ownerJudokaText = option ? option.name : "";
      competitionFormViewModel.showOwnerOptions = false;
    }

    return {
      cancelCompetitionFinalizationForm,
      cancelCompetitionForm,
      deleteCurrentCompetition,
      editCurrentCompetition,
      finalizeCompetition,
      getCompetitionOwnerRequiredMessage,
      getCurrentCompetition,
      getJudokaSecondaryText,
      hideCompetitionOwnerOptions,
      navigateBackFromCompetition,
      openCompetition,
      openCompetitionFromClubDetail,
      openCompetitionFromJudokaProfile,
      resolveCompetitionOwnerSelection,
      saveCompetition,
      selectCompetitionOwner,
      showCompetitionFinalizationForm,
      showCompetitionForm,
      showCompetitionOwnerOptions,
      updateCompetitionOwnerText
    };
  }

  window.createKirokuCompetitionDetailScreen = createKirokuCompetitionDetailScreen;
})();
