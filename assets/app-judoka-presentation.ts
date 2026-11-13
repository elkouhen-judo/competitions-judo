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
      getClassementBadgeClass,
      getJudokaDisplayName,
      getJudokaInitials
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

    return {
      profileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
      profileSubtitle: "Profil sportif et résultats",
      seasonLabel: `Saison ${season.label}`,
      seasonCompetitionCount: String(seasonCompetitionCount || 0),
      seasonCombatCount: String(seasonCombatCount || 0),
      seasonWins: String(seasonWins || 0),
      seasonLosses: String(seasonLosses || 0),
      seasonDraws: String(seasonDraws || 0),
      // Bilan sans compteurs à zéro : « 7V 1D ».
      seasonRecord:
        [seasonWins ? `${seasonWins}V` : "", seasonLosses ? `${seasonLosses}D` : "", seasonDraws ? `${seasonDraws}N` : ""]
          .filter(Boolean)
          .join(" ") || "—",
      victoryRate: `${victoryRate || 0}%`,
      heroAvatar: getJudokaInitials(judoka),
      heroName: getJudokaDisplayName(judoka) || "Judoka",
      heroSummary: `${seasonCompetitionCount || 0} compétitions · ${seasonCombatCount || 0} combats · ${victoryRate || 0}% victoires`,
      heroCategory: ageCategory || "Catégorie à renseigner",
      heroWeightCategory: String(weightCategory || "").trim().replace(/\s*kg$/i, " kg"),
      heroBeltColor: beltColor,
      heroGender: gender,
      heroYearInCategory: yearInCategory,
      heroHandedness: handedness,
      heroUnregistered: unregistered ? "Non réinscrit" : "",
      heroSeason: `Saison ${season.label}`,
      // Fins de combat sans ligne à zéro, triées, « Non renseignée » en complément.
      victoriesByDecisionType: buildDecisionTypeLines(victoriesByDecisionType, seasonWins),
      defeatsByDecisionType: buildDecisionTypeLines(defeatsByDecisionType, seasonLosses),
      topWinTechniques: topWinTechniques || [],
      hasTopWinTechniques: Boolean((topWinTechniques || []).length),
      competitionResults: (competitionResults || []).map((result: JudokaProfile["competitionResults"][number]) => ({
        competitionId: result.competitionId || "",
        name: formatCompetitionName(result.name) || "Compétition",
        date: formatDate(result.competitionDate),
        result: formatCompetitionRanking(result.result) || "Non classé",
        resultClass: getClassementBadgeClass(result.result),
        badgeClass: result.resultBadge ? result.resultBadge.className : "rank-unclassified",
        combatRecord: result.combatRecord && result.combatRecord.total ? result.combatRecord.label.replace(/ · /g, " ") : ""
      })),
      hasCompetitionResults: Boolean((competitionResults || []).length)
    };
  }

  window.createJudokaProfileViewModel = createJudokaProfileViewModel;
  window.buildDecisionTypeLines = buildDecisionTypeLines;
})();
