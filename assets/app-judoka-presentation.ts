(() => {
  type JudokaProfile = import("./types").JudokaProfile;
  type JudokaProfilePresentationHelpers = import("./types").JudokaProfilePresentationHelpers;
  type JudokaProfileViewModel = import("./types").JudokaProfileViewModel;

  type DecisionTypeEntry = { decisionType: string; count: number; total?: number; rate?: number };
  type DecisionTypeLine = { decisionType: string; count: number; rate: number };

  // Fins de combat utiles : lignes non nulles, de la plus fréquente à la moins
  // fréquente, plus « Non renseignée » pour que la somme égale le total.
  function buildDecisionTypeLines(entries: DecisionTypeEntry[] | null | undefined, total: number): DecisionTypeLine[] {
    const safeTotal = Math.max(0, Number(total) || 0);
    const toRate = (count: number) => (safeTotal ? Math.round((count / safeTotal) * 100) : 0);
    const lines = (entries || [])
      .map((entry) => ({ decisionType: entry.decisionType, count: Number(entry.count) || 0 }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count)
      .map((entry) => ({ ...entry, rate: toRate(entry.count) }));
    const missing = safeTotal - lines.reduce((sum, entry) => sum + entry.count, 0);
    if (missing > 0) {
      lines.push({ decisionType: "Non renseignée", count: missing, rate: toRate(missing) });
    }
    return lines;
  }

  // Bilan sans compteurs à zéro : « 1D », « 2V 1D ».
  function formatCombatRecord(record: { total: number; wins: number; losses: number; draws: number } | undefined) {
    if (!record || !record.total) return "";
    const parts = [record.wins ? `${record.wins}V` : "", record.losses ? `${record.losses}D` : "", record.draws ? `${record.draws}N` : ""];
    return parts.filter(Boolean).join(" ");
  }

  // V2 A : rond de tête de ligne. Médaille dessinée (MEDAL-1), place, « ? » à saisir, calendrier à venir.
  const PODIUM_RESULTS = ["1er", "2e", "3e"];
  const MEDAL_CLASSES = ["medal-1", "medal-2", "medal-3"];
  function getRankDot(result: string, isUpcoming: boolean) {
    if (isUpcoming) return { rankDotLabel: "", rankDotClass: "medal-dot-upcoming" };
    if (!result) return { rankDotLabel: "?", rankDotClass: "medal-dot-pending" };
    const podium = PODIUM_RESULTS.indexOf(result);
    if (podium >= 0) return { rankDotLabel: result.replace(/\D/g, ""), rankDotClass: MEDAL_CLASSES[podium] };
    return { rankDotLabel: /^\d/.test(result) ? result.replace(/\D/g, "") : "NC", rankDotClass: "" };
  }

  // « Ceinture blanche », « ceinture noire 1er dan » ; une bicolore garde ses couleurs (« blanc-jaune »).
  const FEMININE_BELTS: Record<string, string> = { blanc: "blanche", vert: "verte", bleu: "bleue", noir: "noire" };
  function formatBeltLabel(beltColor: string) {
    const lower = beltColor.trim().toLowerCase();
    if (!lower) return "";
    if (lower.includes("-")) return `Ceinture ${lower}`;
    const [first, ...rest] = lower.split(/\s+/);
    return ["Ceinture", FEMININE_BELTS[first] || first, ...rest].join(" ");
  }

  // STA-008 : « Dans 6 jours » pour une compétition pas encore disputée.
  function formatWhenLabel(dateValue: unknown, formatRelativeDay?: (value: unknown) => string) {
    const label = formatRelativeDay ? formatRelativeDay(dateValue) : "";
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : "À venir";
  }

  function createJudokaProfileViewModel(
    profile: JudokaProfile | null,
    helpers: JudokaProfilePresentationHelpers
  ): JudokaProfileViewModel | null {
    if (!profile) {
      return null;
    }

    const {
      formatCompetitionName,
      formatCompetitionRanking,
      formatDate,
      getJudokaDisplayName,
      getJudokaInitials,
      formatRelativeDay,
      formatCountdown,
      getBeltBackground
    } = helpers;
    const {
      judoka,
      season,
      lastCompetition,
      seasonCombatCount,
      seasonCompetitionCount,
      seasonWins,
      seasonLosses,
      seasonDraws,
      victoryRate,
      victoriesByDecisionType,
      defeatsByDecisionType,
      topWinTechniques,
      competitionResults
    } = profile;
    const highlightedCompetition =
      lastCompetition || (competitionResults && competitionResults[0]) || null;
    const ageCategory =
      judoka.ageCategory ||
      (highlightedCompetition && highlightedCompetition.category) ||
      "";
    const weightCategory =
      judoka.weightCategory ||
      (highlightedCompetition && highlightedCompetition.weightCategory) ||
      "";
    const beltColor = judoka.beltColor || "";
    const gender = judoka.gender || "";
    const yearInCategory = judoka.yearInCategory
      ? String(judoka.yearInCategory) === "1"
        ? "1re année"
        : `${judoka.yearInCategory}e année`
      : "";
    const handedness = judoka.handedness || "";
    // INSCR-2 : judoka non réinscrit pour la saison en cours.
    const today = helpers.getCurrentLocalDate ? helpers.getCurrentLocalDate() : "";
    const unregistered = Boolean(today && helpers.isRegisteredForDate && !helpers.isRegisteredForDate(judoka, today));

    const combats = Number(seasonCombatCount) || 0;
    const toShare = (count: number) => (combats ? Math.round(((Number(count) || 0) / combats) * 100) : 0);

    return {
      profileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
      // V2 A : « Ceinture orange · Homme » sous le nom ; le club est ajouté par l'écran.
      profileSubtitle: [formatBeltLabel(beltColor), gender].filter(Boolean).join(" · "),
      heroBeltBackground: getBeltBackground ? getBeltBackground(beltColor) : "",
      winShare: toShare(seasonWins),
      lossShare: toShare(seasonLosses),
      seasonCompetitionCount: String(seasonCompetitionCount || 0),
      seasonCombatCount: String(seasonCombatCount || 0),
      seasonWins: String(seasonWins || 0),
      seasonLosses: String(seasonLosses || 0),
      seasonDraws: String(seasonDraws || 0),
      victoryRate: `${victoryRate || 0} %`,
      heroAvatar: getJudokaInitials(judoka),
      heroName: getJudokaDisplayName(judoka) || "Judoka",
      heroSummary: `${seasonCompetitionCount || 0} compétitions · ${seasonCombatCount || 0} combats · ${victoryRate || 0}% victoires`,
      heroCategory: ageCategory,
      heroWeightCategory: String(weightCategory || "").trim().replace(/\s*kg$/i, " kg"),
      heroYearInCategory: yearInCategory,
      heroHandedness: handedness,
      heroUnregistered: unregistered ? "Non réinscrit" : "",
      heroSeason: `Saison ${season.label}`,
      // Fins de combat sans ligne à zéro, triées, « Non renseignée » en complément.
      victoriesByDecisionType: buildDecisionTypeLines(victoriesByDecisionType, seasonWins),
      defeatsByDecisionType: buildDecisionTypeLines(defeatsByDecisionType, seasonLosses),
      topWinTechniques: topWinTechniques || [],
      hasTopWinTechniques: Boolean((topWinTechniques || []).length),
      competitionResults: (competitionResults || []).map((result: JudokaProfile["competitionResults"][number]) => {
        const ranking = formatCompetitionRanking(result.result);
        const isUpcoming = Boolean(result.isUpcoming);
        return {
          competitionId: result.competitionId || "",
          name: formatCompetitionName(result.name) || "Compétition",
          date: formatDate(result.competitionDate),
          result: ranking || (isUpcoming ? "" : "Classement à saisir"),
          needsRanking: !isUpcoming && !ranking,
          combatRecord: formatCombatRecord(result.combatRecord),
          countdown: isUpcoming && formatCountdown ? formatCountdown(result.competitionDate) : "",
          whenLabel: isUpcoming ? formatWhenLabel(result.competitionDate, formatRelativeDay) : "",
          ...getRankDot(ranking, isUpcoming)
        };
      }),
      hasCompetitionResults: Boolean((competitionResults || []).length)
    };
  }

  window.createJudokaProfileViewModel = createJudokaProfileViewModel;
  window.buildDecisionTypeLines = buildDecisionTypeLines;
})();
