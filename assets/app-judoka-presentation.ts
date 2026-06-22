(() => {
  type JudokaProfile = import("./types").JudokaProfile;
  type JudokaProfilePresentationHelpers = import("./types").JudokaProfilePresentationHelpers;
  type JudokaProfileViewModel = import("./types").JudokaProfileViewModel;

  function createJudokaProfileViewModel(
    profile: JudokaProfile | null,
    helpers: JudokaProfilePresentationHelpers
  ): JudokaProfileViewModel | null {
    if (!profile) {
      return null;
    }

    const {
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
    const yearInCategory = judoka.yearInCategory ? `${judoka.yearInCategory}e année` : "";
    const handedness = judoka.handedness || "";

    return {
      profileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
      profileSubtitle: `Saison ${season.label}`,
      seasonLabel: `Saison ${season.label}`,
      seasonCompetitionCount: String(seasonCompetitionCount || 0),
      seasonCombatCount: String(seasonCombatCount || 0),
      seasonWins: String(seasonWins || 0),
      seasonLosses: String(seasonLosses || 0),
      seasonDraws: String(seasonDraws || 0),
      victoryRate: `${victoryRate || 0}%`,
      heroAvatar: getJudokaInitials(judoka),
      heroName: getJudokaDisplayName(judoka) || "Judoka",
      heroSummary: `${seasonCompetitionCount || 0} compétitions · ${seasonCombatCount || 0} combats · ${victoryRate || 0}% victoires`,
      heroCategory: ageCategory || "Catégorie à renseigner",
      heroWeightCategory: weightCategory,
      heroBeltColor: beltColor,
      heroGender: gender,
      heroYearInCategory: yearInCategory,
      heroHandedness: handedness,
      heroSeason: `Saison ${season.label}`,
      victoriesByDecisionType: victoriesByDecisionType || [],
      defeatsByDecisionType: defeatsByDecisionType || [],
      topWinTechniques: topWinTechniques || [],
      hasTopWinTechniques: Boolean((topWinTechniques || []).length),
      competitionResults: (competitionResults || []).map((result: JudokaProfile["competitionResults"][number]) => ({
        competitionId: result.competitionId || "",
        name: result.name || "Compétition",
        date: formatDate(result.competitionDate),
        result: formatCompetitionRanking(result.result) || "Non classé",
        resultClass: getClassementBadgeClass(result.result),
        badgeClass: result.resultBadge ? result.resultBadge.className : "rank-unclassified",
        combatRecord: result.combatRecord ? result.combatRecord.label : "0V · 0D"
      })),
      hasCompetitionResults: Boolean((competitionResults || []).length)
    };
  }

  window.createJudokaProfileViewModel = createJudokaProfileViewModel;
})();
