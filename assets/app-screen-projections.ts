(() => {
  type Competition = import("./types").Competition;
  type CompetitionCombatCard = import("./types").CompetitionCombatCard;
  type CombatReadModel = import("./types").CombatReadModel;
  type AccessInvitation = import("./types").AccessInvitation;
  type Judoka = import("./types").Judoka;
  type ManagedAdminCard = import("./types").ManagedAdminCard;
  type ManagedUserCard = import("./types").ManagedUserCard;
  type PendingOfflineOperation = import("./types").PendingOfflineOperation;
  type PresenceProjection = import("./types").PresenceProjection;

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

  function getManagedUserFlag(user: Judoka, currentSeasonStartYear: number): string {
    if (user.profileType !== "JUDOKA" || user.accessRole === "COACH") return "";
    if (!user.clubId) return "Sans club";
    const season = Number(user.registrationSeason || 0);
    return currentSeasonStartYear && season < currentSeasonStartYear ? "Non réinscrit" : "";
  }

  function projectManagedUsers(
    users: Judoka[] | null | undefined,
    totalCount: number,
    search: string,
    currentPage: number,
    pageSize: number,
    currentUser: Judoka | null | undefined,
    helpers: { getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string },
    currentSeasonStartYear = 0
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
      clubIds: Array.isArray(user.clubIds) && user.clubIds.length ? user.clubIds : user.clubId ? [user.clubId] : [],
      canHaveClub: user.profileType !== "PARENT",
      // ADMIN-1 : un judoka avec e-mail peut être nommé coach ; un parent jamais.
      isCoach: user.accessRole === "COACH",
      canBeCoach: user.profileType !== "PARENT" && Boolean(user.accountEmail) && user.accessRole !== "COACH",
      ageCategory: user.profileType === "PARENT" ? "" : user.ageCategory || "",
      flag: getManagedUserFlag(user, currentSeasonStartYear)
    }));

    // PAGE-3 : la recherche et le total viennent du serveur ; `users` contient les pages déjà lues.
    const total = Math.max(Number(totalCount) || 0, registeredCards.length);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    // ADMIN-3 : « Afficher plus » ajoute la page suivante sous les précédentes.
    const projectedUsers = registeredCards.slice(0, startIndex + pageSize);

    return {
      users: projectedUsers,
      usersSummary: `${total} utilisateur${total > 1 ? "s" : ""}${search ? ` trouvé${total > 1 ? "s" : ""}` : ""}.`,
      usersEmptyMessage: search
        ? `Aucun utilisateur trouvé pour « ${search} ».`
        : "Aucun utilisateur trouvé.",
      canResetUsersSearch: Boolean(search),
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
      clubIds: [],
      canHaveClub: false,
      isCoach: false,
      canBeCoach: false,
      ageCategory: "",
      flag: ""
    }));
    const normalizedSearch = (search || "").toLowerCase();
    const filteredInvitations = !normalizedSearch
      ? invitationCards
      : invitationCards.filter((card) => card.accountEmail.toLowerCase().includes(normalizedSearch));
    const invitationCount = filteredInvitations.length;
    const totalPages = Math.max(Math.ceil(invitationCount / pageSize), 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;

    return {
      invitations: filteredInvitations.slice(startIndex, startIndex + pageSize),
      invitationsSummary: `${invitationCount} invitation${invitationCount > 1 ? "s" : ""}${search ? ` trouvée${invitationCount > 1 ? "s" : ""}` : ""} · page ${safeCurrentPage} / ${totalPages}.`,
      invitationsEmptyMessage: search
        ? `Aucune invitation trouvée pour « ${search} ».`
        : "Aucune invitation en attente.",
      canShowPreviousInvitationsPage: safeCurrentPage > 1,
      canShowNextInvitationsPage: safeCurrentPage < totalPages,
      hasInvitations: Boolean(filteredInvitations.length)
    };
  }

  const COMBAT_STAGE_ORDER = ["Poule", "1/32", "1/16", "1/8", "1/4", "1/2", "Repêchage", "Place de 3", "Finale"];

  // SAISIE-6 : les tours en mots de parents ; la valeur enregistrée (1/4, 1/2, Place de 3) ne change pas.
  const COMBAT_STAGE_LABELS: Record<string, string> = {
    "1/4": "Quart de finale",
    "1/2": "Demi-finale",
    "Place de 3": "Combat pour la 3e place"
  };

  function formatCombatStage(stage: unknown): string {
    const value = String(stage || "");
    return COMBAT_STAGE_LABELS[value] || value;
  }

  // FICHE-7 : V, D ou N, pour lire le résultat sans la couleur.
  function getResultLetter(result: unknown): string {
    const value = String(result || "");
    if (value === "Victoire" || value === "V") return "V";
    if (value === "Défaite" || value === "D") return "D";
    return value ? "N" : "";
  }

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

  // COMBAT-SCORE / SAISIE-7 : score en clair, « Hugo : 1 Ippon, 1 Waza-ari · Adversaire : 1 Shido »,
  // sans compteur à zéro ; vide si le score n'est pas renseigné.
  function formatCombatOfficialScore(score: CombatReadModel["officialScore"], judokaName = ""): string {
    if (!score) return "";
    const side = (value: { ippon: number; wazaAri: number; yuko: number; shido?: number }) => {
      const counts: Array<[number, string]> = [
        [Number(value.ippon || 0), "Ippon"],
        [Number(value.wazaAri || 0), "Waza-ari"],
        [Number(value.yuko || 0), "Yuko"],
        [Number(value.shido || 0), Number(value.shido || 0) > 1 ? "Shidos" : "Shido"]
      ];
      return counts
        .filter(([count]) => count > 0)
        .map(([count, label]) => `${count} ${label}`)
        .join(", ");
    };
    const judokaShidos = Number(score.judoka.shido || 0);
    const opponentShidos = Number(score.opponent.shido || 0);
    // SCORE-VIDE : un score entièrement nul vaut « non renseigné » (combat en attente compris).
    const total = [score.judoka, score.opponent].reduce(
      (sum, value) => sum + Number(value.ippon || 0) + Number(value.wazaAri || 0) + Number(value.yuko || 0),
      judokaShidos + opponentShidos
    );
    if (!total) return "";
    const firstName = String(judokaName || "").trim().split(/\s+/)[0] || "Judoka";
    const judokaSide = side(score.judoka);
    const opponentSide = side(score.opponent);
    return [judokaSide && `${firstName} : ${judokaSide}`, opponentSide && `Adversaire : ${opponentSide}`]
      .filter(Boolean)
      .join(" · ");
  }

  function formatCombatScoreLabel(score: { category?: string; technique?: string; neWazaType?: string; value?: string }): string {
    const fallback = score.category === "Tachi-waza" ? "Debout" : score.category === "Ne-waza" ? "Au sol" : "Technique non renseignée";
    const detail = score.category === "Tachi-waza" ? score.technique || fallback : score.neWazaType || fallback;
    return [detail, score.value].filter(Boolean).join(" · ");
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
      stageLabel: formatCombatStage(c.stage),
      judokaHandedness: c.judokaHandedness || "",
      result: formatResultat(c.result),
      resultClass: `result-${String(c.result || "").toLowerCase()}`,
      resultLetter: getResultLetter(c.result),
      victoryType: c.victoryType || "",
      scoreLabels: (c.scores || []).map(formatCombatScoreLabel),
      concededScoreLabels: (c.concededScores || []).map(formatCombatScoreLabel),
      officialScoreLabel: formatCombatOfficialScore(c.officialScore, normalizeDisplayName(c.judokaDisplayName || "")),
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
      stageLabel: formatCombatStage(combatLike.stage),
      judokaHandedness: combatLike.judokaHandedness || "",
      result: helpers.formatResultat(combatLike.result),
      resultClass: `result-${String(combatLike.result || "").toLowerCase()}`,
      resultLetter: getResultLetter(combatLike.result),
      victoryType: combatLike.victoryType || "",
      scoreLabels: (combatLike.scores || []).map(formatCombatScoreLabel),
      concededScoreLabels: (combatLike.concededScores || []).map(formatCombatScoreLabel),
      officialScoreLabel: formatCombatOfficialScore(
        combatLike.officialScore,
        helpers.normalizeDisplayName(combatLike.judokaDisplayName || "")
      ),
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

  // CONV-002 : même règle que le serveur. Une famille répond jusqu'à la date limite incluse, ou
  // jusqu'au jour de la compétition inclus sans date limite ; le coach du club corrige à tout moment.
  function projectPresence(
    competition: Pick<Competition, "clubCompetitionId" | "competitionDate" | "presence" | "convocation"> | null | undefined,
    today: string,
    isClubCoach: boolean
  ): PresenceProjection {
    const convocation = competition && competition.clubCompetitionId ? competition.convocation : null;
    if (!competition || !convocation) {
      return { isAsked: false, isOpen: false, canAnswer: false, presence: "", responseDeadline: "" };
    }
    const deadline = convocation.responseDeadline;
    const isOpen = deadline ? today <= deadline : today <= competition.competitionDate;
    return {
      isAsked: true,
      isOpen,
      canAnswer: isOpen || isClubCoach,
      presence: competition.presence || "",
      responseDeadline: deadline
    };
  }

  window.KirokuScreenProjections = {
    formatCombatStage,
    projectPresence,
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
