(() => {
  function createKirokuCompetitionScreen(app) {
    const { state, ui, notifications } = app;
    const {
      $,
      cleanText,
      formatDate,
      formatResultat,
      getCurrentLocalDate,
      getJudokaDisplayName,
      normalizeDisplayName,
      toInputDate,
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;
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
      clubCompetitionForm: {
        clubCompetitionId: "",
        name: "",
        competitionDate: "",
        ageCategory: "",
        weightCategory: "",
        participantJudokaIds: []
      }
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
    let competitionFinalizationViewModel = null;
    let combatFormViewModel = null;
    let hideOwnerOptionsTimer = null;

    function ensureCompetitionDetailViewModel() {
      if (!window.Vue || competitionDetailViewModel) {
        return;
      }

      competitionDetailViewModel = ui.createMountedViewModel("competitionView", defaultCompetitionDetailViewState, {
        deleteCurrentCompetition,
        deleteCombat,
        editCurrentCompetition,
        showCombatForm,
        showCompetitionFinalizationForm,
        showHome: () => app.showHome()
      });
    }

    function ensureCompetitionFormViewModel() {
      if (!window.Vue || competitionFormViewModel) {
        return;
      }

      competitionFormViewModel = ui.createMountedViewModel("competitionFormView", defaultCompetitionFormViewState, {
        cancelCompetitionForm,
        saveCompetition,
        selectCompetitionOwner,
        showCompetitionOwnerOptions,
        updateCompetitionOwnerText
      });
    }

    function ensureClubCompetitionFormViewModel() {
      if (!window.Vue || clubCompetitionFormViewModel) {
        return;
      }

      clubCompetitionFormViewModel = ui.createMountedViewModel("clubCompetitionFormView", defaultClubCompetitionFormViewState, {
        cancelClubCompetitionForm,
        saveClubCompetition
      });
    }

    function ensureCompetitionFinalizationViewModel() {
      if (!window.Vue || competitionFinalizationViewModel) {
        return;
      }

      competitionFinalizationViewModel = ui.createMountedViewModel("competitionFinalizationView", defaultCompetitionFinalizationViewState, {
        cancelCompetitionFinalizationForm,
        finalizeCompetition
      });
    }

    function ensureCombatFormViewModel() {
      if (!window.Vue || combatFormViewModel) {
        return;
      }

      combatFormViewModel = ui.createMountedViewModel("combatFormView", defaultCombatFormViewState, {
        cancelCombatForm,
        saveCombat,
        syncCombatDecisionVisibility
      });
    }

    function openCompetition(id, keepMessage) {
      if (!keepMessage) {
        clearMessage();
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
        data => {
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
      Object.assign(competitionDetailViewModel, window.KirokuScreenProjections.projectCompetitionDetail(
        state.currentCompetition,
        state.canEditCurrentCompetition,
        {
          formatDate
        }
      ));
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
      Object.assign(competitionDetailViewModel, window.KirokuScreenProjections.projectCompetitionCombats(
        state.currentCombats,
        {
          formatResultat,
          normalizeDisplayName,
          showJudoka: state.isAdmin || state.isCoach,
          canEdit: state.canEditCurrentCompetition
        }
      ));
    }

    function showCompetitionForm(id) {
      clearMessage();
      ensureCompetitionFormViewModel();
      state.previousView = state.currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c = state.competitions.find(x => String(x.competitionId) === String(id)) || state.currentCompetition;

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

    function showClubCompetitionForm() {
      clearMessage();
      ensureClubCompetitionFormViewModel();
      clubCompetitionFormViewModel.clubCompetitionParticipants = state.judokas.map(j => ({
        judokaId: String(j.judokaId || ""),
        name: getJudokaDisplayName(j) || "Judoka"
      }));
      Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
        clubCompetitionId: "",
        name: "",
        competitionDate: getCurrentLocalDate(),
        ageCategory: "",
        weightCategory: "",
        participantJudokaIds: []
      });
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
        response => {
          showSuccess(response.message);
          app.reloadInitialData();
        },
        showError
      );
    }

    function detachClubCompetitionParticipant(idClubCompetition, idCompetition) {
      app.confirmAndRun({
        message: "Retirer ce judoka de la compétition club sans supprimer ses résultats ?",
        method: "detachClubCompetitionParticipant",
        args: [idClubCompetition, idCompetition],
        onSuccess: response => {
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
        response => {
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
        response => {
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
        const combat = state.currentCombats.find(c => String(c.combatId) === String(combatId));

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
        response => {
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
        response => {
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
        victoryType: result === "Egalité" ? "Hiki wake" : combatFormViewModel.combatForm.victoryType,
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
        onSuccess: response => {
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
        onSuccess: response => {
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
        onSuccess: response => {
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

      if (hiddenValue && state.judokas.some(j => String(j.judokaId) === hiddenValue)) {
        return hiddenValue;
      }

      const typedValue = normalizeJudokaSelectionKey(competitionFormViewModel.ownerJudokaText);
      if (!typedValue) {
        const activeJudokaId = String(app.screens.home.getHomeActiveJudokaId() || "").trim();
        if (activeJudokaId && state.judokas.some(j => String(j.judokaId) === activeJudokaId)) {
          competitionFormViewModel.ownerJudokaId = activeJudokaId;
          return activeJudokaId;
        }
        return "";
      }

      const matches = state.judokas.filter(j => {
        return [
          getJudokaDisplayName(j),
          ui.getCompactJudokaLabel(j),
          j && j.judokaId
        ].some(label => normalizeJudokaSelectionKey(label) === typedValue);
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

      const owner = state.judokas.find(j => String(j.judokaId) === String(idJudoka));
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
      const query = queryOverride !== undefined
        ? cleanText(queryOverride).toLowerCase()
        : cleanText(competitionFormViewModel.ownerJudokaText).toLowerCase();
      competitionFormViewModel.ownerOptions = state.judokas
        .map(getOwnerOption)
        .filter(option => !query || option.searchText.includes(query));
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
      cancelClubCompetitionForm,
      cancelCombatForm,
      cancelCompetitionFinalizationForm,
      cancelCompetitionForm,
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
      openCompetition,
      renderCombatDecisionOptions,
      renderCombats,
      renderCompetitionDetail,
      resolveCompetitionOwnerSelection,
      saveCombat,
      saveClubCompetition,
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
