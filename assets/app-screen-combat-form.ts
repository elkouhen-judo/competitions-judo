(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CombatScoreFormRow = import("./types").CombatScoreFormRow;
  type CombatFormDeps = import("./types").CombatFormDeps;
  type CombatDataQualityIssue = import("./types").CombatDataQualityIssue;

  const {
    createEmptyCombatScoreRow,
    isCombatScoreRowComplete,
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
      saveCombatButtonText: "Ajouter le combat",
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
    const tachiWazaTechniques = window.Vue.computed(() => TACHI_WAZA_TECHNIQUES);
    const combatFormDataQualityIssues = window.Vue.computed((): CombatDataQualityIssue[] => {
      const form = combatFormViewModel.combatForm;
      if (!form.result) {
        return [];
      }
      const issues: CombatDataQualityIssue[] = [];
      if (getCombatDecisionOptions(form.result).length && !form.victoryType) {
        issues.push({ label: "Type de décision non renseigné", priority: "high", field: "victoryType" });
      }
      if (
        form.result === "Victoire" &&
        form.victoryType === "Ippon" &&
        !form.scores.some((score) => score.value === "Ippon")
      ) {
        issues.push({
          label: "Décision Ippon sans prise marquée à Ippon",
          priority: "high",
          field: "scores"
        });
      }
      if (!form.scores.length) {
        issues.push({ label: "Prises marquées non renseignées", priority: "medium", field: "scores" });
      }
      if (!form.opponentStance) {
        issues.push({
          label: "Garde adversaire non renseignée",
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
      window.Vue.nextTick(() => $("combat_resultat").focus());
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
        saveCombatButtonText: "Ajouter le combat"
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
