(() => {
  type KirokuApp = import("./types").KirokuApp;
  type ClubCompetitionDetail = import("../core/types").ClubCompetitionDetail;
  type ClubCompetitionDeps = import("./types").ClubCompetitionDeps;
  type OperationResult = import("./types").OperationResult;

  interface ClubCompetitionJudokaOption {
    judokaId: string;
    name: string;
    ageCategory: string;
    clubId: string;
  }

  interface ClubCompetitionParticipantCard {
    competitionId: string;
    judokaName: string;
    rawResult: string;
    result: string;
    resultClass: string;
    combatSummary: string;
    hasCombats: boolean;
    hasResult: boolean;
  }

  // Ordre d'affichage des participants : podium d'abord, puis places suivantes, non classés en dernier.
  const RANKING_ORDER: Record<string, number> = {
    "1er": 1, "2e": 2, "3e": 3, "4e": 4, "5e": 5, "6e": 6, "7e": 7, "8e": 8, "non classé": 90
  };

  function getRankingOrder(value: unknown): number {
    return RANKING_ORDER[String(value || "").trim().toLowerCase()] || 99;
  }

  function formatCombatSummary(record: { total: number; wins: number; losses: number; draws: number } | undefined) {
    if (!record || !record.total) return "Aucun combat saisi";
    const parts = [record.wins ? `${record.wins}V` : "", record.losses ? `${record.losses}D` : "", record.draws ? `${record.draws}N` : ""];
    return `${record.total} combat${record.total > 1 ? "s" : ""} · ${parts.filter(Boolean).join(" ")}`;
  }

  function createKirokuClubCompetitionScreen(app: KirokuApp, deps: ClubCompetitionDeps) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      cleanText,
      formatCompetitionName,
      formatCompetitionRanking,
      getClassementBadgeClass,
      getCurrentLocalDate,
      getJudokaDisplayName,
      showView
    } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { openCompetitionFromClubDetail } = deps;

    const defaultClubCompetitionFormViewState = {
      clubCompetitionFormTitle: "Nouvelle compétition",
      clubCompetitionParticipants: [] as ClubCompetitionJudokaOption[],
      judokaSearchText: "",
      clubCompetitionForm: {
        clubCompetitionId: "",
        name: "",
        competitionDate: "",
        ageCategory: "",
        level: "",
        clubId: "",
        participantJudokaIds: [] as string[]
      }
    };
    const defaultClubCompetitionDetailViewState = {
      clubCompetitionDetailTitle: "Compétition club",
      clubCompetitionDetailEditing: false,
      clubCompetitionDetailSummary: "",
      clubCompetitionDetailForm: {
        clubCompetitionId: "",
        name: "",
        competitionDate: "",
        ageCategory: "",
        level: ""
      },
      clubCompetitionCurrentParticipants: [] as ClubCompetitionParticipantCard[],
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      clubCompetitionParticipantsLocked: false,
      judokaAvailableSearchText: "",
      clubCompetitionNewJudokaIds: [] as string[]
    };

    const clubCompetitionFormViewModel = window.Vue.reactive({
      ...defaultClubCompetitionFormViewState,
      clubCompetitionFormErrors: { clubId: "", name: "", ageCategory: "" },
      clubCompetitionForm: { ...defaultClubCompetitionFormViewState.clubCompetitionForm, participantJudokaIds: [] as string[] }
    });
    let clubCompetitionFormMounted = false;
    const clubCompetitionDetailViewModel = window.Vue.reactive({
      ...defaultClubCompetitionDetailViewState,
      clubCompetitionDetailForm: { ...defaultClubCompetitionDetailViewState.clubCompetitionDetailForm },
      clubCompetitionCurrentParticipants: [] as ClubCompetitionParticipantCard[],
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      clubCompetitionParticipantsLocked: false,
      clubCompetitionNewJudokaIds: [] as string[]
    });
    let clubCompetitionDetailMounted = false;

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);

    const clubCompetitionFormParticipantsFiltered = window.Vue.computed(() => {
      const query = cleanText(clubCompetitionFormViewModel.judokaSearchText).toLowerCase();
      const ageCategory = cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory);
      const clubId = clubCompetitionFormViewModel.clubCompetitionForm.clubId;
      if (!ageCategory || !clubId) {
        return [];
      }

      const selectedIds = new Set(
        clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds.map(String)
      );
      // Seuls les judokas du club de la compétition peuvent y être inscrits.
      return clubCompetitionFormViewModel.clubCompetitionParticipants.filter(
        (p) =>
          p.clubId === clubId &&
          p.ageCategory === ageCategory &&
          (selectedIds.has(String(p.judokaId)) || !query || p.name.toLowerCase().includes(query))
      );
    });
    const hasClubCompetitionFormAgeCategory = window.Vue.computed(() =>
      Boolean(cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory))
    );
    const coachClubOptions = window.Vue.computed(() => state.clubs);
    // Le choix du club n'est proposé qu'aux coachs de plusieurs clubs.
    const showClubCompetitionClubSelect = window.Vue.computed(() => state.clubs.length > 1);
    const hasNoCoachClub = window.Vue.computed(() => state.clubs.length === 0);
    const clubCompetitionFormParticipantsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        clubCompetitionFormParticipantsFiltered.value,
        state.clubCompetitionFormParticipantsCurrentPage,
        defaultListPageSize
      )
    );
    const clubCompetitionFormParticipantsPaginationRefs = ui.createPaginationRefs(
      clubCompetitionFormParticipantsPagination
    );

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
    const clubCompetitionAvailableJudokasPaginationRefs = ui.createPaginationRefs(
      clubCompetitionAvailableJudokasPagination
    );

    const clubCompetitionParticipantsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants,
        state.clubCompetitionParticipantsCurrentPage,
        defaultListPageSize
      )
    );
    const clubCompetitionParticipantsPaginationRefs = ui.createPaginationRefs(
      clubCompetitionParticipantsPagination
    );

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
          updateClubCompetitionClub,
          showClubCompetitionFormParticipantsPreviousPage,
          showClubCompetitionFormParticipantsNextPage
        },
        {
          isSubmitting,
          clubCompetitionFormParticipantsFiltered,
          clubCompetitionFormParticipantsPage: clubCompetitionFormParticipantsPaginationRefs.page,
          clubCompetitionFormParticipantsTotalPages: clubCompetitionFormParticipantsPaginationRefs.totalPages,
          clubCompetitionFormParticipantsCurrentPage: clubCompetitionFormParticipantsPaginationRefs.currentPage,
          clubCompetitionFormParticipantsTotalCount: clubCompetitionFormParticipantsPaginationRefs.totalCount,
          clubCompetitionFormParticipantsCanShowPreviousPage: clubCompetitionFormParticipantsPaginationRefs.canShowPreviousPage,
          clubCompetitionFormParticipantsCanShowNextPage: clubCompetitionFormParticipantsPaginationRefs.canShowNextPage,
          hasClubCompetitionFormAgeCategory,
          coachClubOptions,
          showClubCompetitionClubSelect,
          hasNoCoachClub
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
          startClubCompetitionDetailEdit,
          cancelClubCompetitionDetailEdit,
          confirmDeleteClubCompetition,
          confirmDetachClubParticipant,
          openCompetitionFromClubDetail,
          saveClubCompetitionDetails,
          updateClubCompetitionDetailAgeCategory,
          updateClubAvailableJudokaSearch,
          showClubCompetitionParticipantsPreviousPage,
          showClubCompetitionParticipantsNextPage,
          showClubCompetitionAvailableJudokasPreviousPage,
          showClubCompetitionAvailableJudokasNextPage,
          setClubParticipantRanking
        },
        {
          isSubmitting,
          clubRankingOptions,
          clubCompetitionParticipantsPage: clubCompetitionParticipantsPaginationRefs.page,
          clubCompetitionParticipantsTotalPages: clubCompetitionParticipantsPaginationRefs.totalPages,
          clubCompetitionParticipantsCurrentPage: clubCompetitionParticipantsPaginationRefs.currentPage,
          clubCompetitionParticipantsTotalCount: clubCompetitionParticipantsPaginationRefs.totalCount,
          clubCompetitionParticipantsCanShowPreviousPage: clubCompetitionParticipantsPaginationRefs.canShowPreviousPage,
          clubCompetitionParticipantsCanShowNextPage: clubCompetitionParticipantsPaginationRefs.canShowNextPage,
          clubCompetitionAvailableJudokasFiltered,
          clubCompetitionAvailableJudokasPage: clubCompetitionAvailableJudokasPaginationRefs.page,
          clubCompetitionAvailableJudokasTotalPages: clubCompetitionAvailableJudokasPaginationRefs.totalPages,
          clubCompetitionAvailableJudokasCurrentPage: clubCompetitionAvailableJudokasPaginationRefs.currentPage,
          clubCompetitionAvailableJudokasTotalCount: clubCompetitionAvailableJudokasPaginationRefs.totalCount,
          clubCompetitionAvailableJudokasCanShowPreviousPage: clubCompetitionAvailableJudokasPaginationRefs.canShowPreviousPage,
          clubCompetitionAvailableJudokasCanShowNextPage: clubCompetitionAvailableJudokasPaginationRefs.canShowNextPage
        }
      );
    }

    // CLUB-1 : le classement de chaque participant se choisit sur sa ligne.
    const clubRankingOptions = window.Vue.computed(() =>
      ["1er", "2e", "3e", "5e", "7e", "Non classé"].map((value) => ({ value, label: value === "Non classé" ? "NC" : value }))
    );

    function setClubParticipantRanking(competitionId: string, result: string) {
      const participant = clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants.find(
        (candidate) => candidate.competitionId === competitionId
      );
      if (!participant || participant.rawResult === result) return;
      app.runServer(
        "finalizeCompetition",
        [competitionId, result],
        (response) => {
          Object.assign(participant, {
            rawResult: result,
            result: formatCompetitionRanking(result),
            resultClass: getClassementBadgeClass(result),
            hasResult: true
          });
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

    function updateClubCompetitionJudokaSearch() {
      state.clubCompetitionFormParticipantsCurrentPage = 1;
    }

    function updateClubCompetitionAgeCategory() {
      clubCompetitionFormViewModel.clubCompetitionFormErrors.ageCategory = "";
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

    function updateClubCompetitionDetailAgeCategory() {
      const ageCategory = cleanText(clubCompetitionDetailViewModel.clubCompetitionDetailForm.ageCategory);
      const allowedIds = new Set(
        clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas
          .filter((judoka) => !ageCategory || judoka.ageCategory === ageCategory)
          .map((judoka) => String(judoka.judokaId))
      );
      clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds =
        clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds.filter((id) =>
          allowedIds.has(String(id))
        );
      state.clubCompetitionAvailableJudokasCurrentPage = 1;
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
        ageCategory: String(j.ageCategory || ""),
        clubId: String(j.clubId || "")
      }));
      // Club par défaut : celui filtré sur l'accueil, ou l'unique club du coach.
      const defaultClubId =
        state.selectedClubId || (state.clubs.length === 1 ? state.clubs[0].clubId : "");
      clubCompetitionFormViewModel.clubCompetitionParticipants = allParticipants;
      clubCompetitionFormViewModel.judokaSearchText = "";
      Object.assign(clubCompetitionFormViewModel.clubCompetitionFormErrors, { clubId: "", name: "", ageCategory: "" });
      Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
        clubCompetitionId: "",
        name: "",
        competitionDate: getCurrentLocalDate(),
        ageCategory: "",
        level: "",
        clubId: defaultClubId,
        participantJudokaIds: []
      });
      state.clubCompetitionFormParticipantsCurrentPage = 1;
      showView("clubCompetitionFormView");
    }

    // Changer de club retire les judokas déjà cochés qui n'en font pas partie.
    function updateClubCompetitionClub() {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      clubCompetitionFormViewModel.clubCompetitionFormErrors.clubId = "";
      const clubJudokaIds = new Set(
        clubCompetitionFormViewModel.clubCompetitionParticipants
          .filter((p) => p.clubId === form.clubId)
          .map((p) => p.judokaId)
      );
      form.participantJudokaIds = form.participantJudokaIds.filter((id) => clubJudokaIds.has(String(id)));
      state.clubCompetitionFormParticipantsCurrentPage = 1;
    }

    function cancelClubCompetitionForm() {
      showView("homeView");
    }

    function saveClubCompetition() {
      ensureClubCompetitionFormViewModel();
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      // COMBAT-2 : club, nom et catégorie vérifiés avant l'envoi.
      const errors = clubCompetitionFormViewModel.clubCompetitionFormErrors;
      errors.clubId = form.clubId || state.clubs.length <= 1 ? "" : "Choisissez le club.";
      errors.name = cleanText(form.name) ? "" : "Indiquez le nom de la compétition.";
      errors.ageCategory = form.ageCategory ? "" : "Choisissez la catégorie d'âge.";
      const firstInvalidField = errors.clubId
        ? "club_competition_club"
        : errors.name
          ? "club_competition_name"
          : errors.ageCategory
            ? "club_competition_categorie_age"
            : "";
      if (firstInvalidField) {
        window.Vue.nextTick(() => document.getElementById(firstInvalidField)?.focus());
        return;
      }
      app.runServer(
        "saveClubCompetition",
        [form],
        (response) => {
          showSuccess(response.message);
          applySavedClubCompetition(response);
          app.showHome && app.showHome();
        },
        showError
      );
    }

    // ECRIT-2 : la compétition club enregistrée met à jour l'accueil sans rechargement.
    function applySavedClubCompetition(response: OperationResult) {
      if (response.clubCompetition) {
        app.local.saveClubCompetition(response.clubCompetition, response.competitions || []);
      }
    }

    function openClubCompetition(id: string) {
      clearMessage();
      ensureClubCompetitionDetailViewModel();
      clubCompetitionDetailViewModel.clubCompetitionDetailTitle = "Chargement...";
      clubCompetitionDetailViewModel.clubCompetitionDetailSummary = "";
      clubCompetitionDetailViewModel.clubCompetitionDetailEditing = false;
      clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants = [];
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas = [];
      clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked = false;
      clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [];
      showView("clubCompetitionDetailView", { routeState: { clubCompetitionId: id } });

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
            level: cc.niveau || ""
          });
          clubCompetitionDetailViewModel.clubCompetitionDetailTitle = formatCompetitionName(cc.nom) || "Compétition club";
          clubCompetitionDetailViewModel.clubCompetitionDetailSummary = [
            ui.formatDateLong(cc.date),
            cc.categorie_age,
            cc.niveau
          ]
            .map((value) => cleanText(value))
            .filter(Boolean)
            .join(" · ");
          const combatRecords = data.combatRecords || {};
          clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants = data.participations
            .map((p) => {
              const judoka = judokasById.get(String(p.ownerJudokaId));
              const record = combatRecords[String(p.competitionId || "")];
              return {
                competitionId: p.competitionId || "",
                judokaName: judoka ? getJudokaDisplayName(judoka) : String(p.ownerJudokaId),
                rawResult: cleanText(p.result),
                result: formatCompetitionRanking(p.result) || "",
                resultClass: getClassementBadgeClass(p.result),
                combatSummary: formatCombatSummary(record),
                hasCombats: Boolean(record && record.total),
                hasResult: Boolean(cleanText(p.result)),
                order: getRankingOrder(p.result)
              };
            })
            .sort((a, b) => a.order - b.order || a.judokaName.localeCompare(b.judokaName, "fr"))
            .map(({ competitionId, judokaName, rawResult, result, resultClass, combatSummary, hasCombats, hasResult }) => ({
              competitionId,
              judokaName,
              rawResult,
              result,
              resultClass,
              combatSummary,
              hasCombats,
              hasResult
            }));
          clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked =
            Boolean(cc.date) && String(cc.date) <= getCurrentLocalDate();
          state.clubCompetitionParticipantsCurrentPage = 1;
          // Seuls les judokas du club de la compétition peuvent y être ajoutés.
          const eventClubId = String(cc.club_id || "");
          const available = state.judokas
            .filter((j) => !participantJudokaIds.has(String(j.judokaId)))
            .filter((j) => String(j.clubId || "") === eventClubId)
            .map((j) => ({
              judokaId: String(j.judokaId || ""),
              name: getJudokaDisplayName(j) || "Judoka",
              ageCategory: String(j.ageCategory || ""),
              clubId: String(j.clubId || "")
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
            level: form.level,
            participantJudokaIds: clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds
          }
        ],
        (response) => {
          showSuccess(response.message);
          applySavedClubCompetition(response);
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
      const isPast = clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked;
      app.confirmAndRun({
        message: isPast
          ? `Retirer ${judokaName} de cette compétition club ? Aucun combat ni classement n'a été saisi : sa participation sera définitivement supprimée.`
          : `Retirer ${judokaName} de cette compétition club ? La compétition n'a pas encore eu lieu : sa participation individuelle sera définitivement supprimée.`,
        method: "detachClubCompetitionParticipant",
        args: [clubCompetitionId, competitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.local.removeCompetition(competitionId);
          openClubCompetition(clubCompetitionId);
        }
      });
    }

    function cancelClubCompetitionDetail() {
      showView("homeView");
    }

    function startClubCompetitionDetailEdit() {
      clubCompetitionDetailViewModel.clubCompetitionDetailEditing = true;
    }

    function cancelClubCompetitionDetailEdit() {
      const clubCompetitionId =
        clubCompetitionDetailViewModel.clubCompetitionDetailForm.clubCompetitionId;
      if (clubCompetitionId) {
        openClubCompetition(clubCompetitionId);
      } else {
        clubCompetitionDetailViewModel.clubCompetitionDetailEditing = false;
      }
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
        message: `Supprimer la compétition club "${name}" ? Les participations individuelles seront détachées et leurs combats seront conservés.`,
        method: "deleteClubCompetition",
        args: [clubCompetitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.local.removeClubCompetition(clubCompetitionId);
          app.showHome && app.showHome();
        }
      });
    }

    return {
      cancelClubCompetitionDetail,
      cancelClubCompetitionForm,
      confirmDeleteClubCompetition,
      confirmDeleteClubCompetitionById,
      confirmDetachClubParticipant,
      openClubCompetition,
      saveClubCompetition,
      saveClubCompetitionDetails,
      showClubCompetitionForm
    };
  }

  window.createKirokuClubCompetitionScreen = createKirokuClubCompetitionScreen;
})();
