(() => {
  type AccessInvitation = import("./types").AccessInvitation;
  type Competition = import("./types").Competition;
  type CompetitionCombatCard = import("./types").CompetitionCombatCard;
  type CombatReadModel = import("./types").CombatReadModel;
  type Judoka = import("./types").Judoka;
  type ManagedAdminCard = import("./types").ManagedAdminCard;
  type ManagedChildCard = import("./types").ManagedChildCard;

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

  function projectManagedChildren(
    children: Judoka[] | null | undefined,
    helpers: {
      getJudokaDisplayName(judoka: Partial<Judoka> | null | undefined): string;
      normalizeDisplayName(value: unknown): string;
      normalizeLastName(value: unknown): string;
    }
  ) {
    const { getJudokaDisplayName, normalizeDisplayName, normalizeLastName } = helpers;

    const projectedChildren: ManagedChildCard[] = (children || []).map((child) => {
      const fullName = getJudokaDisplayName(child) || "Enfant";
      return {
        judokaId: child.judokaId || "",
        fullName,
        firstName: normalizeDisplayName(child.firstName || ""),
        lastName: normalizeLastName(child.lastName || ""),
        accountEmail: child.accountEmail || "Non renseigné",
        directAccessState: child.accountEmail ? "Activée" : "Non activée"
      };
    });

    return {
      children: projectedChildren,
      hasChildren: projectedChildren.length > 0
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
      const isCurrentAdmin = currentUser && String(currentUser.judokaId) === String(admin.judokaId);
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

  function projectAccessInvitations(
    filteredInvitations: AccessInvitation[],
    search: string,
    currentPage: number,
    pageSize: number,
    helpers: { formatDateTime(value: unknown): string }
  ) {
    const { formatDateTime } = helpers;
    const totalPages = Math.max(Math.ceil(filteredInvitations.length / pageSize), 1);
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const visibleInvitations = filteredInvitations.slice(startIndex, startIndex + pageSize);

    return {
      accessInvitations: visibleInvitations.map((invitation) => ({
        email: invitation.email || "Invitation",
        invitedProfileType: invitation.invitedProfileType || "JUDOKA",
        createdAt: formatDateTime(invitation.createdAt)
      })),
      accessInvitationsSummary: `${filteredInvitations.length} invitation(s)${search ? " trouvée(s)" : ""} · page ${safeCurrentPage} / ${totalPages}.`,
      accessInvitationsEmptyMessage: search
        ? `Aucune invitation trouvée pour "${search}".`
        : "Aucune invitation en attente.",
      canResetAccessInvitationSearch: Boolean(search),
      canShowPreviousAccessInvitationPage: safeCurrentPage > 1,
      canShowNextAccessInvitationPage: safeCurrentPage < totalPages,
      hasAccessInvitations: Boolean(filteredInvitations.length)
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
      result: formatResultat(c.result),
      resultClass: `result-${String(c.result || "").toLowerCase()}`,
      victoryType: c.victoryType || "",
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
    projectAccessInvitations,
    projectCompetitionCombats,
    projectCompetitionDetail,
    projectManagedAdmins,
    projectManagedChildren
  };
})();
