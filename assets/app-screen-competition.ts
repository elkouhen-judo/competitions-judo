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
      competitionTitle: "Compétition",
      competitionSubtitle: "",
      competitionDate: "",
      ageWeightLabel: "",
      competitionResult: "",
      canEditCompetition: false,
      canFinalizeCompetition: false,
      combats: [] as CompetitionCombatCard[],
      combatsEmptyMessage: "",
      hasCombats: false,
      isLoadingCombats: false
    };
    const defaultCompetitionForm = {
      competitionId: "",
      name: "",
      competitionDate: "",
      ageCategory: "",
      weightCategory: "",
      result: ""
    };
    const defaultCompetitionFormViewState = {
      competitionFormTitle: "Compétition",
      showCompetitionResultBlock: false,
      showCompetitionOwnerBlock: false,
      ownerJudokaText: "",
      ownerJudokaId: "",
      ownerOptions: [] as CompetitionOwnerOption[],
      showOwnerOptions: false,
      competitionForm: { ...defaultCompetitionForm }
    };
    const defaultClubCompetitionFormViewState = {
      clubCompetitionFormTitle: "Nouvelle compétition club",
      clubCompetitionParticipants: [] as ClubCompetitionJudokaOption[],
      filteredClubCompetitionParticipants: [] as ClubCompetitionJudokaOption[],
      clubCompetitionFormParticipantsPage: [] as ClubCompetitionJudokaOption[],
      clubCompetitionFormParticipantsTotalPages: 1,
      clubCompetitionFormParticipantsCurrentPage: 1,
      clubCompetitionFormParticipantsTotalCount: 0,
      clubCompetitionFormParticipantsCanShowPreviousPage: false,
      clubCompetitionFormParticipantsCanShowNextPage: false,
      judokaSearchText: "",
      clubCompetitionForm: {
        clubCompetitionId: "",
        name: "",
        competitionDate: "",
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
      clubCompetitionParticipantsPage: [] as ClubCompetitionParticipantCard[],
      clubCompetitionParticipantsTotalPages: 1,
      clubCompetitionParticipantsCurrentPage: 1,
      clubCompetitionParticipantsTotalCount: 0,
      clubCompetitionParticipantsCanShowPreviousPage: false,
      clubCompetitionParticipantsCanShowNextPage: false,
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      filteredClubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      clubCompetitionAvailableJudokasPage: [] as ClubCompetitionJudokaOption[],
      clubCompetitionAvailableJudokasTotalPages: 1,
      clubCompetitionAvailableJudokasCurrentPage: 1,
      clubCompetitionAvailableJudokasTotalCount: 0,
      clubCompetitionAvailableJudokasCanShowPreviousPage: false,
      clubCompetitionAvailableJudokasCanShowNextPage: false,
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
      result: "",
      victoryType: "",
      notes: ""
    };
    const defaultCombatFormViewState = {
      combatFormTitle: "Ajouter un combat",
      combatFormSubtitle: "Combat de la compétition en cours",
      saveCombatButtonText: "Ajouter le combat",
      showCombatDecisionBlock: false,
      combatDecisionOptions: [] as string[],
      combatForm: { ...defaultCombatForm }
    };
    let competitionDetailViewModel = defaultCompetitionDetailViewState;
    let competitionFormViewModel = defaultCompetitionFormViewState;
    let clubCompetitionFormViewModel = defaultClubCompetitionFormViewState;
    let clubCompetitionDetailViewModel = defaultClubCompetitionDetailViewState;
    let competitionFinalizationViewModel = defaultCompetitionFinalizationViewState;
    let combatFormViewModel = defaultCombatFormViewState;
    let hideOwnerOptionsTimer: number | null = null;
    let currentCompetitionReturnView: "homeView" | "clubCompetitionDetailView" = "homeView";

    function ensureCompetitionDetailViewModel() {
      if (!window.Vue || competitionDetailViewModel !== defaultCompetitionDetailViewState) {
        return;
      }

      competitionDetailViewModel = ui.createMountedViewModel(
        "competitionView",
        defaultCompetitionDetailViewState,
        {
          deleteCurrentCompetition,
          deleteCombat,
          editCurrentCompetition,
          navigateBackFromCompetition,
          showCombatForm,
          showCompetitionFinalizationForm
        }
      );
    }

    function ensureCompetitionFormViewModel() {
      if (!window.Vue || competitionFormViewModel !== defaultCompetitionFormViewState) {
        return;
      }

      competitionFormViewModel = ui.createMountedViewModel(
        "competitionFormView",
        defaultCompetitionFormViewState,
        {
          cancelCompetitionForm,
          saveCompetition,
          selectCompetitionOwner,
          showCompetitionOwnerOptions,
          updateCompetitionOwnerText
        }
      );
    }

    function ensureClubCompetitionFormViewModel() {
      if (!window.Vue || clubCompetitionFormViewModel !== defaultClubCompetitionFormViewState) {
        return;
      }

      clubCompetitionFormViewModel = ui.createMountedViewModel(
        "clubCompetitionFormView",
        defaultClubCompetitionFormViewState,
        {
          cancelClubCompetitionForm,
          saveClubCompetition,
          updateClubCompetitionJudokaSearch,
          showClubCompetitionFormParticipantsPreviousPage,
          showClubCompetitionFormParticipantsNextPage
        }
      );
    }

    function ensureClubCompetitionDetailViewModel() {
      if (!window.Vue || clubCompetitionDetailViewModel !== defaultClubCompetitionDetailViewState) {
        return;
      }

      clubCompetitionDetailViewModel = ui.createMountedViewModel(
        "clubCompetitionDetailView",
        defaultClubCompetitionDetailViewState,
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
        }
      );
    }

    function ensureCompetitionFinalizationViewModel() {
      if (!window.Vue || competitionFinalizationViewModel !== defaultCompetitionFinalizationViewState) {
        return;
      }

      competitionFinalizationViewModel = ui.createMountedViewModel(
        "competitionFinalizationView",
        defaultCompetitionFinalizationViewState,
        {
          cancelCompetitionFinalizationForm,
          finalizeCompetition
        }
      );
    }

    function ensureCombatFormViewModel() {
      if (!window.Vue || combatFormViewModel !== defaultCombatFormViewState) {
        return;
      }

      combatFormViewModel = ui.createMountedViewModel(
        "combatFormView",
        defaultCombatFormViewState,
        {
          cancelCombatForm,
          saveCombat,
          syncCombatDecisionVisibility
        }
      );
    }

    function navigateBackFromCompetition() {
      if (currentCompetitionReturnView === "clubCompetitionDetailView") {
        showView("clubCompetitionDetailView");
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

    function openCompetition(id: string, keepMessage = false) {
      if (!keepMessage) {
        clearMessage();
        currentCompetitionReturnView = "homeView";
      }
      ensureCompetitionDetailViewModel();
      Object.assign(competitionDetailViewModel, {
        competitionTitle: "Chargement...",
        competitionSubtitle: "",
        competitionDate: "",
        ageWeightLabel: "",
        competitionResult: "",
        canEditCompetition: false,
        canFinalizeCompetition: false,
        combats: [],
        combatsEmptyMessage: "Chargement des combats...",
        hasCombats: false,
        isLoadingCombats: true
      });
      showView("competitionView");

      app.runServer(
        "getCompetitionDetail",
        [id],
        (data: CompetitionDetail) => {
          state.currentCompetition = data.competition;
          state.currentCombats = Array.isArray(data.combats) ? data.combats : [];
          state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
          state.canEditCurrentCompetition = Boolean(data.canEditCompetition);

          renderCompetitionDetail();
          renderCombats();
        },
        showError
      );
    }

    function renderCompetitionDetail() {
      ensureCompetitionDetailViewModel();
      if (!state.currentCompetition) {
        return;
      }
      Object.assign(
        competitionDetailViewModel,
        window.KirokuScreenProjections.projectCompetitionDetail(
          state.currentCompetition,
          state.canEditCurrentCompetition,
          {
            formatDate
          }
        )
      );
    }

    function editCurrentCompetition() {
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(state.currentCompetition.competitionId);
    }

    function renderCombats() {
      ensureCompetitionDetailViewModel();
      Object.assign(
        competitionDetailViewModel,
        window.KirokuScreenProjections.projectCompetitionCombats(state.currentCombats, {
          formatResultat,
          normalizeDisplayName,
          showJudoka: state.isAdmin || state.isCoach,
          canEdit: state.canEditCurrentCompetition
        })
      );
    }

    function showCompetitionForm(id?: string) {
      clearMessage();
      ensureCompetitionFormViewModel();
      state.previousView = state.currentCompetition ? "competitionView" : "homeView";

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
          result: c.result || ""
        });
        competitionFormViewModel.showCompetitionResultBlock = true;
      } else {
        state.previousView = "homeView";
        competitionFormViewModel.competitionFormTitle = "Ajouter une compétition";
        setCompetitionOwnerField(app.screens.home.getHomeActiveJudokaId());
        Object.assign(competitionFormViewModel.competitionForm, {
          ...defaultCompetitionForm,
          competitionDate: getCurrentLocalDate()
        });
        competitionFormViewModel.showCompetitionResultBlock = false;
      }

      showView("competitionFormView");
    }

    function cancelCompetitionForm() {
      showView(state.previousView || "homeView");
    }

    function updateClubCompetitionJudokaSearch() {
      const query = cleanText(clubCompetitionFormViewModel.judokaSearchText).toLowerCase();
      const selectedIds = new Set(
        clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds.map(String)
      );
      clubCompetitionFormViewModel.filteredClubCompetitionParticipants =
        clubCompetitionFormViewModel.clubCompetitionParticipants.filter(
          (p) =>
            selectedIds.has(String(p.judokaId)) || !query || p.name.toLowerCase().includes(query)
        );
      state.clubCompetitionFormParticipantsCurrentPage = 1;
      renderClubCompetitionFormParticipantsPage();
    }

    function renderClubCompetitionFormParticipantsPage() {
      const pagination = window.KirokuScreenProjections.paginateList(
        clubCompetitionFormViewModel.filteredClubCompetitionParticipants,
        state.clubCompetitionFormParticipantsCurrentPage,
        defaultListPageSize
      );
      clubCompetitionFormViewModel.clubCompetitionFormParticipantsPage = pagination.pageItems;
      clubCompetitionFormViewModel.clubCompetitionFormParticipantsTotalPages =
        pagination.totalPages;
      clubCompetitionFormViewModel.clubCompetitionFormParticipantsCurrentPage =
        pagination.currentPage;
      clubCompetitionFormViewModel.clubCompetitionFormParticipantsTotalCount =
        pagination.totalItems;
      clubCompetitionFormViewModel.clubCompetitionFormParticipantsCanShowPreviousPage =
        pagination.canShowPreviousPage;
      clubCompetitionFormViewModel.clubCompetitionFormParticipantsCanShowNextPage =
        pagination.canShowNextPage;
      state.clubCompetitionFormParticipantsCurrentPage = pagination.currentPage;
    }

    function showClubCompetitionFormParticipantsPreviousPage() {
      state.clubCompetitionFormParticipantsCurrentPage = Math.max(
        state.clubCompetitionFormParticipantsCurrentPage - 1,
        1
      );
      renderClubCompetitionFormParticipantsPage();
    }

    function showClubCompetitionFormParticipantsNextPage() {
      state.clubCompetitionFormParticipantsCurrentPage += 1;
      renderClubCompetitionFormParticipantsPage();
    }

    function updateClubAvailableJudokaSearch() {
      const query = cleanText(
        clubCompetitionDetailViewModel.judokaAvailableSearchText
      ).toLowerCase();
      const selectedIds = new Set(
        clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds.map(String)
      );
      clubCompetitionDetailViewModel.filteredClubCompetitionAvailableJudokas =
        clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas.filter(
          (j) =>
            selectedIds.has(String(j.judokaId)) || !query || j.name.toLowerCase().includes(query)
        );
      state.clubCompetitionAvailableJudokasCurrentPage = 1;
      renderClubCompetitionAvailableJudokasPage();
    }

    function renderClubCompetitionAvailableJudokasPage() {
      const pagination = window.KirokuScreenProjections.paginateList(
        clubCompetitionDetailViewModel.filteredClubCompetitionAvailableJudokas,
        state.clubCompetitionAvailableJudokasCurrentPage,
        defaultListPageSize
      );
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokasPage = pagination.pageItems;
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokasTotalPages =
        pagination.totalPages;
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokasCurrentPage =
        pagination.currentPage;
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokasTotalCount =
        pagination.totalItems;
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokasCanShowPreviousPage =
        pagination.canShowPreviousPage;
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokasCanShowNextPage =
        pagination.canShowNextPage;
      state.clubCompetitionAvailableJudokasCurrentPage = pagination.currentPage;
    }

    function showClubCompetitionAvailableJudokasPreviousPage() {
      state.clubCompetitionAvailableJudokasCurrentPage = Math.max(
        state.clubCompetitionAvailableJudokasCurrentPage - 1,
        1
      );
      renderClubCompetitionAvailableJudokasPage();
    }

    function showClubCompetitionAvailableJudokasNextPage() {
      state.clubCompetitionAvailableJudokasCurrentPage += 1;
      renderClubCompetitionAvailableJudokasPage();
    }

    function renderClubCompetitionParticipantsPage() {
      const pagination = window.KirokuScreenProjections.paginateList(
        clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants,
        state.clubCompetitionParticipantsCurrentPage,
        defaultListPageSize
      );
      clubCompetitionDetailViewModel.clubCompetitionParticipantsPage = pagination.pageItems;
      clubCompetitionDetailViewModel.clubCompetitionParticipantsTotalPages = pagination.totalPages;
      clubCompetitionDetailViewModel.clubCompetitionParticipantsCurrentPage =
        pagination.currentPage;
      clubCompetitionDetailViewModel.clubCompetitionParticipantsTotalCount = pagination.totalItems;
      clubCompetitionDetailViewModel.clubCompetitionParticipantsCanShowPreviousPage =
        pagination.canShowPreviousPage;
      clubCompetitionDetailViewModel.clubCompetitionParticipantsCanShowNextPage =
        pagination.canShowNextPage;
      state.clubCompetitionParticipantsCurrentPage = pagination.currentPage;
    }

    function showClubCompetitionParticipantsPreviousPage() {
      state.clubCompetitionParticipantsCurrentPage = Math.max(
        state.clubCompetitionParticipantsCurrentPage - 1,
        1
      );
      renderClubCompetitionParticipantsPage();
    }

    function showClubCompetitionParticipantsNextPage() {
      state.clubCompetitionParticipantsCurrentPage += 1;
      renderClubCompetitionParticipantsPage();
    }

    function showClubCompetitionForm() {
      clearMessage();
      ensureClubCompetitionFormViewModel();
      const allParticipants = state.judokas.map((j) => ({
        judokaId: String(j.judokaId || ""),
        name: getJudokaDisplayName(j) || "Judoka"
      }));
      clubCompetitionFormViewModel.clubCompetitionParticipants = allParticipants;
      clubCompetitionFormViewModel.filteredClubCompetitionParticipants = allParticipants;
      clubCompetitionFormViewModel.judokaSearchText = "";
      Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
        clubCompetitionId: "",
        name: "",
        competitionDate: getCurrentLocalDate(),
        participantJudokaIds: []
      });
      state.clubCompetitionFormParticipantsCurrentPage = 1;
      renderClubCompetitionFormParticipantsPage();
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
          renderClubCompetitionParticipantsPage();
          const available = state.judokas
            .filter((j) => !participantJudokaIds.has(String(j.judokaId)))
            .map((j) => ({
              judokaId: String(j.judokaId || ""),
              name: getJudokaDisplayName(j) || "Judoka"
            }));
          clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas = available;
          clubCompetitionDetailViewModel.filteredClubCompetitionAvailableJudokas = available;
          clubCompetitionDetailViewModel.judokaAvailableSearchText = "";
          clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [];
          state.clubCompetitionAvailableJudokasCurrentPage = 1;
          renderClubCompetitionAvailableJudokasPage();
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

    function detachClubCompetitionParticipant(idClubCompetition: string, idCompetition: string) {
      app.confirmAndRun({
        message: "Retirer ce judoka de la compétition club sans supprimer ses résultats ?",
        method: "detachClubCompetitionParticipant",
        args: [idClubCompetition, idCompetition],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialData();
        }
      });
    }

    function getCompetitionOwnerRequiredMessage() {
      return state.isAdmin
        ? "Sélectionnez un judoka avant d'enregistrer la compétition."
        : "Sélectionnez votre profil ou l'un de vos enfants avant d'enregistrer la compétition.";
    }

    function saveCompetition() {
      ensureCompetitionFormViewModel();
      const competition = {
        competitionId: competitionFormViewModel.competitionForm.competitionId,
        name: competitionFormViewModel.competitionForm.name,
        competitionDate: competitionFormViewModel.competitionForm.competitionDate,
        ageCategory: competitionFormViewModel.competitionForm.ageCategory,
        weightCategory: competitionFormViewModel.competitionForm.weightCategory,
        result: competitionFormViewModel.competitionForm.result,
        ownerJudokaId: undefined as string | undefined
      };

      if (state.isAdmin || state.isParent) {
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
          app.reloadInitialData(response.competitionId);
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
          result: combat.result || "",
          victoryType: combat.victoryType || "",
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
        result,
        victoryType:
          result === "Egalité" ? "Hiki wake" : combatFormViewModel.combatForm.victoryType,
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
      if (!state.isAdmin && !state.isParent) {
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

    function renderCombatDecisionOptions(result: string) {
      ensureCombatFormViewModel();
      const options = getCombatDecisionOptions(result);
      const currentValue = combatFormViewModel.combatForm.victoryType;
      combatFormViewModel.combatDecisionOptions = options;

      if (options.includes(currentValue)) {
        combatFormViewModel.combatForm.victoryType = currentValue;
      } else if (result === "Egalité") {
        combatFormViewModel.combatForm.victoryType = "Hiki wake";
      } else {
        combatFormViewModel.combatForm.victoryType = "";
      }
    }

    function syncCombatDecisionVisibility(clearValueWhenHidden: boolean) {
      ensureCombatFormViewModel();
      const result = combatFormViewModel.combatForm.result;
      const shouldShow = getCombatDecisionOptions(result).length > 0;
      renderCombatDecisionOptions(result);
      combatFormViewModel.showCombatDecisionBlock = shouldShow;

      if (!shouldShow && clearValueWhenHidden) {
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
      cancelCombatForm,
      cancelCompetitionFinalizationForm,
      cancelCompetitionForm,
      confirmDetachClubParticipant,
      deleteCombat,
      deleteCompetitionFromList,
      deleteCurrentCompetition,
      detachClubCompetitionParticipant,
      editCurrentCompetition,
      finalizeCompetition,
      getCompetitionOwnerRequiredMessage,
      getJudokaSecondaryText,
      getCombatDecisionOptions,
      hideCompetitionOwnerOptions,
      openClubCompetition,
      openCompetition,
      renderCombatDecisionOptions,
      renderCombats,
      renderCompetitionDetail,
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
