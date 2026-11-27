(() => {
  type KirokuApp = import("./types").KirokuApp;
  type Judoka = import("../core/types").Judoka;
  type ClubCompetitionDetail = import("../core/types").ClubCompetitionDetail;
  type ClubCompetitionDeps = import("./types").ClubCompetitionDeps;
  type OperationResult = import("./types").OperationResult;
  type CoachDashboardCompetitionPreset = import("./types").CoachDashboardCompetitionPreset;
  type ClubCompetitionPrefill = import("./types").ClubCompetitionPrefill;
  type ViewId = import("./types").ViewId;

  interface ClubCompetitionJudokaOption {
    judokaId: string;
    name: string;
    ageCategory: string;
    /** CLUB-001 : toutes les structures du judoka. */
    clubIds: string[];
    registrationSeason?: number | null;
  }

  type CombatRecord = { total: number; wins: number; losses: number; draws: number };

  // Participant tel que lu sur le serveur ; l'affichage le complète avec l'état de l'appli (COACH-2).
  interface ClubCompetitionParticipant {
    competitionId: string;
    judokaName: string;
    rawResult: string;
    record?: CombatRecord;
    beltColor?: string;
  }

  interface ClubCompetitionParticipantCard {
    competitionId: string;
    judokaName: string;
    beltBackground: string;
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

  function formatCombatSummary(record: CombatRecord | undefined) {
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
      formatSeasonLabel,
      getCurrentLocalDate,
      getJudokaClubIds,
      getJudokaDisplayName,
      getSeasonStartYear,
      isRegisteredForDate,
      showView
    } = ui;
    const { clearMessage, showError, showSuccess } = notifications;
    const { openCompetitionFromClubDetail } = deps;

    const EMPTY_CLUB_COMPETITION_FORM_ERRORS = {
      clubId: "",
      name: "",
      competitionDate: "",
      ageCategory: "",
      level: "",
      participants: ""
    };
    const clubCompetitionLevelOptions = window.Vue.computed(() => ["Départemental", "Régional", "National", "International"]);

    const defaultClubCompetitionFormViewState = {
      clubCompetitionFormTitle: "Nouvelle compétition",
      clubCompetitionFormNotice: "",
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
      clubCompetitionParticipantsRaw: [] as ClubCompetitionParticipant[],
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      clubCompetitionParticipantsLocked: false,
      clubCompetitionUnregisteredCount: 0,
      judokaAvailableSearchText: "",
      clubCompetitionNewJudokaIds: [] as string[]
    };

    const clubCompetitionFormViewModel = window.Vue.reactive({
      ...defaultClubCompetitionFormViewState,
      clubCompetitionFormErrors: { ...EMPTY_CLUB_COMPETITION_FORM_ERRORS },
      clubCompetitionForm: { ...defaultClubCompetitionFormViewState.clubCompetitionForm, participantJudokaIds: [] as string[] }
    });
    let clubCompetitionFormMounted = false;
    let clubCompetitionFormSnapshot = "";
    const clubCompetitionDetailViewModel = window.Vue.reactive({
      ...defaultClubCompetitionDetailViewState,
      clubCompetitionDetailForm: { ...defaultClubCompetitionDetailViewState.clubCompetitionDetailForm },
      clubCompetitionParticipantsRaw: [] as ClubCompetitionParticipant[],
      clubCompetitionAvailableJudokas: [] as ClubCompetitionJudokaOption[],
      clubCompetitionParticipantsLocked: false,
      clubCompetitionUnregisteredCount: 0,
      clubCompetitionNewJudokaIds: [] as string[]
    });
    let clubCompetitionDetailMounted = false;

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);

    function toJudokaOption(j: Judoka): ClubCompetitionJudokaOption {
      return {
        judokaId: String(j.judokaId || ""),
        name: getJudokaDisplayName(j) || "Judoka",
        ageCategory: String(j.ageCategory || ""),
        clubIds: getJudokaClubIds(j),
        registrationSeason: j.registrationSeason
      };
    }

    function isOptionRegistered(option: ClubCompetitionJudokaOption, dateValue?: string) {
      const date = dateValue ?? clubCompetitionFormViewModel.clubCompetitionForm.competitionDate;
      return isRegisteredForDate({ profileType: "JUDOKA", registrationSeason: option.registrationSeason }, date);
    }

    // Seuls les judokas du club et de la catégorie de la compétition peuvent y être inscrits.
    const clubCompetitionFormCategoryParticipants = window.Vue.computed(() => {
      const ageCategory = cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory);
      const clubId = clubCompetitionFormViewModel.clubCompetitionForm.clubId;
      if (!ageCategory || !clubId) {
        return [];
      }
      return clubCompetitionFormViewModel.clubCompetitionParticipants.filter(
        (p) => p.clubIds.includes(clubId) && p.ageCategory === ageCategory && isOptionRegistered(p)
      );
    });
    // INSCR-2 : les judokas de la catégorie non réinscrits pour la saison de la compétition.
    const clubCompetitionFormUnregisteredText = window.Vue.computed(() => {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      const ageCategory = cleanText(form.ageCategory);
      const season = getSeasonStartYear(form.competitionDate);
      if (!ageCategory || !form.clubId || season === null) return "";
      const count = clubCompetitionFormViewModel.clubCompetitionParticipants.filter(
        (p) => p.clubIds.includes(form.clubId) && p.ageCategory === ageCategory && !isOptionRegistered(p)
      ).length;
      if (!count) return "";
      const label = formatSeasonLabel(season);
      return count > 1
        ? `${count} judokas de la catégorie ne sont pas réinscrits pour la saison ${label}.`
        : `1 judoka de la catégorie n'est pas réinscrit pour la saison ${label}.`;
    });
    const clubCompetitionFormSelectedIds = window.Vue.computed(
      () => new Set(clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds.map(String))
    );
    // CREA-6 / UIX-043 : la liste ne propose que les judokas à ajouter ; les inscrits sont dans les pastilles.
    const clubCompetitionFormParticipantsFiltered = window.Vue.computed(() => {
      const query = cleanText(clubCompetitionFormViewModel.judokaSearchText).toLowerCase();
      return clubCompetitionFormCategoryParticipants.value.filter(
        (p) =>
          !clubCompetitionFormSelectedIds.value.has(String(p.judokaId)) &&
          (!query || p.name.toLowerCase().includes(query))
      );
    });
    // CREA-5 : les judokas inscrits, dans l'ordre où ils ont été ajoutés.
    const clubCompetitionFormSelectedParticipants = window.Vue.computed(() => {
      const participantsById = new Map(
        clubCompetitionFormViewModel.clubCompetitionParticipants.map((p) => [String(p.judokaId), p])
      );
      return clubCompetitionFormViewModel.clubCompetitionForm.participantJudokaIds
        .map((id) => participantsById.get(String(id)))
        .filter((participant): participant is ClubCompetitionJudokaOption => Boolean(participant));
    });
    // CREA-8 : un judoka sans catégorie d'âge n'apparaît dans aucune catégorie : il est signalé.
    const clubCompetitionFormUncategorizedText = window.Vue.computed(() => {
      const clubId = clubCompetitionFormViewModel.clubCompetitionForm.clubId;
      if (!clubId) return "";
      const count = clubCompetitionFormViewModel.clubCompetitionParticipants.filter(
        (p) => p.clubIds.includes(clubId) && !cleanText(p.ageCategory)
      ).length;
      if (!count) return "";
      return count > 1
        ? `${count} judokas du club n'ont pas de catégorie d'âge.`
        : "1 judoka du club n'a pas de catégorie d'âge.";
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
          !selectedIds.has(String(j.judokaId)) &&
          (!query || j.name.toLowerCase().includes(query))
      );
    });
    // UIX-043 : les judokas à ajouter, en pastilles, dans l'ordre où ils ont été choisis.
    const clubCompetitionNewJudokas = window.Vue.computed(() => {
      const judokasById = new Map(
        clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas.map((j) => [String(j.judokaId), j])
      );
      return clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds
        .map((id) => judokasById.get(String(id)))
        .filter((judoka): judoka is ClubCompetitionJudokaOption => Boolean(judoka));
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

    // COACH-2 : au retour de la fiche d'un participant, ses combats et son classement sont relus
    // dans l'état de l'appli, mis à jour par chaque enregistrement (y compris hors ligne).
    const clubCompetitionCurrentParticipants = window.Vue.computed((): ClubCompetitionParticipantCard[] => {
      const competitionsById = new Map(state.competitions.map((competition) => [String(competition.competitionId), competition]));
      return clubCompetitionDetailViewModel.clubCompetitionParticipantsRaw.map((participant) => {
        const known = competitionsById.get(participant.competitionId);
        const record = state.combatRecords[participant.competitionId] || participant.record;
        const rawResult = known ? cleanText(known.result) : participant.rawResult;
        const hasCombats = Boolean(record && record.total);
        return {
          competitionId: participant.competitionId,
          judokaName: participant.judokaName,
          beltBackground: ui.getBeltBackground(participant.beltColor),
          rawResult,
          result: formatCompetitionRanking(rawResult) || "",
          resultClass: getClassementBadgeClass(rawResult),
          combatSummary: formatCombatSummary(record),
          hasCombats,
          hasResult: Boolean(rawResult)
        };
      });
    });
    // V3 A : l'avancement du classement et le bilan du club sur la compétition.
    const clubCompetitionProgress = window.Vue.computed(() => {
      const participants = clubCompetitionCurrentParticipants.value;
      const total = participants.length;
      const ranked = participants.filter((p) => p.hasResult).length;
      const podiums = participants.filter((p) => ["1er", "2e", "3e"].includes(p.rawResult)).length;
      let wins = 0;
      let losses = 0;
      for (const participant of participants) {
        const record = state.combatRecords[participant.competitionId];
        wins += record ? Number(record.wins || 0) : 0;
        losses += record ? Number(record.losses || 0) : 0;
      }
      const facts = [
        podiums ? `${podiums} podium${podiums > 1 ? "s" : ""}` : "",
        wins + losses ? `${wins} V · ${losses} D` : ""
      ];
      return {
        title: `${ranked} classé${ranked > 1 ? "s" : ""} sur ${total}`,
        remainingLabel: total - ranked ? `${total - ranked} à classer` : "Tous classés",
        ranked,
        pending: total - ranked,
        facts: facts.filter(Boolean).join(" · ")
      };
    });

    function openClubParticipantCompetition(competitionId: string) {
      openCompetitionFromClubDetail(
        competitionId,
        clubCompetitionCurrentParticipants.value.map(({ competitionId: id, judokaName }) => ({ competitionId: id, judokaName }))
      );
    }

    const clubCompetitionParticipantsPagination = window.Vue.computed(() =>
      window.KirokuScreenProjections.paginateList(
        clubCompetitionCurrentParticipants.value,
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
          onChoiceKeydown: ui.onChoiceKeydown,
          removeClubCompetitionParticipant,
          saveClubCompetition,
          selectClubCompetitionLevel,
          addAllClubCompetitionParticipants,
          addClubCompetitionParticipant,
          updateClubCompetitionAgeCategory,
          updateClubCompetitionDate,
          updateClubCompetitionJudokaSearch,
          updateClubCompetitionClub,
          showClubCompetitionFormParticipantsPreviousPage,
          showClubCompetitionFormParticipantsNextPage
        },
        {
          isSubmitting,
          clubCompetitionFormCategoryParticipants,
          clubCompetitionFormParticipantsFiltered,
          clubCompetitionFormSelectedParticipants,
          clubCompetitionFormUncategorizedText,
          clubCompetitionFormUnregisteredText,
          clubCompetitionLevelOptions,
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
          openClubParticipantCompetition,
          saveClubCompetitionDetails,
          updateClubCompetitionDetailAgeCategory,
          updateClubAvailableJudokaSearch,
          showClubCompetitionParticipantsPreviousPage,
          showClubCompetitionParticipantsNextPage,
          showClubCompetitionAvailableJudokasPreviousPage,
          showClubCompetitionAvailableJudokasNextPage,
          setClubParticipantRanking,
          showClubCompetitionStats,
          selectClubCompetitionDetailLevel,
          addAllClubAvailableJudokas,
          addClubAvailableJudoka,
          removeClubAvailableJudoka,
          onChoiceKeydown: ui.onChoiceKeydown
        },
        {
          isSubmitting,
          canShowClubCompetitionStats,
          clubCompetitionProgress,
          clubRankingOptions,
          clubCompetitionCurrentParticipants,
          clubCompetitionNewJudokas,
          clubCompetitionLevelOptions,
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

    // TDB-1 : les statistiques d'une compétition s'ouvrent depuis sa fiche, une fois des combats saisis.
    // STAT-20 : il faut au moins 2 judokas ayant combattu (MIN_GROUP_JUDOKAS côté serveur).
    const MIN_GROUP_JUDOKAS = 2;
    let clubCompetitionStatsTarget: CoachDashboardCompetitionPreset | null = null;
    const canShowClubCompetitionStats = window.Vue.computed(
      () =>
        !clubCompetitionDetailViewModel.clubCompetitionDetailEditing &&
        clubCompetitionCurrentParticipants.value.filter((p) => p.hasCombats).length >=
          MIN_GROUP_JUDOKAS
    );

    function showClubCompetitionStats() {
      if (clubCompetitionStatsTarget) {
        app.screens.coachDashboard.showCoachDashboard({ competition: clubCompetitionStatsTarget });
      }
    }

    // CLUB-1 : le classement de chaque participant se choisit sur sa ligne.
    const clubRankingOptions = window.Vue.computed(() =>
      ["1er", "2e", "3e", "5e", "7e", "Non classé"].map((value) => ({
        value,
        label: value === "Non classé" ? "NC" : value,
        medalClass: getClassementBadgeClass(value).replace("rank-finalist", "")
      }))
    );

    function setClubParticipantRanking(competitionId: string, result: string) {
      const participant = clubCompetitionDetailViewModel.clubCompetitionParticipantsRaw.find(
        (candidate) => candidate.competitionId === competitionId
      );
      const displayed = clubCompetitionCurrentParticipants.value.find((candidate) => candidate.competitionId === competitionId);
      if (!participant || !displayed || displayed.rawResult === result) return;
      app.runServer(
        "finalizeCompetition",
        [competitionId, result],
        (response) => {
          participant.rawResult = result;
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

    // CREA-7 : retire les judokas qui ne correspondent plus, et dit combien et pourquoi.
    function keepClubCompetitionParticipants(isAllowed: (participant: ClubCompetitionJudokaOption) => boolean, reason: string) {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      const allowedIds = new Set(
        clubCompetitionFormViewModel.clubCompetitionParticipants.filter(isAllowed).map((p) => String(p.judokaId))
      );
      const kept = form.participantJudokaIds.filter((id) => allowedIds.has(String(id)));
      const removed = form.participantJudokaIds.length - kept.length;
      form.participantJudokaIds = kept;
      clubCompetitionFormViewModel.clubCompetitionFormNotice = removed
        ? removed > 1
          ? `${removed} judokas retirés : ils ne sont pas dans ${reason}.`
          : `1 judoka retiré : il n'est pas dans ${reason}.`
        : "";
      state.clubCompetitionFormParticipantsCurrentPage = 1;
    }

    // INSCR-2 : changer la date peut changer de saison ; les non-réinscrits sont retirés.
    function updateClubCompetitionDate() {
      clubCompetitionFormViewModel.clubCompetitionFormErrors.competitionDate = "";
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      const participantsById = new Map(
        clubCompetitionFormViewModel.clubCompetitionParticipants.map((p) => [String(p.judokaId), p])
      );
      const kept = form.participantJudokaIds.filter((id) => {
        const participant = participantsById.get(String(id));
        return !participant || isOptionRegistered(participant);
      });
      const removed = form.participantJudokaIds.length - kept.length;
      if (!removed) return;
      form.participantJudokaIds = kept;
      const season = getSeasonStartYear(form.competitionDate);
      const label = season === null ? "" : ` pour la saison ${formatSeasonLabel(season)}`;
      clubCompetitionFormViewModel.clubCompetitionFormNotice =
        removed > 1
          ? `${removed} judokas retirés : ils ne sont pas réinscrits${label}.`
          : `1 judoka retiré : il n'est pas réinscrit${label}.`;
      state.clubCompetitionFormParticipantsCurrentPage = 1;
    }

    function updateClubCompetitionAgeCategory() {
      clubCompetitionFormViewModel.clubCompetitionFormErrors.ageCategory = "";
      const ageCategory = cleanText(clubCompetitionFormViewModel.clubCompetitionForm.ageCategory);
      keepClubCompetitionParticipants(
        (participant) => !ageCategory || participant.ageCategory === ageCategory,
        "cette catégorie"
      );
    }

    function selectClubCompetitionLevel(level: string) {
      clubCompetitionFormViewModel.clubCompetitionForm.level = level;
      clubCompetitionFormViewModel.clubCompetitionFormErrors.level = "";
    }

    // CREA-4 : ajoute d'un coup toute la liste affichée, toutes pages confondues.
    function addAllClubCompetitionParticipants() {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      const listedIds = clubCompetitionFormParticipantsFiltered.value.map((p) => String(p.judokaId));
      form.participantJudokaIds = [...form.participantJudokaIds, ...listedIds];
      clubCompetitionFormViewModel.clubCompetitionFormErrors.participants = "";
    }

    function addClubCompetitionParticipant(judokaId: string) {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      if (!clubCompetitionFormSelectedIds.value.has(String(judokaId))) {
        form.participantJudokaIds = [...form.participantJudokaIds, String(judokaId)];
      }
      clubCompetitionFormViewModel.clubCompetitionFormErrors.participants = "";
    }

    function removeClubCompetitionParticipant(judokaId: string) {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      form.participantJudokaIds = form.participantJudokaIds.filter((id) => String(id) !== String(judokaId));
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

    // AGD-018 : vue rouverte en quittant le formulaire (l'agenda quand il en vient).
    let clubCompetitionFormReturnView: ViewId = "homeView";

    function showClubCompetitionForm(prefill?: ClubCompetitionPrefill) {
      clearMessage();
      clubCompetitionFormReturnView = prefill ? "ffjudoAgendaView" : "homeView";
      ensureClubCompetitionFormViewModel();
      const allParticipants = state.judokas.map(toJudokaOption);
      // Club par défaut : celui filtré sur l'accueil, ou l'unique club du coach.
      const defaultClubId =
        state.selectedClubId || (state.clubs.length === 1 ? state.clubs[0].clubId : "");
      clubCompetitionFormViewModel.clubCompetitionParticipants = allParticipants;
      clubCompetitionFormViewModel.judokaSearchText = "";
      Object.assign(clubCompetitionFormViewModel.clubCompetitionFormErrors, EMPTY_CLUB_COMPETITION_FORM_ERRORS);
      clubCompetitionFormViewModel.clubCompetitionFormNotice = "";
      Object.assign(clubCompetitionFormViewModel.clubCompetitionForm, {
        clubCompetitionId: "",
        name: prefill?.name || "",
        competitionDate: prefill?.competitionDate || getCurrentLocalDate(),
        ageCategory: prefill?.ageCategory || "",
        level: prefill?.level || "",
        clubId: defaultClubId,
        participantJudokaIds: []
      });
      state.clubCompetitionFormParticipantsCurrentPage = 1;
      clubCompetitionFormSnapshot = serializeClubCompetitionForm();
      showView("clubCompetitionFormView");
    }

    function serializeClubCompetitionForm(): string {
      return JSON.stringify(clubCompetitionFormViewModel.clubCompetitionForm);
    }

    // Changer de club retire les judokas déjà cochés qui n'en font pas partie.
    function updateClubCompetitionClub() {
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      clubCompetitionFormViewModel.clubCompetitionFormErrors.clubId = "";
      keepClubCompetitionParticipants((p) => p.clubIds.includes(form.clubId), "ce club");
    }

    // CREA-3 : quitter un formulaire modifié demande confirmation pour ne rien perdre.
    async function cancelClubCompetitionForm() {
      const hasChanges = clubCompetitionFormSnapshot !== "" && serializeClubCompetitionForm() !== clubCompetitionFormSnapshot;
      if (
        hasChanges &&
        !(await app.notifications.confirmAction({
          message: "Quitter sans enregistrer ? La compétition et ses inscriptions seront perdues.",
          confirmLabel: "Quitter sans enregistrer",
          cancelLabel: "Continuer la saisie",
          danger: true
        }))
      ) {
        return;
      }
      clubCompetitionFormSnapshot = "";
      showView(clubCompetitionFormReturnView);
    }

    function saveClubCompetition() {
      ensureClubCompetitionFormViewModel();
      // CREA-2 : sans club, rien n'est envoyé.
      if (hasNoCoachClub.value) return;
      const form = clubCompetitionFormViewModel.clubCompetitionForm;
      // CREA-1 : tous les champs exigés par le serveur sont vérifiés avant l'envoi, dans l'ordre de l'écran.
      const errors = clubCompetitionFormViewModel.clubCompetitionFormErrors;
      errors.clubId = form.clubId || state.clubs.length <= 1 ? "" : "Choisissez le club.";
      errors.name = cleanText(form.name) ? "" : "Indiquez le nom de la compétition.";
      errors.competitionDate = form.competitionDate ? "" : "Indiquez la date.";
      errors.ageCategory = form.ageCategory ? "" : "Choisissez la catégorie d'âge.";
      errors.level = form.level ? "" : "Choisissez le niveau.";
      errors.participants = form.participantJudokaIds.length ? "" : "Ajoutez au moins un judoka.";
      const fieldByError: Array<[string, string]> = [
        [errors.clubId, "club_competition_club"],
        [errors.name, "club_competition_name"],
        [errors.competitionDate, "club_competition_date"],
        [errors.ageCategory, "club_competition_categorie_age"],
        [errors.level, "club_competition_niveau"],
        [errors.participants, "clubCompetitionParticipants"]
      ];
      const firstInvalidField = fieldByError.find(([error]) => error)?.[1] || "";
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
          clubCompetitionFormSnapshot = "";
          // CREA-10 : la compétition créée s'ouvre, prête pour la saisie des combats.
          const createdId = response.clubCompetition?.clubCompetitionId;
          if (createdId) {
            openClubCompetition(createdId);
          } else if (app.showHome) {
            app.showHome();
          }
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
      clubCompetitionDetailSnapshot = "";
      clubCompetitionDetailViewModel.clubCompetitionParticipantsRaw = [];
      clubCompetitionDetailViewModel.clubCompetitionAvailableJudokas = [];
      clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked = false;
      clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [];
      clubCompetitionStatsTarget = null;
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
          clubCompetitionStatsTarget = {
            clubCompetitionId: String(cc.id_club_competition || id),
            name: String(cc.nom || ""),
            competitionDate: String(cc.date || ""),
            clubId: String(cc.club_id || ""),
            competitionIds: data.participations.map((p) => String(p.competitionId || "")).filter(Boolean)
          };
          // MULTI-1 : un coach de plusieurs clubs lit le club de la compétition sous son titre.
          const eventClub = state.clubs.length > 1
            ? state.clubs.find((club) => club.clubId === String(cc.club_id || ""))
            : undefined;
          clubCompetitionDetailViewModel.clubCompetitionDetailSummary = [
            eventClub ? eventClub.name : "",
            ui.formatDateLong(cc.date),
            cc.categorie_age,
            cc.niveau
          ]
            .map((value) => cleanText(value))
            .filter(Boolean)
            .join(" · ");
          const combatRecords = data.combatRecords || {};
          // Le serveur fait foi au chargement : ses bilans de combats remplacent ceux gardés en mémoire.
          state.combatRecords = { ...state.combatRecords, ...combatRecords };
          clubCompetitionDetailViewModel.clubCompetitionParticipantsRaw = data.participations
            .map((p) => {
              const judoka = judokasById.get(String(p.ownerJudokaId));
              return {
                competitionId: String(p.competitionId || ""),
                judokaName: judoka ? getJudokaDisplayName(judoka) : String(p.ownerJudokaId),
                rawResult: cleanText(p.result),
                record: combatRecords[String(p.competitionId || "")],
                beltColor: judoka ? String(judoka.beltColor || "") : "",
                order: getRankingOrder(p.result)
              };
            })
            .sort((a, b) => a.order - b.order || a.judokaName.localeCompare(b.judokaName, "fr"))
            .map(({ competitionId, judokaName, rawResult, record, beltColor }) => ({
              competitionId,
              judokaName,
              rawResult,
              record,
              beltColor
            }));
          const serverParticipations = new Map(data.participations.map((p) => [String(p.competitionId), p]));
          state.competitions = state.competitions.map((competition) => {
            const fresh = serverParticipations.get(String(competition.competitionId));
            return fresh ? { ...competition, result: fresh.result, coachReview: fresh.coachReview } : competition;
          });
          clubCompetitionDetailViewModel.clubCompetitionParticipantsLocked =
            Boolean(cc.date) && String(cc.date) <= getCurrentLocalDate();
          state.clubCompetitionParticipantsCurrentPage = 1;
          // Seuls les judokas du club de la compétition peuvent y être ajoutés.
          const eventClubId = String(cc.club_id || "");
          let available = state.judokas
            .filter((j) => !participantJudokaIds.has(String(j.judokaId)))
            .filter((j) => getJudokaClubIds(j).includes(eventClubId))
            .map(toJudokaOption);
          // INSCR-2 : les judokas non réinscrits pour la saison de la compétition ne sont pas proposés.
          clubCompetitionDetailViewModel.clubCompetitionUnregisteredCount = available.filter(
            (j) => !isOptionRegistered(j, String(cc.date || ""))
          ).length;
          available = available.filter((j) => isOptionRegistered(j, String(cc.date || "")));
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
        confirmLabel: "Retirer",
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

    async function cancelClubCompetitionDetail() {
      const hasChanges =
        clubCompetitionDetailViewModel.clubCompetitionDetailEditing &&
        clubCompetitionDetailSnapshot !== "" &&
        serializeClubCompetitionDetailForm() !== clubCompetitionDetailSnapshot;
      if (
        hasChanges &&
        !(await app.notifications.confirmAction({
          message: "Quitter sans enregistrer ? Les informations changées et les judokas cochés seront perdus.",
          confirmLabel: "Quitter sans enregistrer",
          cancelLabel: "Continuer la saisie",
          danger: true
        }))
      ) {
        return;
      }
      clubCompetitionDetailSnapshot = "";
      showView("homeView");
    }

    let clubCompetitionDetailSnapshot = "";

    function serializeClubCompetitionDetailForm(): string {
      return JSON.stringify({
        form: clubCompetitionDetailViewModel.clubCompetitionDetailForm,
        added: clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds
      });
    }

    function startClubCompetitionDetailEdit() {
      clubCompetitionDetailViewModel.clubCompetitionDetailEditing = true;
      clubCompetitionDetailSnapshot = serializeClubCompetitionDetailForm();
    }

    function selectClubCompetitionDetailLevel(level: string) {
      clubCompetitionDetailViewModel.clubCompetitionDetailForm.level = level;
    }

    // COACH-7 : ajoute d'un coup les judokas affichés, comme à la création.
    function addAllClubAvailableJudokas() {
      const listedIds = clubCompetitionAvailableJudokasFiltered.value.map((j) => String(j.judokaId));
      clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [
        ...clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds,
        ...listedIds
      ];
    }

    function addClubAvailableJudoka(judokaId: string) {
      const ids = clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds;
      if (!ids.map(String).includes(String(judokaId))) {
        clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds = [...ids, String(judokaId)];
      }
    }

    function removeClubAvailableJudoka(judokaId: string) {
      clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds =
        clubCompetitionDetailViewModel.clubCompetitionNewJudokaIds.filter((id) => String(id) !== String(judokaId));
    }

    // COACH-7 : annuler une modification en cours demande confirmation, comme à la création.
    async function cancelClubCompetitionDetailEdit() {
      const hasChanges =
        clubCompetitionDetailSnapshot !== "" && serializeClubCompetitionDetailForm() !== clubCompetitionDetailSnapshot;
      if (
        hasChanges &&
        !(await app.notifications.confirmAction({
          message: "Annuler les modifications ? Les informations changées et les judokas cochés ne seront pas enregistrés.",
          confirmLabel: "Annuler les modifications",
          cancelLabel: "Continuer la saisie",
          danger: true
        }))
      ) {
        return;
      }
      clubCompetitionDetailSnapshot = "";
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
        message: `Supprimer la compétition club « ${name} » ? Les participations individuelles seront détachées et leurs combats seront conservés.`,
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
