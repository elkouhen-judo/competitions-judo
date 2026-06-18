(() => {
  type JudokaProfile = import("./types").JudokaProfile;
  type JudokaProfilePresentationHelpers = import("./types").JudokaProfilePresentationHelpers;
  type JudokaProfileViewModel = import("./types").JudokaProfileViewModel;
  type CombatProfile = NonNullable<JudokaProfile["combatProfile"]>;

  const emptyCombatProfile: CombatProfile = {
    victoryIppon: 0,
    victoryDecision: 0,
    lossIppon: 0,
    lossDecision: 0,
    lossPenalty: 0,
    lossForfeit: 0,
    draws: 0,
    penalties: 0,
    forfeits: 0
  };

  function createJudokaProfileViewModel(
    profile: JudokaProfile | null,
    helpers: JudokaProfilePresentationHelpers
  ): JudokaProfileViewModel | null {
    if (!profile) {
      return null;
    }

    const { formatDate, getClassementBadgeClass, getJudokaDisplayName, getJudokaInitials } =
      helpers;
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
      combatProfile,
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
    const heroCategoryParts = [ageCategory, weightCategory].filter(Boolean);
    const beltColor = judoka.beltColor || "";
    const gender = judoka.gender || "";
    const yearInCategory = judoka.yearInCategory ? `${judoka.yearInCategory}e année` : "";
    const handedness = judoka.handedness || "";
    const normalizedCombatProfile = combatProfile || emptyCombatProfile;

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
      heroCategory: heroCategoryParts.length ? heroCategoryParts.join(" · ") : "Catégorie à renseigner",
      heroBeltColor: beltColor,
      heroGender: gender,
      heroYearInCategory: yearInCategory,
      heroHandedness: handedness,
      heroSeason: `Saison ${season.label}`,
      combatProfile: {
        victoryIppon: String(normalizedCombatProfile.victoryIppon || 0),
        victoryDecision: String(normalizedCombatProfile.victoryDecision || 0),
        lossIppon: String(normalizedCombatProfile.lossIppon || 0),
        lossDecision: String(normalizedCombatProfile.lossDecision || 0),
        lossPenalty: String(normalizedCombatProfile.lossPenalty || 0),
        lossForfeit: String(normalizedCombatProfile.lossForfeit || 0),
        draws: String(normalizedCombatProfile.draws || 0),
        penalties: String(normalizedCombatProfile.penalties || 0),
        forfeits: String(normalizedCombatProfile.forfeits || 0)
      },
      hasCombatProfileExtras: Boolean(
        Number(normalizedCombatProfile.draws || 0) ||
        Number(normalizedCombatProfile.penalties || 0) ||
        Number(normalizedCombatProfile.forfeits || 0)
      ),
      competitionResults: (competitionResults || []).map((result: JudokaProfile["competitionResults"][number]) => ({
        competitionId: result.competitionId || "",
        name: result.name || "Compétition",
        date: formatDate(result.competitionDate),
        result: result.result || "Non classé",
        resultClass: getClassementBadgeClass(result.result),
        badgeClass: result.resultBadge ? result.resultBadge.className : "rank-unclassified",
        combatRecord: result.combatRecord ? result.combatRecord.label : "0V · 0D"
      })),
      hasCompetitionResults: Boolean((competitionResults || []).length)
    };
  }

  window.createJudokaProfileViewModel = createJudokaProfileViewModel;
})();
