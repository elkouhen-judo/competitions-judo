(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;
  type Competition = import("../core/types").Competition;
  type CompetitionDetail = import("../core/types").CompetitionDetail;
  type CompetitionDetailDeps = import("./types").CompetitionDetailDeps;

  type ClubParticipantLink = import("./types").ClubParticipantLink;

  interface CompetitionOwnerOption {
    judokaId: string;
    name: string;
    meta: string;
    searchText: string;
  }

  // Competition detail concern: viewing a competition + its combats, the coach
  // review field, and finalization status. Returns `openCompetition` so the
  // form controller (and the finalization glue in the main factory) can navigate back
  // into the detail view after a save.
  function createCompetitionDetailController(
    app: KirokuApp,
    deps: {
      showCombatForm: CompetitionDetailDeps["showCombatForm"];
      deleteCombat: CompetitionDetailDeps["deleteCombat"];
      editCurrentCompetition: () => void;
    }
  ) {
    const { state, ui, notifications } = app;
    const { formatCompetitionName, formatDate, formatResultat, getJudokaDisplayName, normalizeDisplayName, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { showCombatForm, deleteCombat, editCurrentCompetition } = deps;

    const defaultCompetitionDetailViewState = {
      coachReviewText: "",
      coachReviewStatus: ""
    };

    type CompetitionDetailRef = typeof defaultCompetitionDetailViewState;
    let competitionDetailRef: CompetitionDetailRef | null = null;
    let competitionDetailMounted = false;
    let currentCompetitionReturnView: "homeView" | "clubCompetitionDetailView" | "judokaView" = "homeView";
    // COACH-4 : ouverte depuis une compétition club, la compétition d'un participant propose le suivant.
    const clubParticipantSequence = window.Vue.reactive({ items: [] as ClubParticipantLink[] });
    // FICHE-8 : sur grand écran, les compétitions du même judoka restent listées à gauche.
    const competitionSideOwner = window.Vue.reactive({ judokaId: "" });
    const competitionSideList = window.Vue.computed(() => {
      const ownerId = String(state.currentCompetition?.ownerJudokaId || competitionSideOwner.judokaId || "");
      if (!ownerId) return null;
      const currentId = String(state.currentCompetition?.competitionId || "");
      const today = ui.getCurrentLocalDate();
      const toItem = (competition: (typeof state.competitions)[number]) => {
        const isPast = competition.competitionDate < today;
        const ranking = competition.result ? ui.formatCompetitionRanking(competition.result) : isPast ? "Classement à saisir" : "";
        return {
          competitionId: String(competition.competitionId),
          name: formatCompetitionName(competition.name) || "Compétition",
          meta: [ui.formatDateLong(competition.competitionDate), ranking].filter(Boolean).join(" · "),
          isCurrent: String(competition.competitionId) === currentId
        };
      };
      const owned = state.competitions.filter((competition) => String(competition.ownerJudokaId) === ownerId);
      if (owned.length < 2) return null;
      const upcoming = owned
        .filter((competition) => competition.competitionDate >= today)
        .sort((a, b) => a.competitionDate.localeCompare(b.competitionDate))
        .map(toItem);
      const past = owned
        .filter((competition) => competition.competitionDate < today)
        .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate))
        .map(toItem);
      return { upcoming, past };
    });

    function openSideCompetition(id: string) {
      if (String(state.currentCompetition?.competitionId || "") === String(id)) return;
      const returnView = currentCompetitionReturnView;
      openCompetition(id);
      currentCompetitionReturnView = returnView;
    }

    const competitionDetailProjection = window.Vue.computed(() => {
      if (!state.currentCompetition) return null;
      return window.KirokuScreenProjections.projectCompetitionDetail(
        state.currentCompetition,
        state.canEditCurrentCompetition,
        { formatDate }
      );
    });

    const combatsProjection = window.Vue.computed(() => {
      const base = window.KirokuScreenProjections.projectCompetitionCombats(state.currentCombats, {
        formatResultat,
        normalizeDisplayName,
        showJudoka: true,
        canEdit: state.canEditCurrentCompetition
      });
      const competitionId = state.currentCompetition?.competitionId || "";
      const combats = window.KirokuScreenProjections.mergePendingCombatCards(
        base.combats,
        state.pendingOperations,
        competitionId,
        {
          formatResultat,
          normalizeDisplayName,
          showJudoka: true,
          canEdit: state.canEditCurrentCompetition,
          judokas: state.judokas,
          getJudokaDisplayName
        }
      );
      return {
        ...base,
        combats,
        hasCombats: combats.length > 0,
        combatsEmptyMessage: combats.length ? "" : base.combatsEmptyMessage
      };
    });

    const competitionTitle = window.Vue.computed(() => {
      if (state.isLoadingCompetition) return "Chargement...";
      return formatCompetitionName(competitionDetailProjection.value?.competitionTitle) || "Compétition";
    });
    // Le sous-titre nomme le judoka concerné (coach et parent consultent plusieurs participations).
    const competitionSubtitle = window.Vue.computed(() => {
      const competition = state.currentCompetition;
      if (!competition || state.isLoadingCompetition) return "";
      const ownerId = String(competition.ownerJudokaId || "");
      const owner =
        state.judokas.find((judoka) => String(judoka.judokaId) === ownerId) ||
        (String(state.currentUser?.judokaId || "") === ownerId ? state.currentUser : null);
      const ownerName = owner ? getJudokaDisplayName(owner) : "";
      return [ownerName, ui.formatDateLong(competition.competitionDate)].filter(Boolean).join(" · ");
    });
    const competitionDate = window.Vue.computed(() => competitionDetailProjection.value?.competitionDate ?? "");
    const ageWeightLabel = window.Vue.computed(() => competitionDetailProjection.value?.ageWeightLabel ?? "");
    const competitionResult = window.Vue.computed(() => {
      return competitionDetailProjection.value?.competitionResult ?? "";
    });
    const competitionAiAnalysis = window.Vue.computed(() => competitionDetailProjection.value?.competitionAiAnalysis ?? "");
    const canEditCompetition = window.Vue.computed(() => competitionDetailProjection.value?.canEditCompetition ?? false);
    const canManageCombat = window.Vue.computed(
      () => !state.isLoadingCompetition && Boolean(state.currentCompetition) && canEditCompetition.value
    );
    const canFinalizeCompetition = window.Vue.computed(() => competitionDetailProjection.value?.canFinalizeCompetition ?? false);
    // PART-1 : une participation liée à une compétition club se retire depuis celle-ci (COMP-027).
    const canDeleteCompetition = window.Vue.computed(
      () => canEditCompetition.value && !state.currentCompetition?.clubCompetitionId
    );
    // FICHE-1 : avant la date, la fiche prépare la compétition ; les saisies de résultat arrivent le jour J.
    const competitionTiming = window.Vue.computed(() => {
      const days = ui.getDaysFromToday(state.currentCompetition?.competitionDate);
      return {
        isUpcoming: days !== null && days > 0,
        isToday: days === 0,
        relative: days !== null && days > 0 ? ui.formatRelativeDay(state.currentCompetition?.competitionDate) : ""
      };
    });
    // FICHE-2 : le classement se choisit sur la fiche, sans écran dédié.
    const rankingOptions = window.Vue.computed(() =>
      ["1er", "2e", "3e", "5e", "7e", "Non classé"].map((value) => ({
        value,
        label: ui.formatCompetitionRanking(value),
        medalClass: ui.getClassementBadgeClass(value).replace("rank-finalist", "")
      }))
    );
    const showRankingSection = window.Vue.computed(
      () => Boolean(state.currentCompetition) && !state.isLoadingCompetition && canEditCompetition.value && !competitionTiming.value.isUpcoming
    );
    const competitionResultLabel = window.Vue.computed(() => ui.formatCompetitionRanking(state.currentCompetition?.result));
    const competitionResultClass = window.Vue.computed(() => ui.getClassementBadgeClass(state.currentCompetition?.result));
    const competitionLevel = window.Vue.computed(() => state.currentCompetition?.level ?? "");
    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const combats = window.Vue.computed(() => {
      if (state.isLoadingCompetition) return [];
      return combatsProjection.value.combats;
    });
    const combatsEmptyMessage = window.Vue.computed(() => {
      if (state.isLoadingCompetition) return "Chargement des combats…";
      return combatsProjection.value.combatsEmptyMessage;
    });
    const hasCombats = window.Vue.computed(() => !state.isLoadingCompetition && combatsProjection.value.hasCombats);
    const isLoadingCombats = window.Vue.computed(() => state.isLoadingCompetition);
    // Jour J : quand la compétition a lieu aujourd'hui (ou plus tard) ou n'a encore aucun combat,
    // la saisie des combats passe avant la synthèse et le suivi coach.
    const isCompetitionDayMode = window.Vue.computed(() => {
      if (!canManageCombat.value) return false;
      const date = String(state.currentCompetition?.competitionDate || "");
      const today = new Date().toISOString().slice(0, 10);
      return !combatsProjection.value.hasCombats || (Boolean(date) && date >= today);
    });
    const competitionSportSummary = window.Vue.computed(() => {
      const total = state.currentCombats.length;
      const wins = state.currentCombats.filter((combat) => combat.result === "Victoire").length;
      const losses = state.currentCombats.filter((combat) => combat.result === "Défaite").length;
      // FICHE-6 : trois tuiles, accordées au nombre.
      return {
        total,
        totalLabel: total > 1 ? "combats" : "combat",
        wins,
        winsLabel: wins > 1 ? "victoires" : "victoire",
        losses,
        lossesLabel: losses > 1 ? "défaites" : "défaite"
      };
    });

    const showCoachAssessment = window.Vue.computed(() =>
      Boolean(
        state.currentCompetition &&
        (state.isCoach || state.isParent || state.currentCompetition.coachReview)
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
          cancelPendingOperation,
          deleteCurrentCompetition,
          deleteCombat,
          editCurrentCompetition,
          navigateBackFromCompetition,
          saveCompetitionRanking,
          showCombatForm,
          saveCoachReview,
          openNextClubParticipant,
          openSideCompetition
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
          canManageCombat,
          canFinalizeCompetition,
          canDeleteCompetition,
          competitionResultClass,
          competitionResultLabel,
          competitionTiming,
          rankingOptions,
          showRankingSection,
          isSubmitting,
          combats,
          combatsEmptyMessage,
          hasCombats,
          isLoadingCombats,
          isCompetitionDayMode,
          competitionSportSummary,
          showCoachAssessment,
          canEditCoachAssessment,
          nextClubParticipant,
          competitionSideList,
        }
      );
    }

    // FICHE-4 : le bilan s'enregistre à la sortie du champ, sans bouton ni notification.
    function saveCoachReview() {
      if (!competitionDetailRef || !state.currentCompetition) return;
      const ref = competitionDetailRef;
      const competitionId = state.currentCompetition.competitionId;
      const review = ref.coachReviewText;
      if (review === (state.currentCompetition.coachReview || "")) return;
      ref.coachReviewStatus = "Enregistrement…";
      app.runServer(
        "saveCoachReview",
        [competitionId, review],
        () => {
          ref.coachReviewStatus = "Enregistré";
          if (state.currentCompetition) {
            state.currentCompetition = { ...state.currentCompetition, coachReview: review };
          }
          // COACH-1 : la liste des compétitions garde le bilan enregistré, sans rechargement.
          state.competitions = state.competitions.map((competition) =>
            String(competition.competitionId) === String(competitionId) ? { ...competition, coachReview: review } : competition
          );
        },
        (error) => {
          ref.coachReviewStatus = "Non enregistré";
          showError(error);
        }
      );
    }

    function saveCompetitionRanking(result: string) {
      if (!state.currentCompetition || state.currentCompetition.result === result) return;
      const competitionId = state.currentCompetition.competitionId;
      app.runServer(
        "finalizeCompetition",
        [competitionId, result],
        (response) => {
          showSuccess(response.message);
          if (state.currentCompetition && String(state.currentCompetition.competitionId) === String(competitionId)) {
            state.currentCompetition = { ...state.currentCompetition, result };
          }
          state.competitions = state.competitions.map((competition) =>
            String(competition.competitionId) === String(competitionId) ? { ...competition, result } : competition
          );
          if (response.competition) {
            app.local.saveCompetition(response.competition);
          }
        },
        showError
      );
    }

    function cancelPendingOperation(operationId: string) {
      app.cancelPendingOperation(operationId);
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

    function openCompetitionFromClubDetail(competitionId: string, participants: ClubParticipantLink[] = []) {
      openCompetition(competitionId);
      currentCompetitionReturnView = "clubCompetitionDetailView";
      clubParticipantSequence.items = participants.filter((participant) => participant.competitionId);
    }

    // Le suivant de la liste de la compétition club ; après le dernier, on revient au premier.
    const nextClubParticipant = window.Vue.computed((): ClubParticipantLink | null => {
      const items = clubParticipantSequence.items;
      const currentId = String(state.currentCompetition?.competitionId || "");
      if (items.length < 2 || !currentId) return null;
      const index = items.findIndex((item) => item.competitionId === currentId);
      if (index < 0) return null;
      return items[(index + 1) % items.length];
    });

    function openNextClubParticipant() {
      const next = nextClubParticipant.value;
      if (!next) return;
      openCompetitionFromClubDetail(next.competitionId, [...clubParticipantSequence.items]);
    }

    function openCompetitionFromJudokaProfile(competitionId: string) {
      openCompetition(competitionId);
      currentCompetitionReturnView = "judokaView";
    }

    function openCompetition(id: string, keepMessage = false, onLoaded?: () => void) {
      if (!keepMessage) {
        clearMessage();
        currentCompetitionReturnView = "homeView";
        clubParticipantSequence.items = [];
      }
      ensureCompetitionDetailViewModel();
      const known = state.competitions.find((competition) => String(competition.competitionId) === String(id));
      competitionSideOwner.judokaId = known ? String(known.ownerJudokaId || "") : "";
      state.currentCompetition = null;
      state.currentCombats = [];
      state.currentCombatSuggestions = null;
      state.isLoadingCompetition = true;
      showView("competitionView", { routeState: { competitionId: id } });

      app.runServer(
        "getCompetitionDetail",
        [id],
        (data: CompetitionDetail) => {
          state.currentCompetition = data.competition;
          state.currentCombats = Array.isArray(data.combats) ? data.combats : [];
          state.canEditCurrentCompetition = Boolean(data.canEditCompetition);
          state.isLoadingCompetition = false;
          if (competitionDetailRef) {
            competitionDetailRef.coachReviewText = data.competition.coachReview || "";
            competitionDetailRef.coachReviewStatus = "";
          }
          onLoaded?.();
        },
        (error) => {
          state.isLoadingCompetition = false;
          showError(error);
        }
      );
    }

    function deleteCurrentCompetition() {
      if (!state.currentCompetition) return;

      const competitionId = state.currentCompetition.competitionId;
      const label = state.currentCompetition.name ? ` « ${state.currentCompetition.name} »` : "";
      app.confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [competitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          state.currentCompetition = null;
          app.local.removeCompetition(competitionId);
          app.showHome && app.showHome();
        }
      });
    }

    return {
      getCurrentCompetition,
      navigateBackFromCompetition,
      openCompetition,
      openCompetitionFromClubDetail,
      openCompetitionFromJudokaProfile,
      deleteCurrentCompetition
    };
  }

  // Competition form concern: creating/editing a competition, including the
  // parent-only "owner judoka" typed-search picker.
  function createCompetitionFormController(
    app: KirokuApp,
    deps: {
      openCompetition: ReturnType<typeof createCompetitionDetailController>["openCompetition"];
    }
  ) {
    const { state, ui, notifications } = app;
    const { cleanText, getJudokaDisplayName, toInputDate, showView } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { openCompetition } = deps;

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
      competitionFormErrors: { name: "", ageCategory: "", owner: "" },
      competitionForm: { ...defaultCompetitionForm }
    };

    let competitionFormMounted = false;
    const competitionFormViewModel = window.Vue.reactive({
      ...defaultCompetitionFormViewState,
      competitionFormErrors: { name: "", ageCategory: "", owner: "" },
      competitionForm: { ...defaultCompetitionFormViewState.competitionForm }
    });
    let hideOwnerOptionsTimer: number | null = null;
    let previousCompetitionFormView: "homeView" | "competitionView" = "homeView";

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const competitionInheritedFieldsLocked = window.Vue.computed(() =>
      Boolean(competitionFormViewModel.competitionInheritedFieldsLocked)
    );
    const competitionWeightCategoryOptions = window.Vue.computed(() =>
      window.KirokuScreenProjections.getWeightCategoryOptions(
        competitionFormViewModel.competitionForm.ageCategory
      )
    );

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

    // MULTI-4 : le formulaire ne fait que modifier ; seul le coach crée une compétition (compétition club).
    function showCompetitionForm(id: string) {
      clearMessage();
      ensureCompetitionFormViewModel();
      Object.assign(competitionFormViewModel.competitionFormErrors, { name: "", ageCategory: "", owner: "" });
      previousCompetitionFormView = state.currentCompetition ? "competitionView" : "homeView";

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

      showView("competitionFormView");
    }

    function cancelCompetitionForm() {
      showView(previousCompetitionFormView);
    }

    function onCompetitionFormAgeCategoryChange() {
      competitionFormViewModel.competitionFormErrors.ageCategory = "";
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
      return "Choisissez le judoka concerné.";
    }

    function saveCompetition() {
      ensureCompetitionFormViewModel();
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

      // COMBAT-2 : champs obligatoires vérifiés avant l'envoi, erreur sous le champ concerné.
      const errors = competitionFormViewModel.competitionFormErrors;
      errors.name = cleanText(competition.name) ? "" : "Indiquez le nom de la compétition.";
      errors.ageCategory = competition.ageCategory ? "" : "Choisissez la catégorie d'âge.";
      errors.owner = "";
      if (state.isParent) {
        competition.ownerJudokaId = resolveCompetitionOwnerSelection();
        errors.owner = competition.ownerJudokaId ? "" : getCompetitionOwnerRequiredMessage();
      }
      const firstInvalidField = errors.owner
        ? "competition_judoka_text"
        : errors.name
          ? "competition_nom"
          : errors.ageCategory
            ? "competition_categorie_age"
            : "";
      if (firstInvalidField) {
        window.Vue.nextTick(() => document.getElementById(firstInvalidField)?.focus());
        return;
      }

      app.runServer(
        "saveCompetition",
        [competition],
        (response) => {
          showSuccess(response.message);
          const competitionId = response.competitionId || "";
          // ECRIT-2 : la compétition enregistrée met à jour l'état local, sans getInitialData.
          if (response.competition) {
            app.local.saveCompetition(response.competition);
          }
          if (!competitionId) {
            app.showHome && app.showHome();
          } else {
            openCompetition(competitionId, true);
          }
        },
        showError
      );
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

    // Information sportive utile pour distinguer deux judokas, jamais l'e-mail ni l'identifiant.
    function getJudokaSecondaryText(judoka: Judoka) {
      return [judoka.ageCategory, judoka.weightCategory]
        .map((value) => cleanText(value))
        .filter(Boolean)
        .join(" · ");
    }

    // Préremplit catégorie d'âge et poids depuis le profil du judoka, sans écraser une saisie.
    function prefillCategoryFromJudoka(idJudoka: string) {
      const judoka =
        state.judokas.find((j) => String(j.judokaId) === String(idJudoka)) ||
        (String(state.currentUser?.judokaId || "") === String(idJudoka) ? state.currentUser : null);
      if (!judoka) return;
      const form = competitionFormViewModel.competitionForm;
      if (!form.ageCategory && cleanText(judoka.ageCategory)) {
        form.ageCategory = cleanText(judoka.ageCategory);
      }
      const profileWeight = cleanText(judoka.weightCategory);
      if (!form.weightCategory && profileWeight && form.ageCategory === cleanText(judoka.ageCategory)) {
        // Le profil peut écrire « -38 kg » quand la liste propose « -38kg » : on retient l'option exacte.
        const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();
        const options = competitionWeightCategoryOptions.value;
        const matchingOption = options.find((option) => compact(option) === compact(profileWeight));
        if (matchingOption || !options.length) {
          form.weightCategory = matchingOption || profileWeight;
        }
      }
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
      competitionFormViewModel.competitionFormErrors.owner = "";
      if (option && !competitionFormViewModel.competitionForm.competitionId) {
        prefillCategoryFromJudoka(option.judokaId);
      }
    }

    return {
      cancelCompetitionForm,
      getCompetitionOwnerRequiredMessage,
      getJudokaSecondaryText,
      hideCompetitionOwnerOptions,
      resolveCompetitionOwnerSelection,
      saveCompetition,
      selectCompetitionOwner,
      showCompetitionForm,
      showCompetitionOwnerOptions,
      updateCompetitionOwnerText
    };
  }

  function createKirokuCompetitionDetailScreen(app: KirokuApp, deps: CompetitionDetailDeps) {
    const { state, notifications } = app;
    const { showError } = notifications;
    const { showCombatForm, deleteCombat } = deps;

    const detail = createCompetitionDetailController(app, {
      showCombatForm,
      deleteCombat,
      editCurrentCompetition
    });
    const {
      getCurrentCompetition,
      navigateBackFromCompetition,
      openCompetition,
      openCompetitionFromClubDetail,
      openCompetitionFromJudokaProfile,
      deleteCurrentCompetition
    } = detail;

    const form = createCompetitionFormController(app, { openCompetition });
    const {
      cancelCompetitionForm,
      getCompetitionOwnerRequiredMessage,
      getJudokaSecondaryText,
      hideCompetitionOwnerOptions,
      resolveCompetitionOwnerSelection,
      saveCompetition,
      selectCompetitionOwner,
      showCompetitionForm,
      showCompetitionOwnerOptions,
      updateCompetitionOwnerText
    } = form;

    function editCurrentCompetition() {
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(state.currentCompetition.competitionId);
    }

    return {
      cancelCompetitionForm,
      deleteCurrentCompetition,
      editCurrentCompetition,
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
      showCompetitionForm,
      showCompetitionOwnerOptions,
      updateCompetitionOwnerText
    };
  }

  window.createKirokuCompetitionDetailScreen = createKirokuCompetitionDetailScreen;
})();
