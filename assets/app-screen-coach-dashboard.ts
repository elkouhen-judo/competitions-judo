(() => {
  type KirokuApp = import("./types").KirokuApp;
  type CoachDashboardStats = import("../core/types").CoachDashboardStats;
  type CoachDashboardCompetitionOption = import("../core/types").CoachDashboardCompetitionOption;
  type CoachDashboardCompetitionPreset = import("./types").CoachDashboardCompetitionPreset;

  const COACH_DASHBOARD_REFRESH_DEBOUNCE_MS = 300;
  const COACH_DASHBOARD_COMPETITION_SUGGESTION_LIMIT = 8;
  const PODIUM_LEVEL_PRIORITY = ["International", "National", "Régional", "Départemental"];
  const PODIUM_PLACE_PRIORITY = ["1er", "2e", "3e"];
  const PODIUM_PLACE_EMOJIS: Record<string, string> = { "1er": "🥇", "2e": "🥈", "3e": "🥉" };

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
    activity:
      "Judokas différents ayant au moins un combat retenu (puis leur garde à partir de 5 judokas), participations passées, compétitions et combats par judoka engagé.",
    participations:
      "Participations dont la date est passée. Une participation sans combat saisi compte dans les podiums, pas dans les taux de victoire.",
    podiumsByLevel:
      "Places obtenues par niveau de compétition, sur les participations classées à ce niveau, puis les classements dans les 7 premiers (1er, 2e, 3e, 5e, 7e).",
    victoriesByType: "Comment les combats gagnés se sont terminés, en part de toutes les victoires.",
    winTechniques:
      "Les 5 techniques les plus marquées par les judokas dans les combats gagnés, et le nombre de techniques différentes marquées.",
    defeatsByType: "Comment les combats perdus se sont terminés, en part de toutes les défaites.",
    defeatTechniques: "Les 5 techniques les plus marquées par les adversaires dans les combats perdus.",
    ippon:
      "Part des victoires avec au moins un Ippon du judoka, puis part de ces Ippon marqués debout et au sol.",
    lateral:
      "Taux de victoire selon la garde du judoka et celle de l'adversaire. Seuls les combats gagnés ou perdus dont les deux gardes sont connues comptent.",
    byLevel: "Combats, victoires et défaites selon le niveau de la compétition.",
    scoreHolding:
      "Qui marque le premier et qui gagne ensuite, lu sur le déroulé. Seuls les combats dont tous les points sont rangés comptent.",
    groundShare:
      "Part des points marqués et concédés au sol. Seuls les points dont la technique est connue comptent.",
    discipline:
      "Shidos reçus par combat, sur les combats dont le score est renseigné, et défaites par Hansoku-make.",
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

  // STAT-25, STAT-29 : la valeur de la période précédente, si son dénominateur atteint 5.
  function formatPreviousRate(count: number, total: number) {
    if (total < MIN_RATE_SAMPLE) return "";
    return `avant ${count}/${total} (${toRate(count, total)} %)`;
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
    const withPrevious = (text: string, previous: string) => (previous ? `${text} · ${previous}` : text);

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
        podiums: formatDelta(
          countAllPodiums(stats.podiumsByLevel) - countAllPodiums(previous.podiumsByLevel),
          "podium"
        )
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

    // STAT-2 : parmi les victoires avec un Ippon du judoka, debout ou au sol.
    // STAT-29 : la part des victoires par Ippon, et celle de la période précédente.
    const coachDashboardIpponLines = window.Vue.computed(() => {
      const stats = currentStats();
      const split = stats?.ipponVictories;
      if (!stats || !split || !split.total) return [];
      const previous = previousStats();
      const share = formatShare(split.total, stats.victories);
      return [
        {
          key: "victories",
          label: "Victoires avec Ippon",
          ...share,
          text: withPrevious(
            share.text,
            previous ? formatPreviousRate(previous.ipponVictories.total, previous.victories) : ""
          )
        },
        { key: "standing", label: "Debout", ...formatShare(split.standing, split.total) },
        { key: "ground", label: "Au sol", ...formatShare(split.ground, split.total) }
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
    // STAT-25 : chaque niveau rappelle son bilan de la période précédente.
    const coachDashboardLevelLines = window.Vue.computed(() => {
      const previousByKey = new Map((previousStats()?.byLevel || []).map((line) => [line.key, line]));
      return toResultLines(currentStats()?.byLevel || []).map((line) => {
        const previous = previousByKey.get(line.key);
        return {
          ...line,
          text: withPrevious(line.text, previous ? formatPreviousRate(previous.victories, previous.combats) : "")
        };
      });
    });

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

    // STAT-6 : tenue du score, sur les combats au déroulé complet.
    const coachDashboardScoreHoldingLines = window.Vue.computed(() => {
      const holding = currentStats()?.scoreHolding;
      if (!holding || !holding.counted) return [];
      return [
        { key: "scoredFirst", label: "Marque le premier", value: `${holding.scoredFirst}/${holding.counted}` },
        {
          key: "wonAfterScoringFirst",
          label: "Puis gagne",
          value: withPrevious(
            formatWinRate(holding.wonAfterScoringFirst, holding.scoredFirst).text,
            formatPreviousRate(
              previousStats()?.scoreHolding.wonAfterScoringFirst || 0,
              previousStats()?.scoreHolding.scoredFirst || 0
            )
          )
        },
        { key: "lostAfterLeading", label: "Perd après avoir mené", value: String(holding.lostAfterLeading) },
        { key: "wonAfterTrailing", label: "Gagne après avoir été mené", value: String(holding.wonAfterTrailing) }
      ];
    });

    // STAT-7 : part des points au sol, marqués et concédés.
    const coachDashboardGroundLines = window.Vue.computed(() => {
      const share = currentStats()?.groundShare;
      if (!share) return [];
      const previous = previousStats()?.groundShare;
      const toLine = (key: "scored" | "conceded", label: string) => {
        const current = share[key];
        const formatted = formatShare(current.ground, current.counted);
        const before = previous ? formatPreviousRate(previous[key].ground, previous[key].counted) : "";
        return { key, label, ...current, ...formatted, text: withPrevious(formatted.text, before) };
      };
      return [toLine("scored", "Marqués au sol"), toLine("conceded", "Concédés au sol")].filter(
        (line) => line.counted > 0
      );
    });

    // STAT-8 : shidos reçus par combat, défaites par Hansoku-make.
    const coachDashboardDiscipline = window.Vue.computed(() => {
      const discipline = currentStats()?.discipline;
      if (!discipline || !discipline.scoredCombats) return null;
      const average = discipline.shidosReceived / discipline.scoredCombats;
      const previous = previousStats()?.discipline;
      // STAT-29 : « 0,4 par combat (12 combats) · avant 0,9 (8 combats) ».
      const before =
        previous && previous.scoredCombats >= MIN_RATE_SAMPLE
          ? `avant ${DECIMAL_FORMATTER.format(previous.shidosReceived / previous.scoredCombats)} (${pluralize(
              previous.scoredCombats,
              "combat"
            )})`
          : "";
      return {
        shidoText: withPrevious(
          `${DECIMAL_FORMATTER.format(average)} par combat (${pluralize(discipline.scoredCombats, "combat")})`,
          before
        ),
        hansokuMakeText: String(discipline.hansokuMakeDefeats)
      };
    });

    // STAT-28 : l'activité du club, sans aucun nom, et la valeur de la période précédente.
    const coachDashboardActivityLines = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats) return [];
      const previous = previousStats();
      const before = (value: string) => (previous ? `avant ${value}` : "");
      const perJudoka = (entry: CoachDashboardStats) =>
        entry.engagedJudokas ? DECIMAL_FORMATTER.format(entry.totalCombats / entry.engagedJudokas) : "0";
      const handedness = (stats.judokasByHandedness || [])
        .filter((entry) => entry.judokaCount > 0)
        .map((entry) => pluralize(entry.judokaCount, entry.handedness.toLowerCase()));
      const levels = stats.podiumsByLevel
        .filter((entry) => entry.participations > 0 || (previous && findLevel(previous, entry.level)?.participations))
        .sort((a, b) => PODIUM_LEVEL_PRIORITY.indexOf(a.level) - PODIUM_LEVEL_PRIORITY.indexOf(b.level))
        .map((entry) => {
          const previousCount = previous ? findLevel(previous, entry.level)?.participations || 0 : null;
          return `${entry.level} ${entry.participations}${previousCount === null ? "" : ` (avant ${previousCount})`}`;
        });
      return [
        {
          key: "judokas",
          label: "Judokas engagés",
          value: withPrevious([String(stats.engagedJudokas), ...handedness].join(" · "), before(String(previous?.engagedJudokas ?? "")))
        },
        {
          key: "participations",
          label: "Participations",
          value: withPrevious(String(stats.participations), before(String(previous?.participations ?? "")))
        },
        {
          key: "competitions",
          label: "Compétitions",
          value: withPrevious(String(stats.analyzedCompetitions), before(String(previous?.analyzedCompetitions ?? "")))
        },
        {
          key: "combatsPerJudoka",
          label: "Combats par judoka engagé",
          value: withPrevious(perJudoka(stats), previous ? before(perJudoka(previous)) : "")
        },
        ...(levels.length ? [{ key: "byLevel", label: "Participations par niveau", value: levels.join(" · ") }] : [])
      ];
    });
    // STAT-27 : participations passées, dont celles sans combat saisi.
    const coachDashboardParticipationText = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats || !stats.participationsWithoutCombat) return "";
      return `${pluralize(stats.participations, "participation")}, dont ${stats.participationsWithoutCombat} sans combat saisi.`;
    });
    // STAT-29 : techniques différentes marquées dans les combats gagnés.
    const coachDashboardDistinctTechniquesText = window.Vue.computed(() => {
      const stats = currentStats();
      if (!stats || !stats.distinctWinTechniques) return "";
      const previous = previousStats();
      return withPrevious(
        pluralize(stats.distinctWinTechniques, "technique différente marquée", "techniques différentes marquées"),
        previous ? `avant ${previous.distinctWinTechniques}` : ""
      );
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
    function countAllPodiums(levels: CoachDashboardStats["podiumsByLevel"]): number {
      return (levels || []).reduce((sum, entry) => sum + countPodiums(entry.podiums), 0);
    }
    function findLevel(stats: CoachDashboardStats, level: string) {
      return (stats.podiumsByLevel || []).find((entry) => entry.level === level) || null;
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
          // STAT-26 : les 7 premiers, au-delà des podiums.
          const topSeven = entry.topSeven ? `${entry.topSeven} dans les 7 premiers` : "";
          // STAT-25 : le rapport de la période précédente au même niveau.
          const previous = previousStats() ? findLevel(previousStats() as CoachDashboardStats, entry.level) : null;
          const before = previous
            ? `avant ${countPodiums(previous.podiums)} sur ${previous.rankedParticipations}`
            : "";
          return { level: entry.level, text: [...places, ratio, topSeven, before].filter(Boolean).join(" · ") };
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
          retryCoachDashboard,
          returnToClubCompetition,
          scheduleCoachDashboardRefresh,
          showCoachHome,
          showCoachCompetitions,
          toggleCoachDashboardFilters,
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
          coachDashboardLevelLines,
          coachDashboardPeriodLines,
          coachDashboardPreviousLabel,
          coachDashboardTileDeltas,
          coachDashboardActivityLines,
          coachDashboardParticipationText,
          coachDashboardDistinctTechniquesText,
          coachDashboardScoreHoldingLines,
          coachDashboardGroundLines,
          coachDashboardDiscipline,
          coachDashboardDataQualityIssues,
          coachDashboardPodiumsByLevel,
          coachDashboardPodiumLines,
          coachDashboardPodiumTotal,
          coachDashboardRankedTotal,
          coachDashboardTopWinTechniques,
          coachDashboardTopWinTechniqueBars,
          coachDashboardDefeatTechniqueBars,
          coachDashboardIncompleteCount,
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
        coachDashboardViewModel.coachDashboardWithheld = null;
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
        coachDashboardViewModel.coachDashboardWithheld = null;
      } else if (!coachDashboardFiltersInitialized) {
        // TDB-6 : première ouverture sur la saison en cours et le club choisi à l'accueil.
        Object.assign(form, getDefaultCoachDashboardFilters(), { clubId: state.selectedClubId || "" });
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
