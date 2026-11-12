(() => {
  type Competition = import("./types").Competition;
  type CompetitionCombatCard = import("./types").CompetitionCombatCard;
  type CombatReadModel = import("./types").CombatReadModel;
  type CombatDataQualityIssue = import("./types").CombatDataQualityIssue;
  type AccessInvitation = import("./types").AccessInvitation;
  type Judoka = import("./types").Judoka;
  type ManagedAdminCard = import("./types").ManagedAdminCard;
  type ManagedUserCard = import("./types").ManagedUserCard;
  type PendingOfflineOperation = import("./types").PendingOfflineOperation;

  /**
   * FFJDA weight categories (2025-2026 season), mirroring
   * core/domain/category-reference.ts (frontend code cannot import core/).
   * Poussinet and Poussin compete without official weight divisions. Vétéran
   * reuses the Senior weight scale (the body division doesn't change past
   * Senior, only the age band).
   */
  const SENIOR_WEIGHT_CATEGORIES: Record<string, string[]> = {
    "Homme": ["-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
    "Femme": ["-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
  };

  const WEIGHT_CATEGORIES_BY_AGE_AND_GENDER: Record<string, Record<string, string[]>> = {
    Benjamin: {
      "Homme": ["-30kg", "-34kg", "-38kg", "-42kg", "-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "+66kg"],
      "Femme": ["-32kg", "-36kg", "-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "+63kg"]
    },
    Minime: {
      "Homme": ["-34kg", "-38kg", "-42kg", "-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "-73kg", "+73kg"],
      "Femme": ["-36kg", "-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "+70kg"]
    },
    Cadet: {
      "Homme": ["-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "+90kg"],
      "Femme": ["-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "+70kg"]
    },
    Junior: {
      "Homme": ["-55kg", "-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
      "Femme": ["-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
    },
    Senior: SENIOR_WEIGHT_CATEGORIES,
    "Vétéran": SENIOR_WEIGHT_CATEGORIES
  };

  function getWeightCategoryOptions(ageCategory: string, gender?: string): string[] {
    const byGender = WEIGHT_CATEGORIES_BY_AGE_AND_GENDER[ageCategory];
    if (!byGender) {
      return [];
    }
    if (gender && byGender[gender]) {
      return byGender[gender];
    }
    return [...new Set([...byGender["Homme"], ...byGender["Femme"]])];
  }

  /**
   * Number of valid "année dans la catégorie" values. Senior and Vétéran are
   * open/age-banded categories where this concept doesn't apply.
   */
  const YEARS_IN_CATEGORY_COUNT: Record<string, number> = {
    Poussinet: 2,
    Poussin: 2,
    Benjamin: 2,
    Minime: 2,
    Cadet: 3,
    Junior: 3
  };

  function getYearInCategoryOptions(ageCategory: string): string[] {
    const count = YEARS_IN_CATEGORY_COUNT[ageCategory];
    if (!count) {
      return [];
    }
    return Array.from({ length: count }, (_, index) => String(index + 1));
  }

  function paginateList<TItem>(
    items: TItem[] | null | undefined,
    currentPage: number,
    pageSize: number
  ) {
    const totalItems = (items || []).length;
    const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;

    return {
      pageItems: (items || []).slice(startIndex, startIndex + pageSize),
      totalItems,
      totalPages,
      currentPage: safeCurrentPage,
      canShowPreviousPage: safeCurrentPage > 1,
      canShowNextPage: safeCurrentPage < totalPages
    };
  }

  function projectManagedAdmins(
    admins: Judoka[] | null | undefined,
    currentUser: Judoka | null | undefined,
    helpers: { getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string }
  ) {
    const { getJudokaDisplayName } = helpers;

    const projectedAdmins: ManagedAdminCard[] = (admins || []).map((admin) => {
      const fullName = getJudokaDisplayName(admin) || admin.accountEmail || "Admin";
      const isCurrentAdmin = Boolean(
        currentUser && String(currentUser.judokaId) === String(admin.judokaId)
      );
      return {
        judokaId: admin.judokaId || "",
        fullName,
        accountEmail: admin.accountEmail || "Non renseigné",
        isCurrentAdmin
      };
    });

    return {
      admins: projectedAdmins,
      hasAdmins: projectedAdmins.length > 0
    };
  }

  function isAdminUser(user: Judoka): boolean {
    return user.accessRole === "ADMIN" || user.adminAccess === true;
  }

  function getUserRoleLabel(user: Judoka): string {
    const profileTypeLabel = user.profileType === "PARENT" ? "Parent" : "Judoka";
    const roles = [user.accessRole === "COACH" ? "Coach" : "", isAdminUser(user) ? "Admin" : ""].filter(Boolean);
    return [...roles, profileTypeLabel].join(" · ");
  }

  function projectManagedUsers(
    users: Judoka[] | null | undefined,
    totalCount: number,
    search: string,
    currentPage: number,
    pageSize: number,
    currentUser: Judoka | null | undefined,
    helpers: { getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string }
  ) {
    const { getJudokaDisplayName } = helpers;

    const registeredCards: ManagedUserCard[] = (users || []).map((user) => ({
      judokaId: user.judokaId || "",
      fullName: getJudokaDisplayName(user) || user.accountEmail || "Utilisateur",
      accountEmail: user.accountEmail || "Non renseigné",
      roleLabel: getUserRoleLabel(user),
      isAdmin: isAdminUser(user),
      isCurrentUser: Boolean(
        currentUser && String(currentUser.judokaId) === String(user.judokaId)
      ),
      isPending: false,
      clubId: user.clubId || "",
      canHaveClub: user.profileType !== "PARENT"
    }));

    // PAGE-3 : la recherche et le total viennent du serveur ; `users` contient les pages déjà lues.
    const total = Math.max(Number(totalCount) || 0, registeredCards.length);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const projectedUsers = registeredCards.slice(startIndex, startIndex + pageSize);

    return {
      users: projectedUsers,
      usersSummary: `${total} utilisateur(s)${search ? " trouvé(s)" : ""} · page ${safeCurrentPage} / ${totalPages}.`,
      usersEmptyMessage: search
        ? `Aucun utilisateur trouvé pour "${search}".`
        : "Aucun utilisateur trouvé.",
      canResetUsersSearch: Boolean(search),
      canShowPreviousUsersPage: safeCurrentPage > 1,
      canShowNextUsersPage: safeCurrentPage < totalPages,
      hasUsers: Boolean(total)
    };
  }

  function projectAccessInvitations(
    pendingInvitations: AccessInvitation[] | null | undefined,
    search: string,
    currentPage: number,
    pageSize: number
  ) {
    const invitationCards: ManagedUserCard[] = (pendingInvitations || []).map((invitation) => ({
      judokaId: "",
      fullName: invitation.email || "Invitation",
      accountEmail: invitation.email || "Non renseigné",
      roleLabel: `En attente d'inscription · ${invitation.invitedProfileType === "PARENT" ? "Parent" : "Judoka"}`,
      isAdmin: false,
      isCurrentUser: false,
      isPending: true,
      clubId: "",
      canHaveClub: false
    }));
    const normalizedSearch = (search || "").toLowerCase();
    const filteredInvitations = !normalizedSearch
      ? invitationCards
      : invitationCards.filter((card) => card.accountEmail.toLowerCase().includes(normalizedSearch));
    const totalPages = Math.max(Math.ceil(filteredInvitations.length / pageSize), 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;

    return {
      invitations: filteredInvitations.slice(startIndex, startIndex + pageSize),
      invitationsSummary: `${filteredInvitations.length} invitation(s)${search ? " trouvée(s)" : ""} · page ${safeCurrentPage} / ${totalPages}.`,
      invitationsEmptyMessage: search
        ? `Aucune invitation trouvée pour "${search}".`
        : "Aucune invitation en attente.",
      canShowPreviousInvitationsPage: safeCurrentPage > 1,
      canShowNextInvitationsPage: safeCurrentPage < totalPages,
      hasInvitations: Boolean(filteredInvitations.length)
    };
  }

  const COMBAT_STAGE_ORDER = ["Poule", "1/32", "1/16", "1/8", "1/4", "1/2", "Repêchage", "Place de 3", "Finale"];

  function getCombatStageOrder(stage: string): number {
    const index = COMBAT_STAGE_ORDER.indexOf(stage);
    return index === -1 ? COMBAT_STAGE_ORDER.length : index;
  }

  function projectCompetitionDetail(
    competition: Competition,
    canEditCompetition: boolean,
    helpers: { formatDate(value: unknown): string }
  ) {
    const { formatDate } = helpers;
    const weight = String(competition.weightCategory || "").trim().replace(/\s*kg$/i, " kg");
    const ageWeightLabel = [competition.ageCategory, weight].filter(Boolean).join(" · ");
    const hasResult = Boolean(String(competition.result || "").trim());

    return {
      competitionTitle: competition.name || "Compétition",
      competitionSubtitle: "Détail de la compétition",
      competitionDate: formatDate(competition.competitionDate),
      ageWeightLabel,
      competitionResult: competition.result || "",
      competitionAiAnalysis: "",
      canEditCompetition,
      canFinalizeCompetition: canEditCompetition && !hasResult
    };
  }

  // COMBAT-SCORE : « IWY - IWY », suivi des shidos s'il y en a ; vide si le score n'est pas renseigné.
  function formatCombatOfficialScore(score: CombatReadModel["officialScore"]): string {
    if (!score) return "";
    const side = (value: { ippon: number; wazaAri: number; yuko: number }) =>
      [value.ippon, value.wazaAri, value.yuko].join(" ");
    const judokaShidos = Number(score.judoka.shido || 0);
    const opponentShidos = Number(score.opponent.shido || 0);
    const shidos = judokaShidos || opponentShidos ? ` · Shidos ${judokaShidos} - ${opponentShidos}` : "";
    return `${side(score.judoka)} - ${side(score.opponent)}${shidos}`;
  }

  function formatCombatScoreLabel(score: { category?: string; technique?: string; neWazaType?: string; value?: string }): string {
    const fallback = score.category === "Tachi-waza" ? "Debout" : score.category === "Ne-waza" ? "Au sol" : "Technique non précisée";
    const detail = score.category === "Tachi-waza" ? score.technique || fallback : score.neWazaType || fallback;
    return [detail, score.value].filter(Boolean).join(" · ");
  }

  function hasMatchingIpponScore(combat: CombatReadModel): boolean {
    return (combat.scores || []).some((score) => score.value === "Ippon");
  }

  function getCombatDataQualityIssues(
    combat: CombatReadModel,
    helpers: { showJudoka: boolean }
  ): CombatDataQualityIssue[] {
    const issues: CombatDataQualityIssue[] = [];
    if (!combat.victoryType) {
      issues.push({ label: "Fin du combat non renseignée", shortLabel: "fin du combat", priority: "high", field: "victoryType" });
    }
    const hasMissingIpponScore =
      combat.result === "Victoire" &&
      combat.victoryType === "Ippon" &&
      !hasMatchingIpponScore(combat);
    if (hasMissingIpponScore) {
      issues.push({ label: "Ippon indiqué, mais aucun point Ippon détaillé", shortLabel: "détail du point Ippon", priority: "high", field: "scores" });
    }
    // Une victoire aux points doit montrer au moins un point du judoka ; une défaite ou une décision n'en exige pas.
    const isVictoryOnPoints = combat.result === "Victoire" && ["Ippon", "Waza-ari", "Yuko"].includes(combat.victoryType || "");
    if (isVictoryOnPoints && !(combat.scores || []).length && !hasMissingIpponScore) {
      issues.push({ label: "Points marqués non renseignés", shortLabel: "points marqués", priority: "medium", field: "scores" });
    }
    const allPoints = [...(combat.scores || []), ...(combat.concededScores || [])];
    if (allPoints.some((score) => !(score.category === "Ne-waza" ? score.neWazaType : score.technique))) {
      issues.push({ label: "Technique d'un point non précisée", shortLabel: "technique d'un point", priority: "medium", field: "scores" });
    }
    if (helpers.showJudoka && !combat.judokaHandedness) {
      issues.push({ label: "Droitier/gaucher du judoka non renseigné", shortLabel: "garde du judoka (profil)", priority: "medium" });
    }
    if (!combat.opponentStance) {
      issues.push({ label: "Droitier/gaucher de l'adversaire non renseigné", shortLabel: "garde de l'adversaire", priority: "medium", field: "opponentStance" });
    }
    return issues;
  }

  function projectCompetitionCombats(
    combats: CombatReadModel[] | null | undefined,
    helpers: {
      formatResultat(value: unknown): string;
      normalizeDisplayName(value: unknown): string;
      showJudoka: boolean;
      canEdit: boolean;
    }
  ) {
    const { formatResultat, normalizeDisplayName } = helpers;
    const projectedCombats: CompetitionCombatCard[] = (combats || []).map((c) => ({
      combatId: c.combatId || "",
      judokaId: c.judokaId || "",
      competitionId: c.competitionId || "",
      opponent: c.opponent || "Adversaire non renseigné",
      opponentStance: c.opponentStance || "",
      stage: c.stage || "",
      judokaHandedness: c.judokaHandedness || "",
      result: formatResultat(c.result),
      resultClass: `result-${String(c.result || "").toLowerCase()}`,
      victoryType: c.victoryType || "",
      scoreLabels: (c.scores || []).map(formatCombatScoreLabel),
      concededScoreLabels: (c.concededScores || []).map(formatCombatScoreLabel),
      officialScoreLabel: formatCombatOfficialScore(c.officialScore),
      dataQualityIssues: getCombatDataQualityIssues(c, helpers),
      judokaDisplayName: normalizeDisplayName(c.judokaDisplayName || ""),
      showJudoka: Boolean(helpers.showJudoka),
      canEdit: Boolean(helpers.canEdit),
      notes: c.notes || ""
    }));

    // Quand chaque combat a son tour renseigné, on les présente dans l'ordre du tableau.
    const allStaged = projectedCombats.length > 1 && projectedCombats.every((combat) => combat.stage);
    const orderedCombats = allStaged
      ? [...projectedCombats].sort((a, b) => getCombatStageOrder(a.stage) - getCombatStageOrder(b.stage))
      : projectedCombats;

    return {
      combats: orderedCombats,
      combatsEmptyMessage: projectedCombats.length ? "" : "Aucun combat pour cette compétition.",
      hasCombats: orderedCombats.length > 0,
      isLoadingCombats: false
    };
  }

  function buildPendingCombatCard(
    op: PendingOfflineOperation,
    payload: {
      judokaId?: string;
      combatId?: string;
      opponent?: string;
      opponentStance?: string;
      stage?: string;
      result?: string;
      victoryType?: string;
      scores?: CombatReadModel["scores"];
      concededScores?: CombatReadModel["scores"];
      officialScore?: CombatReadModel["officialScore"];
      notes?: string;
    },
    helpers: {
      formatResultat(value: unknown): string;
      normalizeDisplayName(value: unknown): string;
      showJudoka: boolean;
      canEdit: boolean;
      judokas: Judoka[];
      getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
    }
  ): CompetitionCombatCard {
    const judoka = helpers.judokas.find((j) => String(j.judokaId) === String(payload.judokaId));
    const combatLike: CombatReadModel = {
      combatId: payload.combatId || op.id,
      judokaId: payload.judokaId || "",
      competitionId: op.competitionId,
      opponent: payload.opponent || "",
      opponentStance: payload.opponentStance || "",
      stage: payload.stage || "",
      result: (payload.result as CombatReadModel["result"]) || "Victoire",
      victoryType: payload.victoryType || "",
      scores: payload.scores || [],
      concededScores: payload.concededScores || [],
      officialScore: payload.officialScore || null,
      notes: payload.notes || "",
      judokaDisplayName: judoka ? helpers.getJudokaDisplayName(judoka) : "",
      judokaHandedness: judoka ? judoka.handedness : ""
    };

    return {
      combatId: combatLike.combatId,
      judokaId: combatLike.judokaId,
      competitionId: combatLike.competitionId,
      opponent: combatLike.opponent || "Adversaire non renseigné",
      opponentStance: combatLike.opponentStance || "",
      stage: combatLike.stage || "",
      judokaHandedness: combatLike.judokaHandedness || "",
      result: helpers.formatResultat(combatLike.result),
      resultClass: `result-${String(combatLike.result || "").toLowerCase()}`,
      victoryType: combatLike.victoryType || "",
      scoreLabels: (combatLike.scores || []).map(formatCombatScoreLabel),
      concededScoreLabels: (combatLike.concededScores || []).map(formatCombatScoreLabel),
      officialScoreLabel: formatCombatOfficialScore(combatLike.officialScore),
      dataQualityIssues: getCombatDataQualityIssues(combatLike, helpers),
      judokaDisplayName: helpers.normalizeDisplayName(combatLike.judokaDisplayName || ""),
      showJudoka: Boolean(helpers.showJudoka),
      canEdit: op.type === "updateCombat" && Boolean(helpers.canEdit),
      notes: combatLike.notes || "",
      pendingSync: true,
      pendingError: op.errorMessage,
      pendingOperationId: op.id
    };
  }

  /**
   * Overlays not-yet-synced `ajouterCombat`/`updateCombat` offline operations
   * onto an already-projected combat card list (OFF-007/OFF-008): updates
   * replace their target card in place, adds are appended as synthetic cards.
   */
  function mergePendingCombatCards(
    cards: CompetitionCombatCard[],
    pendingOperations: PendingOfflineOperation[] | null | undefined,
    competitionId: string,
    helpers: {
      formatResultat(value: unknown): string;
      normalizeDisplayName(value: unknown): string;
      showJudoka: boolean;
      canEdit: boolean;
      judokas: Judoka[];
      getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
    }
  ): CompetitionCombatCard[] {
    const relevantOps = (pendingOperations || []).filter(
      (op) =>
        (op.type === "ajouterCombat" || op.type === "updateCombat") &&
        op.competitionId === competitionId &&
        op.status !== "synced"
    );

    if (!relevantOps.length) {
      return cards;
    }

    let merged = cards;

    relevantOps.forEach((op) => {
      const payload = (op.payload[0] || {}) as Parameters<typeof buildPendingCombatCard>[1];
      const card = buildPendingCombatCard(op, payload, helpers);

      if (op.type === "updateCombat" && payload.combatId) {
        const index = merged.findIndex((c) => c.combatId === payload.combatId);
        if (index !== -1) {
          merged = [...merged.slice(0, index), card, ...merged.slice(index + 1)];
          return;
        }
      }

      merged = [...merged, card];
    });

    return merged;
  }

  window.KirokuScreenProjections = {
    getWeightCategoryOptions,
    getYearInCategoryOptions,
    mergePendingCombatCards,
    paginateList,
    projectCompetitionCombats,
    projectCompetitionDetail,
    projectAccessInvitations,
    projectManagedAdmins,
    projectManagedUsers
  };
})();
