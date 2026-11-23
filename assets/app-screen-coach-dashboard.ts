(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;
  type CoachDashboardClubEntry = import("../core/types").CoachDashboardClubEntry;
  type CoachDashboardCompetitionOption = import("../core/types").CoachDashboardCompetitionOption;
  type CoachDashboardCompetitionPreset = import("./types").CoachDashboardCompetitionPreset;

  const COACH_DASHBOARD_REFRESH_DEBOUNCE_MS = 300;
  const COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT = 8;

  // STAT-1 : en dessous de 5 combats (ou points) au dénominateur, pas de pourcentage ni de barre.
  const MIN_RATE_SAMPLE = 5;

  // TDB-9 : chaque métrique dit en une phrase ce qu'elle mesure et sur quels combats (docs/metrics.md).
  const METRIC_DESCRIPTIONS = {
    combats: "Nombre de combats saisis sur les compétitions retenues par les filtres.",
    victories:
      "Part des combats gagnés, sur tous les combats retenus. Sous 5 combats, seul le décompte s'affiche.",
    podiums:
      "Premières, deuxièmes et troisièmes places, sur les participations dont le classement final est saisi.",
    byClub:
      "Sur tous vos clubs : le résultat de chacun. Un résultat compte pour le club de sa compétition. Un club de moins de 2 judokas est listé sans chiffres.",
    engagement: "Judokas différents ayant au moins un combat retenu, et nombre moyen de combats de chacun.",
    participations:
      "Participations dont la date est passée. Une participation sans combat saisi compte dans les podiums, pas dans les taux de victoire.",
    byLevel:
      "Victoires selon le niveau de la compétition, puis podiums sur les participations classées à ce niveau.",
    winning:
      "Comment les combats gagnés se sont terminés, les 5 techniques les plus marquées dans ces combats, et la part des points marqués debout ou au sol.",
    losing:
      "Comment les combats perdus se sont terminés, les 5 techniques les plus marquées par les adversaires dans ces combats, et la part des points concédés debout ou au sol.",
    byPeriod:
      "Participations, combats, victoires et podiums par trimestre de saison, ou par saison quand la période en couvre plusieurs.",
    previous:
      "Écart avec la même fenêtre de dates un an plus tôt, pour le même club et la même catégorie. Un écart de taux demande 5 combats dans chaque période."
  };

  const DECIMAL_FORMATTER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  function toRate(count: number, total: number): number {
    return total ? Math.round((count / total) * 100) : 0;
  }

  // STAT-1 : un taux affiche d'abord son décompte ; le pourcentage et la barre attendent 5 combats.
  function formatWinRate(victories: number, combats: number) {
    const showRate = combats >= MIN_RATE_SAMPLE;
    const rate = toRate(victories, combats);
    const won = combats > 1 ? "gagnés" : "gagné";
    return {
      text: `${victories}/${combats} ${won}${showRate ? ` (${rate} %)` : " · trop peu de combats"}`,
      rate,
      showBar: showRate
    };
  }

  // Part d'un total (fins de combat, debout / au sol) : décompte, puis pourcentage au-delà du seuil.
  function formatShare(count: number, total: number) {
    const showRate = total >= MIN_RATE_SAMPLE;
    const rate = toRate(count, total);
    return { text: `${count}/${total}${showRate ? ` (${rate} %)` : ""}`, rate, showBar: showRate };
  }

  // STAT-23 : un écart s'écrit signé, sans jugement (« +12 combats », « −2 podiums »).
  function formatDelta(delta: number, singular: string, plural = `${singular}s`) {
    if (!delta) return `même nombre de ${plural}`;
    const sign = delta > 0 ? "+" : "−";
    const count = Math.abs(delta);
    return `${sign}${count} ${count > 1 ? plural : singular}`;
  }

  // STAT-7 : points debout ou au sol ; les parts attendent 5 points dont la technique est connue.
  function formatGroundSplit(share: { ground: number; counted: number }) {
    if (!share.counted) return "";
    const standing = share.counted - share.ground;
    if (share.counted < MIN_RATE_SAMPLE) return `${standing} debout, ${share.ground} au sol`;
    const groundRate = toRate(share.ground, share.counted);
    return `${100 - groundRate} % debout, ${groundRate} % au sol (${share.counted} points)`;
  }

  // STAT-11 : les podiums de la période, sommés sur les niveaux.
  function countPodiums(stats: CoachDashboardStats): number {
    return (stats.byLevel || []).reduce((total, line) => total + Number(line.podiums || 0), 0);
  }

  function createKirokuCoachDashboardScreen(app: KirokuApp) {
    const { state, screens, ui } = app;
    const { cleanText, formatDate, getCurrentLocalDate, pluralize, showView } = ui;

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
      // STAT-20 : périmètre trop petit pour des statistiques de groupe.
      coachDashboardWithheld: null as { analyzedCompetitions: number; totalCombats: number } | null,
      // STAT-23 : la même fenêtre un an plus tôt.
      coachDashboardPrevious: null as { dateFrom: string; dateTo: string; stats: CoachDashboardStats } | null,
      coachDashboardByClub: null as CoachDashboardClubEntry[] | null,
      isLoadingCoachDashboardStats: false,
      // TDB-2 : un échec de chargement n'est jamais présenté comme « aucun combat ».
      coachDashboardLoadError: "",
      // TDB-8 : l'erreur de dates s'affiche sous les dates.
      coachDashboardDateError: "",
      // TDB-1 : statistiques ouvertes depuis une compétition club, et retour vers sa fiche.
      returnClubCompetitionId: "",
      returnClubCompetitionName: "",
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
    const currentStats = () => coachDashboardViewModel.coachDashboardStats;
    // STAT-23 : statistiques de la même fenêtre un an plus tôt, ou null.
    const previousStats = () => coachDashboardViewModel.coachDashboardPrevious?.stats || null;

    // STAT-23 : la période comparée, rappelée sous les tuiles.
    const coachDashboardPreviousLabel = window.Vue.computed(() => {
      const previous = coachDashboardViewModel.coachDashboardPrevious;
      if (!previous || !currentStats()) return "";
      return `Écarts avec la période du ${formatFilterDate(previous.dateFrom)} au ${formatFilterDate(previous.dateTo)}.`;
    });

    // STAT-23 : écarts des tuiles « Combats », « Victoires » et « Podiums ».
    const coachDashboardTileDeltas = window.Vue.computed(() => {
      const stats = currentStats();
      const previous = previousStats();
      if (!stats || !previous) return { combats: "", victories: "", podiums: "" };
      const bothRated = stats.totalCombats >= MIN_RATE_SAMPLE && previous.totalCombats >= MIN_RATE_SAMPLE;
      return {
        combats: formatDelta(stats.totalCombats - previous.totalCombats, "combat"),
        victories: bothRated
          ? formatDelta(stats.victoryRate - previous.victoryRate, "point")
          : formatDelta(stats.victories - previous.victories, "victoire"),
        podiums: formatDelta(countPodiums(stats) - countPodiums(previous), "podium")
      };
    });

    // STAT-1 : la tuile « Victoires » donne le décompte tant que l'échantillon est trop petit.
    const coachDashboardVictoryTile = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats) return { value: "", label: "Victoires" };
      if (stats.totalCombats >= MIN_RATE_SAMPLE) {
        return { value: `${stats.victoryRate} %`, label: `Victoires (${stats.victories})` };
      }
      return { value: `${stats.victories}/${stats.totalCombats}`, label: "Victoires · trop peu de combats" };
    });

    // STAT-3 : fins de combat utiles, triées, « Non renseignée » pour que la somme égale le total.
    function toDecisionLines(entries: Array<{ decisionType: string; count: number }>, total: number) {
      return window.buildDecisionTypeLines(entries, total).map((entry) => ({
        ...entry,
        ...formatShare(entry.count, total)
      }));
    }
    const coachDashboardVictoriesByType = window.Vue.computed(() => {
      const stats = currentStats();
      return stats ? toDecisionLines(stats.victoriesByDecisionType, stats.victories) : [];
    });
    const coachDashboardDefeatsByType = window.Vue.computed(() => {
      const stats = currentStats();
      return stats ? toDecisionLines(stats.defeatsByDecisionType, stats.defeats) : [];
    });

    // STAT-16, STAT-11 : par niveau, les victoires puis les podiums sur les participations classées.
    const coachDashboardLevelLines = window.Vue.computed(() =>
      (currentStats()?.byLevel || []).map((line) => ({
        ...line,
        ...(line.combats
          ? formatWinRate(line.victories, line.combats)
          : { text: "aucun combat saisi", rate: 0, showBar: false }),
        detailText: line.rankedParticipations
          ? `${pluralize(line.podiums, "podium")} sur ${pluralize(
              line.rankedParticipations,
              "participation classée",
              "participations classées"
            )}`
          : ""
      }))
    );

    // STAT-24 : une ligne par trimestre de saison, ou par saison ; affichée à partir de 2 lignes.
    const coachDashboardPeriodLines = window.Vue.computed(() => {
      const periods = currentStats()?.byPeriod || [];
      if (periods.length < 2) return [];
      return periods.map((entry) => ({
        ...entry,
        ...(entry.combats
          ? formatWinRate(entry.victories, entry.combats)
          : { text: "aucun combat saisi", rate: 0, showBar: false }),
        detailText: [
          pluralize(entry.participations, "participation"),
          entry.podiums ? pluralize(entry.podiums, "podium") : ""
        ]
          .filter(Boolean)
          .join(" · ")
      }));
    });

    // STAT-7 : points marqués et concédés, debout ou au sol.
    const coachDashboardScoredGroundText = window.Vue.computed(() => {
      const share = currentStats()?.groundShare;
      return share ? formatGroundSplit(share.scored) : "";
    });
    const coachDashboardConcededGroundText = window.Vue.computed(() => {
      const share = currentStats()?.groundShare;
      return share ? formatGroundSplit(share.conceded) : "";
    });

    // MULTI-6 : une ligne par club sur « Tous mes clubs », sans nom de judoka.
    const coachDashboardClubLines = window.Vue.computed(() => {
      const entries = currentStats() ? coachDashboardViewModel.coachDashboardByClub || [] : [];
      if (entries.length < 2) return [];
      return entries.map((entry) => {
        const club = state.clubs.find((candidate) => candidate.clubId === entry.clubId);
        const label = club ? club.name : "Club";
        if (entry.withheld) {
          return { key: entry.clubId, label, text: "moins de 2 judokas", detailText: "", rate: 0, showBar: false };
        }
        if (!entry.combats && !entry.participations) {
          return { key: entry.clubId, label, text: "aucune compétition", detailText: "", rate: 0, showBar: false };
        }
        return {
          key: entry.clubId,
          label,
          ...(entry.combats
            ? formatWinRate(entry.victories, entry.combats)
            : { text: "aucun combat saisi", rate: 0, showBar: false }),
          detailText: [
            pluralize(entry.engagedJudokas, "judoka"),
            pluralize(entry.participations, "participation"),
            entry.podiums ? pluralize(entry.podiums, "podium") : ""
          ]
            .filter(Boolean)
            .join(" · ")
        };
      });
    });

    // STAT-13 : l'effectif engagé, sans aucun nom.
    const coachDashboardEngagementText = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats || !stats.engagedJudokas) return "";
      const perJudoka = DECIMAL_FORMATTER.format(stats.totalCombats / stats.engagedJudokas);
      return `${pluralize(stats.engagedJudokas, "judoka engagé", "judokas engagés")} · ${perJudoka} combats par judoka`;
    });
    // STAT-27 : participations passées, dont celles sans combat saisi.
    const coachDashboardParticipationText = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats || !stats.participationsWithoutCombat) return "";
      return `${pluralize(stats.participations, "participation")}, dont ${stats.participationsWithoutCombat} sans combat saisi.`;
    });
    const coachDashboardTopWinTechniques = window.Vue.computed(() => currentStats()?.topWinTechniques || []);
    const coachDashboardPodiumTotal = window.Vue.computed(() => {
      const stats = currentStats();
      return stats ? countPodiums(stats) : 0;
    });
    const coachDashboardRankedTotal = window.Vue.computed(() =>
      (currentStats()?.byLevel || []).reduce((total, line) => total + Number(line.rankedParticipations || 0), 0)
    );
    // STATS-2 : les techniques s'affichent en barres relatives à la plus fréquente.
    function toTechniqueBars(entries: Array<{ technique: string; count: number }>) {
      const max = Math.max(1, ...entries.map((entry) => entry.count));
      return entries.map((entry) => ({ ...entry, rate: Math.round((entry.count / max) * 100) }));
    }
    const coachDashboardTopWinTechniqueBars = window.Vue.computed(() =>
      toTechniqueBars(coachDashboardTopWinTechniques.value)
    );
    // STAT-4 : techniques des points adverses dans les combats perdus.
    const coachDashboardDefeatTechniqueBars = window.Vue.computed(() =>
      toTechniqueBars(currentStats()?.topDefeatTechniques || [])
    );
    // STAT-15 : le bilan, puis le fait le plus marquant, sans jugement.
    const coachDashboardSummaryInsight = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats || !stats.totalCombats) {
        return "Aucun combat à analyser sur ce périmètre.";
      }
      const record = [
        pluralize(stats.victories, "victoire"),
        pluralize(stats.defeats, "défaite"),
        stats.draws ? pluralize(stats.draws, "nul") : ""
      ]
        .filter(Boolean)
        .join(", ");
      const sentences = [`${record} sur ${pluralize(stats.totalCombats, "combat")}.`];
      const mainDefeat = [...(stats.defeatsByDecisionType || [])]
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)[0];
      const topTechnique = (stats.topWinTechniques || [])[0];
      if (mainDefeat) {
        sentences.push(`Défaites le plus souvent par ${mainDefeat.decisionType} (${mainDefeat.count}).`);
      } else if (topTechnique) {
        sentences.push(`Technique la plus marquée : ${topTechnique.technique} (${topTechnique.count}).`);
      }
      return sentences.join(" ");
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

    // MULTI-1 : sur « Tous mes clubs », une compétition dit son club.
    function formatCoachDashboardOptionClub(option: { clubId?: string }) {
      if (state.clubs.length < 2 || coachDashboardViewModel.coachDashboardForm.clubId) return "";
      const club = state.clubs.find((candidate) => candidate.clubId === String(option.clubId || ""));
      return club ? club.name : "";
    }

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
          resetCoachDashboardFilters,
          changeCoachDashboardClub,
          retryCoachDashboard,
          returnToClubCompetition,
          scheduleCoachDashboardRefresh,
          showCoachHome,
          showCoachCompetitions,
          toggleCoachDashboardFilters,
          addCoachDashboardCompetition,
          removeCoachDashboardCompetition,
          showCoachJudoka,
          showCoachAgenda: () => screens.ffjudoAgenda.showFfjudoAgenda(),
          showCoachDashboard,
          formatCoachDashboardDate,
          formatCoachDashboardOptionClub,
          formatCompetitionName: ui.formatCompetitionName
        },
        {
          isSubmitting,
          coachDashboardVictoryTile,
          coachDashboardVictoriesByType,
          coachDashboardDefeatsByType,
          coachDashboardLevelLines,
          coachDashboardPeriodLines,
          coachDashboardPreviousLabel,
          coachDashboardTileDeltas,
          coachDashboardEngagementText,
          coachDashboardClubLines,
          coachDashboardParticipationText,
          coachDashboardScoredGroundText,
          coachDashboardConcededGroundText,
          coachDashboardPodiumTotal,
          coachDashboardRankedTotal,
          coachDashboardTopWinTechniques,
          coachDashboardTopWinTechniqueBars,
          coachDashboardDefeatTechniqueBars,
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
          coachDashboardViewModel.coachDashboardWithheld = response.withheld || null;
          coachDashboardViewModel.coachDashboardPrevious = response.previous || null;
          coachDashboardViewModel.coachDashboardByClub = response.byClub || null;
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

    // TDB-6 : réinitialiser revient à la saison en cours et à toutes les catégories ; MULTI-3 : le club reste.
    function resetCoachDashboardFilters() {
      clearCoachDashboardRefreshTimer();
      const { clubId } = coachDashboardViewModel.coachDashboardForm;
      Object.assign(coachDashboardViewModel.coachDashboardForm, getDefaultCoachDashboardFilters(), { clubId });
      coachDashboardViewModel.competitionSearchText = "";
      fetchCoachDashboardStats();
    }

    // MULTI-3 : le club des statistiques est celui de l'accueil, sauf pour les statistiques d'une compétition.
    function changeCoachDashboardClub() {
      if (!coachDashboardViewModel.returnClubCompetitionId) {
        app.setSelectedClubId(coachDashboardViewModel.coachDashboardForm.clubId);
      }
      scheduleCoachDashboardRefresh();
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
            competitionDate: preset.competitionDate,
            clubId: preset.clubId
          }
        ];
        coachDashboardViewModel.returnClubCompetitionId = preset.clubCompetitionId;
        coachDashboardViewModel.returnClubCompetitionName = preset.name;
        coachDashboardViewModel.coachDashboardStats = null;
        coachDashboardViewModel.coachDashboardWithheld = null;
      } else if (coachDashboardViewModel.returnClubCompetitionId) {
        // Retour à l'onglet « Stats » : les filtres du coach reviennent.
        Object.assign(
          form,
          filtersBeforeCompetition || getDefaultCoachDashboardFilters(),
          { clubId: state.selectedClubId || "" }
        );
        filtersBeforeCompetition = null;
        coachDashboardViewModel.returnClubCompetitionId = "";
        coachDashboardViewModel.returnClubCompetitionName = "";
        coachDashboardViewModel.coachDashboardStats = null;
        coachDashboardViewModel.coachDashboardWithheld = null;
      } else if (!coachDashboardFiltersInitialized) {
        // TDB-6 : première ouverture sur la saison en cours et le club choisi à l'accueil.
        Object.assign(form, getDefaultCoachDashboardFilters(), { clubId: state.selectedClubId || "" });
      } else {
        // MULTI-3 : les autres filtres restent ; le club suit celui de l'accueil.
        form.clubId = state.selectedClubId || "";
      }
      coachDashboardFiltersInitialized = true;
      coachDashboardViewModel.competitionSearchText = "";
      coachDashboardViewModel.filtersExpanded = false;
      coachDashboardViewModel.coachDashboardLoadError = "";
      coachDashboardViewModel.coachDashboardDateError = "";
      showView("coachDashboardView");
      fetchCoachDashboardStats();
    }

    function returnToClubCompetition() {
      const clubCompetitionId = coachDashboardViewModel.returnClubCompetitionId;
      if (clubCompetitionId) {
        screens.competition.openClubCompetition(clubCompetitionId);
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

    return {
      showCoachDashboard
    };
  }

  window.createKirokuCoachDashboardScreen = createKirokuCoachDashboardScreen;
})();
