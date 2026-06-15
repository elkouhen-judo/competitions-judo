(() => {
  function createKirokuCompetitionScreen(app) {
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
      combats: [],
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
      ownerOptions: [],
      showOwnerOptions: false,
      competitionForm: { ...defaultCompetitionForm }
    };
    const defaultClubCompetitionFormViewState = {
      clubCompetitionFormTitle: "Créer une compétition club",
      clubCompetitionParticipants: [],
      filteredClubCompetitionParticipants: [],
      clubCompetitionFormParticipantsPage: [],
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
        participantJudokaIds: []
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
      clubCompetitionCurrentParticipants: [],
      clubCompetitionParticipantsPage: [],
      clubCompetitionParticipantsTotalPages: 1,
      clubCompetitionParticipantsCurrentPage: 1,
      clubCompetitionParticipantsTotalCount: 0,
      clubCompetitionParticipantsCanShowPreviousPage: false,
      clubCompetitionParticipantsCanShowNextPage: false,
      clubCompetitionAvailableJudokas: [],
      filteredClubCompetitionAvailableJudokas: [],
      clubCompetitionAvailableJudokasPage: [],
      clubCompetitionAvailableJudokasTotalPages: 1,
      clubCompetitionAvailableJudokasCurrentPage: 1,
      clubCompetitionAvailableJudokasTotalCount: 0,
      clubCompetitionAvailableJudokasCanShowPreviousPage: false,
      clubCompetitionAvailableJudokasCanShowNextPage: false,
      judokaAvailableSearchText: "",
      clubCompetitionNewJudokaIds: []
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
      combatDecisionOptions: [],
      combatForm: { ...defaultCombatForm }
    };
    let competitionDetailViewModel = null;
    let competitionFormViewModel = null;
    let clubCompetitionFormViewModel = null;
    let clubCompetitionDetailViewModel = null;
    let competitionFinalizationViewModel = null;
    let combatFormViewModel = null;
    let hideOwnerOptionsTimer = null;
    let currentCompetitionReturnView = "homeView";

    function ensureCompetitionDetailViewModel() {
      if (!window.Vue || competitionDetailViewModel) {
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
      if (!window.Vue || competitionFormViewModel) {
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
      if (!window.Vue || clubCompetitionFormViewModel) {
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
      if (!window.Vue || clubCompetitionDetailViewModel) {
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
      if (!window.Vue || competitionFinalizationViewModel) {
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
      if (!window.Vue || combatFormViewModel) {
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
        app.showHome();
      }
    }

    function openCompetitionFromClubDetail(competitionId) {
      openCompetition(competitionId);
      currentCompetitionReturnView = "clubCompetitionDetailView";
    }

    function openCompetition(id, keepMessage) {
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
        (data) => {
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

    function showCompetitionForm(id) {
      clearMessage();
      ensureCompetitionFormViewModel();
      state.previousView = state.currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c =
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

    function openClubCompetition(id) {
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
        (data) => {
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

    function confirmDetachClubParticipant(clubCompetitionId, competitionId, judokaName) {
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

    function confirmDeleteClubCompetitionById(clubCompetitionId, name) {
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

    function detachClubCompetitionParticipant(idClubCompetition, idCompetition) {
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
        result: competitionFormViewModel.competitionForm.result
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

    function showCombatForm(id) {
      clearMessage();
      ensureCombatFormViewModel();
      resetCombatForm();
      const combatId = id && typeof id === "object" && "type" in id ? "" : id;

      if (combatId) {
        const combat = state.currentCombats.find((c) => String(c.combatId) === String(combatId));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        Object.assign(combatFormViewModel, {
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: state.currentCompetition.name || "",
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
          combatFormSubtitle: state.currentCompetition.name || ""
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

      const combat = getCombatFormValue();

      app.runServer(
        "ajouterCombat",
        [combat],
        (response) => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(state.currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function updateCombat(idCombat) {
      const combat = getCombatFormValue();
      combat.combatId = idCombat;

      app.runServer(
        "updateCombat",
        [combat],
        (response) => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(state.currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function getCombatFormValue() {
      ensureCombatFormViewModel();
      const result = combatFormViewModel.combatForm.result;
      return {
        competitionId: state.currentCompetition.competitionId,
        judokaId: state.currentCompetition.ownerJudokaId,
        opponent: combatFormViewModel.combatForm.opponent,
        result,
        victoryType:
          result === "Egalité" ? "Hiki wake" : combatFormViewModel.combatForm.victoryType,
        notes: combatFormViewModel.combatForm.notes
      };
    }

    function deleteCurrentCompetition() {
      if (!state.currentCompetition) return;

      const label = state.currentCompetition.name ? ` "${state.currentCompetition.name}"` : "";
      app.confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [state.currentCompetition.competitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          state.currentCompetition = null;
          app.reloadInitialData();
        }
      });
    }

    function deleteCompetitionFromList(id, name) {
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

    function deleteCombat(id) {
      app.confirmAndRun({
        message: "Supprimer ce combat ?",
        method: "deleteCombat",
        args: [id],
        onSuccess: (response) => {
          showSuccess(response.message);
          openCompetition(state.currentCompetition.competitionId, true);
        }
      });
    }

    function normalizeJudokaSelectionKey(value) {
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
        return [getJudokaDisplayName(j), ui.getCompactJudokaLabel(j), j && j.judokaId].some(
          (label) => normalizeJudokaSelectionKey(label) === typedValue
        );
      });

      if (matches.length === 1) {
        const resolvedId = String(matches[0].judokaId || "");
        competitionFormViewModel.ownerJudokaId = resolvedId;
        competitionFormViewModel.ownerJudokaText = getJudokaDisplayName(matches[0]);
        return resolvedId;
      }

      return "";
    }

    function setCompetitionOwnerField(idJudoka) {
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

    function getJudokaSecondaryText(judoka) {
      if (cleanText(judoka.accountEmail)) {
        return judoka.accountEmail;
      }

      return `ID ${String(judoka.judokaId || "").slice(-6)}`;
    }

    function getJudokaSearchText(judoka) {
      return `${getJudokaDisplayName(judoka)} ${getJudokaSecondaryText(judoka)}`.toLowerCase();
    }

    function getOwnerOption(judoka) {
      return {
        judokaId: String(judoka.judokaId || ""),
        name: getJudokaDisplayName(judoka) || "Judoka",
        meta: getJudokaSecondaryText(judoka),
        searchText: getJudokaSearchText(judoka)
      };
    }

    function refreshCompetitionOwnerOptions(queryOverride) {
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

    function selectCompetitionOwner(option) {
      if (hideOwnerOptionsTimer) {
        window.clearTimeout(hideOwnerOptionsTimer);
        hideOwnerOptionsTimer = null;
      }
      competitionFormViewModel.ownerJudokaId = option ? option.judokaId : "";
      competitionFormViewModel.ownerJudokaText = option ? option.name : "";
      competitionFormViewModel.showOwnerOptions = false;
    }

    function getCombatDecisionOptions(result) {
      if (result === "Victoire" || result === "Défaite") {
        return ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait"];
      }
      if (result === "Egalité") {
        return ["Hiki wake"];
      }
      return [];
    }

    function renderCombatDecisionOptions(result) {
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

    function syncCombatDecisionVisibility(clearValueWhenHidden) {
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
