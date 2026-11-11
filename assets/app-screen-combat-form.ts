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

  const OTHER_TECHNIQUE_VALUE = "__autre__";

  // « scores » : points marqués par le judoka ; « concededScores » : techniques subies.
  type ScoreListKey = "scores" | "concededScores";

  function createKirokuCombatFormScreen(app: KirokuApp, deps: CombatFormDeps) {
    const { state, ui, notifications } = app;
    const { $, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { getCurrentCompetition, openCompetition } = deps;
    const canManageCombat = window.Vue.computed(
      () => !state.isLoadingCompetition && Boolean(state.currentCompetition) && state.canEditCurrentCompetition
    );

    // Même liste et même ordre que le domaine (core/domain/competitions/combat-stage).
    const COMBAT_STAGES = ["Poule", "1/32", "1/16", "1/8", "1/4", "1/2", "Repêchage", "Place de 3", "Finale"];
    const combatStageOptions = window.Vue.computed(() => COMBAT_STAGES);
    const combatResultOptions = window.Vue.computed(() => [
      { value: "Victoire", label: "Victoire", className: "choice-win" },
      { value: "Défaite", label: "Défaite", className: "choice-loss" },
      { value: "Egalité", label: "Égalité", className: "choice-draw" }
    ]);
    const combatStanceOptions = window.Vue.computed(() => ["Droitier", "Gaucher"]);
    const combatScoreValues = window.Vue.computed(() => ["Ippon", "Waza-ari", "Yuko"]);
    const combatScoreCategories = window.Vue.computed(() => [
      { value: "Tachi-waza", label: "Debout" },
      { value: "Ne-waza", label: "Au sol" }
    ]);
    const DECISION_SCORE_VALUES = ["Ippon", "Waza-ari", "Yuko"];

    const defaultCombatForm = {
      combatId: "",
      stage: "",
      opponent: "",
      opponentStance: "",
      result: "",
      victoryType: "",
      scores: [] as CombatScoreFormRow[],
      concededScores: [] as CombatScoreFormRow[],
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
      combatForm: { ...defaultCombatForm, scores: [] as CombatScoreFormRow[], concededScores: [] as CombatScoreFormRow[] },
      combatFormErrors: { result: "" }
    });
    let combatFormMounted = false;

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const combatDecisionOptions = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result));
    const showCombatDecisionBlock = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result).length > 0);
    const neWazaTechniques = window.Vue.computed(() => NE_WAZA_TECHNIQUES);
    const tachiWazaTechniques = window.Vue.computed(() => TACHI_WAZA_TECHNIQUES);
    const otherTechniqueValue = window.Vue.computed(() => OTHER_TECHNIQUE_VALUE);
    const combatFormDataQualityIssues = window.Vue.computed((): CombatDataQualityIssue[] => {
      const form = combatFormViewModel.combatForm;
      if (!form.result) {
        return [];
      }
      const issues: CombatDataQualityIssue[] = [];
      if (getCombatDecisionOptions(form.result).length && !form.victoryType) {
        issues.push({ label: "Fin du combat non renseignée", shortLabel: "fin du combat", priority: "high", field: "victoryType" });
      }
      const hasMissingIpponScore =
        form.result === "Victoire" &&
        form.victoryType === "Ippon" &&
        !form.scores.some((score) => score.value === "Ippon");
      if (hasMissingIpponScore) {
        issues.push({
          label: "Ippon indiqué, mais aucun point Ippon détaillé",
          shortLabel: "détail du point Ippon",
          priority: "high",
          field: "scores"
        });
      }
      if (!form.scores.length && !hasMissingIpponScore) {
        issues.push({ label: "Points marqués non renseignés", shortLabel: "points marqués", priority: "medium", field: "scores" });
      }
      if (!form.opponentStance) {
        issues.push({
          label: "Droitier/gaucher de l'adversaire non renseigné",
          shortLabel: "garde de l'adversaire",
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
          deleteCombatFromForm,
          getScoreTechnique,
          getScoreTechniqueOptions,
          getScoreTechniqueSelectValue,
          isCustomScoreTechnique,
          onCombatScoreCategoryChange,
          removeCombatScoreRow,
          saveCombat,
          saveCombatAndNext,
          selectCombatDecision,
          selectCombatResult,
          selectCombatScoreCategory,
          selectCombatStage,
          selectCombatStance,
          selectScoreTechnique,
          setScoreTechnique,
          syncCombatDecisionVisibility
        },
        {
          combatDecisionOptions,
          combatResultOptions,
          combatScoreCategories,
          combatScoreValues,
          combatStageOptions,
          combatStanceOptions,
          combatFormVictoryTypeIssues,
          combatFormScoreIssues,
          combatFormOpponentStanceIssues,
          isSubmitting,
          neWazaTechniques,
          otherTechniqueValue,
          showCombatDecisionBlock,
          tachiWazaTechniques
        }
      );
    }

    function showCombatForm(id?: string | Event, focusField?: string) {
      clearMessage();
      if (!canManageCombat.value) {
        showError({ message: "Attends le chargement de la compétition avant d'ajouter un combat." });
        return;
      }
      ensureCombatFormViewModel();
      resetCombatForm();
      const combatId = id && typeof id === "object" && "type" in id ? "" : id;
      const competitionName = ui.formatCompetitionName(getCurrentCompetition().name);
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
          stage: combat.stage || "",
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
          concededScores: (combat.concededScores || []).map((score) => ({
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
      window.Vue.nextTick(() => {
        const target = focusField || getCombatFormFocusTarget(isEditingExistingCombat);
        // Le bouton Enregistrer est en bas du formulaire : le focaliser ne doit pas faire défiler la page,
        // sinon le haut du formulaire (tour, résultat) sort de l'écran à l'ouverture.
        $(target).focus({ preventScroll: target === "saveCombatButton" });
      });
    }

    function getCombatFormFocusTarget(isEditingExistingCombat: boolean): string {
      const form = combatFormViewModel.combatForm;
      if (!isEditingExistingCombat) {
        return form.stage ? "combat_resultat" : "combat_etape";
      }
      if (!form.result) {
        return "combat_resultat";
      }
      if (getCombatDecisionOptions(form.result).length && !form.victoryType) {
        return "combat_type_victoire";
      }
      if (!form.opponent) {
        return "combat_adversaire";
      }
      if (!form.stage) {
        return "combat_etape";
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

    // COMBAT-2 : le résultat est vérifié avant tout appel serveur, l'erreur s'affiche sous le champ.
    function validateCombatForm(): boolean {
      combatFormViewModel.combatFormErrors.result = combatFormViewModel.combatForm.result
        ? ""
        : "Choisissez le résultat du combat.";
      if (combatFormViewModel.combatFormErrors.result) {
        window.Vue.nextTick(() => $("combat_resultat").focus());
        return false;
      }
      return true;
    }

    function saveCombat() {
      ensureCombatFormViewModel();
      if (!validateCombatForm()) return;
      const idCombat = combatFormViewModel.combatForm.combatId;

      if (idCombat) {
        updateCombat(idCombat);
      } else {
        addCombat();
      }
    }

    // COMBAT-3 : enregistre puis rouvre un formulaire vide avec l'étape suivante proposée.
    function saveCombatAndNext() {
      ensureCombatFormViewModel();
      if (!validateCombatForm()) return;
      const nextStage = getNextCombatStage(combatFormViewModel.combatForm.stage, combatFormViewModel.combatForm.result);
      addCombat(() => {
        showCombatForm();
        combatFormViewModel.combatForm.stage = nextStage;
        window.Vue.nextTick(() => $("combat_resultat").focus());
      });
    }

    function getNextCombatStage(stage: string, result: string): string {
      if (!stage || stage === "Poule" || stage === "Finale" || stage === "Place de 3") return stage === "Poule" ? "Poule" : "";
      if (result === "Défaite") {
        if (stage === "1/2" || stage === "Repêchage") return "Place de 3";
        if (stage === "1/4") return "Repêchage";
        return "";
      }
      if (stage === "Repêchage") return "Place de 3";
      const next: Record<string, string> = { "1/32": "1/16", "1/16": "1/8", "1/8": "1/4", "1/4": "1/2", "1/2": "Finale" };
      return next[stage] || "";
    }

    function selectCombatStage(stage: string) {
      const form = combatFormViewModel.combatForm;
      form.stage = form.stage === stage ? "" : stage;
    }

    function selectCombatResult(result: string) {
      combatFormViewModel.combatForm.result = result;
      combatFormViewModel.combatFormErrors.result = "";
      syncCombatDecisionVisibility(true);
    }

    // COMBAT-1 : la fin du combat crée la ligne de point correspondante pour ne pas saisir deux fois.
    function selectCombatDecision(decision: string) {
      const form = combatFormViewModel.combatForm;
      form.victoryType = form.victoryType === decision && form.result !== "Egalité" ? "" : decision;
      if (
        form.result === "Victoire" &&
        DECISION_SCORE_VALUES.includes(form.victoryType) &&
        !form.scores.some((score) => score.value === form.victoryType)
      ) {
        form.scores.push({ ...createEmptyCombatScoreRow(), value: form.victoryType });
      }
      // Défaite sur un point : la technique subie correspondante est préparée.
      if (
        form.result === "Défaite" &&
        DECISION_SCORE_VALUES.includes(form.victoryType) &&
        !form.concededScores.some((score) => score.value === form.victoryType)
      ) {
        form.concededScores.push({ ...createEmptyCombatScoreRow(), value: form.victoryType });
      }
    }

    function selectCombatStance(stance: string) {
      const form = combatFormViewModel.combatForm;
      form.opponentStance = form.opponentStance === stance ? "" : stance;
    }

    function getScoreList(list: ScoreListKey = "scores"): CombatScoreFormRow[] {
      return list === "concededScores"
        ? combatFormViewModel.combatForm.concededScores
        : combatFormViewModel.combatForm.scores;
    }

    function selectCombatScoreCategory(index: number, category: string, list: ScoreListKey = "scores") {
      const score = getScoreList(list)[index];
      if (!score) return;
      if (score.category !== category) score.customTechnique = false;
      score.category = category;
      onCombatScoreCategoryChange(index, list);
    }

    // COMBAT-TECH : la technique se choisit dans la liste, ou se saisit librement via « Autre technique… ».
    function getScoreTechniqueOptions(score: CombatScoreFormRow): string[] {
      return score.category === "Ne-waza" ? NE_WAZA_TECHNIQUES : TACHI_WAZA_TECHNIQUES;
    }

    function getScoreTechnique(score: CombatScoreFormRow): string {
      return score.category === "Ne-waza" ? score.neWazaType : score.technique;
    }

    function isCustomScoreTechnique(score: CombatScoreFormRow): boolean {
      const technique = getScoreTechnique(score);
      return Boolean(score.customTechnique) || (Boolean(technique) && !getScoreTechniqueOptions(score).includes(technique));
    }

    function getScoreTechniqueSelectValue(score: CombatScoreFormRow): string {
      return isCustomScoreTechnique(score) ? OTHER_TECHNIQUE_VALUE : getScoreTechnique(score);
    }

    function setScoreTechnique(index: number, value: string, list: ScoreListKey = "scores") {
      const score = getScoreList(list)[index];
      if (!score) return;
      const technique = String(value || "").trim();
      if (score.category === "Ne-waza") score.neWazaType = technique;
      else score.technique = technique;
    }

    function selectScoreTechnique(index: number, value: string, list: ScoreListKey = "scores") {
      const score = getScoreList(list)[index];
      if (!score) return;
      if (value === OTHER_TECHNIQUE_VALUE) {
        score.customTechnique = true;
        setScoreTechnique(index, "", list);
        const inputId = list === "concededScores" ? `combat_custom_technique_concededScores_${index}` : `combat_custom_technique_${index}`;
        window.Vue.nextTick(() => {
          const input = document.getElementById(inputId);
          if (input) input.focus();
        });
        return;
      }
      score.customTechnique = false;
      setScoreTechnique(index, value, list);
    }

    function deleteCombatFromForm() {
      const combatId = combatFormViewModel.combatForm.combatId;
      if (combatId) deleteCombat(combatId);
    }

    function addCombat(afterReload?: () => void) {
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
          openCompetition(competitionId, true, afterReload);
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
        stage: combatFormViewModel.combatForm.stage,
        opponent: combatFormViewModel.combatForm.opponent,
        opponentStance: combatFormViewModel.combatForm.opponentStance,
        result,
        victoryType:
          result === "Egalité" ? "Hiki wake" : combatFormViewModel.combatForm.victoryType,
        scores: combatFormViewModel.combatForm.scores.filter(isCombatScoreRowComplete),
        concededScores: combatFormViewModel.combatForm.concededScores.filter(isCombatScoreRowComplete),
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

    function addCombatScoreRow(list: ScoreListKey = "scores") {
      ensureCombatFormViewModel();
      getScoreList(list).push(createEmptyCombatScoreRow());
    }

    function removeCombatScoreRow(index: number, list: ScoreListKey = "scores") {
      ensureCombatFormViewModel();
      getScoreList(list).splice(index, 1);
    }

    function onCombatScoreCategoryChange(index: number, list: ScoreListKey = "scores") {
      ensureCombatFormViewModel();
      const score = getScoreList(list)[index];
      if (!score) return;
      if (score.category !== "Tachi-waza") score.technique = "";
      if (score.category !== "Ne-waza") score.neWazaType = "";
    }

    function resetCombatForm() {
      ensureCombatFormViewModel();
      Object.assign(combatFormViewModel.combatForm, defaultCombatForm, {
        scores: [] as CombatScoreFormRow[],
        concededScores: [] as CombatScoreFormRow[]
      });
      combatFormViewModel.combatFormErrors.result = "";
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
