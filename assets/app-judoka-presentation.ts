(() => {
  function createJudokaProfileViewModel(profile, helpers) {
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
    const category =
      highlightedCompetition && highlightedCompetition.category
        ? highlightedCompetition.category
        : "Catégorie à confirmer";
    const weightCategory =
      highlightedCompetition && highlightedCompetition.weightCategory
        ? highlightedCompetition.weightCategory
        : "Poids à confirmer";
    const normalizedCombatProfile = combatProfile || {};

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
      heroCategory: `${category} · ${weightCategory}`,
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
      competitionResults: (competitionResults || []).map((result) => ({
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
