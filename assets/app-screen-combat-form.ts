(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CombatScoreFormRow = import("./types").CombatScoreFormRow;
  type CombatFormDeps = import("./types").CombatFormDeps;
  type CombatDataQualityIssue = import("./types").CombatDataQualityIssue;

  const {
    createEmptyCombatScoreRow,
    isCombatScoreRowComplete,
    neWazaTechniques: NE_WAZA_TECHNIQUES,
    tachiWazaTechniques: TACHI_WAZA_TECHNIQUES
  } = window.KirokuCompetitionFormHelpers;

  function createKirokuCombatFormScreen(app: KirokuApp, deps: CombatFormDeps) {
    const { state, ui, notifications } = app;
    const { $, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { getCurrentCompetition, openCompetition } = deps;

    const defaultCombatForm = {
      combatId: "",
      opponent: "",
      opponentStance: "",
      result: "",
      victoryType: "",
      scores: [] as CombatScoreFormRow[],
      notes: ""
    };
    const defaultCombatFormViewState = {
      combatFormTitle: "Ajouter un combat",
      combatFormSubtitle: "Combat de la compétition en cours",
      saveCombatButtonText: "Enregistrer",
      combatForm: { ...defaultCombatForm }
    };

    const combatFormViewModel = window.Vue.reactive({
      ...defaultCombatFormViewState,
      combatForm: { ...defaultCombatForm, scores: [] as CombatScoreFormRow[] }
    });
    let combatFormMounted = false;

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const combatDecisionOptions = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result));
    const showCombatDecisionBlock = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result).length > 0);
    const neWazaTechniques = window.Vue.computed(() => NE_WAZA_TECHNIQUES);
    const tachiWazaTechniques = window.Vue.computed(() => TACHI_WAZA_TECHNIQUES);
    const combatFormDataQualityIssues = window.Vue.computed((): CombatDataQualityIssue[] => {
      const form = combatFormViewModel.combatForm;
      if (!form.result) {
        return [];
      }
      const issues: CombatDataQualityIssue[] = [];
      if (getCombatDecisionOptions(form.result).length && !form.victoryType) {
        issues.push({ label: "Fin du combat non renseignée", priority: "high", field: "victoryType" });
      }
      const hasMissingIpponScore =
        form.result === "Victoire" &&
        form.victoryType === "Ippon" &&
        !form.scores.some((score) => score.value === "Ippon");
      if (hasMissingIpponScore) {
        issues.push({
          label: "Ippon indiqué, mais aucun point Ippon détaillé",
          priority: "high",
          field: "scores"
        });
      }
      if (!form.scores.length && !hasMissingIpponScore) {
        issues.push({ label: "Points marqués non renseignés", priority: "medium", field: "scores" });
      }
      if (!form.opponentStance) {
        issues.push({
          label: "Droitier/gaucher de l'adversaire non renseigné",
          priority: "medium",
          field: "opponentStance"
        });
      }
      return issues;
    });
    const combatFormVictoryTypeIssues = window.Vue.computed(() =>
      combatFormDataQualityIssues.value.filter((issue) => issue.field === "victoryType")
    );
    const combatFormScoreIssues = window.Vue.computed(() =>
      combatFormDataQualityIssues.value.filter((issue) => issue.field === "scores")
    );
    const combatFormOpponentStanceIssues = window.Vue.computed(() =>
      combatFormDataQualityIssues.value.filter((issue) => issue.field === "opponentStance")
    );

    function ensureCombatFormViewModel() {
      if (combatFormMounted) {
        return;
      }
      combatFormMounted = true;
      ui.mountViewModel(
        "combatFormView",
        combatFormViewModel,
        {
          addCombatScoreRow,
          cancelCombatForm,
          onCombatScoreCategoryChange,
          removeCombatScoreRow,
          saveCombat,
          syncCombatDecisionVisibility
        },
        {
          combatDecisionOptions,
          combatFormVictoryTypeIssues,
          combatFormScoreIssues,
          combatFormOpponentStanceIssues,
          isSubmitting,
          neWazaTechniques,
          showCombatDecisionBlock,
          tachiWazaTechniques
        }
      );
    }

    function showCombatForm(id?: string | Event) {
      clearMessage();
      ensureCombatFormViewModel();
      resetCombatForm();
      const combatId = id && typeof id === "object" && "type" in id ? "" : id;
      const competitionName = getCurrentCompetition().name;
      let isEditingExistingCombat = false;

      if (combatId) {
        const combat = state.currentCombats.find((c) => String(c.combatId) === String(combatId));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        isEditingExistingCombat = true;
        Object.assign(combatFormViewModel, {
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: competitionName || "",
          saveCombatButtonText: "Enregistrer"
        });
        Object.assign(combatFormViewModel.combatForm, {
          combatId: combat.combatId || "",
          opponent: combat.opponent || "",
          opponentStance: combat.opponentStance || "",
          result: combat.result || "",
          victoryType: combat.victoryType || "",
          scores: (combat.scores || []).map((score) => ({
            category: score.category || "",
            technique: score.technique || "",
            neWazaType: score.neWazaType || "",
            value: score.value || ""
          })),
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
      window.Vue.nextTick(() => $(getCombatFormFocusTarget(isEditingExistingCombat)).focus());
    }

    function getCombatFormFocusTarget(isEditingExistingCombat: boolean): string {
      const form = combatFormViewModel.combatForm;
      if (!isEditingExistingCombat || !form.result) {
        return "combat_resultat";
      }
      if (getCombatDecisionOptions(form.result).length && !form.victoryType) {
        return "combat_type_victoire";
      }
      if (!form.opponent) {
        return "combat_adversaire";
      }
      if (!form.opponentStance) {
        return "combat_garde_adversaire";
      }
      return "saveCombatButton";
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
        scores: combatFormViewModel.combatForm.scores.filter(isCombatScoreRowComplete),
        notes: combatFormViewModel.combatForm.notes,
        combatId: undefined as string | undefined
      };
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

    function addCombatScoreRow() {
      ensureCombatFormViewModel();
      combatFormViewModel.combatForm.scores.push(createEmptyCombatScoreRow());
    }

    function removeCombatScoreRow(index: number) {
      ensureCombatFormViewModel();
      combatFormViewModel.combatForm.scores.splice(index, 1);
    }

    function onCombatScoreCategoryChange(index: number) {
      ensureCombatFormViewModel();
      const score = combatFormViewModel.combatForm.scores[index];
      if (!score) return;
      if (score.category !== "Tachi-waza") score.technique = "";
      if (score.category !== "Ne-waza") score.neWazaType = "";
    }

    function resetCombatForm() {
      ensureCombatFormViewModel();
      Object.assign(combatFormViewModel.combatForm, defaultCombatForm, {
        scores: [] as CombatScoreFormRow[]
      });
      Object.assign(combatFormViewModel, {
        combatFormTitle: "Ajouter un combat",
        combatFormSubtitle: "Combat de la compétition en cours",
        saveCombatButtonText: "Enregistrer"
      });
      syncCombatDecisionVisibility(true);
    }

    function bindEvents() {
      ensureCombatFormViewModel();
    }

    return {
      bindEvents,
      cancelCombatForm,
      deleteCombat,
      getCombatDecisionOptions,
      saveCombat,
      showCombatForm,
      syncCombatDecisionVisibility
    };
  }

  window.createKirokuCombatFormScreen = createKirokuCombatFormScreen;
})();
