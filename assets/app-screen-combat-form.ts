(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CombatScoreFormRow = import("./types").CombatScoreFormRow;
  type CombatFormDeps = import("./types").CombatFormDeps;
  type CombatSuggestions = import("./types").CombatSuggestions;
  type OperationResult = import("./types").OperationResult;
  type CombatDataQualityIssue = import("./types").CombatDataQualityIssue;

  const {
    createEmptyCombatScoreRow,
    isCombatScoreRowComplete,
    neWazaFamilies: NE_WAZA_FAMILIES,
    neWazaTechniques: NE_WAZA_TECHNIQUES,
    tachiWazaFamilies: TACHI_WAZA_FAMILIES,
    tachiWazaTechniques: TACHI_WAZA_TECHNIQUES
  } = window.KirokuCompetitionFormHelpers;

  // COMBAT-TECH : la valeur d'une option porte la catégorie (T: debout, N: au sol) puis la technique.
  const TACHI_PREFIX = "T:";
  const NE_PREFIX = "N:";
  const OTHER_TECHNIQUE = "__autre__";
  const OTHER_TACHI_WAZA_VALUE = TACHI_PREFIX + OTHER_TECHNIQUE;
  const OTHER_NE_WAZA_VALUE = NE_PREFIX + OTHER_TECHNIQUE;

  // COMBAT-PTS : une seule liste de points ; chaque point indique qui l'a marqué.
  const CAMP_JUDOKA = "JUDOKA";
  const CAMP_OPPONENT = "ADVERSAIRE";

  // COMBAT-SCORE : le score IWY est le décompte du déroulé ; les shidos sont comptés à part.
  type ScoreSideKey = "judoka" | "opponent";
  type PointValueKey = "ippon" | "wazaAri" | "yuko";
  type ScoreRowKey = PointValueKey | "shido";
  type CombatSideScoreForm = Record<ScoreRowKey, number>;
  type CombatOfficialScoreForm = Record<ScoreSideKey, CombatSideScoreForm>;
  const POINT_VALUE_KEYS: PointValueKey[] = ["ippon", "wazaAri", "yuko"];
  const POINT_VALUE_BY_KEY: Record<PointValueKey, string> = { ippon: "Ippon", wazaAri: "Waza-ari", yuko: "Yuko" };
  const SCORE_ROW_MAX: Record<ScoreRowKey, number> = { ippon: 1, wazaAri: 9, yuko: 9, shido: 3 };
  const DECISION_SCORE_VALUES = ["Ippon", "Waza-ari", "Yuko"];

  let nextPointKey = 1;

  function createPointRow(camp: string, value: string, extra: Partial<CombatScoreFormRow> = {}): CombatScoreFormRow {
    return { ...createEmptyCombatScoreRow(), camp, value, key: nextPointKey++, ...extra };
  }

  function getCampForSide(side: ScoreSideKey): string {
    return side === "judoka" ? CAMP_JUDOKA : CAMP_OPPONENT;
  }

  function getScoreTechnique(score: CombatScoreFormRow): string {
    return score.category === "Ne-waza" ? score.neWazaType : score.technique;
  }

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
    const combatScoreValueKeys = window.Vue.computed(() => [
      { key: "ippon", label: "Ippon", max: SCORE_ROW_MAX.ippon },
      { key: "wazaAri", label: "Waza-ari", max: SCORE_ROW_MAX.wazaAri },
      { key: "yuko", label: "Yuko", max: SCORE_ROW_MAX.yuko },
      { key: "shido", label: "Shido", max: SCORE_ROW_MAX.shido }
    ]);
    const combatTechniqueFamilies = window.Vue.computed(() => [
      ...TACHI_WAZA_FAMILIES.map((family) => ({ ...family, label: `Debout · ${family.label}`, prefix: TACHI_PREFIX })),
      ...NE_WAZA_FAMILIES.map((family) => ({ ...family, label: `Au sol · ${family.label}`, prefix: NE_PREFIX }))
    ]);
    const otherTachiWazaValue = window.Vue.computed(() => OTHER_TACHI_WAZA_VALUE);
    const otherNeWazaValue = window.Vue.computed(() => OTHER_NE_WAZA_VALUE);

    const defaultCombatForm = {
      combatId: "",
      stage: "",
      opponent: "",
      opponentStance: "",
      result: "",
      victoryType: "",
      /** Score renseigné même sans point (ex. décision à 0 - 0). */
      scoreFilled: false,
      shidos: { judoka: 0, opponent: 0 } as Record<ScoreSideKey, number>,
      points: [] as CombatScoreFormRow[],
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
      combatForm: { ...defaultCombatForm, shidos: { judoka: 0, opponent: 0 }, points: [] as CombatScoreFormRow[] },
      combatFormErrors: { result: "" }
    });
    let combatFormMounted = false;
    let combatFormSnapshot = "";

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const combatDecisionOptions = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result));
    const showCombatDecisionBlock = window.Vue.computed(() => getCombatDecisionOptions(combatFormViewModel.combatForm.result).length > 0);
    const combatDecisionLabel = window.Vue.computed(() => {
      const result = combatFormViewModel.combatForm.result;
      if (result === "Victoire") return "Victoire par";
      if (result === "Défaite") return "Défaite par";
      return "Fin du combat";
    });

    const judokaFirstName = window.Vue.computed(() => {
      const ownerId = String(state.currentCompetition?.ownerJudokaId || "");
      const judoka =
        (state.judokas || []).find((candidate) => String(candidate.judokaId) === ownerId) ||
        (state.currentUser && String(state.currentUser.judokaId) === ownerId ? state.currentUser : null);
      return String(judoka?.firstName || "").trim() || "Judoka";
    });
    const combatScoreSides = window.Vue.computed(() => [
      { key: "judoka", label: judokaFirstName.value, labelFor: "au judoka", className: "side-judoka" },
      { key: "opponent", label: "Adversaire", labelFor: "à l'adversaire", className: "side-opponent" }
    ]);

    // COMBAT-SUGG : adversaires déjà rencontrés et techniques déjà marquées.
    // DETAIL-2 : chargés à l'ouverture du formulaire, gardés par judoka jusqu'au prochain enregistrement.
    // Hors connexion, runServer répond avec les dernières suggestions mises en cache.
    const combatSuggestionsByJudoka = new Map<string, CombatSuggestions>();
    function loadCombatSuggestions(judokaId: string) {
      const cached = combatSuggestionsByJudoka.get(judokaId);
      state.currentCombatSuggestions = cached || null;
      if (cached || !judokaId) {
        return;
      }
      app.runServer(
        "getCombatSuggestions",
        [judokaId],
        (suggestions) => {
          combatSuggestionsByJudoka.set(judokaId, suggestions);
          if (String(state.currentCompetition?.ownerJudokaId || "") === judokaId) {
            state.currentCombatSuggestions = suggestions;
          }
        },
        // Les suggestions sont une aide : leur absence ne bloque pas la saisie.
        () => undefined
      );
    }

    const combatOpponentSuggestions = window.Vue.computed(() => state.currentCombatSuggestions?.opponents || []);
    const combatFavoriteTechniques = window.Vue.computed(() =>
      (state.currentCombatSuggestions?.techniques || []).map((technique) => {
        const prefix = NE_WAZA_TECHNIQUES.includes(technique) ? NE_PREFIX : TACHI_PREFIX;
        return { value: prefix + technique, label: technique };
      })
    );

    function countPoints(camp: string, value: string): number {
      return combatFormViewModel.combatForm.points.filter((point) => point.camp === camp && point.value === value).length;
    }

    function getCombatScoreCount(side: ScoreSideKey, key: ScoreRowKey): number {
      if (key === "shido") return combatFormViewModel.combatForm.shidos[side];
      return countPoints(getCampForSide(side), POINT_VALUE_BY_KEY[key]);
    }

    const combatScoreIsFilled = window.Vue.computed(
      () => combatFormViewModel.combatForm.scoreFilled || combatFormViewModel.combatForm.points.length > 0
    );
    const canClearCombatScore = window.Vue.computed(
      () => combatFormViewModel.combatForm.scoreFilled && !combatFormViewModel.combatForm.points.length
    );

    function getOfficialScore(): CombatOfficialScoreForm | null {
      if (!combatScoreIsFilled.value) return null;
      const side = (key: ScoreSideKey): CombatSideScoreForm => ({
        ippon: getCombatScoreCount(key, "ippon"),
        wazaAri: getCombatScoreCount(key, "wazaAri"),
        yuko: getCombatScoreCount(key, "yuko"),
        shido: getCombatScoreCount(key, "shido")
      });
      return { judoka: side("judoka"), opponent: side("opponent") };
    }

    const combatOfficialScoreSummary = window.Vue.computed(() => {
      const score = getOfficialScore();
      if (!score) return "Non renseigné";
      const side = (key: ScoreSideKey) => POINT_VALUE_KEYS.map((valueKey) => score[key][valueKey]).join(" ");
      const shidos = score.judoka.shido || score.opponent.shido ? ` · Shidos ${score.judoka.shido} - ${score.opponent.shido}` : "";
      return `${side("judoka")} - ${side("opponent")}${shidos}`;
    });

    const combatDecisionPointNotice = window.Vue.computed(() => {
      const point = combatFormViewModel.combatForm.points.find(
        (candidate) => candidate.autoFromDecision && !getScoreTechnique(candidate)
      );
      return point ? `${point.value} ajouté au déroulé du combat : précisez la technique.` : "";
    });

    const combatFormDataQualityIssues = window.Vue.computed((): CombatDataQualityIssue[] => {
      const form = combatFormViewModel.combatForm;
      if (!form.result) {
        return [];
      }
      const issues: CombatDataQualityIssue[] = [];
      const judokaPoints = form.points.filter((score) => score.camp !== CAMP_OPPONENT);
      if (getCombatDecisionOptions(form.result).length && !form.victoryType) {
        issues.push({ label: "Fin du combat non renseignée", shortLabel: "fin du combat", priority: "high", field: "victoryType" });
      }
      const hasMissingIpponScore =
        form.result === "Victoire" &&
        form.victoryType === "Ippon" &&
        !judokaPoints.some((score) => score.value === "Ippon");
      if (hasMissingIpponScore) {
        issues.push({
          label: "Ippon indiqué, mais aucun point Ippon détaillé",
          shortLabel: "détail du point Ippon",
          priority: "high",
          field: "scores"
        });
      }
      // Une victoire aux points doit montrer au moins un point du judoka ; une défaite ou une décision n'en exige pas.
      const isVictoryOnPoints = form.result === "Victoire" && DECISION_SCORE_VALUES.includes(form.victoryType);
      if (isVictoryOnPoints && !judokaPoints.length && !hasMissingIpponScore) {
        issues.push({ label: "Points marqués non renseignés", shortLabel: "points marqués", priority: "medium", field: "scores" });
      }
      if (form.points.some((score) => !getScoreTechnique(score))) {
        issues.push({ label: "Technique d'un point non précisée", shortLabel: "technique d'un point", priority: "medium", field: "scores" });
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
          cancelCombatForm,
          changeCombatOfficialScore,
          clearCombatOfficialScore,
          deleteCombatFromForm,
          getCombatPointCampLabel,
          getCombatScoreCount,
          getScoreTechnique,
          getScoreTechniqueSelectValue,
          isCustomScoreTechnique,
          moveCombatPoint,
          onChoiceKeydown,
          removeCombatScoreRow,
          saveCombat,
          saveCombatAndNext,
          selectCombatDecision,
          selectCombatResult,
          selectCombatStage,
          selectCombatStance,
          selectScoreTechnique,
          setScoreTechnique,
          syncCombatDecisionVisibility
        },
        {
          canClearCombatScore,
          combatDecisionLabel,
          combatDecisionOptions,
          combatDecisionPointNotice,
          combatFavoriteTechniques,
          combatOfficialScoreSummary,
          combatOpponentSuggestions,
          combatResultOptions,
          combatScoreIsFilled,
          combatScoreSides,
          combatScoreValueKeys,
          combatStageOptions,
          combatStanceOptions,
          combatTechniqueFamilies,
          combatFormVictoryTypeIssues,
          combatFormScoreIssues,
          combatFormOpponentStanceIssues,
          isSubmitting,
          otherNeWazaValue,
          otherTachiWazaValue,
          showCombatDecisionBlock
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
      loadCombatSuggestions(String(getCurrentCompetition().ownerJudokaId || ""));
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
          scoreFilled: Boolean(combat.officialScore),
          shidos: {
            judoka: Math.min(SCORE_ROW_MAX.shido, Number(combat.officialScore?.judoka.shido || 0)),
            opponent: Math.min(SCORE_ROW_MAX.shido, Number(combat.officialScore?.opponent.shido || 0))
          },
          points: toChronologicalPoints(combat.scores || [], combat.concededScores || [], combat.officialScore || null),
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

      takeCombatFormSnapshot();
      showView("combatFormView");
      window.Vue.nextTick(() => {
        const target = focusField || getCombatFormFocusTarget(isEditingExistingCombat);
        // Le bouton Enregistrer est en bas du formulaire : le focaliser ne doit pas faire défiler la page,
        // sinon le haut du formulaire (tour, résultat) sort de l'écran à l'ouverture.
        $(target).focus({ preventScroll: target === "saveCombatButton" });
      });
    }

    type StoredScore = { category?: string; technique?: string; neWazaType?: string; value?: string; order?: number };

    // COMBAT-CHRONO : les points du judoka et de l'adversaire sont remis dans l'ordre du combat.
    // Anciens combats sans rang global : points du judoka puis de l'adversaire, comme avant.
    // Un score enregistré qui compte plus de points que le déroulé est complété par des points à préciser.
    function toChronologicalPoints(
      scores: StoredScore[],
      concededScores: StoredScore[],
      officialScore: { judoka: Record<PointValueKey, number>; opponent: Record<PointValueKey, number> } | null
    ): CombatScoreFormRow[] {
      const tagged = [
        ...scores.map((score) => ({ score, camp: CAMP_JUDOKA })),
        ...concededScores.map((score) => ({ score, camp: CAMP_OPPONENT }))
      ];
      const orders = tagged.map(({ score }) => score.order);
      const hasGlobalOrder =
        orders.every((order) => typeof order === "number") && new Set(orders).size === orders.length;
      const ordered = hasGlobalOrder ? [...tagged].sort((a, b) => Number(a.score.order) - Number(b.score.order)) : tagged;
      const points = ordered.map(({ score, camp }) =>
        createPointRow(camp, score.value || "", {
          category: score.category || "",
          technique: score.technique || "",
          neWazaType: score.neWazaType || ""
        })
      );
      if (officialScore) {
        (["judoka", "opponent"] as ScoreSideKey[]).forEach((side) => {
          POINT_VALUE_KEYS.forEach((key) => {
            const camp = getCampForSide(side);
            const value = POINT_VALUE_BY_KEY[key];
            const stored = Math.min(SCORE_ROW_MAX[key], Number(officialScore[side][key] || 0));
            const missing = stored - points.filter((point) => point.camp === camp && point.value === value).length;
            for (let index = 0; index < missing; index += 1) points.push(createPointRow(camp, value));
          });
        });
      }
      return points;
    }

    function getCombatFormFocusTarget(isEditingExistingCombat: boolean): string {
      const form = combatFormViewModel.combatForm;
      if (!isEditingExistingCombat) {
        if (!form.stage) return "combat_etape";
        return "combat_adversaire";
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

    function serializeCombatForm(): string {
      const form = combatFormViewModel.combatForm;
      return JSON.stringify({
        ...form,
        points: form.points.map((point) => [point.camp, point.value, point.category, point.technique, point.neWazaType])
      });
    }

    function takeCombatFormSnapshot() {
      combatFormSnapshot = serializeCombatForm();
    }

    // COMBAT-QUIT : quitter un formulaire modifié demande confirmation pour ne rien perdre.
    function cancelCombatForm() {
      const hasChanges = combatFormSnapshot !== "" && serializeCombatForm() !== combatFormSnapshot;
      if (hasChanges && !window.confirm("Quitter sans enregistrer ? Les modifications de ce combat seront perdues.")) {
        return;
      }
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
        takeCombatFormSnapshot();
        window.Vue.nextTick(() => $(nextStage ? "combat_adversaire" : "combat_etape").focus());
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

    // Les flèches du clavier parcourent un groupe de choix et sélectionnent l'option atteinte.
    function onChoiceKeydown(event: KeyboardEvent) {
      const steps: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      const isEdgeKey = event.key === "Home" || event.key === "End";
      if (!(event.key in steps) && !isEdgeKey) return;
      const group = event.currentTarget as HTMLElement;
      const radios = Array.from(group.querySelectorAll<HTMLButtonElement>("[role='radio']:not(:disabled)"));
      if (!radios.length) return;
      event.preventDefault();
      const current = radios.indexOf(document.activeElement as HTMLButtonElement);
      let targetIndex = event.key === "Home" ? 0 : radios.length - 1;
      if (!isEdgeKey) {
        const start = current === -1 ? (steps[event.key] > 0 ? -1 : 0) : current;
        targetIndex = (start + steps[event.key] + radios.length) % radios.length;
      }
      const target = radios[targetIndex];
      target.focus();
      target.click();
    }

    function selectCombatStage(stage: string) {
      const form = combatFormViewModel.combatForm;
      form.stage = form.stage === stage ? "" : stage;
    }

    function selectCombatResult(result: string) {
      combatFormViewModel.combatForm.result = result;
      combatFormViewModel.combatFormErrors.result = "";
      syncCombatDecisionVisibility(true);
      applyDecisionPoint();
    }

    // COMBAT-1 : « Victoire par Ippon » (ou Waza-ari, Yuko) ajoute ce point en fin de déroulé s'il n'y est pas.
    // Victoire : point du judoka ; défaite : point de l'adversaire.
    function selectCombatDecision(decision: string) {
      const form = combatFormViewModel.combatForm;
      form.victoryType = form.victoryType === decision && form.result !== "Egalité" ? "" : decision;
      applyDecisionPoint();
    }

    // Un point ajouté automatiquement et encore sans technique suit les changements de résultat ou de décision.
    function applyDecisionPoint() {
      const form = combatFormViewModel.combatForm;
      form.points = form.points.filter((point) => !(point.autoFromDecision && !getScoreTechnique(point)));
      form.points.forEach((point) => {
        point.autoFromDecision = false;
      });
      const camp = form.result === "Victoire" ? CAMP_JUDOKA : form.result === "Défaite" ? CAMP_OPPONENT : "";
      if (camp && DECISION_SCORE_VALUES.includes(form.victoryType) && !countPoints(camp, form.victoryType)) {
        form.points.push(createPointRow(camp, form.victoryType, { autoFromDecision: true }));
      }
    }

    // COMBAT-SCORE : « + » ajoute l'action en fin de déroulé, « − » retire la dernière (de préférence sans technique).
    function changeCombatOfficialScore(side: ScoreSideKey, key: ScoreRowKey, delta: number) {
      const form = combatFormViewModel.combatForm;
      form.scoreFilled = true;
      if (key === "shido") {
        form.shidos[side] = Math.min(SCORE_ROW_MAX.shido, Math.max(0, form.shidos[side] + delta));
        return;
      }
      const camp = getCampForSide(side);
      const value = POINT_VALUE_BY_KEY[key];
      if (delta > 0) {
        if (countPoints(camp, value) < SCORE_ROW_MAX[key]) form.points.push(createPointRow(camp, value));
        return;
      }
      const matching = form.points
        .map((point, index) => ({ point, index }))
        .filter(({ point }) => point.camp === camp && point.value === value);
      const target = [...matching].reverse().find(({ point }) => !getScoreTechnique(point)) || matching[matching.length - 1];
      if (target) form.points.splice(target.index, 1);
    }

    function clearCombatOfficialScore() {
      const form = combatFormViewModel.combatForm;
      form.scoreFilled = false;
      form.shidos = { judoka: 0, opponent: 0 };
    }

    function selectCombatStance(stance: string) {
      const form = combatFormViewModel.combatForm;
      form.opponentStance = form.opponentStance === stance ? "" : stance;
    }

    function getCombatPointCampLabel(score: CombatScoreFormRow): string {
      return score.camp === CAMP_OPPONENT ? "Adversaire" : judokaFirstName.value;
    }

    function getPoint(index: number): CombatScoreFormRow | undefined {
      return combatFormViewModel.combatForm.points[index];
    }

    // COMBAT-CHRONO : une action saisie dans le désordre se remet à sa place.
    function moveCombatPoint(index: number, delta: number) {
      const points = combatFormViewModel.combatForm.points;
      const target = index + delta;
      if (target < 0 || target >= points.length) return;
      const [point] = points.splice(index, 1);
      if (point) points.splice(target, 0, point);
    }

    // COMBAT-TECH : la technique se choisit dans la liste, ou se saisit librement via « Autre technique… ».
    function getScoreTechniqueOptions(score: CombatScoreFormRow): string[] {
      return score.category === "Ne-waza" ? NE_WAZA_TECHNIQUES : TACHI_WAZA_TECHNIQUES;
    }

    function isCustomScoreTechnique(score: CombatScoreFormRow): boolean {
      const technique = getScoreTechnique(score);
      return Boolean(score.customTechnique) || (Boolean(technique) && !getScoreTechniqueOptions(score).includes(technique));
    }

    function getScoreTechniqueSelectValue(score: CombatScoreFormRow): string {
      if (!score.category) return "";
      const prefix = score.category === "Ne-waza" ? NE_PREFIX : TACHI_PREFIX;
      if (isCustomScoreTechnique(score)) return prefix + OTHER_TECHNIQUE;
      const technique = getScoreTechnique(score);
      return technique ? prefix + technique : "";
    }

    function setScoreTechnique(index: number, value: string) {
      const score = getPoint(index);
      if (!score) return;
      const technique = String(value || "").trim();
      if (score.category === "Ne-waza") score.neWazaType = technique;
      else score.technique = technique;
    }

    function selectScoreTechnique(index: number, value: string) {
      const score = getPoint(index);
      if (!score) return;
      const category = value.startsWith(NE_PREFIX) ? "Ne-waza" : value.startsWith(TACHI_PREFIX) ? "Tachi-waza" : "";
      const technique = value.slice(2);
      Object.assign(score, { category, technique: "", neWazaType: "", customTechnique: false });
      if (!category) return;
      if (technique === OTHER_TECHNIQUE) {
        score.customTechnique = true;
        const inputId = `combat_custom_technique_${index}`;
        window.Vue.nextTick(() => {
          const input = document.getElementById(inputId);
          if (input) input.focus();
        });
        return;
      }
      setScoreTechnique(index, technique);
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
          showSavedCombat(response, competitionId, afterReload);
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
          showSavedCombat(response, competitionId);
        },
        showError
      );
    }

    // ECRIT-2 : le combat renvoyé par le serveur met à jour la fiche, sans la recharger.
    // Hors connexion, l'écriture est en file d'attente : la fiche est relue depuis le cache.
    function showSavedCombat(response: OperationResult, competitionId: string, afterShown?: () => void) {
      if (!response.combat) {
        openCompetition(competitionId, true, afterShown);
        return;
      }
      combatSuggestionsByJudoka.delete(String(response.combat.judokaId));
      app.local.saveCombat(response.combat);
      showView("competitionView", { routeState: { competitionId } });
      afterShown?.();
    }

    function getCombatFormValue() {
      ensureCombatFormViewModel();
      const competition = getCurrentCompetition();
      const form = combatFormViewModel.combatForm;
      const result = form.result;
      // COMBAT-CHRONO : chaque point porte son rang dans le combat, tous camps confondus.
      const orderedPoints = form.points
        .filter(isCombatScoreRowComplete)
        .map((point, order) => ({ point, order }));
      return {
        competitionId: competition.competitionId,
        judokaId: competition.ownerJudokaId,
        stage: form.stage,
        opponent: form.opponent,
        opponentStance: form.opponentStance,
        result,
        victoryType: result === "Egalité" ? "Hiki wake" : form.victoryType,
        officialScore: getOfficialScore(),
        scores: orderedPoints.filter(({ point }) => point.camp !== CAMP_OPPONENT).map(toScorePayload),
        concededScores: orderedPoints.filter(({ point }) => point.camp === CAMP_OPPONENT).map(toScorePayload),
        notes: form.notes,
        combatId: undefined as string | undefined
      };
    }

    function toScorePayload({ point, order }: { point: CombatScoreFormRow; order: number }) {
      return { category: point.category, technique: point.technique, neWazaType: point.neWazaType, value: point.value, order };
    }

    function deleteCombat(id: string) {
      const competitionId = getCurrentCompetition().competitionId;
      app.confirmAndRun({
        message: "Supprimer ce combat ?",
        method: "deleteCombat",
        args: [id],
        onSuccess: (response) => {
          showSuccess(response.message);
          combatSuggestionsByJudoka.delete(String(getCurrentCompetition().ownerJudokaId));
          app.local.removeCombat(id);
          showView("competitionView", { routeState: { competitionId } });
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

    function removeCombatScoreRow(index: number) {
      ensureCombatFormViewModel();
      combatFormViewModel.combatForm.points.splice(index, 1);
    }

    function resetCombatForm() {
      ensureCombatFormViewModel();
      Object.assign(combatFormViewModel.combatForm, defaultCombatForm, {
        shidos: { judoka: 0, opponent: 0 },
        points: [] as CombatScoreFormRow[]
      });
      combatFormViewModel.combatFormErrors.result = "";
      combatFormSnapshot = "";
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
