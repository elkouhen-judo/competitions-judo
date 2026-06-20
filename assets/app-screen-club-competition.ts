(() => {
  type KirokuApp = import("./types").KirokuApp;
  type ClubCompetitionDetail = import("../core/types").ClubCompetitionDetail;
  type ClubCompetitionDeps = import("./types").ClubCompetitionDeps;

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

  function createKirokuClubCompetitionScreen(app: KirokuApp, deps: ClubCompetitionDeps) {
    const { defaultListPageSize, state, ui, notifications } = app;
    const {
      cleanText,
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
          updateClubCompetitionDetailAgeCategory,
          updateClubAvailableJudokaSearch,
          showClubCompetitionParticipantsPreviousPage,
          showClubCompetitionParticipantsNextPage,
          showClubCompetitionAvailableJudokasPreviousPage,
          showClubCompetitionAvailableJudokasNextPage
        },
        {
          isSubmitting,
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
        ageCategory: String(j.ageCategory || "")
      }));
      clubCompetitionFormViewModel.clubCompetitionParticipants = allParticipants;
      clubCompetitionFormViewModel.judokaSearchText = "";
      Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
        clubCompetitionId: "",
        name: "",
        competitionDate: getCurrentLocalDate(),
        ageCategory: "",
        level: "",
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
      clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked = false;
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
            level: cc.niveau || ""
          });
          clubCompetitionDetailViewModel.clubCompetitionDetailTitle = cc.nom || "Compétition club";
          clubCompetitionDetailViewModel.clubCompetitionCurrentParticipants =
            data.participations.map((p) => {
              const judoka = judokasById.get(String(p.ownerJudokaId));
              return {
                competitionId: p.competitionId || "",
                judokaName: judoka ? getJudokaDisplayName(judoka) : String(p.ownerJudokaId),
                result: formatCompetitionRanking(p.result) || "Non classé",
                resultClass: getClassementBadgeClass(p.result)
              };
            });
          clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked =
            data.participations.some((p) => Boolean(cleanText(p.result)));
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
      if (
        clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked &&
        clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds.length
      ) {
        showError("Les participants sont verrouillés car la compétition est terminée.");
        return;
      }
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
      if (clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked) {
        showError("Les participants sont verrouillés car la compétition est terminée.");
        return;
      }
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
        message: `Supprimer la compétition club "${name}" ? Les participations individuelles seront détachées et leurs combats seront conservés.`,
        method: "deleteClubCompetition",
        args: [clubCompetitionId],
        onSuccess: (response) => {
          showSuccess(response.message);
          app.reloadInitialData();
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
