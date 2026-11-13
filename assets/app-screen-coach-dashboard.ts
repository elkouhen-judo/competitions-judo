(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;
  type CoachDashboardCompetitionOption = import("../core/types").CoachDashboardCompetitionOption;
  type CoachDashboardQualityIssueCombat = import("../core/types").CoachDashboardQualityIssueCombat;
  type CoachDashboardCompetitionPreset = import("./types").CoachDashboardCompetitionPreset;

  const COACH_DASHBOARD_REFRESH_DEBOUNCE_MS = 300;
  const COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT = 8;
  const PODIUM_LEVEL_PRIORITY = ["International", "National", "Régional", "Départemental"];
  const PODIUM_PLACE_PRIORITY = ["1er", "2e", "3e"];
  const PODIUM_PLACE_EMOJIS: Record<string, string> = { "1er": "🥇", "2e": "🥈", "3e": "🥉" };

  const COACH_DASHBOARD_JUDOKA_PREVIEW_LIMIT = 10;

  // TDB-9 : chaque métrique dit en une phrase ce qu'elle mesure et sur quels combats (docs/metrics.md).
  const METRIC_DESCRIPTIONS = {
    combats: "Nombre de combats saisis sur les compétitions retenues par les filtres.",
    victories: "Part des combats gagnés, sur tous les combats retenus.",
    podiums: "Premières, deuxièmes et troisièmes places obtenues sur les compétitions retenues.",
    incomplete:
      "Combats concernés par le manque de saisie le plus fréquent. Un combat peut avoir plusieurs manques.",
    effectif: "Judokas différents ayant au moins un combat retenu, par genre puis par garde.",
    podiumsByLevel: "Places obtenues, par niveau de compétition. Une compétition sans classement ne compte pas.",
    byJudoka: "Combats, victoires, défaites et podiums de chaque judoka sur les compétitions retenues.",
    victoriesByType: "Comment les combats gagnés se sont terminés, en part de toutes les victoires.",
    winTechniques: "Techniques les plus marquées par les judokas dans les combats gagnés.",
    defeatsByType: "Comment les combats perdus se sont terminés, en part de toutes les défaites.",
    concededTechniques: "Techniques les plus marquées par les adversaires, tous résultats confondus.",
    ippon: "Combats gagnés avec au moins un Ippon marqué debout ou au sol, en part de tous les combats retenus.",
    lateral:
      "Taux de victoire selon la garde de l'adversaire. Seuls les combats gagnés ou perdus dont les deux gardes sont connues comptent.",
    quality: "Combats dont une information utile aux statistiques manque. Touchez un manque pour voir les combats."
  };

  const DATA_QUALITY_ISSUE_DESCRIPTIONS: Record<string, string> = {
    judokaHandedness:
      "La garde du judoka suivi (droitier/gaucher) n'est pas renseignée sur ce combat — elle alimente les statistiques par garde.",
    opponentStance:
      "La garde de l'adversaire (droitier/gaucher) n'est pas renseignée sur ce combat — elle alimente les statistiques par garde.",
    victoryType:
      "La manière dont le combat s'est terminé (Ippon, Waza-ari...) n'est pas renseignée sur ce combat.",
    scores:
      "Aucun point marqué n'a été détaillé sur ce combat — cela aide à distinguer les Ippon debout et au sol.",
    competitionLevel:
      "Le niveau de la compétition n'est pas renseigné — il alimente les Podiums par niveau.",
    judokaGender:
      "Le genre du judoka suivi n'est pas renseigné — il alimente la répartition Judokas par genre.",
    inconsistentIppon:
      "Le combat est gagné par Ippon, mais aucun point Ippon n'a été détaillé : la saisie mérite une vérification."
  };

  function createKirokuCoachDashboardScreen(app: KirokuApp) {
    const { state, screens, ui } = app;
    const { cleanText, formatDate, getCurrentLocalDate, getJudokaDisplayName, pluralize, showView } = ui;

    const defaultCoachDashboardForm = {
      clubId: "",
      ageCategory: "",
      dateFrom: "",
      dateTo: "",
      competitionIds: [] as string[]
    };
    type CoachDashboardForm = typeof defaultCoachDashboardForm;

    const coachDashboardViewModel = window.Vue.reactive({
      coachDashboardForm: { ...defaultCoachDashboardForm, competitionIds: [] as string[] },
      availableCompetitions: [] as CoachDashboardCompetitionOption[],
      competitionSearchText: "",
      filtersExpanded: false,
      coachDashboardStats: null as CoachDashboardStats | null,
      isLoadingCoachDashboardStats: false,
      // TDB-2 : un échec de chargement n'est jamais présenté comme « aucun combat ».
      coachDashboardLoadError: "",
      // TDB-8 : l'erreur de dates s'affiche sous les dates.
      coachDashboardDateError: "",
      // TDB-1 : statistiques ouvertes depuis une compétition club, et retour vers sa fiche.
      returnClubCompetitionId: "",
      returnClubCompetitionName: "",
      expandedQualityCriterion: "",
      showAllJudokas: false,
      metricDescriptions: METRIC_DESCRIPTIONS
    });
    let coachDashboardMounted = false;
    let coachDashboardRefreshTimer: number | null = null;
    let coachDashboardRequestId = 0;
    // TDB-6 : les filtres sont gardés tant que l'application reste ouverte.
    let coachDashboardFiltersInitialized = false;
    let filtersBeforeCompetition: CoachDashboardForm | null = null;

    // TDB-6 : une saison va du 1er septembre au 31 août.
    function getSeasonRange(dateValue: string): Pick<CoachDashboardForm, "dateFrom" | "dateTo"> {
      const [year, month] = String(dateValue || "").split("-").map(Number);
      if (!year) return { dateFrom: "", dateTo: "" };
      const startYear = (month || 0) >= 9 ? year : year - 1;
      return { dateFrom: `${startYear}-09-01`, dateTo: `${startYear + 1}-08-31` };
    }

    function getDefaultCoachDashboardFilters(): CoachDashboardForm {
      return { ...defaultCoachDashboardForm, ...getSeasonRange(getCurrentLocalDate()), competitionIds: [] };
    }

    const isSubmitting = window.Vue.computed(() => state.isSubmitting);
    const coachDashboardVictoriesByType = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.victoriesByDecisionType || []
    );
    const coachDashboardDefeatsByType = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.defeatsByDecisionType || []
    );
    const coachDashboardByLateralMatchup = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.byLateralMatchup || []
    );
    const coachDashboardJudokasByGender = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByGender || []
    );
    const coachDashboardJudokasByHandedness = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.judokasByHandedness || []
    );
    // TDB-7 : l'effectif s'affiche dans la synthèse.
    const coachDashboardEffectifText = window.Vue.computed(() =>
      [
        ...coachDashboardJudokasByGender.value.map((entry) =>
          pluralize(entry.judokaCount, entry.gender.toLowerCase())
        ),
        ...coachDashboardJudokasByHandedness.value.map((entry) =>
          pluralize(entry.judokaCount, entry.handedness.toLowerCase())
        )
      ].join(" · ")
    );
    const coachDashboardDataQualityIssues = window.Vue.computed(() =>
      (coachDashboardViewModel.coachDashboardStats?.dataQualityIssues || []).filter(
        (entry) => entry.count > 0
      )
    );
    const coachDashboardPodiumsByLevel = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.podiumsByLevel || []
    );
    const coachDashboardTopWinTechniques = window.Vue.computed(
      () => coachDashboardViewModel.coachDashboardStats?.topWinTechniques || []
    );
    // STATS-1 : podiums écrits en toutes lettres, par niveau (« National : 1 deuxième place »).
    const PODIUM_PLACE_WORDS: Record<string, [string, string]> = {
      "1er": ["première place", "premières places"],
      "2e": ["deuxième place", "deuxièmes places"],
      "3e": ["troisième place", "troisièmes places"]
    };
    const coachDashboardPodiumLines = window.Vue.computed(() =>
      [...coachDashboardPodiumsByLevel.value]
        .sort((a, b) => PODIUM_LEVEL_PRIORITY.indexOf(a.level) - PODIUM_LEVEL_PRIORITY.indexOf(b.level))
        .map((entry) => {
          const parts = PODIUM_PLACE_PRIORITY.map((place) => {
            const count = Number(entry.podiums.find((podium) => podium.place === place)?.count || 0);
            const words = PODIUM_PLACE_WORDS[place] || [place, place];
            return count ? `${PODIUM_PLACE_EMOJIS[place]} ${count} ${count > 1 ? words[1] : words[0]}` : "";
          }).filter(Boolean);
          return { level: entry.level, text: parts.join(" · ") };
        })
        .filter((line) => line.text)
    );
    const coachDashboardPodiumTotal = window.Vue.computed(() =>
      coachDashboardPodiumsByLevel.value.reduce(
        (total, entry) => total + entry.podiums.reduce((sum, podium) => sum + Number(podium.count || 0), 0),
        0
      )
    );
    // STATS-2 : les techniques s'affichent en barres relatives à la plus fréquente.
    function toTechniqueBars(entries: Array<{ technique: string; count: number }>) {
      const max = Math.max(1, ...entries.map((entry) => entry.count));
      return entries.map((entry) => ({ ...entry, rate: Math.round((entry.count / max) * 100) }));
    }
    const coachDashboardTopWinTechniqueBars = window.Vue.computed(() =>
      toTechniqueBars(coachDashboardTopWinTechniques.value)
    );
    // TDB-5 : techniques des points marqués par les adversaires.
    const coachDashboardConcededTechniqueBars = window.Vue.computed(() =>
      toTechniqueBars(coachDashboardViewModel.coachDashboardStats?.topConcededTechniques || [])
    );
    // Combats concernés par le critère de saisie le plus fréquent (les critères se recoupent).
    const coachDashboardIncompleteCount = window.Vue.computed(() =>
      coachDashboardDataQualityIssues.value.reduce((max, issue) => Math.max(max, issue.count), 0)
    );

    function getJudokaName(judokaId: string): string {
      const judoka =
        state.judokas.find((candidate) => String(candidate.judokaId) === String(judokaId)) ||
        (state.currentUser && String(state.currentUser.judokaId) === String(judokaId) ? state.currentUser : null);
      return (judoka && getJudokaDisplayName(judoka)) || "Judoka";
    }

    // TDB-3 : résultats par judoka, du plus actif au moins actif.
    const coachDashboardJudokaRows = window.Vue.computed(() =>
      (coachDashboardViewModel.coachDashboardStats?.byJudoka || [])
        .map((entry) => ({
          ...entry,
          name: getJudokaName(entry.judokaId),
          summary: [
            pluralize(entry.combats, "combat"),
            `${entry.victories} V`,
            `${entry.defeats} D`,
            entry.podiums ? pluralize(entry.podiums, "podium") : ""
          ]
            .filter(Boolean)
            .join(" · ")
        }))
        .sort((a, b) => b.combats - a.combats || a.name.localeCompare(b.name, "fr"))
    );
    const coachDashboardVisibleJudokaRows = window.Vue.computed(() =>
      coachDashboardViewModel.showAllJudokas
        ? coachDashboardJudokaRows.value
        : coachDashboardJudokaRows.value.slice(0, COACH_DASHBOARD_JUDOKA_PREVIEW_LIMIT)
    );

    // TDB-7 : la synthèse parle de performance ; les saisies à compléter restent dans leur tuile.
    const coachDashboardSummaryInsight = window.Vue.computed(() => {
      const stats = coachDashboardViewModel.coachDashboardStats;
      if (!stats || !stats.totalCombats) {
        return "Aucun combat à analyser sur ce périmètre.";
      }
      const scope = `${stats.victoryRate} % de victoires sur ${pluralize(stats.totalCombats, "combat")}`;
      if (stats.victoryRate >= 60) {
        return `Point fort : ${scope}.`;
      }
      const mainDefeat = [...stats.defeatsByDecisionType].sort((a, b) => b.count - a.count)[0];
      const defeatHint = mainDefeat && mainDefeat.count ? ` ; défaites surtout par ${mainDefeat.decisionType}` : "";
      return `Point d'attention : ${scope}${defeatHint}.`;
    });
    const coachDashboardSelectedCompetitions = window.Vue.computed(() => {
      const optionsById = new Map(
        coachDashboardViewModel.availableCompetitions.map((option) => [
          String(option.competitionId),
          option
        ])
      );
      return coachDashboardViewModel.coachDashboardForm.competitionIds
        .map((id) => optionsById.get(String(id)))
        .filter((option): option is CoachDashboardCompetitionOption => Boolean(option));
    });
    const coachDashboardCompetitionSuggestions = window.Vue.computed(() => {
      const query = cleanText(coachDashboardViewModel.competitionSearchText).toLowerCase();
      if (!query) {
        return [] as CoachDashboardCompetitionOption[];
      }
      const selectedIds = new Set(
        coachDashboardViewModel.coachDashboardForm.competitionIds.map(String)
      );
      return coachDashboardViewModel.availableCompetitions
        .filter(
          (option) =>
            !selectedIds.has(String(option.competitionId)) &&
            (option.name.toLowerCase().includes(query) || option.competitionDate.includes(query))
        )
        .slice(0, COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT);
    });

    function formatCoachDashboardDate(value: unknown) {
      const formatted = formatDate(value);
      if (!formatted) {
        return "Date non renseignée";
      }
      return formatted;
    }

    // TDB-7 : les dates du résumé au format de l'application (« 1 sept. 2026 »).
    function formatFilterDate(value: string): string {
      const [year, month, day] = String(value || "").split("-").map(Number);
      if (!year || !month || !day) return value;
      return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(year, month - 1, day)
      );
    }

    // TDB-6 : une période égale à une saison s'écrit « Saison 2026-2027 ».
    const coachDashboardPeriodLabel = window.Vue.computed(() => {
      const { dateFrom, dateTo } = coachDashboardViewModel.coachDashboardForm;
      const season = getSeasonRange(dateFrom);
      if (dateFrom && dateFrom === season.dateFrom && dateTo === season.dateTo) {
        const startYear = Number(dateFrom.slice(0, 4));
        return `Saison ${startYear}-${startYear + 1}`;
      }
      return [
        dateFrom ? `Depuis le ${formatFilterDate(dateFrom)}` : "",
        dateTo ? `Jusqu'au ${formatFilterDate(dateTo)}` : ""
      ]
        .filter(Boolean)
        .join(" · ");
    });

    function ensureCoachDashboardViewModel() {
      if (coachDashboardMounted) {
        return;
      }
      coachDashboardMounted = true;
      ui.mountViewModel(
        "coachDashboardView",
        coachDashboardViewModel,
        {
          getDataQualityIssueDescription,
          getQualityIssueCombatLabel,
          openCoachDashboardJudoka,
          openQualityIssueCombat,
          resetCoachDashboardFilters,
          retryCoachDashboard,
          returnToClubCompetition,
          scheduleCoachDashboardRefresh,
          showCoachHome,
          showCoachCompetitions,
          toggleCoachDashboardFilters,
          toggleQualityIssue,
          addCoachDashboardCompetition,
          removeCoachDashboardCompetition,
          showCoachJudoka,
          showCoachDashboard,
          formatCoachDashboardDate,
          formatCompetitionName: ui.formatCompetitionName
        },
        {
          isSubmitting,
          coachDashboardVictoriesByType,
          coachDashboardDefeatsByType,
          coachDashboardByLateralMatchup,
          coachDashboardEffectifText,
          coachDashboardDataQualityIssues,
          coachDashboardPodiumsByLevel,
          coachDashboardPodiumLines,
          coachDashboardPodiumTotal,
          coachDashboardTopWinTechniques,
          coachDashboardTopWinTechniqueBars,
          coachDashboardConcededTechniqueBars,
          coachDashboardIncompleteCount,
          coachDashboardJudokaRows,
          coachDashboardVisibleJudokaRows,
          coachDashboardSummaryInsight,
          coachDashboardSelectedCompetitions,
          coachDashboardCompetitionSuggestions,
          coachDashboardPeriodLabel,
          showCoachDashboardClubFilter,
          coachDashboardClubOptions,
          coachDashboardClubName
        }
      );
    }

    // Filtre club : proposé aux coachs de plusieurs clubs uniquement.
    const showCoachDashboardClubFilter = window.Vue.computed(() => state.clubs.length > 1);
    const coachDashboardClubOptions = window.Vue.computed(() => state.clubs);
    const coachDashboardClubName = window.Vue.computed(() => {
      const club = state.clubs.find((candidate) => candidate.clubId === coachDashboardViewModel.coachDashboardForm.clubId);
      return club ? club.name : "";
    });

    function fetchCoachDashboardStats() {
      const dateFrom = coachDashboardViewModel.coachDashboardForm.dateFrom;
      const dateTo = coachDashboardViewModel.coachDashboardForm.dateTo;
      if (dateFrom && dateTo && dateFrom > dateTo) {
        coachDashboardViewModel.coachDashboardDateError =
          "La date de début doit être antérieure ou égale à la date de fin.";
        return;
      }
      coachDashboardViewModel.coachDashboardDateError = "";

      const requestId = (coachDashboardRequestId += 1);
      coachDashboardViewModel.isLoadingCoachDashboardStats = true;

      app.runServer(
        "getCoachDashboard",
        [
          {
            clubId: coachDashboardViewModel.coachDashboardForm.clubId,
            dateFrom: coachDashboardViewModel.coachDashboardForm.dateFrom,
            dateTo: coachDashboardViewModel.coachDashboardForm.dateTo,
            ageCategory: coachDashboardViewModel.coachDashboardForm.ageCategory,
            competitionIds: getSelectedCoachDashboardCompetitionIds()
          }
        ],
        (response) => {
          if (requestId !== coachDashboardRequestId) {
            return;
          }
          coachDashboardViewModel.coachDashboardStats = response.stats;
          coachDashboardViewModel.availableCompetitions = response.availableCompetitions;
          coachDashboardViewModel.coachDashboardLoadError = "";
          // Une compétition sélectionnée reste choisie, même si le serveur la désigne
          // par une autre de ses participations.
          const optionIdByCompetitionId = new Map<string, string>();
          response.availableCompetitions.forEach((option) => {
            (option.competitionIds?.length ? option.competitionIds : [option.competitionId]).forEach((id) =>
              optionIdByCompetitionId.set(String(id), String(option.competitionId))
            );
          });
          coachDashboardViewModel.coachDashboardForm.competitionIds = [
            ...new Set(
              coachDashboardViewModel.coachDashboardForm.competitionIds
                .map((id) => optionIdByCompetitionId.get(String(id)) || "")
                .filter(Boolean)
            )
          ];
          coachDashboardViewModel.isLoadingCoachDashboardStats = false;
        },
        () => {
          if (requestId !== coachDashboardRequestId) {
            return;
          }
          coachDashboardViewModel.isLoadingCoachDashboardStats = false;
          // TDB-2 : les dernières statistiques restent affichées ; l'échec est dit sans ambiguïté.
          coachDashboardViewModel.coachDashboardLoadError = state.isOnline
            ? "Statistiques indisponibles pour le moment."
            : "Les statistiques demandent une connexion. Elles s'afficheront au retour du réseau.";
        }
      );
    }

    function retryCoachDashboard() {
      fetchCoachDashboardStats();
    }

    function getSelectedCoachDashboardCompetitionIds() {
      const selectedIds = new Set(coachDashboardViewModel.coachDashboardForm.competitionIds.map(String));
      const expandedCompetitionIds: string[] = [];
      coachDashboardViewModel.availableCompetitions.forEach((option) => {
        if (!selectedIds.has(String(option.competitionId))) {
          return;
        }
        (option.competitionIds?.length ? option.competitionIds : [option.competitionId]).forEach((id) => {
          expandedCompetitionIds.push(String(id));
        });
      });
      return expandedCompetitionIds.length
        ? expandedCompetitionIds
        : coachDashboardViewModel.coachDashboardForm.competitionIds;
    }

    function scheduleCoachDashboardRefresh() {
      if (coachDashboardRefreshTimer) {
        window.clearTimeout(coachDashboardRefreshTimer);
      }
      coachDashboardRefreshTimer = window.setTimeout(() => {
        coachDashboardRefreshTimer = null;
        fetchCoachDashboardStats();
      }, COACH_DASHBOARD_REFRESH_DEBOUNCE_MS);
    }

    function addCoachDashboardCompetition(competitionId: string) {
      const id = String(competitionId);
      if (!coachDashboardViewModel.coachDashboardForm.competitionIds.includes(id)) {
        coachDashboardViewModel.coachDashboardForm.competitionIds.push(id);
      }
      coachDashboardViewModel.competitionSearchText = "";
      scheduleCoachDashboardRefresh();
    }

    function removeCoachDashboardCompetition(competitionId: string) {
      const id = String(competitionId);
      coachDashboardViewModel.coachDashboardForm.competitionIds =
        coachDashboardViewModel.coachDashboardForm.competitionIds.filter(
          (existingId) => existingId !== id
        );
      scheduleCoachDashboardRefresh();
    }

    function clearCoachDashboardRefreshTimer() {
      if (coachDashboardRefreshTimer) {
        window.clearTimeout(coachDashboardRefreshTimer);
        coachDashboardRefreshTimer = null;
      }
    }

    // TDB-6 : réinitialiser revient à la saison en cours, tous clubs et toutes catégories.
    function resetCoachDashboardFilters() {
      clearCoachDashboardRefreshTimer();
      Object.assign(coachDashboardViewModel.coachDashboardForm, getDefaultCoachDashboardFilters());
      coachDashboardViewModel.competitionSearchText = "";
      fetchCoachDashboardStats();
    }

    function toggleCoachDashboardFilters() {
      coachDashboardViewModel.filtersExpanded = !coachDashboardViewModel.filtersExpanded;
    }

    function showCoachDashboard(options: { competition?: CoachDashboardCompetitionPreset } = {}) {
      ensureCoachDashboardViewModel();
      clearCoachDashboardRefreshTimer();
      const form = coachDashboardViewModel.coachDashboardForm;
      const preset = options.competition;
      if (preset && preset.competitionIds.length) {
        // TDB-1 : une seule compétition, sur sa saison ; les filtres du coach sont mis de côté.
        // Jamais ouvert : l'onglet reviendra à ses filtres de première ouverture (TDB-6).
        if (!coachDashboardViewModel.returnClubCompetitionId) {
          filtersBeforeCompetition = coachDashboardFiltersInitialized
            ? { ...form, competitionIds: [...form.competitionIds] }
            : null;
        }
        const [firstCompetitionId] = preset.competitionIds;
        Object.assign(form, {
          ...defaultCoachDashboardForm,
          ...getSeasonRange(preset.competitionDate),
          competitionIds: [firstCompetitionId]
        });
        coachDashboardViewModel.availableCompetitions = [
          {
            competitionId: firstCompetitionId,
            competitionIds: [...preset.competitionIds],
            name: preset.name,
            competitionDate: preset.competitionDate
          }
        ];
        coachDashboardViewModel.returnClubCompetitionId = preset.clubCompetitionId;
        coachDashboardViewModel.returnClubCompetitionName = preset.name;
        coachDashboardViewModel.coachDashboardStats = null;
      } else if (coachDashboardViewModel.returnClubCompetitionId) {
        // Retour à l'onglet « Stats » : les filtres du coach reviennent.
        Object.assign(
          form,
          filtersBeforeCompetition || { ...getDefaultCoachDashboardFilters(), clubId: state.selectedClubId || "" }
        );
        filtersBeforeCompetition = null;
        coachDashboardViewModel.returnClubCompetitionId = "";
        coachDashboardViewModel.returnClubCompetitionName = "";
        coachDashboardViewModel.coachDashboardStats = null;
      } else if (!coachDashboardFiltersInitialized) {
        // TDB-6 : première ouverture sur la saison en cours et le club choisi à l'accueil.
        Object.assign(form, getDefaultCoachDashboardFilters(), { clubId: state.selectedClubId || "" });
      }
      coachDashboardFiltersInitialized = true;
      coachDashboardViewModel.competitionSearchText = "";
      coachDashboardViewModel.filtersExpanded = false;
      coachDashboardViewModel.coachDashboardLoadError = "";
      coachDashboardViewModel.coachDashboardDateError = "";
      coachDashboardViewModel.expandedQualityCriterion = "";
      coachDashboardViewModel.showAllJudokas = false;
      showView("coachDashboardView");
      fetchCoachDashboardStats();
    }

    function returnToClubCompetition() {
      const clubCompetitionId = coachDashboardViewModel.returnClubCompetitionId;
      if (clubCompetitionId) {
        screens.competition.openClubCompetition(clubCompetitionId);
      }
    }

    function openCoachDashboardJudoka(judokaId: string) {
      screens.judoka.showJudokaProfile(judokaId);
    }

    // TDB-4 : un manque de saisie s'ouvre sur la liste des combats concernés.
    function toggleQualityIssue(criterion: string) {
      coachDashboardViewModel.expandedQualityCriterion =
        coachDashboardViewModel.expandedQualityCriterion === criterion ? "" : criterion;
    }

    function getQualityIssueCombatLabel(combat: CoachDashboardQualityIssueCombat): string {
      return [
        getJudokaName(combat.judokaId),
        ui.formatCompetitionName(combat.competitionName) || "Compétition",
        combat.opponent ? `contre ${combat.opponent}` : "adversaire non renseigné"
      ].join(" · ");
    }

    function openQualityIssueCombat(combat: CoachDashboardQualityIssueCombat) {
      if (combat.competitionId) {
        screens.competition.openCompetition(combat.competitionId);
      }
    }

    function showCoachHomeMode(mode: "judoka" | "coachHome" | "coach" | "coachJudoka") {
      screens.home.setHomeMode(mode);
      if (app.showHome) {
        app.showHome();
      }
    }

    function showCoachHome() {
      showCoachHomeMode("coachHome");
    }

    function showCoachCompetitions() {
      showCoachHomeMode("coach");
    }

    function showCoachJudoka() {
      showCoachHomeMode("coachJudoka");
    }

    function getDataQualityIssueDescription(criterion: string): string {
      return DATA_QUALITY_ISSUE_DESCRIPTIONS[criterion] || "";
    }

    return {
      showCoachDashboard
    };
  }

  window.createKirokuCoachDashboardScreen = createKirokuCoachDashboardScreen;
})();
