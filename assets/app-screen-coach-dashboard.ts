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

  // STAT-1 : en dessous de 5 combats (ou points) au dénominateur, pas de pourcentage ni de barre.
  const MIN_RATE_SAMPLE = 5;

  // TDB-9 : chaque métrique dit en une phrase ce qu'elle mesure et sur quels combats (docs/metrics.md).
  const METRIC_DESCRIPTIONS = {
    combats: "Nombre de combats saisis sur les compétitions retenues par les filtres.",
    victories:
      "Part des combats gagnés, sur tous les combats retenus. Sous 5 combats, seul le décompte s'affiche.",
    podiums:
      "Premières, deuxièmes et troisièmes places, sur les participations dont le classement final est saisi.",
    incomplete:
      "Combats concernés par le manque de saisie le plus fréquent. Un combat peut avoir plusieurs manques.",
    effectif: "Judokas différents ayant au moins un combat retenu, puis leur garde.",
    podiumsByLevel:
      "Places obtenues par niveau de compétition, sur les participations classées à ce niveau.",
    byJudoka:
      "Combats, victoires, défaites et podiums de chaque judoka, puis son bilan contre les droitiers et les gauchers.",
    victoriesByType: "Comment les combats gagnés se sont terminés, en part de toutes les victoires.",
    winTechniques: "Les 5 techniques les plus marquées par les judokas dans les combats gagnés.",
    defeatsByType: "Comment les combats perdus se sont terminés, en part de toutes les défaites.",
    defeatTechniques: "Les 5 techniques les plus marquées par les adversaires dans les combats perdus.",
    ippon: "Victoires avec au moins un Ippon du judoka : part des Ippon marqués debout et au sol.",
    lateral:
      "Taux de victoire selon la garde du judoka et celle de l'adversaire. Seuls les combats gagnés ou perdus dont les deux gardes sont connues comptent.",
    byStage: "Combats, victoires et défaites à chaque tour du tableau.",
    byLevel: "Combats, victoires et défaites selon le niveau de la compétition.",
    scoreHolding:
      "Qui marque le premier et qui gagne ensuite, lu sur le déroulé. Seuls les combats dont tous les points sont rangés comptent.",
    groundShare:
      "Part des points marqués et concédés au sol. Seuls les points dont la technique est connue comptent.",
    discipline:
      "Shidos reçus par combat, sur les combats dont le score est renseigné, et défaites par Hansoku-make.",
    byMonth: "Combats, victoires et podiums de chaque mois qui compte des combats.",
    quality: "Informations utiles aux statistiques qui manquent. Touchez un manque pour voir où compléter."
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
      "Le niveau de la compétition n'est pas renseigné — il alimente les podiums et les résultats par niveau. Compté une fois par compétition.",
    inconsistentIppon:
      "Le combat est gagné par Ippon, mais aucun point Ippon n'a été détaillé : la saisie mérite une vérification."
  };

  const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
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
    const currentStats = () => coachDashboardViewModel.coachDashboardStats;

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

    // STAT-2 : parmi les victoires avec un Ippon du judoka, debout ou au sol.
    const coachDashboardIpponLines = window.Vue.computed(() => {
      const split = currentStats()?.ipponVictories;
      if (!split || !split.total) return [];
      return [
        { label: "Debout", ...formatShare(split.standing, split.total) },
        { label: "Au sol", ...formatShare(split.ground, split.total) }
      ];
    });

    // STAT-10 : quatre lignes garde du judoka / garde de l'adversaire.
    const coachDashboardByLateralMatchup = window.Vue.computed(() =>
      (currentStats()?.byLateralMatchup || [])
        .filter((entry) => entry.combats > 0)
        .map((entry) => ({ ...entry, ...formatWinRate(entry.victories, entry.combats) }))
    );

    // STAT-5, STAT-16 : bilan par tour et par niveau.
    function toResultLines(lines: Array<{ key: string; label: string; combats: number; victories: number; defeats: number }>) {
      return lines
        .filter((line) => line.combats > 0)
        .map((line) => ({ ...line, ...formatWinRate(line.victories, line.combats) }));
    }
    const coachDashboardStageLines = window.Vue.computed(() => toResultLines(currentStats()?.byStage || []));
    const coachDashboardLevelLines = window.Vue.computed(() => toResultLines(currentStats()?.byLevel || []));

    // STAT-12 : un mois par ligne, affiché à partir de 2 mois.
    const coachDashboardMonthLines = window.Vue.computed(() => {
      const months = (currentStats()?.byMonth || []).filter((entry) => entry.combats > 0);
      if (months.length < 2) return [];
      return months.map((entry) => {
        const [year, month] = entry.month.split("-").map(Number);
        const label = year && month ? MONTH_FORMATTER.format(new Date(year, month - 1, 1)) : entry.month;
        return {
          ...entry,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          ...formatWinRate(entry.victories, entry.combats),
          podiumText: entry.podiums ? pluralize(entry.podiums, "podium") : ""
        };
      });
    });

    // STAT-6 : tenue du score, sur les combats au déroulé complet.
    const coachDashboardScoreHoldingLines = window.Vue.computed(() => {
      const holding = currentStats()?.scoreHolding;
      if (!holding || !holding.counted) return [];
      return [
        { key: "scoredFirst", label: "Marque le premier", value: `${holding.scoredFirst}/${holding.counted}` },
        {
          key: "wonAfterScoringFirst",
          label: "Puis gagne",
          value: formatWinRate(holding.wonAfterScoringFirst, holding.scoredFirst).text
        },
        { key: "lostAfterLeading", label: "Perd après avoir mené", value: String(holding.lostAfterLeading) },
        { key: "wonAfterTrailing", label: "Gagne après avoir été mené", value: String(holding.wonAfterTrailing) }
      ];
    });

    // STAT-7 : part des points au sol, marqués et concédés.
    const coachDashboardGroundLines = window.Vue.computed(() => {
      const share = currentStats()?.groundShare;
      if (!share) return [];
      return [
        { key: "scored", label: "Marqués au sol", ...share.scored, ...formatShare(share.scored.ground, share.scored.counted) },
        {
          key: "conceded",
          label: "Concédés au sol",
          ...share.conceded,
          ...formatShare(share.conceded.ground, share.conceded.counted)
        }
      ].filter((line) => line.counted > 0);
    });

    // STAT-8 : shidos reçus par combat, défaites par Hansoku-make.
    const coachDashboardDiscipline = window.Vue.computed(() => {
      const discipline = currentStats()?.discipline;
      if (!discipline || !discipline.scoredCombats) return null;
      const average = discipline.shidosReceived / discipline.scoredCombats;
      return {
        shidoText: `${DECIMAL_FORMATTER.format(average)} shido par combat (${pluralize(discipline.scoredCombats, "combat")})`,
        hansokuMakeText: String(discipline.hansokuMakeDefeats)
      };
    });

    // STAT-13 : l'effectif donne les judokas engagés, puis leur garde.
    const coachDashboardEffectifText = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats) return "";
      return [
        pluralize(stats.engagedJudokas, "judoka"),
        ...(stats.judokasByHandedness || [])
          .filter((entry) => entry.judokaCount > 0)
          .map((entry) => pluralize(entry.judokaCount, entry.handedness.toLowerCase()))
      ].join(" · ");
    });
    const coachDashboardDataQualityIssues = window.Vue.computed(() =>
      (currentStats()?.dataQualityIssues || []).filter((entry) => entry.count > 0)
    );
    const coachDashboardPodiumsByLevel = window.Vue.computed(() => currentStats()?.podiumsByLevel || []);
    const coachDashboardTopWinTechniques = window.Vue.computed(() => currentStats()?.topWinTechniques || []);
    // STATS-1 : podiums écrits en toutes lettres, par niveau (« National : 1 deuxième place »).
    const PODIUM_PLACE_WORDS: Record<string, [string, string]> = {
      "1er": ["première place", "premières places"],
      "2e": ["deuxième place", "deuxièmes places"],
      "3e": ["troisième place", "troisièmes places"]
    };
    function countPodiums(podiums: Array<{ count: number }>): number {
      return podiums.reduce((sum, podium) => sum + Number(podium.count || 0), 0);
    }
    // STAT-11 : chaque niveau rapporte ses podiums à ses participations classées.
    const coachDashboardPodiumLines = window.Vue.computed(() =>
      [...coachDashboardPodiumsByLevel.value]
        .filter((entry) => entry.rankedParticipations > 0 || countPodiums(entry.podiums) > 0)
        .sort((a, b) => PODIUM_LEVEL_PRIORITY.indexOf(a.level) - PODIUM_LEVEL_PRIORITY.indexOf(b.level))
        .map((entry) => {
          const places = PODIUM_PLACE_PRIORITY.map((place) => {
            const count = Number(entry.podiums.find((podium) => podium.place === place)?.count || 0);
            const words = PODIUM_PLACE_WORDS[place] || [place, place];
            return count ? `${PODIUM_PLACE_EMOJIS[place]} ${count} ${count > 1 ? words[1] : words[0]}` : "";
          }).filter(Boolean);
          const ratio = `${pluralize(countPodiums(entry.podiums), "podium")} sur ${pluralize(
            entry.rankedParticipations,
            "participation classée",
            "participations classées"
          )}`;
          return { level: entry.level, text: [...places, ratio].join(" · ") };
        })
    );
    const coachDashboardPodiumTotal = window.Vue.computed(() =>
      coachDashboardPodiumsByLevel.value.reduce((total, entry) => total + countPodiums(entry.podiums), 0)
    );
    const coachDashboardRankedTotal = window.Vue.computed(() =>
      coachDashboardPodiumsByLevel.value.reduce((total, entry) => total + Number(entry.rankedParticipations || 0), 0)
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
    // STAT-14 : la tuile ne compte que les critères par combat (le niveau se compte par compétition).
    const coachDashboardIncompleteCount = window.Vue.computed(() =>
      coachDashboardDataQualityIssues.value
        .filter((issue) => issue.unit !== "competition")
        .reduce((max, issue) => Math.max(max, issue.count), 0)
    );

    function getJudokaName(judokaId: string): string {
      const judoka =
        state.judokas.find((candidate) => String(candidate.judokaId) === String(judokaId)) ||
        (state.currentUser && String(state.currentUser.judokaId) === String(judokaId) ? state.currentUser : null);
      return (judoka && getJudokaDisplayName(judoka)) || "Judoka";
    }

    function formatVersus(label: string, record: { combats: number; victories: number } | undefined): string {
      if (!record || !record.combats) return "";
      const rate = record.combats >= MIN_RATE_SAMPLE ? ` (${toRate(record.victories, record.combats)} %)` : "";
      return `${label} ${record.victories}/${record.combats}${rate}`;
    }

    // TDB-3 : résultats par judoka, du plus actif au moins actif.
    const coachDashboardJudokaRows = window.Vue.computed(() =>
      (currentStats()?.byJudoka || [])
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
            .join(" · "),
          // STAT-10 : bilan contre les droitiers et contre les gauchers.
          versus: [
            formatVersus("contre droitiers", entry.vsRightHanded),
            formatVersus("contre gauchers", entry.vsLeftHanded)
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
      const worstStage = (stats.byStage || [])
        .filter((line) => line.key && line.defeats > 0)
        .sort((a, b) => b.defeats - a.defeats)[0];
      const mainDefeat = [...(stats.defeatsByDecisionType || [])]
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)[0];
      const topTechnique = (stats.topWinTechniques || [])[0];
      if (worstStage) {
        sentences.push(`Le plus de défaites : ${worstStage.label} (${worstStage.defeats}).`);
      } else if (mainDefeat) {
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
          openQualityIssueCompetition,
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
          coachDashboardVictoryTile,
          coachDashboardVictoriesByType,
          coachDashboardDefeatsByType,
          coachDashboardIpponLines,
          coachDashboardByLateralMatchup,
          coachDashboardStageLines,
          coachDashboardLevelLines,
          coachDashboardMonthLines,
          coachDashboardScoreHoldingLines,
          coachDashboardGroundLines,
          coachDashboardDiscipline,
          coachDashboardEffectifText,
          coachDashboardDataQualityIssues,
          coachDashboardPodiumsByLevel,
          coachDashboardPodiumLines,
          coachDashboardPodiumTotal,
          coachDashboardRankedTotal,
          coachDashboardTopWinTechniques,
          coachDashboardTopWinTechniqueBars,
          coachDashboardDefeatTechniqueBars,
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

    // STAT-14 : le niveau manquant ouvre la compétition concernée.
    function openQualityIssueCompetition(competition: { competitionId: string }) {
      if (competition.competitionId) {
        screens.competition.openCompetition(competition.competitionId);
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
