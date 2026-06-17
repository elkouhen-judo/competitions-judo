(() => {
  type Competition = import("./types").Competition;
  type CompetitionCombatCard = import("./types").CompetitionCombatCard;
  type CombatReadModel = import("./types").CombatReadModel;
  type AccessInvitation = import("./types").AccessInvitation;
  type Judoka = import("./types").Judoka;
  type ManagedAdminCard = import("./types").ManagedAdminCard;
  type ManagedUserCard = import("./types").ManagedUserCard;

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

  function getUserRoleLabel(user: Judoka): string {
    const profileTypeLabel = user.profileType === "PARENT" ? "Parent" : "Judoka";
    if (user.accessRole === "ADMIN") return `Admin · ${profileTypeLabel}`;
    if (user.accessRole === "COACH") return `Coach · ${profileTypeLabel}`;
    return profileTypeLabel;
  }

  function projectManagedUsers(
    users: Judoka[] | null | undefined,
    pendingInvitations: AccessInvitation[] | null | undefined,
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
      isAdmin: user.accessRole === "ADMIN",
      isCurrentUser: Boolean(
        currentUser && String(currentUser.judokaId) === String(user.judokaId)
      ),
      isPending: false
    }));

    const pendingCards: ManagedUserCard[] = (pendingInvitations || []).map((invitation) => ({
      judokaId: "",
      fullName: invitation.email || "Invitation",
      accountEmail: invitation.email || "Non renseigné",
      roleLabel: `En attente d'inscription · ${invitation.invitedProfileType === "PARENT" ? "Parent" : "Judoka"}`,
      isAdmin: false,
      isCurrentUser: false,
      isPending: true
    }));

    const allCards = [...registeredCards, ...pendingCards];
    const normalizedSearch = (search || "").toLowerCase();
    const filteredUsers = !normalizedSearch
      ? allCards
      : allCards.filter((card) =>
          `${card.fullName} ${card.accountEmail}`.toLowerCase().includes(normalizedSearch)
        );

    const totalPages = Math.max(Math.ceil(filteredUsers.length / pageSize), 1);
    const safeCurrentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const projectedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

    return {
      users: projectedUsers,
      usersSummary: `${filteredUsers.length} utilisateur(s)${search ? " trouvé(s)" : ""} · page ${safeCurrentPage} / ${totalPages}.`,
      usersEmptyMessage: search
        ? `Aucun utilisateur trouvé pour "${search}".`
        : "Aucun utilisateur trouvé.",
      canResetUsersSearch: Boolean(search),
      canShowPreviousUsersPage: safeCurrentPage > 1,
      canShowNextUsersPage: safeCurrentPage < totalPages,
      hasUsers: Boolean(filteredUsers.length)
    };
  }

  function projectCompetitionDetail(
    competition: Competition,
    canEditCompetition: boolean,
    helpers: { formatDate(value: unknown): string }
  ) {
    const { formatDate } = helpers;
    const ageWeightLabel = [competition.ageCategory, competition.weightCategory]
      .filter(Boolean)
      .join(" - ");
    const hasResult = Boolean(String(competition.result || "").trim());

    return {
      competitionTitle: competition.name || "Compétition",
      competitionSubtitle: "Détail de la compétition",
      competitionDate: formatDate(competition.competitionDate),
      ageWeightLabel,
      competitionResult: competition.result || "",
      competitionAiAnalysis: competition.aiAnalysis || "",
      canEditCompetition,
      canFinalizeCompetition: canEditCompetition && !hasResult
    };
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
      result: formatResultat(c.result),
      resultClass: `result-${String(c.result || "").toLowerCase()}`,
      victoryType: c.victoryType || "",
      techniqueCategory: c.techniqueCategory || "",
      judokaDisplayName: normalizeDisplayName(c.judokaDisplayName || ""),
      showJudoka: Boolean(helpers.showJudoka),
      canEdit: Boolean(helpers.canEdit),
      notes: c.notes || "Aucun déroulé renseigné"
    }));

    return {
      combats: projectedCombats,
      combatsEmptyMessage: projectedCombats.length ? "" : "Aucun combat pour cette compétition.",
      hasCombats: projectedCombats.length > 0,
      isLoadingCombats: false
    };
  }

  window.KirokuScreenProjections = {
    paginateList,
    projectCompetitionCombats,
    projectCompetitionDetail,
    projectManagedAdmins,
    projectManagedUsers
  };
})();
