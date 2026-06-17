(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;
  type Competition = import("../core/types").Competition;
  type CompetitionDetail = import("../core/types").CompetitionDetail;
  type ClubCompetitionDetail = import("../core/types").ClubCompetitionDetail;
  type CompetitionCombatCard = import("./types").CompetitionCombatCard;

  interface CompetitionOwnerOption {
    judokaId: string;
    name: string;
    meta: string;
    searchText: string;
  }

  interface ClubCompetitionJudokaOption {
    judokaId: string;
    name: string;
    ageCategory: string;
  }

  interface ClubCompetitionParticipantCard {
    competitionId: string;
    judokaName: string;
    result: string;
    resultClass: string;
  }

  function createKirokuCompetitionScreen(app: KirokuApp) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      $,
      cleanText,
      formatDate,
      formatResultat,
      getClassementBadgeClass,
      getCurrentLocalDate,
      getJudokaDisplayName,
      normalizeDisplayName,
      toInputDate,
      showView
    } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
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
      ownerJudokaText: "",
      ownerJudokaId: "",
      ownerOptions: [] as CompetitionOwnerOption[],
      showOwnerOptions: false,
      competitionForm: { ...defaultCompetitionForm }
    };
    const defaultClubCompetitionFormViewState = {
      clubCompetitionFormTitle: "Nouvelle compétition",
      clubCompetitionParticipants: [] as ClubCompetitionJudokaOption[],
      judokaSearchText: "",
      clubCompetitionForm: {
        clubCompetitionId: "",
        name: "",
        competitionDate: "",
        ageCategory: "",
        participantJudokaIds: [] as string[]
      }
    };
    const defaultClubCompetitionDetailViewState = {
      clubCompetitionDetailTitle: "Compétition club",
      clubCompetitionDetailForm: {
        clubCompetitionId: "",
        name: "",
        competitionDate: "",
        ageCategory: "",
        weightCategory: ""
      },
      clubCompetitionCurrentParticipants: [] as ClubCompetitionParticipantCard[],
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      judokaAvailableSearchText: "",
      clubCompetitionNewJudokaIds: [] as string[]
    };
    const defaultCompetitionFinalizationViewState = {
      finalizationSubtitle: "",
      finalizationForm: {
        competitionId: "",
        result: ""
      }
    };
    const defaultCombatForm = {
      combatId: "",
      opponent: "",
      opponentStance: "",
      result: "",
      victoryType: "",
      techniqueCategory: "",
      notes: ""
    };
    const defaultCombatFormViewState = {
      combatFormTitle: "Ajouter un combat",
      combatFormSubtitle: "Combat de la compétition en cours",
      saveCombatButtonText: "Ajouter le combat",
      combatForm: { ...defaultCombatForm }
    };
    let competitionDetailRef: { coachObjectiveText: string; coachReviewText: string } | null = null;
    let competitionDetailMounted = false;
    const competitionFormViewModel = window.Vue.reactive({
      ...defaultCompetitionFormViewState,
      competitionForm: { ...defaultCompetitionFormViewState.competitionForm }
    });
    let competitionFormMounted = false;
    const clubCompetitionFormViewModel = window.Vue.reactive({
      ...defaultClubCompetitionFormViewState,
      clubCompetitionForm: { ...defaultClubCompetitionFormViewState.clubCompetitionForm, participantJudokaIds: [] as string[] }
    });
    let clubCompetitionFormMounted = false;
    const clubCompetitionDetailViewModel = window.Vue.reactive({
      ...defaultClubCompetitionDetailViewState,
      clubCompetitionDetailForm: { ...defaultClubCompetitionDetailViewState.clubCompetitionDetailForm },
      clubCompetitionCurrentParticipants: [] as ClubCompetitionParticipantCard[],
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      clubCompetitionNewJudokaIds: [] as string[]
    });
    let clubCompetitionDetailMounted = false;
    const competitionFinalizationViewModel = window.Vue.reactive({
      ...defaultCompetitionFinalizationViewState,
      finalizationForm: { ...defaultCompetitionFinalizationViewState.finalizationForm }
    });
    let competitionFinalizationMounted = false;
    const combatFormViewModel = window.Vue.reactive({
      ...defaultCombatFormViewState,
      combatForm: { ...defaultCombatForm }
    });
    let combatFormMounted = false;
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
    const competitionLevel = window.Vue.computed(() => state.currentCompetition?.level ?? "");
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
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

    const showCoachAssessment = window.Vue.computed(() =>
      Boolean(state.isCoach || state.currentCompetition?.coachObjective || state.currentCompetition?.coachReview)
    );
    const canEditCoachAssessment = window.Vue.computed(() => state.isCoach);

    const combatDecisionOptions = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result));
    const showCombatDecisionBlock = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result).length > 0);

    const clubCompetitionFormParticipantsFiltered = window.Vue.computed(() => {
      const query = cleanText(clubCompetitionFormViewModel.judokaSearchText).toLowerCase();
      const ageCategory = cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory);
      if (!ageCategory) {
        return [];
      }

      const selectedIds = new Set(
        clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds.map(String)
      );
      return clubCompetitionFormViewModel.clubCompetitionParticipants.filter(
        (p) =>
          p.ageCategory === ageCategory &&
          (selectedIds.has(String(p.judokaId)) || !query || p.name.toLowerCase().includes(query))
      );
    });
    const hasClubCompetitionFormAgeCategory = window.Vue.computed(() =>
      Boolean(cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory))
    );
    const clubCompetitionFormParticipantsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        clubCompetitionFormParticipantsFiltered.value,
        state.clubCompetitionFormParticipantsCurrentPage,
        defaultListPageSize
      )
    );
    const clubCompetitionFormParticipantsPage = window.Vue.computed(() => clubCompetitionFormParticipantsPagination.value.pageItems);
    const clubCompetitionFormParticipantsTotalPages = window.Vue.computed(() => clubCompetitionFormParticipantsPagination.value.totalPages);
    const clubCompetitionFormParticipantsCurrentPage = window.Vue.computed(() => clubCompetitionFormParticipantsPagination.value.currentPage);
    const clubCompetitionFormParticipantsTotalCount = window.Vue.computed(() => clubCompetitionFormParticipantsPagination.value.totalItems);
    const clubCompetitionFormParticipantsCanShowPreviousPage = window.Vue.computed(() => clubCompetitionFormParticipantsPagination.value.canShowPreviousPage);
    const clubCompetitionFormParticipantsCanShowNextPage = window.Vue.computed(() => clubCompetitionFormParticipantsPagination.value.canShowNextPage);

    const clubCompetitionAvailableJudokasFiltered = window.Vue.computed(() => {
      const query = cleanText(clubCompetitionDetailViewModel.judokaAvailableSearchText).toLowerCase();
      const ageCategory = cleanText(clubCompetitionDetailViewModel.clubCompetitionDetailForm.ageCategory);
      const selectedIds = new Set(clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds.map(String));
      return clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas.filter(
        (j) =>
          (!ageCategory || j.ageCategory === ageCategory) &&
          (selectedIds.has(String(j.judokaId)) || !query || j.name.toLowerCase().includes(query))
      );
    });
    const clubCompetitionAvailableJudokasPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        clubCompetitionAvailableJudokasFiltered.value,
        state.clubCompetitionAvailableJudokasCurrentPage,
        defaultListPageSize
      )
    );
    const clubCompetitionAvailableJudokasPage = window.Vue.computed(() => clubCompetitionAvailableJudokasPagination.value.pageItems);
    const clubCompetitionAvailableJudokasTotalPages = window.Vue.computed(() => clubCompetitionAvailableJudokasPagination.value.totalPages);
    const clubCompetitionAvailableJudokasCurrentPage = window.Vue.computed(() => clubCompetitionAvailableJudokasPagination.value.currentPage);
    const clubCompetitionAvailableJudokasTotalCount = window.Vue.computed(() => clubCompetitionAvailableJudokasPagination.value.totalItems);
    const clubCompetitionAvailableJudokasCanShowPreviousPage = window.Vue.computed(() => clubCompetitionAvailableJudokasPagination.value.canShowPreviousPage);
    const clubCompetitionAvailableJudokasCanShowNextPage = window.Vue.computed(() => clubCompetitionAvailableJudokasPagination.value.canShowNextPage);

    const clubCompetitionParticipantsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants,
        state.clubCompetitionParticipantsCurrentPage,
        defaultListPageSize
      )
    );
    const clubCompetitionParticipantsPage = window.Vue.computed(() => clubCompetitionParticipantsPagination.value.pageItems);
    const clubCompetitionParticipantsTotalPages = window.Vue.computed(() => clubCompetitionParticipantsPagination.value.totalPages);
    const clubCompetitionParticipantsCurrentPage = window.Vue.computed(() => clubCompetitionParticipantsPagination.value.currentPage);
    const clubCompetitionParticipantsTotalCount = window.Vue.computed(() => clubCompetitionParticipantsPagination.value.totalItems);
    const clubCompetitionParticipantsCanShowPreviousPage = window.Vue.computed(() => clubCompetitionParticipantsPagination.value.canShowPreviousPage);
    const clubCompetitionParticipantsCanShowNextPage = window.Vue.computed(() => clubCompetitionParticipantsPagination.value.canShowNextPage);

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
          saveCompetition,
          selectCompetitionOwner,
          showCompetitionOwnerOptions,
          updateCompetitionOwnerText,
          hideCompetitionOwnerOptions
        },
        { isSubmitting }
      );
    }

    function ensureClubCompetitionFormViewModel() {
      if (clubCompetitionFormMounted) {
        return;
      }
      clubCompetitionFormMounted = true;
      ui.mountViewModel(
        "clubCompetitionFormView",
        clubCompetitionFormViewModel,
        {
          cancelClubCompetitionForm,
          saveClubCompetition,
          updateClubCompetitionAgeCategory,
          updateClubCompetitionJudokaSearch,
          showClubCompetitionFormParticipantsPreviousPage,
          showClubCompetitionFormParticipantsNextPage
        },
        {
          isSubmitting,
          clubCompetitionFormParticipantsFiltered,
          clubCompetitionFormParticipantsPage,
          clubCompetitionFormParticipantsTotalPages,
          clubCompetitionFormParticipantsCurrentPage,
          clubCompetitionFormParticipantsTotalCount,
          clubCompetitionFormParticipantsCanShowPreviousPage,
          clubCompetitionFormParticipantsCanShowNextPage,
          hasClubCompetitionFormAgeCategory
        }
      );
    }

    function ensureClubCompetitionDetailViewModel() {
      if (clubCompetitionDetailMounted) {
        return;
      }
      clubCompetitionDetailMounted = true;
      ui.mountViewModel(
        "clubCompetitionDetailView",
        clubCompetitionDetailViewModel,
        {
          cancelClubCompetitionDetail,
          confirmDeleteClubCompetition,
          confirmDetachClubParticipant,
          openCompetitionFromClubDetail,
          saveClubCompetitionDetails,
          updateClubAvailableJudokaSearch,
          showClubCompetitionParticipantsPreviousPage,
          showClubCompetitionParticipantsNextPage,
          showClubCompetitionAvailableJudokasPreviousPage,
          showClubCompetitionAvailableJudokasNextPage
        },
        {
          isSubmitting,
          clubCompetitionParticipantsPage,
          clubCompetitionParticipantsTotalPages,
          clubCompetitionParticipantsCurrentPage,
          clubCompetitionParticipantsTotalCount,
          clubCompetitionParticipantsCanShowPreviousPage,
          clubCompetitionParticipantsCanShowNextPage,
          clubCompetitionAvailableJudokasFiltered,
          clubCompetitionAvailableJudokasPage,
          clubCompetitionAvailableJudokasTotalPages,
          clubCompetitionAvailableJudokasCurrentPage,
          clubCompetitionAvailableJudokasTotalCount,
          clubCompetitionAvailableJudokasCanShowPreviousPage,
          clubCompetitionAvailableJudokasCanShowNextPage
        }
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

    function ensureCombatFormViewModel() {
      if (combatFormMounted) {
        return;
      }
      combatFormMounted = true;
      ui.mountViewModel(
        "combatFormView",
        combatFormViewModel,
        {
          cancelCombatForm,
          saveCombat,
          syncCombatDecisionVisibility
        },
        { combatDecisionOptions, isSubmitting, showCombatDecisionBlock }
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

    function updateClubCompetitionJudokaSearch() {
      state.clubCompetitionFormParticipantsCurrentPage = 1;
    }

    function updateClubCompetitionAgeCategory() {
      const ageCategory = cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory);
      const allowedIds = new Set(
        clubCompetitionFormViewModel.clubCompetitionParticipants
          .filter((participant) => !ageCategory || participant.ageCategory === ageCategory)
          .map((participant) => String(participant.judokaId))
      );
      clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds =
        clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds.filter((id) =>
          allowedIds.has(String(id))
        );
      state.clubCompetitionFormParticipantsCurrentPage = 1;
    }

    function showClubCompetitionFormParticipantsPreviousPage() {
      state.clubCompetitionFormParticipantsCurrentPage = Math.max(
        state.clubCompetitionFormParticipantsCurrentPage - 1,
        1
      );
    }

    function showClubCompetitionFormParticipantsNextPage() {
      state.clubCompetitionFormParticipantsCurrentPage += 1;
    }

    function updateClubAvailableJudokaSearch() {
      state.clubCompetitionAvailableJudokasCurrentPage = 1;
    }

    function showClubCompetitionAvailableJudokasPreviousPage() {
      state.clubCompetitionAvailableJudokasCurrentPage = Math.max(
        state.clubCompetitionAvailableJudokasCurrentPage - 1,
        1
      );
    }

    function showClubCompetitionAvailableJudokasNextPage() {
      state.clubCompetitionAvailableJudokasCurrentPage += 1;
    }

    function showClubCompetitionParticipantsPreviousPage() {
      state.clubCompetitionParticipantsCurrentPage = Math.max(
        state.clubCompetitionParticipantsCurrentPage - 1,
        1
      );
    }

    function showClubCompetitionParticipantsNextPage() {
      state.clubCompetitionParticipantsCurrentPage += 1;
    }

    function showClubCompetitionForm() {
      clearMessage();
      ensureClubCompetitionFormViewModel();
      const allParticipants = state.judokas.map((j) => ({
        judokaId: String(j.judokaId || ""),
        name: getJudokaDisplayName(j) || "Judoka",
        ageCategory: String(j.ageCategory || "")
      }));
      clubCompetitionFormViewModel.clubCompetitionParticipants = allParticipants;
      clubCompetitionFormViewModel.judokaSearchText = "";
      Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
        clubCompetitionId: "",
        name: "",
        competitionDate: getCurrentLocalDate(),
        ageCategory: "",
        participantJudokaIds: []
      });
      state.clubCompetitionFormParticipantsCurrentPage = 1;
      showView("clubCompetitionFormView");
    }

    function cancelClubCompetitionForm() {
      showView("homeView");
    }

    function saveClubCompetition() {
      ensureClubCompetitionFormViewModel();
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      app.runServer(
        "saveClubCompetition",
        [form],
        (response) => {
          showSuccess(response.message);
          app.reloadInitialData();
        },
        showError
      );
    }

    function openClubCompetition(id: string) {
      clearMessage();
      ensureClubCompetitionDetailViewModel();
      clubCompetitionDetailViewModel.clubCompetitionDetailTitle = "Chargement...";
      clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants = [];
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas = [];
      clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [];
      showView("clubCompetitionDetailView");

      app.runServer(
        "getClubCompetitionDetail",
        [id],
        (data: ClubCompetitionDetail) => {
          const cc = data.clubCompetition;
          const judokasById = new Map(data.judokas.map((j) => [String(j.judokaId), j]));
          const participantJudokaIds = new Set(
            data.participations.map((p) => String(p.ownerJudokaId))
          );

          Object.assign(clubCompetitionDetailViewModel.clubCompetitionDetailForm, {
            clubCompetitionId: cc.id_club_competition || "",
            name: cc.nom || "",
            competitionDate: cc.date || "",
            ageCategory: cc.categorie_age || "",
            weightCategory: cc.categorie_poids || ""
          });
          clubCompetitionDetailViewModel.clubCompetitionDetailTitle = cc.nom || "Compétition club";
          clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants =
            data.participations.map((p) => {
              const judoka = judokasById.get(String(p.ownerJudokaId));
              return {
                competitionId: p.competitionId || "",
                judokaName: judoka ? getJudokaDisplayName(judoka) : String(p.ownerJudokaId),
                result: p.result || "Non classé",
                resultClass: getClassementBadgeClass(p.result)
              };
            });
          state.clubCompetitionParticipantsCurrentPage = 1;
          const available = state.judokas
            .filter((j) => !participantJudokaIds.has(String(j.judokaId)))
            .map((j) => ({
              judokaId: String(j.judokaId || ""),
              name: getJudokaDisplayName(j) || "Judoka",
              ageCategory: String(j.ageCategory || "")
            }));
          clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas = available;
          clubCompetitionDetailViewModel.judokaAvailableSearchText = "";
          clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [];
          state.clubCompetitionAvailableJudokasCurrentPage = 1;
        },
        showError
      );
    }

    function saveClubCompetitionDetails() {
      ensureClubCompetitionDetailViewModel();
      const form = clubCompetitionDetailViewModel.clubCompetitionDetailForm;
      app.runServer(
        "saveClubCompetition",
        [
          {
            clubCompetitionId: form.clubCompetitionId,
            name: form.name,
            competitionDate: form.competitionDate,
            ageCategory: form.ageCategory,
            weightCategory: form.weightCategory,
            participantJudokaIds: clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds
          }
        ],
        (response) => {
          showSuccess(response.message);
          openClubCompetition(form.clubCompetitionId);
        },
        showError
      );
    }

    function confirmDetachClubParticipant(
      clubCompetitionId: string,
      competitionId: string,
      judokaName: string
    ) {
      app.confirmAndRun({
        message: `Retirer ${judokaName} de cette compétition club ? Ses résultats individuels seront conservés.`,
        method: "detachClubCompetitionParticipant",
        args: [clubCompetitionId, competitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          openClubCompetition(clubCompetitionId);
        }
      });
    }

    function cancelClubCompetitionDetail() {
      showView("homeView");
    }

    function confirmDeleteClubCompetition() {
      ensureClubCompetitionDetailViewModel();
      const clubCompetitionId =
        clubCompetitionDetailViewModel.clubCompetitionDetailForm.clubCompetitionId;
      const name = clubCompetitionDetailViewModel.clubCompetitionDetailTitle;
      confirmDeleteClubCompetitionById(clubCompetitionId, name);
    }

    function confirmDeleteClubCompetitionById(clubCompetitionId: string, name?: string) {
      app.confirmAndRun({
        message: `Supprimer la compétition club "${name}" ? Les compétitions et combats individuels des judokas associés seront aussi supprimés.`,
        method: "deleteClubCompetition",
        args: [clubCompetitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialData();
        }
      });
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

    function showCombatForm(id?: string | Event) {
      clearMessage();
      ensureCombatFormViewModel();
      resetCombatForm();
      const combatId = id && typeof id === "object" && "type" in id ? "" : id;
      const competitionName = getCurrentCompetition().name;

      if (combatId) {
        const combat = state.currentCombats.find((c) => String(c.combatId) === String(combatId));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        Object.assign(combatFormViewModel, {
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: competitionName || "",
          saveCombatButtonText: "Enregistrer le combat"
        });
        Object.assign(combatFormViewModel.combatForm, {
          combatId: combat.combatId || "",
          opponent: combat.opponent || "",
          opponentStance: combat.opponentStance || "",
          result: combat.result || "",
          victoryType: combat.victoryType || "",
          techniqueCategory: combat.techniqueCategory || "",
          notes: combat.notes || ""
        });
        syncCombatDecisionVisibility(false);
      } else {
        Object.assign(combatFormViewModel, {
          combatFormTitle: "Ajouter un combat",
          combatFormSubtitle: competitionName || ""
        });
        syncCombatDecisionVisibility(true);
      }

      showView("combatFormView");
      window.Vue.nextTick(() => $("combat_adversaire").focus());
    }

    function cancelCombatForm() {
      resetCombatForm();
      showView("competitionView");
    }

    function saveCombat() {
      ensureCombatFormViewModel();
      const idCombat = combatFormViewModel.combatForm.combatId;

      if (idCombat) {
        updateCombat(idCombat);
      } else {
        addCombat();
      }
    }

    function addCombat() {
      if (!state.currentCompetition) {
        showError({ message: "Ouvre une compétition avant d'ajouter un combat." });
        return;
      }

      const competitionId = state.currentCompetition.competitionId;
      const combat = getCombatFormValue();

      app.runServer(
        "ajouterCombat",
        [combat],
        (response) => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(competitionId, true);
        },
        showError
      );
    }

    function updateCombat(idCombat: string) {
      const competitionId = getCurrentCompetition().competitionId;
      const combat = getCombatFormValue();
      combat.combatId = idCombat;

      app.runServer(
        "updateCombat",
        [combat],
        (response) => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(competitionId, true);
        },
        showError
      );
    }

    function getCombatFormValue() {
      ensureCombatFormViewModel();
      const competition = getCurrentCompetition();
      const result = combatFormViewModel.combatForm.result;
      return {
        competitionId: competition.competitionId,
        judokaId: competition.ownerJudokaId,
        opponent: combatFormViewModel.combatForm.opponent,
        opponentStance: combatFormViewModel.combatForm.opponentStance,
        result,
        victoryType:
          result === "Egalité" ? "Hiki wake" : combatFormViewModel.combatForm.victoryType,
        techniqueCategory: combatFormViewModel.combatForm.techniqueCategory,
        notes: combatFormViewModel.combatForm.notes,
        combatId: undefined as string | undefined
      };
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

    function deleteCompetitionFromList(id: string, name?: string) {
      const label = name ? ` "${name}"` : "";
      app.confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [id],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialData();
        }
      });
    }

    function deleteCombat(id: string) {
      const competitionId = getCurrentCompetition().competitionId;
      app.confirmAndRun({
        message: "Supprimer ce combat ?",
        method: "deleteCombat",
        args: [id],
        onSuccess: (response) => {
          showSuccess(response.message);
          openCompetition(competitionId, true);
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

    function getCombatDecisionOptions(result: string): string[] {
      if (result === "Victoire" || result === "Défaite") {
        return ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait"];
      }
      if (result === "Egalité") {
        return ["Hiki wake"];
      }
      return [];
    }

    function syncCombatDecisionVisibility(clearValueWhenHidden: boolean) {
      ensureCombatFormViewModel();
      const result = combatFormViewModel.combatForm.result;
      const options = getCombatDecisionOptions(result);
      if (result === "Egalité") {
        combatFormViewModel.combatForm.victoryType = "Hiki wake";
      } else if (!options.length && clearValueWhenHidden) {
        combatFormViewModel.combatForm.victoryType = "";
      } else if (!options.includes(combatFormViewModel.combatForm.victoryType)) {
        combatFormViewModel.combatForm.victoryType = "";
      }
    }

    function resetCombatForm() {
      ensureCombatFormViewModel();
      Object.assign(combatFormViewModel.combatForm, defaultCombatForm);
      Object.assign(combatFormViewModel, {
        combatFormTitle: "Ajouter un combat",
        combatFormSubtitle: "Combat de la compétition en cours",
        saveCombatButtonText: "Ajouter le combat"
      });
      syncCombatDecisionVisibility(true);
    }

    function bindEvents() {
      ensureCombatFormViewModel();
    }

    return {
      bindEvents,
      cancelClubCompetitionDetail,
      cancelClubCompetitionForm,
      confirmDeleteClubCompetition,
      confirmDeleteClubCompetitionById,
      navigateBackFromCompetition,
      openCompetitionFromClubDetail,
      openCompetitionFromJudokaProfile,
      cancelCombatForm,
      cancelCompetitionFinalizationForm,
      cancelCompetitionForm,
      confirmDetachClubParticipant,
      deleteCombat,
      deleteCompetitionFromList,
      deleteCurrentCompetition,
      editCurrentCompetition,
      finalizeCompetition,
      getCompetitionOwnerRequiredMessage,
      getJudokaSecondaryText,
      getCombatDecisionOptions,
      hideCompetitionOwnerOptions,
      openClubCompetition,
      openCompetition,
      resolveCompetitionOwnerSelection,
      saveCombat,
      saveClubCompetition,
      saveClubCompetitionDetails,
      saveCompetition,
      selectCompetitionOwner,
      showCompetitionOwnerOptions,
      showCombatForm,
      showClubCompetitionForm,
      showCompetitionFinalizationForm,
      showCompetitionForm,
      syncCombatDecisionVisibility,
      updateCompetitionOwnerText
    };
  }

  window.createKirokuCompetitionScreen = createKirokuCompetitionScreen;
})();
